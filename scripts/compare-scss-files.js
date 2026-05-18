#!/usr/bin/env node

/**
 * compare-scss-files.js
 * Compare SCSS files between custom PWA and new PWA to identify missing properties
 * 
 * This script helps identify SCSS properties, variables, and mixins that exist in the new PWA
 * but are missing in custom SCSS files, helping avoid build errors and missing styles.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

class SCSSComparator {
  constructor(options = {}) {
    const { projectDir } = require('./_project-dir');
    this.projectRoot = projectDir;
    this.verbose = options.verbose || false;
    this.autoFix = options.autoFix || false;
    this.dryRun = options.dryRun || false;
    this.scssDir = options.scssDir || path.join(projectDir, 'src/styles');
    this.comparisons = [];
  }

  print(msg, color = RESET) {
    console.log(`${color}${msg}${RESET}`);
  }

  printHeader(msg) {
    this.print(`\n${'━'.repeat(80)}`, BLUE);
    this.print(msg, BLUE);
    this.print('━'.repeat(80), BLUE);
  }

  printSection(msg) {
    this.print(`\n▶ ${msg}`, YELLOW);
  }

  printSuccess(msg) {
    this.print(`✓ ${msg}`, GREEN);
  }

  printWarning(msg) {
    this.print(`⚠ ${msg}`, YELLOW);
  }

  printError(msg) {
    this.print(`✗ ${msg}`, RED);
  }

  /**
   * Find SCSS files for comparison
   */
  findSCSSFiles(directory = this.scssDir) {
    if (!fs.existsSync(directory)) {
      return [];
    }

    try {
      const output = execSync(`find ${directory} -name "*.scss"`, {
        encoding: 'utf8'
      });
      return output.trim().split('\n').filter(f => f);
    } catch (err) {
      this.printError(`Failed to find SCSS files in ${directory}`);
      return [];
    }
  }

  /**
   * Parse SCSS file for variables, mixins, and classes
   */
  parseSCSSFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    const variables = [];
    const mixins = [];
    const classes = [];
    const imports = [];
    const uses = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Variables: $variable-name
      if (trimmed.match(/^\$[\w-]+\s*:/)) {
        const match = trimmed.match(/^\$([\w-]+)/);
        if (match) {
          variables.push({
            name: match[1],
            line: index + 1,
            value: trimmed
          });
        }
      }
      
      // Mixins: @mixin name
      if (trimmed.match(/^@mixin\s+[\w-]+/)) {
        const match = trimmed.match(/^@mixin\s+([\w-]+)/);
        if (match) {
          mixins.push({
            name: match[1],
            line: index + 1,
            declaration: trimmed
          });
        }
      }
      
      // Classes: .class-name
      if (trimmed.match(/^\.[\w-]+/)) {
        const match = trimmed.match(/^\.([\w-]+)/);
        if (match) {
          classes.push({
            name: match[1],
            line: index + 1
          });
        }
      }
      
      // Imports: @import
      if (trimmed.match(/^@import/)) {
        imports.push({
          line: index + 1,
          statement: trimmed
        });
      }
      
      // Uses: @use (Sass modules)
      if (trimmed.match(/^@use/)) {
        uses.push({
          line: index + 1,
          statement: trimmed
        });
      }
    });

    return { variables, mixins, classes, imports, uses };
  }

  /**
   * Compare two SCSS files
   */
  compareFiles(customFile, pwaFile) {
    if (!fs.existsSync(customFile)) {
      this.printWarning(`Custom file not found: ${customFile}`);
      return null;
    }

    if (!fs.existsSync(pwaFile)) {
      this.printWarning(`PWA file not found: ${pwaFile}`);
      return null;
    }

    const customParsed = this.parseSCSSFile(customFile);
    const pwaParsed = this.parseSCSSFile(pwaFile);

    // Find missing elements
    const missingVariables = pwaParsed.variables.filter(pwaVar => 
      !customParsed.variables.find(customVar => customVar.name === pwaVar.name)
    );

    const missingMixins = pwaParsed.mixins.filter(pwaMixin =>
      !customParsed.mixins.find(customMixin => customMixin.name === pwaMixin.name)
    );

    const missingImports = pwaParsed.uses.filter(pwaUse =>
      !customParsed.uses.find(customUse => customUse.statement === pwaUse.statement) &&
      !customParsed.imports.find(customImport => {
        // Check if import covers the same module
        const pwaModule = pwaUse.statement.match(/@use\s+['"]([^'"]+)['"]/);
        const importModule = customImport.statement.match(/@import\s+['"]([^'"]+)['"]/);
        return pwaModule && importModule && pwaModule[1].includes(importModule[1]);
      })
    );

    return {
      customFile,
      pwaFile,
      missingVariables,
      missingMixins,
      missingImports,
      customParsed,
      pwaParsed
    };
  }

  /**
   * Get corresponding PWA file for a custom file
   */
  getPWAFilePath(customFilePath) {
    // Assuming git merge scenario where we can access theirs version
    try {
      execSync(`git show :2:${customFilePath}`, { stdio: 'pipe' });
      return `:2:${customFilePath}`; // Git stage 2 (theirs)
    } catch (err) {
      // Not in merge, try to find corresponding file in standard structure
      return customFilePath;
    }
  }

  /**
   * Add missing properties to custom file
   */
  addMissingProperties(customFile, missingVariables, missingMixins, missingImports) {
    if (this.dryRun) {
      this.printWarning('DRY RUN: Would add missing properties');
      return false;
    }

    const content = fs.readFileSync(customFile, 'utf8');
    let lines = content.split('\n');

    // Create backup
    const backupFile = `${customFile}.backup.${Date.now()}`;
    fs.writeFileSync(backupFile, content);
    this.printSuccess(`Backup created: ${backupFile}`);

    // Add missing @use imports at the beginning (after any existing @use statements)
    if (missingImports.length > 0) {
      const lastUseIndex = lines.findIndex((line, idx) => {
        const nextLine = lines[idx + 1];
        return line.match(/^@use/) && (!nextLine || !nextLine.match(/^@use/));
      });

      const insertIndex = lastUseIndex >= 0 ? lastUseIndex + 1 : 0;

      missingImports.forEach(imp => {
        lines.splice(insertIndex, 0, `${imp.statement} // Added by migration`);
      });
    }

    // Add missing variables (find a good insertion point)
    if (missingVariables.length > 0) {
      // Find the last variable definition
      let lastVarIndex = -1;
      lines.forEach((line, idx) => {
        if (line.trim().match(/^\$/)) {
          lastVarIndex = idx;
        }
      });

      // If no variables found, add after imports
      if (lastVarIndex === -1) {
        lastVarIndex = lines.findIndex(line => !line.match(/^@(use|import)/));
      }

      // Add comment header
      lines.splice(lastVarIndex + 1, 0, '');
      lines.splice(lastVarIndex + 2, 0, '// Variables added during migration from new PWA version');
      
      let insertIdx = lastVarIndex + 3;
      missingVariables.forEach(variable => {
        lines.splice(insertIdx, 0, variable.value);
        insertIdx++;
      });
    }

    // Add missing mixins
    if (missingMixins.length > 0) {
      lines.push('');
      lines.push('// Mixins added during migration from new PWA version');
      missingMixins.forEach(mixin => {
        lines.push(mixin.declaration);
        lines.push('  // TODO: Add mixin body from PWA version');
        lines.push('}');
        lines.push('');
      });
    }

    fs.writeFileSync(customFile, lines.join('\n'));
    return true;
  }

  /**
   * Run comparison
   */
  run(targetFile = null) {
    this.printHeader('🎨 SCSS File Comparator');

    if (this.dryRun) {
      this.printWarning('DRY RUN MODE - No files will be modified');
    }

    // Find files to compare
    let filePairs = [];

    if (targetFile) {
      // Compare specific file
      this.printSection(`Comparing: ${targetFile}`);
      const pwaFile = this.getPWAFilePath(targetFile);
      filePairs.push({ custom: targetFile, pwa: pwaFile });
    } else {
      // Compare common SCSS files
      this.printSection('Finding SCSS Files');
      
      const commonFiles = [
        'src/styles/themes/variables.scss',
        'src/styles/themes/b2b/variables.scss',
        'src/styles/themes/b2c/variables.scss'
      ];

      // Find all custom theme directories
      const themesDir = 'src/styles/themes';
      if (fs.existsSync(themesDir)) {
        const themes = fs.readdirSync(themesDir).filter(f => {
          const fullPath = path.join(themesDir, f);
          return fs.statSync(fullPath).isDirectory() && 
                 !['b2b', 'b2c'].includes(f);
        });

        themes.forEach(theme => {
          const customVars = `src/styles/themes/${theme}/variables.scss`;
          const pwaVars = 'src/styles/themes/b2b/variables.scss';
          if (fs.existsSync(customVars)) {
            filePairs.push({ custom: customVars, pwa: pwaVars });
          }
        });
      }
    }

    if (filePairs.length === 0) {
      this.printWarning('No SCSS files found to compare');
      return;
    }

    this.printSection('Comparing Files');
    
    filePairs.forEach(({ custom, pwa }) => {
      this.print(`\nComparing: ${custom}`, CYAN);
      
      const comparison = this.compareFiles(custom, pwa);
      
      if (!comparison) {
        return;
      }

      this.comparisons.push(comparison);

      // Display results
      if (comparison.missingVariables.length > 0) {
        this.printWarning(`Missing ${comparison.missingVariables.length} variables:`);
        comparison.missingVariables.slice(0, 10).forEach(v => {
          this.print(`  • $${v.name}`, YELLOW);
        });
        if (comparison.missingVariables.length > 10) {
          this.print(`  ... and ${comparison.missingVariables.length - 10} more`, YELLOW);
        }
      } else {
        this.printSuccess('All variables present');
      }

      if (comparison.missingMixins.length > 0) {
        this.printWarning(`Missing ${comparison.missingMixins.length} mixins:`);
        comparison.missingMixins.forEach(m => {
          this.print(`  • @mixin ${m.name}`, YELLOW);
        });
      }

      if (comparison.missingImports.length > 0) {
        this.printWarning(`Missing ${comparison.missingImports.length} imports:`);
        comparison.missingImports.forEach(imp => {
          this.print(`  • ${imp.statement}`, YELLOW);
        });
      }

      // Auto-fix if requested
      if (this.autoFix && (comparison.missingVariables.length > 0 || 
                           comparison.missingMixins.length > 0 ||
                           comparison.missingImports.length > 0)) {
        this.printSection(`Auto-fixing: ${custom}`);
        this.addMissingProperties(
          custom,
          comparison.missingVariables,
          comparison.missingMixins,
          comparison.missingImports
        );
        this.printSuccess('Properties added');
      }
    });

    // Summary
    this.printSection('Summary');
    
    const totalMissingVars = this.comparisons.reduce((sum, c) => sum + c.missingVariables.length, 0);
    const totalMissingMixins = this.comparisons.reduce((sum, c) => sum + c.missingMixins.length, 0);
    const totalMissingImports = this.comparisons.reduce((sum, c) => sum + c.missingImports.length, 0);

    this.print(`Files compared: ${this.comparisons.length}`);
    this.print(`Missing variables: ${totalMissingVars}`);
    this.print(`Missing mixins: ${totalMissingMixins}`);
    this.print(`Missing imports: ${totalMissingImports}`);

    if (totalMissingVars + totalMissingMixins + totalMissingImports > 0) {
      this.printSection('Next Steps');
      
      if (this.autoFix) {
        this.print('1. Review the added properties in your SCSS files');
        this.print('2. Adjust values to match your brand if needed');
        this.print('3. Test with: npm run build');
      } else {
        this.print('To automatically add missing properties:');
        this.print('  node scripts/compare-scss-files.js --auto-fix');
        this.print('');
        this.print('Or manually copy properties from PWA version');
       }
      
      this.print('');
      this.print('4. Commit changes: git add . && git commit -m "style: add missing SCSS properties"');
    } else {
      this.printSuccess('No missing properties detected!');
    }
  }
}

