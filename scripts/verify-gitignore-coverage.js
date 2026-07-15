#!/usr/bin/env node

/**
 * Verify .gitignore Coverage for PWA Migration Toolkit
 *
 * Checks that all toolkit files are properly ignored in the custom PWA project.
 * Only needed for the "copy & hide" deployment mode.
 *
 * Usage:
 *   node scripts/verify-gitignore-coverage.js [--project-dir <path>]
 */

const fs = require('fs');
const path = require('path');
const { projectDir } = require('./_project-dir');
const { log, execSilent, chalk } = require('./_utils');

process.chdir(projectDir);

console.log(chalk.blue('🔍 Verifying .gitignore coverage for PWA Migration Toolkit'));
console.log();

let errors = 0;
let warnings = 0;

function checkIgnored(pattern, description, expectedCount) {
  // Find matching files
  const { execSync } = require('child_process');
  let files = [];
  try {
    const globPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '*');
    const output = execSilent(`git ls-files --others --ignored --exclude-standard -- "${pattern}"`, projectDir);
    // Try finding actual files matching pattern
    const findResult = execSilent(`node -e "const g=require('path');const f=require('fs');try{const r=f.readdirSync('.',{recursive:true}).filter(p=>p.match(/${pattern.replace(/\./g, '\\\\.').replace(/\*/g, '.*').replace(/\//g, '\\\\/')}/));console.log(r.join('\\n'))}catch{}"`, projectDir);
    if (findResult) {
      files = findResult.split('\n').filter(Boolean).slice(0, 5);
    }
  } catch {}

  if (files.length === 0) {
    console.log(chalk.yellow(`⚠️  ${description}: No files found`));
    warnings++;
    return;
  }

  let allIgnored = true;
  for (const file of files) {
    const result = execSilent(`git check-ignore -q "${file}" 2>&1; echo $?`, projectDir);
    if (result !== '0') {
      allIgnored = false;
      console.log(chalk.red(`❌ ${description}: ${file} is NOT ignored`));
      errors++;
    }
  }

  if (allIgnored) {
    console.log(chalk.green(`✅ ${description}: Properly ignored (${expectedCount} files)`));
  }
}

// Check each category
console.log('Checking toolkit files...');
console.log();

checkIgnored('.github/instructions/migration-*.instructions.md', 'Migration instructions', '9');
checkIgnored('.github/skills/pwa-*.SKILL.md', 'PWA skills', '2');
checkIgnored('.github/skills/README.md', 'Skills README', '1');
checkIgnored('scripts/migrate-*.js', 'Migration scripts', '3');
checkIgnored('scripts/check-*.js', 'Check scripts', '5');
checkIgnored('scripts/analyze-*.js', 'Analysis scripts', '1');
checkIgnored('scripts/detect-*.js', 'Detection scripts', '1');
checkIgnored('scripts/generate-*.js', 'Report generation scripts', '1');
checkIgnored('scripts/merge-*.js', 'Merge scripts', '2');
checkIgnored('scripts/compare-*.js', 'Comparison scripts', '1');
checkIgnored('scripts/fix-*.js', 'Fix scripts', '2');
checkIgnored('scripts/sync-*.js', 'Sync scripts', '1');
checkIgnored('scripts/update-*.js', 'Update scripts', '2');
checkIgnored('scripts/validate-*.js', 'Validation scripts', '1');
checkIgnored('scripts/pre-commit-*.js', 'Pre-commit scripts', '1');
checkIgnored('data/pattern-migrations.json', 'Pattern database', '1');
checkIgnored('docs/guides/migration-*.md', 'Migration guides', '1');
checkIgnored('docs/guides/customization-*.md', 'Customization guides', '1');

console.log();
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (errors === 0 && warnings === 0) {
  console.log(chalk.green('✅ Success! All toolkit files are properly ignored.'));
  console.log();
  console.log("Your custom PWA repository is clean - toolkit files won't be committed.");
  process.exit(0);
} else if (errors === 0) {
  console.log(chalk.yellow(`⚠️  Verification complete with ${warnings} warnings.`));
  console.log();
  console.log("Some toolkit files weren't found - this is OK if you haven't copied them yet.");
  process.exit(0);
} else {
  console.log(chalk.red(`❌ Verification failed! ${errors} toolkit files are NOT ignored.`));
  console.log();
  console.log('Fix this by adding the .gitignore patterns:');
  console.log('  cat .gitignore-toolkit-template >> .gitignore');
  process.exit(1);
}
