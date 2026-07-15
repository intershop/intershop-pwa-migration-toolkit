#!/usr/bin/env node

/**
 * Automated Migration Script: Customization Branch → Feature Branch
 *
 * Automates the migration of customizations from an old PWA version to a new one:
 *   1. Creating a new branch based on upstream PWA (target)
 *   2. Merging your customizations from old branch (source) into it
 *   3. Reporting conflicts for manual resolution
 *
 * Usage: node scripts/migrate-custom-branch.js [OPTIONS]
 *
 * Options:
 *   --source-branch <branch>    Your OLD custom branch (default: training_4.0.0)
 *   --target-branch <branch>    Upstream PWA version reference
 *   --migration-branch <branch> Your NEW custom branch name
 *   --target-tag <tag>          Use a tag instead of branch for upstream
 *   --intershop-remote <name>   Name of Intershop PWA remote (default: auto-detect)
 *   --auto-resolve              Automatically resolve simple conflicts
 *   --skip-nodejs-check         Skip Node.js version validation
 *   --dry-run                   Show what would be done without making changes
 *   --help                      Show this help message
 */

const fs = require('fs');
const path = require('path');
const { log, exec, execSilent, chalk, askYesNo } = require('./_utils');

// Parse arguments
const args = process.argv.slice(2);
let sourceBranch = 'training_4.0.0';
let targetBranch = 'feature/migration-4.0-to-9.1';
let targetTag = '';
let intershopRemote = '';
let migrationBranch = 'migration/training-to-9.1';
let autoResolve = false;
let skipNodejsCheck = false;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--source-branch': sourceBranch = args[++i]; break;
    case '--target-branch': targetBranch = args[++i]; break;
    case '--target-tag': targetTag = args[++i]; break;
    case '--intershop-remote': intershopRemote = args[++i]; break;
    case '--migration-branch': migrationBranch = args[++i]; break;
    case '--auto-resolve': autoResolve = true; break;
    case '--skip-nodejs-check': skipNodejsCheck = true; break;
    case '--dry-run': dryRun = true; break;
    case '--help':
      console.log(`Usage: node scripts/migrate-custom-branch.js [OPTIONS]

Options:
  --source-branch <branch>    Your OLD custom branch (default: training_4.0.0)
  --target-branch <branch>    Upstream PWA version reference
  --migration-branch <branch> Your NEW custom branch name
  --target-tag <tag>          Use a tag instead of branch for upstream
  --intershop-remote <name>   Name of Intershop PWA remote (default: auto-detect)
  --auto-resolve              Automatically resolve simple conflicts
  --skip-nodejs-check         Skip Node.js version validation
  --dry-run                   Show what would be done without making changes

Example:
  node scripts/migrate-custom-branch.js \\
    --source-branch training_4.0.0 \\
    --target-tag 10.0.0 \\
    --migration-branch training_10.0.0`);
      process.exit(0);
  }
}

// Check git repo
if (!execSilent('git rev-parse --git-dir')) {
  log.error('Not in a git repository');
  process.exit(1);
}

// Auto-detect Intershop remote
function detectIntershopRemote() {
  if (intershopRemote) return true;
  log.info('Auto-detecting Intershop PWA remote...');
  for (const remote of ['upstream', 'intershop-pwa', 'intershop', 'origin']) {
    const url = execSilent(`git remote get-url ${remote} 2>/dev/null`);
    if (url && url.includes('intershop/intershop-pwa')) {
      intershopRemote = remote;
      log.success(`Detected Intershop PWA remote: ${intershopRemote}`);
      return true;
    }
  }
  log.warning('Could not auto-detect Intershop PWA remote');
  console.log('Please specify with --intershop-remote option');
  console.log();
  console.log('Available remotes:');
  console.log(execSilent('git remote -v'));
  return false;
}

