#!/usr/bin/env node

/**
 * Pre-Commit Customization Check
 *
 * Checks for customization anti-patterns before allowing commits.
 * Helps maintain migration-friendly code by catching common issues early.
 *
 * Install as git hook:
 *   cp scripts/pre-commit-customization-check.js .git/hooks/pre-commit
 *
 * Or with husky:
 *   Add to .husky/pre-commit: node scripts/pre-commit-customization-check.js
 */

const fs = require('fs');
const path = require('path');
const { execSilent, chalk, askYesNo } = require('./_utils');

// Try to resolve project dir (optional for hook context)
let cwd = process.cwd();
try {
  const { projectDir } = require('./_project-dir');
  cwd = projectDir;
} catch {}
process.chdir(cwd);

console.log();
console.log(chalk.blue('🔍 Running customization checks...'));
console.log();

let blockCommit = false;
let warnings = 0;

// Get list of staged files
const stagedFiles = execSilent('git diff --cached --name-only --diff-filter=ACM').split('\n').filter(Boolean);

if (stagedFiles.length === 0) {
  console.log(chalk.green('✅ No files to check'));
  process.exit(0);
}

// Define core Intershop directories
const CORE_PATHS = [
  'src/app/core/',
  'src/app/shared/components/',
  'src/app/shared/forms/',
  'src/app/pages/',
  'src/styles/global',
];

// Exclude paths (OK to modify)
const EXCLUDE_PATHS = [
  'src/app/custom/',
  'src/app/extensions/',
  'src/styles/themes/',
  '.spec.ts',
  '.md',
];

function isCoreFile(file) {
  for (const exclude of EXCLUDE_PATHS) {
    if (file.includes(exclude)) return false;
  }
  for (const corePath of CORE_PATHS) {
    if (file.includes(corePath)) return true;
  }
  return false;
}

function hasCustomizationMarkers(file) {
  if (!fs.existsSync(file)) return false;

  // Check in staged diff
  const diff = execSilent(`git diff --cached "${file}"`);
  if (/CUSTOMIZATION/i.test(diff)) return true;

  // Check if file already has markers
  const content = fs.readFileSync(file, 'utf-8');
  return /CUSTOMIZATION/i.test(content);
}

// Check for deleted standard files
function checkDeletedFiles() {
  const deleted = execSilent('git diff --cached --name-only --diff-filter=D')
    .split('\n')
    .filter(f => f && /\.(ts|html|scss)$/.test(f));

  if (deleted.length > 0) {
    console.log(chalk.yellow('⚠️  Warning: Standard files deleted'));
    console.log();
    for (const file of deleted) {
      if (isCoreFile(file)) {
        console.log(`  ${chalk.red('✗')} ${file}`);
        console.log(`    ${chalk.cyan('Consider:')} Comment out instead of deleting`);
      }
    }
    console.log();
    warnings++;
  }
}

// Check for renamed files without copying
function checkRenamedFiles() {
  const renamed = execSilent('git diff --cached --name-status --diff-filter=R')
    .split('\n')
    .filter(l => l && /\.(ts|html|scss)$/.test(l));

  if (renamed.length > 0) {
    console.log(chalk.yellow('⚠️  Warning: Files renamed'));
    console.log();
    for (const line of renamed) {
      const parts = line.split('\t');
      if (parts.length >= 3) {
        const [, oldFile, newFile] = parts;
        if (isCoreFile(oldFile)) {
          console.log(`  ${chalk.yellow('⚠')} ${oldFile} → ${newFile}`);
          console.log(`    ${chalk.cyan('Consider:')} Copy instead of rename (keep original for merges)`);
        }
      }
    }
    console.log();
    warnings++;
  }
}

// Check for ish- prefix in custom components
function checkCustomPrefixes() {
  const newComponents = execSilent('git diff --cached --name-only --diff-filter=A')
    .split('\n')
    .filter(f => f && /custom.*\.component\.ts$/.test(f));

  for (const file of newComponents) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      const selectorMatch = content.match(/selector:\s*'([^']+)'/);
      if (selectorMatch && selectorMatch[1].startsWith('ish-')) {
        if (warnings === 0) {
          console.log(chalk.yellow('⚠️  Warning: Naming convention issues'));
          console.log();
        }
        console.log(`  ${chalk.yellow('⚠')} ${file}`);
        console.log(`    Uses 'ish-' prefix: selector: '${selectorMatch[1]}'`);
        console.log(`    ${chalk.cyan('Consider:')} Use 'custom-' or your company prefix`);
        console.log();
        warnings++;
      }
    }
  }
}