// CLI
function showUsage() {
  console.log(`
Usage: node compare-scss-files.js [OPTIONS] [FILE]

Compare SCSS files between custom PWA and new PWA to identify missing properties.

ARGUMENTS:
  FILE               Specific SCSS file to compare (optional)

OPTIONS:
  --auto-fix         Automatically add missing properties to custom files
  --dry-run          Show what would be changed without modifying files
  --verbose          Show detailed processing information
  --scss-dir DIR     Directory containing SCSS files (default: src/styles)
  -h, --help         Show this help message

EXAMPLES:
  # Compare all theme variable files
  node compare-scss-files.js

  # Compare specific file
  node compare-scss-files.js src/styles/themes/custom/variables.scss

  # Auto-fix missing properties
  node compare-scss-files.js --auto-fix

  # Preview changes without modifying files
  node compare-scss-files.js --dry-run

WORKFLOW:
  1. Run comparison to identify missing properties
  2. Review the list of missing variables/mixins
  3. Use --auto-fix to add them automatically (or manually)
  4. Adjust values to match your brand
  5. Test with npm run build
`);
}

// Parse arguments
const args = process.argv.slice(2);
const options = {
  autoFix: args.includes('--auto-fix'),
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose') || args.includes('-v'),
  scssDir: args.includes('--scss-dir') ? args[args.indexOf('--scss-dir') + 1] : 'src/styles'
};

if (args.includes('-h') || args.includes('--help')) {
  showUsage();
  process.exit(0);
}

// Get target file if specified
const targetFile = args.find(arg => arg.endsWith('.scss') && !arg.startsWith('--'));

// Run
const comparator = new SCSSComparator(options);
comparator.run(targetFile);
