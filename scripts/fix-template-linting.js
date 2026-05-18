#!/usr/bin/env node

/**
 * fix-template-linting.js
 * Automatically adds eslint-disable comments to templates with known migration-related linting issues
 * 
 * This script identifies common linting issues in Angular templates during migration and
 * adds appropriate disable comments, rather than fixing the underlying issues immediately.
 * This is useful during migration when you want to:
 * 1. Get the project building first
 * 2. Address linting issues iteratively after migration
 * 
 * Supports all HTML template files including themed variants (.b2c.html, .b2b.html, etc.)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

// Common migration-related linting rules that can be safely suppressed temporarily
const SUPPRESSIBLE_RULES = {
  '@angular-eslint/template/no-call-expression': {
    description: 'Function calls in templates (common in migrated code)',
    comment: '<!-- eslint-disable-next-line @angular-eslint/template/no-call-expression -->',
    pattern: /\(.*\(.*\).*\)/
  },
  '@angular-eslint/template/no-negated-async': {
    description: 'Negated async pipe (!(observable | async))',
    comment: '<!-- eslint-disable-next-line @angular-eslint/template/no-negated-async -->',
    pattern: /!\s*\(/
  },
  '@angular-eslint/template/eqeqeq': {
    description: 'Using == instead of === in templates',
    comment: '<!-- eslint-disable-next-line @angular-eslint/template/eqeqeq -->',
    pattern: /[^=!]={2}[^=]/
  },
  '@angular-eslint/template/no-any': {
    description: 'Using $any() type cast in templates',
    comment: '<!-- eslint-disable-next-line @angular-eslint/template/no-any -->',
    pattern: /\$any\(/
  }
};

class TemplateLintingFixer {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
    this.filesFixed = 0;
    this.issuesFixed = 0;
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
   * Get all template files (including themed variants like .b2c.html, .b2b.html)
   */
  getTemplateFiles() {
    try {
      // Find all HTML template files including themed variants
      // Pattern matches: *.html (includes .component.html, .component.b2c.html, etc.)
      const output = execSync('find src -name "*.html" -type f', {
        encoding: 'utf8'
      });
      return output.trim().split('\n').filter(f => f);
    } catch (err) {
      this.printError('Failed to find template files');
      return [];
    }
  }

  /**
   * Get linting errors for a specific file
   */
  getLintingErrors(filePath) {
    try {
      execSync(`npx eslint "${filePath}" --format json`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      return []; // No errors
    } catch (err) {
      try {
        const output = err.stdout || err.stderr || '[]';
        const results = JSON.parse(output);
        if (results.length > 0) {
          return results[0].messages || [];
        }
      } catch (parseErr) {
        // If JSON parsing fails, try to extract errors manually
        return this.extractErrorsFromOutput(err.stdout || err.stderr || '');
      }
      return [];
    }
  }

  /**
   * Extract errors from non-JSON eslint output
   */
  extractErrorsFromOutput(output) {
    const errors = [];
    const lines = output.split('\n');
    
    lines.forEach(line => {
      // Match format: "  10:15  error  Message  rule-name"
      const match = line.match(/^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+([@\w/-]+)$/);
      if (match) {
        errors.push({
          line: parseInt(match[1]),
          column: parseInt(match[2]),
          severity: match[3] === 'error' ? 2 : 1,
          message: match[4].trim(),
          ruleId: match[5]
        });
      }
    });
    
    return errors;
  }

  /**
   * Add disable comment to a specific line in file
   */
  addDisableComment(filePath, lineNumber, ruleId) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    if (lineNumber < 1 || lineNumber > lines.length) {
      return false;
    }
    
    const targetLine = lines[lineNumber - 1];
    const ruleInfo = SUPPRESSIBLE_RULES[ruleId];
    
    if (!ruleInfo) {
      return false; // Unknown rule, don't suppress
    }
    
    // Check if comment already exists
    const prevLine = lineNumber > 1 ? lines[lineNumber - 2] : '';
    if (prevLine.includes('eslint-disable') && prevLine.includes(ruleId)) {
      return false; // Already has disable comment
    }
    
    // Detect indentation
    const indent = targetLine.match(/^(\s*)/)[1];
    
    // Insert disable comment on previous line
    lines.splice(lineNumber - 1, 0, `${indent}${ruleInfo.comment}`);
    
    if (!this.dryRun) {
      fs.writeFileSync(filePath, lines.join('\n'));
    }
    
    return true;
  }

  /**
   * Process a single template file
   */
  processFile(filePath) {
    if (this.verbose) {
      this.print(`Checking ${filePath}...`);
    }
    
    const errors = this.getLintingErrors(filePath);
    
    if (errors.length === 0) {
      return 0;
    }
    
    let fixedCount = 0;
    
    // Process errors in reverse order (bottom to top) to maintain line numbers
    const sortedErrors = errors
      .filter(err => SUPPRESSIBLE_RULES[err.ruleId])
      .sort((a, b) => b.line - a.line);
    
    sortedErrors.forEach(error => {
      if (this.verbose) {
        this.print(`  Line ${error.line}: ${error.message} (${error.ruleId})`);
      }
      
      if (this.addDisableComment(filePath, error.line, error.ruleId)) {
        fixedCount++;
        this.issuesFixed++;
      }
    });
    
    if (fixedCount > 0) {
      this.filesFixed++;
      this.printSuccess(`Fixed ${fixedCount} issues in ${filePath}`);
    }
    
    return fixedCount;
  }

  /**
   * Run the fixer
   */
  run() {
    this.printHeader('🔧 Template Linting Auto-Fixer');
    
    if (this.dryRun) {
      this.printWarning('DRY RUN MODE - No files will be modified');
    }
    
    this.printSection('Suppressible Rules');
    Object.entries(SUPPRESSIBLE_RULES).forEach(([rule, info]) => {
      this.print(`  • ${rule}`);
      this.print(`    ${info.description}`);
    });
    
    this.printSection('Finding Template Files');
    const templateFiles = this.getTemplateFiles();
    this.print(`Found ${templateFiles.length} template files`);
    
    this.printSection('Processing Templates');
    templateFiles.forEach(file => this.processFile(file));
    
    this.printSection('Summary');
    this.print(`Files modified: ${this.filesFixed}`);
    this.print(`Issues suppressed: ${this.issuesFixed}`);
    
    if (this.issuesFixed > 0) {
      this.printSection('Next Steps');
      this.print('1. Review the added eslint-disable comments');
      this.print('2. Run linting again: npm run lint');
      this.print('3. Consider fixing the underlying issues after migration stabilizes');
      this.print('4. Commit changes: git add . && git commit -m "chore: suppress template linting issues"');
    } else {
      this.printSuccess('No suppressible linting issues found!');
    }
    
    return this.issuesFixed;
  }
}

// CLI
function showUsage() {
  console.log(`
Usage: node fix-template-linting.js [OPTIONS]

Automatically add eslint-disable comments to templates with migration-related linting issues.

OPTIONS:
  --dry-run          Show what would be changed without modifying files
  --verbose          Show detailed processing information
  -h, --help         Show this help message

EXAMPLES:
  # Run in dry-run mode to see what would be changed
  node fix-template-linting.js --dry-run

  # Apply suppressions
  node fix-template-linting.js

  # Verbose mode
  node fix-template-linting.js --verbose

SUPPRESSED RULES:
  • @angular-eslint/template/no-call-expression
  • @angular-eslint/template/no-negated-async
  • @angular-eslint/template/eqeqeq
  • @angular-eslint/template/no-any

NOTE: This tool suppresses linting rules temporarily to help during migration.
Consider fixing the underlying issues after the migration is complete.
`);
}

// Parse arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose') || args.includes('-v')
};

if (args.includes('-h') || args.includes('--help')) {
  showUsage();
  process.exit(0);
}

// Run
const fixer = new TemplateLintingFixer(options);
const issuesFixed = fixer.run();

process.exit(issuesFixed > 0 ? 0 : 0); // Exit 0 either way (success)
