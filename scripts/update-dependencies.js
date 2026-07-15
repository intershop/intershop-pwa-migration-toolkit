#!/usr/bin/env node

/**
 * PWA Dependency Update Workflow
 *
 * Interactive script that guides through the dependency update process.
 * Based on: https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/updating-pwa.md
 *
 * Usage:
 *   node scripts/update-dependencies.js
 *   node scripts/update-dependencies.js --auto  # Skip prompts (for CI/CD)
 */

const fs = require('fs');
const path = require('path');
const { projectDir } = require('./_project-dir');
const { log, exec, execSilent, chalk, askYesNo, askInput } = require('./_utils');

process.chdir(projectDir);

const autoMode = process.argv.includes('--auto');

async function waitForUser() {
  if (!autoMode && process.stdin.isTTY) {
    await askInput('Press Enter to continue...');
  }
}

async function confirm(question) {
  if (autoMode) return true;
  return askYesNo(question);
}

async function run() {
  console.log();
  console.log('==========================================================');
  console.log('  PWA Dependency Update Workflow');
  console.log('==========================================================');
  console.log();
  console.log(chalk.blue('Based on official Intershop PWA Updating Guide'));
  console.log('  https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/updating-pwa.md');
  console.log();
  console.log(chalk.yellow('⚠️  Important:'));
  console.log('  - This workflow is for PWA development, not customer projects');
  console.log('  - Customer projects should consume PWA updates via migration');
  console.log('  - Create commits after each step for better tracking');
  console.log();

  if (!(await confirm('Ready to start dependency update workflow?'))) {
    console.log('Update cancelled.');
    process.exit(0);
  }

  // Verify PWA project
  const pkgPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    log.error('Not in a PWA project directory');
    process.exit(1);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  if (!pkg.dependencies?.['@angular/core'] && !pkg.name?.includes('pwa')) {
    log.error('Not in a PWA project directory');
    process.exit(1);
  }

  // Create update branch
  const currentBranch = execSilent('git rev-parse --abbrev-ref HEAD 2>/dev/null') || '';
  if (currentBranch) {
    console.log(chalk.blue(`📍 Current branch: ${currentBranch}`));
    if (await confirm('Create new branch for updates? (recommended)')) {
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const updateBranch = `update/dependencies-${date}`;
      exec(`git checkout -b "${updateBranch}"`, { silent: true });
      console.log(chalk.green(`✅ Created branch: ${updateBranch}`));
    }
  }

  // Step 0: Pre-checks
  console.log();
  console.log('==========================================================');
  console.log('  Step 0: Pre-Update Checks');
  console.log('==========================================================');
  console.log();
  console.log(`${chalk.blue('Current Node.js:')} ${process.version}`);
  const angularVersion = (pkg.dependencies?.['@angular/core'] || '').replace(/[^\d]/g, '').slice(0, 2);
  console.log(`${chalk.blue('Current Angular:')} ${angularVersion}`);
  console.log();

  await waitForUser();

  // Step 1: Check Angular updates
  console.log('==========================================================');
  console.log('  Step 1: Check for Angular Updates');
  console.log('==========================================================');
  console.log();
  console.log('Running: ng update');
  console.log();
  exec('ng update', { silent: false });
  console.log();
  console.log(chalk.blue('ℹ️  Review the output above for available Angular updates'));
  await waitForUser();

  // Step 2: Update Angular
  console.log('==========================================================');
  console.log('  Step 2: Update Angular Dependencies');
  console.log('==========================================================');
  console.log();
  console.log(chalk.yellow('This will update @angular/cli and @angular/core'));
  console.log();

  if (await confirm('Update Angular now?')) {
    console.log();
    console.log('Running: ng update @angular/cli @angular/core -C');
    const angularResult = exec('ng update @angular/cli @angular/core -C');
    if (!angularResult.success) {
      log.error('Angular update failed');
      console.log('Review errors above and fix before continuing');
      process.exit(1);
    }
    console.log(chalk.green('✅ Angular updated successfully'));
    console.log();
    console.log('Running quick build check...');
    exec('npm run build 2>&1 | head -20', { silent: false });
  } else {
    console.log('Skipping Angular update');
  }
  await waitForUser();

  // Step 3: Third-party dependencies
  console.log('==========================================================');
  console.log('  Step 3: Check Third-Party Dependencies');
  console.log('==========================================================');
  console.log();
  console.log('Checking for outdated packages...');
  console.log();
  exec('npm outdated --long', { silent: false });
  console.log();
  console.log(chalk.yellow('⚠️  Important:'));
  console.log('  - @types/node should stay on LTS version');
  console.log('  - Update one category at a time');
  console.log('  - Test after each major update');
  console.log();

  if (await confirm('Update third-party dependencies interactively?')) {
    console.log();
    console.log('Update recommendations:');
    console.log('  ng update <package-name>          (for Angular-related)');
    console.log('  npm install <package-name>@latest (for others)');
    console.log();
    await askInput('When done, press Enter to continue...');
  }
  await waitForUser();

  // Step 4: Check unused deps
  console.log('==========================================================');
  console.log('  Step 4: Check for Unused Dependencies');
  console.log('==========================================================');
  console.log();
  console.log(chalk.blue('Current dependencies:'));
  exec('npm ls --depth=0 2>/dev/null | head -20', { silent: false });
  console.log();

  if (await confirm('Review dependencies for removal?')) {
    console.log();
    console.log('To check: npm ls <package-name>');
    console.log('To remove: npm uninstall <package-name>');
    await askInput('Review and remove unused packages, then press Enter...');
  }
  await waitForUser();

  // Step 5: Formatting tools
  console.log('==========================================================');
  console.log('  Step 5: Update Formatting Tools');
  console.log('==========================================================');
  console.log();

  if (await confirm('Update prettier and eslint?')) {
    const prettierInstalled = execSilent('npm list prettier --depth=0 2>/dev/null');
    const eslintInstalled = execSilent('npm list eslint --depth=0 2>/dev/null');

    if (prettierInstalled) exec('npm install prettier@latest --save-dev', { silent: true });
    if (eslintInstalled) exec('npm install eslint@latest --save-dev', { silent: true });

    console.log(chalk.green('✅ Formatting tools updated'));
    console.log();
    console.log('Running formatters...');
    exec('npm run format 2>&1', { silent: true });
    exec('npm run lint -- --fix 2>&1', { silent: true });

    if (execSilent('git diff-index HEAD --')) {
      exec('git add -A && git commit -m "chore: update formatting tools and apply formatting"', { silent: true });
      console.log(chalk.green('✅ Formatting changes committed'));
    }
  }
  await waitForUser();

  // Final
  console.log('==========================================================');
  console.log('  Summary');
  console.log('==========================================================');
  console.log();
  console.log(chalk.green('✅ Dependency update workflow complete!'));
  console.log();
  console.log('Remaining steps:');
  console.log('  1. Run full test suite: npm test');
  console.log('  2. Run full build: npm run build');
  console.log('  3. Manual smoke test');
  console.log('  4. Push changes: git push');
  console.log();
}

run();