// Validate target
function validateTarget() {
  if (targetTag) {
    log.info(`Validating tag: ${targetTag}`);
    for (const prefix of ['', 'tags/', `${intershopRemote}/`]) {
      if (execSilent(`git rev-parse "${prefix}${targetTag}" 2>/dev/null`)) {
        targetBranch = `${prefix}${targetTag}`;
        log.success(`Found tag: ${targetBranch}`);
        return true;
      }
    }
    log.error(`Tag '${targetTag}' not found`);
    console.log();
    console.log('Available release tags (last 10):');
    const tags = execSilent('git tag -l');
    if (tags) {
      const semverTags = tags.split('\n').filter(t => /^\d+\.\d+\.\d+$/.test(t)).sort();
      semverTags.slice(-10).forEach(t => console.log(`  ${t}`));
    }
    console.log();
    console.log(`Hint: Fetch tags with: git fetch ${intershopRemote} --tags`);
    return false;
  }

  if (!execSilent(`git rev-parse --verify "${targetBranch}" 2>/dev/null`)) {
    log.error(`Target branch '${targetBranch}' does not exist`);
    console.log();
    console.log('Available branches:');
    const branches = execSilent('git branch -a');
    if (branches) branches.split('\n').filter(b => b.includes('remotes/')).slice(0, 10).forEach(b => console.log(b));
    return false;
  }
  return true;
}

if (!detectIntershopRemote()) {
  log.error('Please set up Intershop PWA remote or specify with --intershop-remote');
  process.exit(1);
}

// Fetch latest
log.info(`Fetching from ${intershopRemote}...`);
exec(`git fetch "${intershopRemote}" --tags`, { silent: true });

// Validate branches
if (!execSilent(`git rev-parse --verify "${sourceBranch}" 2>/dev/null`)) {
  log.error(`Source branch '${sourceBranch}' does not exist`);
  process.exit(1);
}

if (!validateTarget()) process.exit(1);

// Check uncommitted changes
if (execSilent('git diff-index HEAD --') !== '') {
  log.error('You have uncommitted changes. Please commit or stash them first.');
  process.exit(1);
}

log.info('============================================');
log.info('Automated PWA Migration');
log.info('============================================');
log.info(`Source Branch (Customizations): ${sourceBranch}`);
log.info(`Target Branch (New PWA Version): ${targetBranch}`);
log.info(`Migration Branch: ${migrationBranch}`);
log.info(`Auto-resolve conflicts: ${autoResolve}`);
log.info(`Dry Run: ${dryRun}`);
log.info('============================================');
console.log();

// Check Node.js version
if (!skipNodejsCheck) {
  const checkScript = path.join(__dirname, 'check-nodejs-version.js');
  if (fs.existsSync(checkScript)) {
    log.info('Checking Node.js version requirements...');
    const tvMatch = targetBranch.match(/\d+\.\d+\.\d+/);
    const tv = tvMatch ? tvMatch[0] : '11.0.0';
    const result = exec(`node "${checkScript}" "${tv}"`, { silent: true });
    if (!result.success) {
      log.error('Node.js version check failed');
      console.log();
      log.info(`1. Update: node scripts/check-nodejs-version.js ${tv} --auto-update`);
      log.info('2. Skip (not recommended): Re-run with --skip-nodejs-check');
      process.exit(1);
    }
    console.log();
  }
} else {
  log.warning('Node.js version check skipped (--skip-nodejs-check)');
}

if (dryRun) {
  log.warning('DRY RUN MODE - No changes will be made');
  console.log();
}

// Step 1: Create migration branch
log.info('Step 1: Creating migration branch from target branch...');
if (!dryRun) {
  if (execSilent(`git rev-parse --verify "${migrationBranch}" 2>/dev/null`)) {
    log.warning('Migration branch already exists, deleting it...');
    exec(`git branch -D "${migrationBranch}"`, { silent: true });
  }
  exec(`git checkout "${targetBranch}"`, { silent: true });
  exec(`git checkout -b "${migrationBranch}"`, { silent: true });
  log.success('Migration branch created');
} else {
  log.info(`Would create branch: ${migrationBranch} from ${targetBranch}`);
}
console.log();

