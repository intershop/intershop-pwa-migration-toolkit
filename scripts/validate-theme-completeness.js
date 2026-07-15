#!/usr/bin/env node

/**
 * SCSS Theme Completeness Validator
 *
 * Validates that custom themes have all required SCSS variables from reference themes.
 * Run BEFORE the first build to prevent incremental SCSS variable discovery.
 *
 * Usage:
 *   node scripts/validate-theme-completeness.js [--fix] [--project-dir <path>]
 */

const fs = require('fs');
const path = require('path');
const { projectDir } = require('./_project-dir');
const { log, chalk } = require('./_utils');

process.chdir(projectDir);

const THEMES_DIR = path.join(projectDir, 'src', 'styles', 'themes');
const REFERENCE_THEME = 'b2b';
const STANDARD_THEMES = ['b2b', 'b2c'];
const REQUIRED_IMPORTS = ["@use 'sass:color'", "@use 'sass:map'"];

const fixMode = process.argv.includes('--fix');
let exitCode = 0;

if (fixMode) {
  console.log(chalk.blue('🔧 Running in FIX mode - will attempt to add missing variables'));
  console.log();
}

if (!fs.existsSync(THEMES_DIR)) {
  log.error(`Themes directory not found: ${THEMES_DIR}`);
  process.exit(1);
}

const referenceFile = path.join(THEMES_DIR, REFERENCE_THEME, 'variables.scss');
if (!fs.existsSync(referenceFile)) {
  log.error(`Reference theme not found: ${referenceFile}`);
  process.exit(1);
}

log.header('🔍 PWA Theme Completeness Validator');
console.log();
console.log(`Reference theme: ${REFERENCE_THEME}`);
console.log();

// Extract all variable names from reference theme
const referenceContent = fs.readFileSync(referenceFile, 'utf-8');
const referenceVars = [...new Set(
  (referenceContent.match(/^\$[a-zA-Z0-9_-]+/gm) || [])
)].sort();
const referenceCount = referenceVars.length;

console.log(`📋 Reference theme has ${chalk.green(referenceCount)} variables to check`);
console.log();

// Find all custom themes
const customThemes = [];
for (const entry of fs.readdirSync(THEMES_DIR, { withFileTypes: true })) {
  if (entry.isDirectory() && !STANDARD_THEMES.includes(entry.name)) {
    customThemes.push(entry.name);
  }
}

if (customThemes.length === 0) {
  log.success('No custom themes detected - validation not needed');
  process.exit(0);
}

console.log(chalk.blue('Custom themes found:'));
for (const theme of customThemes) {
  console.log(`  - ${theme}`);
}
console.log();
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log();

// Validate each custom theme
for (const theme of customThemes) {
  const themeFile = path.join(THEMES_DIR, theme, 'variables.scss');

  if (!fs.existsSync(themeFile)) {
    console.log(chalk.yellow(`⚠️  SKIPPED: Theme file not found: ${themeFile}`));
    console.log();
    continue;
  }

  console.log(`${chalk.blue('Validating theme:')} ${chalk.yellow(theme)}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const content = fs.readFileSync(themeFile, 'utf-8');

  // Check for Sass module imports
  console.log('Checking Sass module imports...');
  const importIssues = [];
  for (const imp of REQUIRED_IMPORTS) {
    if (!content.includes(imp)) {
      importIssues.push(imp);
    }
  }

  if (importIssues.length > 0) {
    console.log(chalk.yellow('⚠️  Missing Sass module imports:'));
    for (const imp of importIssues) {
      console.log(`   - ${imp}`);
    }
    exitCode = 1;
  } else {
    console.log(chalk.green('✓ Sass imports OK'));
  }
  console.log();

  // Check for missing variables
  console.log('Checking SCSS variables...');
  const missingVars = [];

  for (const varName of referenceVars) {
    const varRegex = new RegExp(`^\\${varName}\\b`, 'm');
    if (!varRegex.test(content)) {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    console.log(chalk.red(`❌ Missing ${missingVars.length} variables in ${theme} theme:`));
    console.log();
    console.log(chalk.yellow('Missing variables:'));
    for (const v of missingVars) {
      console.log(`   ${v}`);
    }
    console.log();
    exitCode = 1;

    if (fixMode) {
      console.log(chalk.blue('💡 Use sync-custom-theme-variables.js to add these automatically'));
    }
  } else {
    console.log(chalk.green('✅ All variables present'));
  }

  // Summary for this theme
  const themeVarCount = (content.match(/^\$/gm) || []).length;
  console.log();
  console.log(`Summary: ${theme} has ${themeVarCount}/${referenceCount} variables`);
  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();
}

// Final summary
console.log();
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(chalk.blue('📊 Validation Summary'));
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (exitCode === 0) {
  console.log(chalk.green('✅ All custom themes are complete!'));
  console.log();
  console.log('You can proceed with the build:');
  console.log('  npm run build');
} else {
  console.log(chalk.red('❌ Theme validation failed'));
  console.log();
  console.log('Next steps:');
  console.log('  1. Review missing variables above');
  console.log('  2. Run sync script to add them:');
  console.log('     node scripts/sync-custom-theme-variables.js');
  console.log('  3. Review and adjust values for your theme');
  console.log('  4. Re-run validation:');
  console.log('     node scripts/validate-theme-completeness.js');
  console.log();
  console.log(chalk.yellow('💡 This validation prevents build-error-fix cycles'));
  console.log('   Expected time saved: 15-30 minutes');
}

console.log();
process.exit(exitCode);