// Main check: Core files without CUSTOMIZATION markers
console.log(chalk.blue('Checking core file modifications...'));

const coreFilesModified = [];

for (const file of stagedFiles) {
  if (!fs.existsSync(file)) continue;
  if (isCoreFile(file) && !hasCustomizationMarkers(file)) {
    coreFilesModified.push(file);
  }
}

if (coreFilesModified.length > 0) {
  console.log();
  console.log(chalk.yellow('⚠️  Warning: Core Intershop files modified without CUSTOMIZATION markers'));
  console.log();

  for (const file of coreFilesModified) {
    console.log(`  ${chalk.yellow('⚠')} ${file}`);
  }

  console.log();
  console.log(chalk.cyan('Recommendation:'));
  console.log('  1. Add // CUSTOMIZATION: <reason> comments to your changes');
  console.log('  2. Or use theme overrides (.mytheme.html suffix)');
  console.log('  3. Or copy to custom/ folder with custom- prefix');
  console.log();
  console.log('Example:');
  console.log(chalk.green('  // CUSTOMIZATION: Added custom validation for B2B users'));
  console.log(chalk.green('  if (this.isB2BUser()) { ... }'));
  console.log();

  warnings++;
}

// Run additional checks
checkDeletedFiles();
checkRenamedFiles();
checkCustomPrefixes();

// Check for modifications to global styles
const globalStyles = stagedFiles.filter(f => f.includes('src/styles/global') && !f.includes('themes/'));
if (globalStyles.length > 0) {
  console.log(chalk.red('❌ Error: Global styles modified'));
  console.log();
  for (const file of globalStyles) {
    console.log(`  ${chalk.red('✗')} ${file}`);
  }
  console.log();
  console.log(chalk.cyan('Solution:') + ' Override in your theme folder instead:');
  console.log('  src/styles/themes/mytheme/custom-overrides.scss');
  console.log();
  blockCommit = true;
}

// Check for package-lock.json manual modifications
if (stagedFiles.includes('package-lock.json') && !stagedFiles.includes('package.json')) {
  console.log(chalk.yellow('⚠️  Warning: package-lock.json modified without package.json change'));
  console.log();
  console.log('  This usually indicates manual editing of package-lock.json');
  console.log();
  console.log(chalk.cyan('Recommendation:'));
  console.log('  1. Only modify package.json directly');
  console.log("  2. Run 'npm install' to update package-lock.json");
  console.log("  3. During migration: accept Intershop's package-lock.json");
  console.log();
  warnings++;
}

// Summary
console.log();
console.log(chalk.blue('================================'));

if (blockCommit) {
  console.log(chalk.red('❌ Commit blocked'));
  console.log();
  console.log('Critical issues found that will cause migration problems.');
  console.log('Please fix the issues above before committing.');
  console.log();
  console.log('To bypass this check (not recommended):');
  console.log('  git commit --no-verify');
  console.log();
  process.exit(1);
} else if (warnings > 0) {
  console.log(chalk.yellow(`⚠️  ${warnings} warning(s) found`));
  console.log();
  console.log('Customizations detected that may complicate future migrations.');
  console.log('Review the warnings above and consider following best practices.');
  console.log();
  console.log('See: docs/guides/customization-best-practices.md');
  console.log();

  // Ask for confirmation in interactive mode
  if (process.stdin.isTTY) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Continue with commit? (y/N): ', answer => {
      rl.close();
      if (!/^[yY]/.test(answer)) {
        console.log('Commit cancelled.');
        process.exit(1);
      }
      console.log(chalk.green('✅ Proceeding with commit'));
      process.exit(0);
    });
  } else {
    // Non-interactive (CI/CD) - allow with warnings
    console.log('Non-interactive mode: Proceeding with warnings');
    process.exit(0);
  }
} else {
  console.log(chalk.green('✅ All checks passed'));
  console.log();
  console.log('No customization issues detected.');
  console.log('Your code follows migration-friendly practices.');
  process.exit(0);
}
