#!/usr/bin/env node

/**
 * SCSS Theme Variable Synchronizer
 *
 * Syncs missing SCSS variables from reference theme (b2b) to custom themes
 * while preserving existing custom values. Prevents the "build-fix-rebuild" cycle.
 *
 * Usage:
 *   node scripts/sync-custom-theme-variables.js              # Sync all custom themes
 *   node scripts/sync-custom-theme-variables.js training      # Sync specific theme
 *   node scripts/sync-custom-theme-variables.js --project-dir <path>
 */

const fs = require('fs');
const path = require('path');
const { projectDir } = require('./_project-dir');
const { log, chalk } = require('./_utils');

process.chdir(projectDir);

const THEMES_DIR = path.join(projectDir, 'src', 'styles', 'themes');
const REFERENCE_THEME = 'b2b';
const STANDARD_THEMES = ['b2b', 'b2c'];
const REQUIRED_IMPORTS = ["@use 'sass:color';", "@use 'sass:map';"];

// Parse target theme from args (skip --project-dir and its value)
let targetTheme = '';
for (const arg of process.argv.slice(2)) {
  if (arg === '--project-dir') continue;
  if (!arg.startsWith('-')) { targetTheme = arg; break; }
}

// Validate
if (!fs.existsSync(THEMES_DIR)) {
  log.error(`Themes directory not found: ${THEMES_DIR}`);
  process.exit(1);
}

const referenceFile = path.join(THEMES_DIR, REFERENCE_THEME, 'variables.scss');
if (!fs.existsSync(referenceFile)) {
  log.error(`Reference theme not found: ${referenceFile}`);
  process.exit(1);
}

log.header('🔧 PWA Theme Variable Synchronizer');
console.log(`Reference theme: ${REFERENCE_THEME}`);
console.log();

// Determine which themes to sync
const themesToSync = [];

if (targetTheme) {
  const themeDir = path.join(THEMES_DIR, targetTheme);
  if (!fs.existsSync(themeDir)) {
    log.error(`Theme not found: ${targetTheme}`);
    process.exit(1);
  }
  if (STANDARD_THEMES.includes(targetTheme)) {
    log.warning(`${targetTheme} is a standard theme - sync not needed`);
    process.exit(0);
  }
  themesToSync.push(targetTheme);
} else {
  // Find all custom themes
  for (const entry of fs.readdirSync(THEMES_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && !STANDARD_THEMES.includes(entry.name)) {
      themesToSync.push(entry.name);
    }
  }
}

if (themesToSync.length === 0) {
  log.success('No custom themes to sync');
  process.exit(0);
}

console.log(chalk.blue('Themes to sync:'));
for (const theme of themesToSync) {
  console.log(`  - ${theme}`);
}
console.log();
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log();

// Extract variable names from reference theme
const referenceContent = fs.readFileSync(referenceFile, 'utf-8');
const referenceVarNames = [...new Set(
  (referenceContent.match(/^\$[a-zA-Z0-9_-]+/gm) || [])
)];

let exitCode = 0;

// Process each theme
for (const theme of themesToSync) {
  const themeFile = path.join(THEMES_DIR, theme, 'variables.scss');

  if (!fs.existsSync(themeFile)) {
    log.error(`Theme file not found: ${themeFile}`);
    exitCode = 1;
    continue;
  }

  console.log(chalk.yellow(`Processing: ${theme}`));

  // Create backup
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFile = `${themeFile}.backup-${timestamp}`;
  fs.copyFileSync(themeFile, backupFile);
  console.log(`  Backup created: ${backupFile}`);

  let content = fs.readFileSync(themeFile, 'utf-8');
  const missingVars = [];
  let addedImports = 0;
  let addedVars = 0;

  // Check and add missing Sass imports
  for (const imp of REQUIRED_IMPORTS) {
    if (!content.includes(imp)) {
      missingVars.push(`IMPORT: ${imp}`);
      addedImports++;
      if (content.includes('@use')) {
        // Add after last @use statement
        const lastUseIdx = content.lastIndexOf('@use');
        const lineEnd = content.indexOf('\n', lastUseIdx);
        content = content.slice(0, lineEnd + 1) + imp + '\n' + content.slice(lineEnd + 1);
      } else {
        content = imp + '\n' + content;
      }
    }
  }

  // Check each variable from reference theme
  for (const varName of referenceVarNames) {
    const varRegex = new RegExp(`^\\${varName}\\b`, 'm');
    if (!varRegex.test(content)) {
      missingVars.push(varName);

      // Extract full variable definition from reference
      const defMatch = referenceContent.match(new RegExp(`^\\${varName}[^\n]*`, 'm'));
      if (defMatch) {
        if (addedVars === 0) {
          const today = new Date().toISOString().slice(0, 10);
          content += `\n\n// Variables auto-synced from ${REFERENCE_THEME} theme (${today})\n`;
        }
        content += defMatch[0] + '\n';
        addedVars++;
      }
    }
  }

  // Write updated content
  if (missingVars.length > 0) {
    fs.writeFileSync(themeFile, content);
    console.log(chalk.yellow(`  ⚠️  Found ${missingVars.length} missing items`));
    exitCode = 1;

    if (addedImports > 0) {
      console.log(chalk.green(`  ✓ Added ${addedImports} Sass imports`));
    }
    if (addedVars > 0) {
      console.log(chalk.green(`  ✓ Added ${addedVars} variables`));
    }

    console.log();
    console.log('  Missing items (showing first 10):');
    for (const v of missingVars.slice(0, 10)) {
      if (v.startsWith('IMPORT:')) {
        console.log(chalk.yellow(`    [IMPORT] ${v.replace('IMPORT: ', '')}`));
      } else {
        console.log(`    ${v}`);
      }
    }
    if (missingVars.length > 10) {
      console.log(`    ... and ${missingVars.length - 10} more`);
    }
    console.log();
    console.log(chalk.blue('  📝 Action required:'));
    console.log(`     1. Review auto-added variables in ${themeFile}`);
    console.log("     2. Adjust values for your theme's color scheme");
    console.log('     3. Run validation: node scripts/validate-theme-completeness.js');
    console.log();
  } else {
    console.log(chalk.green('  ✅ Theme is already complete'));
    // Remove backup if no changes
    fs.unlinkSync(backupFile);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();
}

// Final summary
console.log();
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(chalk.blue('📊 Sync Summary'));
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (exitCode === 0) {
  log.success('All themes synchronized successfully');
} else {
  log.warning('Some themes were updated');
  console.log();
  console.log('Next steps:');
  console.log('  1. Review changes in each theme file');
  console.log('  2. Customize variable values for your brand');
  console.log('  3. Run validation:');
  console.log('     node scripts/validate-theme-completeness.js');
  console.log('  4. Test build:');
  console.log('     npm run build');
}

console.log();
process.exit(exitCode);