// Step 2: Identify customization files
log.info('Step 2: Analyzing customization files...');
if (!dryRun) {
  const mergeBase = execSilent(`git merge-base "${sourceBranch}" develop 2>/dev/null`);
  const customFilesList = mergeBase ? execSilent(`git diff --name-only "${sourceBranch}" ${mergeBase} 2>/dev/null`) : '';
  if (!customFilesList) {
    log.warning('No customization files found');
  } else {
    const fileCount = customFilesList.split('\n').filter(Boolean).length;
    log.success(`Found ${fileCount} customized files`);
    customFilesList.split('\n').filter(Boolean).slice(0, 20).forEach(f => console.log(`  ${f}`));
    if (fileCount > 20) log.info(`... and ${fileCount - 20} more files`);
  }
} else {
  log.info(`Would analyze customization files between ${sourceBranch} and original version`);
}
console.log();

// Step 3: Merge source into migration branch
log.info('Step 3: Merging customizations into migration branch...');
if (!dryRun) {
  const mergeResult = exec(`git merge --no-commit --no-ff "${sourceBranch}" 2>&1`, { silent: true });

  if (mergeResult.success) {
    log.success('Merge successful without conflicts');
    exec(`git commit -m "feat: merge customizations from ${sourceBranch}"`, { silent: true });
  } else {
    const conflictFiles = execSilent('git diff --name-only --diff-filter=U');
    if (conflictFiles) {
      const files = conflictFiles.split('\n').filter(Boolean);
      log.warning(`Found ${files.length} files with merge conflicts:`);
      files.forEach(f => console.log(`  ${f}`));
      console.log();

      if (autoResolve) {
        log.info('Attempting automatic conflict resolution...');
        let resolved = 0, failed = 0;
        for (const file of files) {
          log.info(`Processing: ${file}`);
          const res = exec(`git checkout --ours "${file}"`, { silent: true });
          if (res.success) {
            exec(`git add "${file}"`, { silent: true });
            resolved++;
            log.success("  ✓ Resolved using 'ours' strategy");
          } else {
            failed++;
            log.warning('  ✗ Could not auto-resolve');
          }
        }
        log.info(`Auto-resolution summary: ${resolved} resolved, ${failed} need manual review`);

        if (failed === 0) {
          exec(`git commit -m "feat: merge customizations from ${sourceBranch} (auto-resolved)"`, { silent: true });
          log.success('All conflicts automatically resolved and committed');
        } else {
          log.warning('Some conflicts require manual resolution');
          log.warning('Please resolve conflicts in the following files:');
          console.log(execSilent('git diff --name-only --diff-filter=U'));
          console.log();
          log.info('After resolving conflicts manually, run:');
          log.info('  git add <resolved-files>');
          log.info(`  git commit -m 'feat: merge customizations from ${sourceBranch}'`);
          process.exit(1);
        }
      } else {
        log.warning('Merge has conflicts. Please resolve manually or run with --auto-resolve flag');
        console.log();
        log.info('To resolve conflicts:');
        log.info('  1. Edit the conflicted files');
        log.info('  2. git add <resolved-files>');
        log.info(`  3. git commit -m 'feat: merge customizations from ${sourceBranch}'`);
        console.log();
        log.info('Or abort the merge:');
        log.info('  git merge --abort');
        process.exit(1);
      }
    }
  }
} else {
  log.info(`Would merge ${sourceBranch} into ${migrationBranch}`);
}
console.log();

