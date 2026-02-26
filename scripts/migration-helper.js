#!/usr/bin/env node

/**
 * Interactive Migration Helper
 *
 * This tool provides an interactive interface for migrating customizations
 * from an old PWA version to a new one.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const readline = require('readline');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: msg => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: msg => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: msg => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: msg => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  step: (num, msg) => console.log(`\n${colors.cyan}Step ${num}:${colors.reset} ${msg}`),
};

// Helper to execute shell commands
function exec(command, silent = false) {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
    });
    return { success: true, output: output?.trim() };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      output: error.stdout?.toString()?.trim(),
    };
  }
}

// Helper to ask yes/no questions
function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(`${colors.cyan}${question} (y/n):${colors.reset} `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Helper to ask for text input
function askText(question, defaultValue = '') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = defaultValue
    ? `${colors.cyan}${question} [${defaultValue}]:${colors.reset} `
    : `${colors.cyan}${question}:${colors.reset} `;

  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

// Get list of branches
function getBranches() {
  const result = exec('git branch -a', true);
  if (!result.success) return [];

  return result.output
    .split('\n')
    .map(b => b.replace('*', '').trim())
    .filter(b => b && !b.startsWith('remotes/origin/HEAD'));
}

// Detect customization files
function analyzeCustomizations(sourceBranch, baseBranch = 'develop') {
  log.info('Analyzing customizations...');

  const mergeBase = exec(`git merge-base ${sourceBranch} ${baseBranch}`, true);
  if (!mergeBase.success) {
    log.warning('Could not find common ancestor, using develop as base');
    return null;
  }

  const diff = exec(`git diff --name-status ${mergeBase.output} ${sourceBranch}`, true);
  if (!diff.success) return null;

  const files = {
    modified: [],
    added: [],
    deleted: [],
    total: 0,
  };

  diff.output.split('\n').forEach(line => {
    const [status, file] = line.split('\t');
    if (file) {
      files.total++;
      if (status === 'M') files.modified.push(file);
      else if (status === 'A') files.added.push(file);
      else if (status === 'D') files.deleted.push(file);
    }
  });

  return files;
}

// Auto-resolve simple conflicts
function autoResolveConflicts() {
  const conflictFiles = exec('git diff --name-only --diff-filter=U', true);
  if (!conflictFiles.success || !conflictFiles.output) {
    log.info('No conflicts to resolve');
    return { resolved: 0, failed: 0 };
  }

  const files = conflictFiles.output.split('\n').filter(f => f);
  let resolved = 0;
  let failed = 0;

  files.forEach(file => {
    // Try simple resolution strategies
    const content = fs.readFileSync(file, 'utf-8');

    // Strategy 1: If conflict is only in imports, keep both
    if (file.endsWith('.ts') && content.includes('import ')) {
      const isResolved = autoResolveImports(file, content);
      if (isResolved) {
        exec(`git add ${file}`, true);
        resolved++;
        return;
      }
    }

    // Strategy 2: For test files, prefer 'ours' (customizations)
    if (file.endsWith('.spec.ts')) {
      const result = exec(`git checkout --ours ${file}`, true);
      if (result.success) {
        exec(`git add ${file}`, true);
        resolved++;
        return;
      }
    }

    failed++;
  });

  return { resolved, failed, total: files.length };
}

// Smart import conflict resolution
function autoResolveImports(file, content) {
  const lines = content.split('\n');
  const resolved = [];
  let inConflict = false;
  let conflictType = null;
  let oursImports = [];
  let theirsImports = [];

  lines.forEach(line => {
    if (line.startsWith('<<<<<<<')) {
      inConflict = true;
      conflictType = 'ours';
      oursImports = [];
      theirsImports = [];
    } else if (line.startsWith('=======')) {
      conflictType = 'theirs';
    } else if (line.startsWith('>>>>>>>')) {
      // Merge imports
      const allImports = [...new Set([...oursImports, ...theirsImports])].sort();
      resolved.push(...allImports);
      inConflict = false;
    } else if (inConflict) {
      if (line.trim().startsWith('import ')) {
        if (conflictType === 'ours') {
          oursImports.push(line);
        } else {
          theirsImports.push(line);
        }
      }
    } else {
      resolved.push(line);
    }
  });

  // Only save if we successfully resolved everything
  if (!inConflict) {
    fs.writeFileSync(file, resolved.join('\n'));
    return true;
  }

  return false;
}

// Detect features that were removed in target PWA
async function detectRemovedFeatures(targetBranch) {
  log.info('Comparing extensions with target PWA...');

  // Get current extensions
  const currentExtensions = exec('ls -1 src/app/extensions/', true);
  if (!currentExtensions.success) {
    return [];
  }

  const currentList = currentExtensions.output.split('\n').filter(e => e);

  // Get target extensions
  const targetExtensions = exec(`git ls-tree -d --name-only ${targetBranch}:src/app/extensions`, true);
  if (!targetExtensions.success) {
    log.warning('Could not compare with target branch extensions');
    return [];
  }

  const targetList = targetExtensions.output.split('\n').filter(e => e);

  // Find removed features
  const removed = currentList.filter(ext => !targetList.includes(ext));

  return removed;
}

// Handle removed features interactively
async function handleRemovedFeatures(removedFeatures) {
  console.log(`\n${colors.yellow}⚠️  WARNING: Following features were removed from new PWA:${colors.reset}`);
  console.log(removedFeatures.map(f => `  - ${f}`).join('\n'));

  for (const feature of removedFeatures) {
    console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.cyan}📦 Feature: ${feature}${colors.reset}`);
    console.log(`   Path: src/app/extensions/${feature}/`);

    // Check for references
    const templateRefs = exec(
      `grep -r "ish-lazy-${feature}\\|${feature}" src/app --include="*.html" 2>/dev/null | wc -l`,
      true
    );
    const refsCount = templateRefs.success ? parseInt(templateRefs.output) : 0;

    if (refsCount > 0) {
      console.log(`   ${colors.yellow}⚠${colors.reset}  Found ${refsCount} reference(s) in templates`);
    }

    const choice = await askText(
      `\n${colors.yellow}How should this feature be handled?${colors.reset}\n` +
        `  ${colors.green}A)${colors.reset} Keep and maintain independently (you will maintain it)\n` +
        `  ${colors.red}B)${colors.reset} Remove completely from customization\n` +
        `  ${colors.blue}C)${colors.reset} Check documentation for alternatives\n` +
        `  ${colors.cyan}S)${colors.reset} Skip for now (decide later)\n` +
        '\nYour choice (A/B/C/S): '
    );

    switch (choice.toUpperCase()) {
      case 'A':
        log.success(`Keeping ${feature} as custom-maintained extension`);
        console.log(`  ${colors.yellow}→${colors.reset} Verify all dependencies still work`);
        console.log(`  ${colors.yellow}→${colors.reset} Document in MIGRATION_SUCCESS_REPORT.md`);
        console.log(`  ${colors.yellow}→${colors.reset} Test thoroughly after build succeeds`);
        break;

      case 'B': {
        log.warning(`Removing ${feature} completely...`);
        const confirmRemove = await ask(`  Really remove src/app/extensions/${feature}/ ?`);
        if (confirmRemove) {
          exec(`rm -rf src/app/extensions/${feature}/`);
          exec(`git add src/app/extensions/${feature}/`);
          log.success(`Removed ${feature} extension`);
          console.log(`  ${colors.yellow}→${colors.reset} Check for remaining references in templates`);
          console.log(`  ${colors.yellow}→${colors.reset} Remove from environment configs if present`);
          console.log(`  ${colors.yellow}→${colors.reset} Remove from module imports/exports`);
        } else {
          log.info('Removal cancelled - will need manual cleanup');
        }
        break;
      }

      case 'C':
        log.info(`Check PWA 9.1 documentation for ${feature} alternatives`);
        console.log(`  ${colors.blue}→${colors.reset} Search in docs/guides/ for similar features`);
        console.log(`  ${colors.blue}→${colors.reset} Check if functionality moved to different extension`);
        console.log(`  ${colors.blue}→${colors.reset} Manual migration may be required`);
        break;

      case 'S':
        log.info(`Skipping ${feature} - will need manual handling`);
        console.log(`  ${colors.yellow}→${colors.reset} Document decision needed in migration report`);
        break;

      default:
        log.warning('Invalid choice, skipping feature');
    }
  }

  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

// Main migration workflow
async function main() {
  console.clear();
  console.log(`
${colors.cyan}╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     Intershop PWA - Interactive Migration Helper         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}
  `);

  // Check if we're in a git repository
  const gitCheck = exec('git rev-parse --git-dir', true);
  if (!gitCheck.success) {
    log.error('Not in a git repository!');
    process.exit(1);
  }

  // Check for uncommitted changes
  const statusCheck = exec('git diff-index --quiet HEAD --', true);
  if (!statusCheck.success) {
    log.error('You have uncommitted changes. Please commit or stash them first.');
    process.exit(1);
  }

  // Check Node.js and npm versions
  log.step(1, 'Validate Environment');

  const nodeVersion = process.version.replace('v', '');
  const npmVersion = exec('npm --version', true).output.trim();

  console.log(`\nCurrent environment:`);
  console.log(`  Node.js: ${nodeVersion}`);
  console.log(`  npm:     ${npmVersion}`);

  // Step 2: Select branches
  log.step(2, 'Configure Migration');

  const branches = getBranches();
  log.info(`Found ${branches.length} branches`);

  console.log('\nAvailable branches:');
  branches
    .filter(b => !b.startsWith('remotes/'))
    .forEach((b, i) => {
      console.log(`  ${i + 1}. ${b}`);
    });

  const sourceBranch = await askText('\nSource branch (with customizations)', 'training_4.0.0');
  const targetBranch = await askText('Target branch (new PWA version)', 'feature/migration-4.0-to-9.1');
  const migrationBranch = await askText('Migration branch name', 'migration/training-to-9.1');

  // Verify branches exist
  const sourceBranchCheck = exec(`git rev-parse --verify ${sourceBranch}`, true);
  const targetBranchCheck = exec(`git rev-parse --verify ${targetBranch}`, true);

  if (!sourceBranchCheck.success) {
    log.error(`Source branch '${sourceBranch}' does not exist`);
    process.exit(1);
  }

  if (!targetBranchCheck.success) {
    log.error(`Target branch '${targetBranch}' does not exist`);
    process.exit(1);
  }

  // Validate Node.js/npm versions against target branch
  console.log(`\nChecking target branch requirements...`);
  const targetPackageJson = exec(`git show ${targetBranch}:package.json`, true);
  if (targetPackageJson.success) {
    const targetPkg = JSON.parse(targetPackageJson.output);
    if (targetPkg.engines) {
      const requiredNode = targetPkg.engines.node;
      const requiredNpm = targetPkg.engines.npm;

      console.log(`\nTarget PWA requires:`);
      console.log(`  Node.js: ${requiredNode}`);
      console.log(`  npm:     ${requiredNpm}`);

      if (nodeVersion !== requiredNode) {
        log.warning(`Node.js version mismatch! Current: ${nodeVersion}, Required: ${requiredNode}`);
        const continueAnyway = await ask('Continue anyway? (may cause build issues)');
        if (!continueAnyway) {
          log.info('Migration cancelled. Please update Node.js version and try again.');
          log.info(`→ Use: nvm install ${requiredNode} && nvm use ${requiredNode}`);
          process.exit(0);
        }
      } else {
        log.success(`Node.js version matches (${nodeVersion})`);
      }

      if (npmVersion !== requiredNpm) {
        log.warning(`npm version mismatch! Current: ${npmVersion}, Required: ${requiredNpm}`);
        const continueAnyway = await ask('Continue anyway? (may cause build issues)');
        if (!continueAnyway) {
          log.info('Migration cancelled. Please update npm version and try again.');
          log.info(`→ Use: npm install -g npm@${requiredNpm}`);
          process.exit(0);
        }
      } else {
        log.success(`npm version matches (${npmVersion})`);
      }
    }
  }

  // Step 3: Analyze customizations
  log.step(3, 'Analyze Customizations');

  const customFiles = analyzeCustomizations(sourceBranch);
  if (customFiles) {
    log.info(`Total customized files: ${customFiles.total}`);
    log.info(`  Modified: ${customFiles.modified.length}`);
    log.info(`  Added: ${customFiles.added.length}`);
    log.info(`  Deleted: ${customFiles.deleted.length}`);

    if (customFiles.modified.length > 0) {
      console.log('\nMost modified files:');
      customFiles.modified.slice(0, 10).forEach(f => console.log(`  - ${f}`));
    }
  }

  const proceed = await ask('\nProceed with migration?');
  if (!proceed) {
    log.info('Migration cancelled');
    process.exit(0);
  }

  // Step 4: Create migration branch
  log.step(4, 'Create Migration Branch');

  // Delete if exists
  exec(`git branch -D ${migrationBranch}`, true);

  exec(`git checkout ${targetBranch}`);
  const createBranch = exec(`git checkout -b ${migrationBranch}`);

  if (!createBranch.success) {
    log.error('Failed to create migration branch');
    process.exit(1);
  }

  log.success(`Created branch: ${migrationBranch}`);

  // Step 5: Merge customizations
  log.step(5, 'Merge Customizations');

  const merge = exec(`git merge --no-commit --no-ff ${sourceBranch}`, true);

  if (merge.success) {
    log.success('Merge successful without conflicts');
    exec(`git commit -m "feat: merge customizations from ${sourceBranch}"`);
  } else {
    // Check for conflicts
    const conflicts = exec('git diff --name-only --diff-filter=U', true);

    if (conflicts.success && conflicts.output) {
      const conflictFiles = conflicts.output.split('\n').filter(f => f);
      log.warning(`Found ${conflictFiles.length} files with conflicts`);

      console.log('\nConflicted files:');
      conflictFiles.forEach(f => console.log(`  - ${f}`));

      const autoResolve = await ask('\nAttempt automatic conflict resolution?');

      if (autoResolve) {
        log.info('Attempting automatic resolution...');
        const result = autoResolveConflicts();

        log.info(`Resolved: ${result.resolved}/${result.total} conflicts`);

        if (result.failed === 0) {
          exec(`git commit -m "feat: merge customizations from ${sourceBranch} (auto-resolved)"`);
          log.success('All conflicts automatically resolved');
        } else {
          log.warning(`${result.failed} conflicts require manual resolution`);
          log.info('\nPlease resolve remaining conflicts manually');
          log.info('After resolving, run:');
          log.info(`  git add <resolved-files>`);
          log.info(`  git commit -m "feat: merge customizations from ${sourceBranch}"`);
          log.info(`  node scripts/migration-helper.js --continue`);
          process.exit(1);
        }
      } else {
        log.info('Please resolve conflicts manually');
        log.info('After resolving, continue with: node scripts/migration-helper.js --continue');
        process.exit(1);
      }
    }
  }

  // Step 6: Check for Removed Features
  log.step(6, 'Check for Removed Features');

  const removedFeatures = await detectRemovedFeatures(targetBranch);

  if (removedFeatures.length > 0) {
    log.warning(`Found ${removedFeatures.length} feature(s) that were removed from target PWA`);
    await handleRemovedFeatures(removedFeatures);

    // Check if there are changes to commit
    const status = exec('git status --porcelain', true);
    if (status.success && status.output) {
      const commitChanges = await ask('\nCommit feature removal changes?');
      if (commitChanges) {
        exec(`git commit -am "chore: handle removed features"`);
        log.success('Feature removal changes committed');
      }
    }
  } else {
    log.success('No removed features detected');
  }

  // Step 7: Run Automated Fixes
  await runAutomatedFixes();

  // Step 8: Generate report
  log.step(8, 'Generate Migration Report');
  await generateReport(sourceBranch, targetBranch, migrationBranch);

  // Final summary
  console.log(`
${colors.green}╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║            Migration Process Complete! ✓                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}
  `);

  log.info(`Migration branch: ${migrationBranch}`);
  log.info(`Review changes: git diff ${targetBranch}`);
  log.info(`Run tests: npm test`);
  log.info(`Push branch: git push -u gitlab ${migrationBranch}`);
}

async function runAutomatedFixes() {
  log.step(7, 'Run Automated Fixes');

  // Check if node_modules exists
  if (!fs.existsSync('node_modules')) {
    log.info('Installing dependencies...');
    exec('npm ci --prefer-offline --no-audit');
  }

  const runLint = await ask('Run ESLint auto-fix?');
  if (runLint) {
    log.info('Running ESLint...');
    exec('npm run lint -- --fix 2>&1 || true');
  }

  const runFormat = await ask('Run Prettier formatting?');
  if (runFormat) {
    log.info('Running Prettier...');
    exec('npm run format 2>&1 || true');
  }

  // Commit auto-fixes
  const hasChanges = exec('git diff-index --quiet HEAD --', true);
  if (!hasChanges.success) {
    exec('git add -A');
    exec('git commit -m "chore: apply automated code formatting and linting fixes"');
    log.success('Auto-fixes committed');
  }

  const runBuild = await ask('Test build?');
  if (runBuild) {
    log.info('Building...');
    const build = exec('npm run build');
    if (build.success) {
      log.success('Build successful!');
    } else {
      log.error('Build failed');
    }
  }
}

async function generateReport(sourceBranch, targetBranch, migrationBranch) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const reportFile = `MIGRATION_REPORT_${timestamp}.md`;

  const changedFiles = exec(`git diff --name-only ${targetBranch} ${migrationBranch}`, true);

  const report = `# Migration Report

**Date:** ${new Date().toLocaleString()}  
**Source Branch:** ${sourceBranch}  
**Target Branch:** ${targetBranch}  
**Migration Branch:** ${migrationBranch}

## Summary

This report documents the migration of customizations from ${sourceBranch} to ${targetBranch}.

## Files Changed

\`\`\`
${changedFiles.output || 'No files changed'}
\`\`\`

## Next Steps

### 1. Review Changes
\`\`\`bash
git diff ${targetBranch}..${migrationBranch}
\`\`\`

### 2. Manual Migration Tasks

Based on the [Migration Guide](docs/guides/migrations.md):

- [ ] Update control flow syntax (@if, @for)
- [ ] Convert class guards to functional guards
- [ ] Migrate to standalone components where applicable
- [ ] Update Formly configurations (templateOptions → props)
- [ ] Replace Font Awesome icons with Bootstrap Icons
- [ ] Update environment configurations
- [ ] Review and update test files

### 3. Testing

\`\`\`bash
# Run tests
npm test

# Run e2e tests  
npm run e2e:local

# Check build
npm run build

# Lint
npm run lint
\`\`\`

### 4. Documentation

- [ ] Update project README
- [ ] Document breaking changes
- [ ] Update deployment docs

## Resources

- [PWA Migration Guide](docs/guides/migrations.md)
- [Component Patterns](.github/instructions/component-patterns.instructions.md)
- [Testing Patterns](.github/instructions/testing-patterns.instructions.md)
- [State Management](.github/instructions/state-management-patterns.instructions.md)
`;

  fs.writeFileSync(reportFile, report);
  log.success(`Migration report saved: ${reportFile}`);
}

// Handle --continue flag
if (process.argv.includes('--continue')) {
  (async () => {
    try {
      log.info('Continuing migration...');
      await runAutomatedFixes();
      log.success('Migration continued successfully');
    } catch (error) {
      log.error(`Migration continuation failed: ${error.message}`);
      process.exit(1);
    }
  })();
} else {
  main().catch(error => {
    log.error(`Migration failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}