// Step 4: Run automated migration scripts
log.info('Step 4: Running automated migration scripts...');
if (!dryRun) {
  if (!fs.existsSync('node_modules')) {
    log.info('Installing dependencies...');
    exec('npm ci --prefer-offline --no-audit');
  }

  log.info('Running ESLint auto-fix...');
  exec('npm run lint -- --fix 2>&1', { silent: true });

  log.info('Running Prettier...');
  exec('npm run format 2>&1', { silent: true });

  if (execSilent('git diff-index HEAD --')) {
    exec('git add -A');
    exec('git commit -m "chore: apply automated code formatting and linting fixes"', { silent: true });
    log.success('Auto-fixes committed');
  } else {
    log.info('No auto-fixes needed');
  }
} else {
  log.info('Would run: npm run lint -- --fix');
  log.info('Would run: npm run format');
}
console.log();

// Step 5: Build
log.info('Step 5: Testing build...');
if (!dryRun) {
  const buildResult = exec('npm run build 2>&1', { silent: true });
  if (buildResult.success) {
    log.success('Build successful!');
  } else {
    log.error('Build failed. Please check the errors and fix them manually.');
    console.log(buildResult.output);
    process.exit(1);
  }
} else {
  log.info('Would run: npm run build');
}
console.log();

// Step 6: Tests
log.info('Step 6: Running tests...');
if (!dryRun) {
  const testResult = exec('npm test -- --ci --maxWorkers=2 2>&1', { silent: true });
  if (testResult.success) {
    log.success('All tests passed!');
  } else {
    log.warning('Some tests failed. You may need to update them manually.');
  }
} else {
  log.info('Would run: npm test -- --ci');
}
console.log();

// Step 7: Generate report
log.info('Step 7: Generating migration report...');
const reportDate = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const reportFile = `MIGRATION_REPORT_${reportDate}.md`;

if (!dryRun) {
  const changedFiles = execSilent(`git diff --name-only "${targetBranch}" "${migrationBranch}" 2>/dev/null`) || 'Could not determine changed files';
  const report = `# Migration Report

**Date:** ${new Date().toISOString().slice(0, 19).replace('T', ' ')}
**Source Branch:** ${sourceBranch}
**Target Branch:** ${targetBranch}
**Migration Branch:** ${migrationBranch}

## Summary

This report documents the automated migration of customizations from the source branch to the target branch.

## Files Changed

\`\`\`
${changedFiles}
\`\`\`

## Conflicts Resolved

${autoResolve ? 'Conflicts were automatically resolved' : 'No automatic conflict resolution was performed'}

## Next Steps

### 1. Review Changes
\`\`\`bash
git diff ${targetBranch}..${migrationBranch}
\`\`\`

### 2. Manual Adjustments
- [ ] Control flow syntax (@if, @for instead of *ngIf, *ngFor)
- [ ] Functional guards (replace class-based guards)
- [ ] Standalone components migration
- [ ] FormlyFieldConfig updates (templateOptions -> props)
- [ ] Icon references (Font Awesome -> Bootstrap Icons)
- [ ] Environment configuration changes

### 3. Final Verification
\`\`\`bash
npm run test
npm run build
npm run lint
\`\`\`
`;
  fs.writeFileSync(reportFile, report);
  log.success(`Migration report saved to: ${reportFile}`);
} else {
  log.info(`Would generate migration report: ${reportFile}`);
}
console.log();

// Final summary
log.info('============================================');
log.success('Migration Process Complete!');
log.info('============================================');
console.log();
const currentBranch = execSilent('git branch --show-current');
log.info(`Current branch: ${currentBranch}`);
log.info(`Migration report: ${reportFile}`);
console.log();
log.info('Next steps:');
log.info(`  1. Review changes: git diff ${targetBranch}`);
log.info(`  2. Review migration report: cat ${reportFile}`);
log.info('  3. Run tests: npm test');
log.info('  4. Choose workflow:');
log.info('     - Test locally: npm run start');
log.info(`     - Push to remote: git push -u origin ${migrationBranch}`);
console.log();
