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

// Video tutorials for specific version ranges
const VIDEO_TUTORIALS = [
  { sourceMin: 7, sourceMax: 7, targetMin: 8, targetMax: 8, title: 'Migrating from PWA 7.0 to 8.0', url: 'https://public.academy.intershop.com/plus/catalog/courses/452' },
  { sourceMin: 8, sourceMax: 8, targetMin: 9, targetMax: 9, title: 'Migrating from PWA 8.0 to 9.0', url: 'https://public.academy.intershop.com/plus/catalog/courses/454' },
  { sourceMin: 9, sourceMax: 9, targetMin: 11, targetMax: 11, title: 'Migrating from PWA 9.0 to 11.0', url: 'https://public.academy.intershop.com/plus/catalog/courses/488' },
];

function showVideoTutorials(sourceBranch, targetBranch) {
  const srcMatch = sourceBranch.match(/(\d+)\.\d+/);
  const tgtMatch = targetBranch.match(/(\d+)\.\d+/);
  if (!srcMatch || !tgtMatch) return;
  const srcMajor = parseInt(srcMatch[1]);
  const tgtMajor = parseInt(tgtMatch[1]);
  const matches = VIDEO_TUTORIALS.filter(t => srcMajor >= t.sourceMin && srcMajor <= t.sourceMax && tgtMajor >= t.targetMin && tgtMajor <= t.targetMax);
  if (matches.length > 0) {
    console.log();
    log.info('Video Tutorial(s) available:');
    matches.forEach(t => { console.log(`  ${t.title}`); console.log(`  ${chalk.cyan(t.url)}`); });
    console.log();
  }
}

// Smart conflict resolution: merge imports from both sides
// Only auto-resolves conflict blocks that contain EXCLUSIVELY import statements.
// Mixed blocks (imports + code) are left with conflict markers for manual review.
function autoResolveImports(file, content) {
  const lines = content.split('\n');
  const resolved = [];
  let inConflict = false;
  let conflictType = null;
  let oursLines = [];
  let theirsLines = [];
  let conflictStartMarker = '';
  let conflictEndMarker = '';
  let hasUnresolved = false;

  function isImportOrEmpty(line) {
    const trimmed = line.trim();
    return trimmed === '' || trimmed.startsWith('import ') || trimmed.startsWith('} from ');
  }

  for (const line of lines) {
    if (line.startsWith('<<<<<<<')) {
      inConflict = true;
      conflictType = 'ours';
      oursLines = [];
      theirsLines = [];
      conflictStartMarker = line;
    } else if (inConflict && line.startsWith('=======')) {
      conflictType = 'theirs';
    } else if (inConflict && line.startsWith('>>>>>>>')) {
      conflictEndMarker = line;
      const oursAllImports = oursLines.every(isImportOrEmpty);
      const theirsAllImports = theirsLines.every(isImportOrEmpty);

      if (oursAllImports && theirsAllImports) {
        // Safe: both sides are import-only — merge them
        const oursImports = oursLines.filter(l => l.trim() !== '');
        const theirsImports = theirsLines.filter(l => l.trim() !== '');
        resolved.push(...[...new Set([...oursImports, ...theirsImports])].sort());
      } else {
        // Unsafe: mixed content — keep conflict markers for manual review
        resolved.push(conflictStartMarker);
        resolved.push(...oursLines);
        resolved.push('=======');
        resolved.push(...theirsLines);
        resolved.push(conflictEndMarker);
        hasUnresolved = true;
      }
      inConflict = false;
    } else if (inConflict) {
      (conflictType === 'ours' ? oursLines : theirsLines).push(line);
    } else {
      resolved.push(line);
    }
  }

  // If we're still inside a conflict at EOF, don't write — file is malformed
  if (inConflict) return false;

  fs.writeFileSync(file, resolved.join('\n'));
  // Return 'partial' if some blocks were left unresolved, true if fully resolved
  if (hasUnresolved) return 'partial';
  return true;
}

// Smart conflict resolution: merge SCSS sections from both sides
// NOTE: In merge context, "ours" = target (new PWA), "theirs" = source (customizations).
// We keep both sides with clear markers so the developer can review.
function autoResolveStyles(file, content) {
  const lines = content.split('\n');
  const resolved = [];
  let inConflict = false;
  let conflictType = null;
  let oursStyles = [];
  let theirsStyles = [];

  for (const line of lines) {
    if (line.startsWith('<<<<<<<')) {
      inConflict = true; conflictType = 'ours'; oursStyles = []; theirsStyles = [];
    } else if (inConflict && line.startsWith('=======')) {
      conflictType = 'theirs';
    } else if (inConflict && line.startsWith('>>>>>>>')) {
      // ours = new PWA (target), theirs = customizations (source)
      resolved.push('  /* === Upstream (new PWA version) styles === */');
      resolved.push(...oursStyles);
      if (theirsStyles.length > 0) {
        resolved.push('');
        resolved.push('  /* === Custom styles (review: keep, adapt, or remove) === */');
        resolved.push(...theirsStyles);
      }
      inConflict = false;
    } else if (inConflict) {
      (conflictType === 'ours' ? oursStyles : theirsStyles).push(line);
    } else {
      resolved.push(line);
    }
  }
  if (inConflict) return false;
  fs.writeFileSync(file, resolved.join('\n'));
  return true;
}

// Extract values from a TypeScript `features:` array in environment files
function extractFeaturesArray(content) {
  const match = content.match(/features\s*:\s*\[([\s\S]*?)\]/);
  if (!match) return [];
  return match[1].match(/'([^']+)'|"([^"]+)"/g)?.map(s => s.replace(/['"]/g, '')) || [];
}

// Re-inject custom feature toggles into environment file content
function reinjectFeatureToggles(content, toggles) {
  const match = content.match(/(features\s*:\s*\[)([\s\S]*?)(\])/);
  if (!match) return content;
  const existing = extractFeaturesArray(content);
  const toAdd = toggles.filter(t => !existing.includes(t));
  if (toAdd.length === 0) return content;
  const existingBlock = match[2].trimEnd().replace(/,?\s*$/, '');
  const newEntries = toAdd.map(t => `'${t}'`).join(', ');
  const separator = existingBlock.trim() ? ', ' : '';
  return content.replace(match[0], `${match[1]}${existingBlock}${separator}${newEntries}${match[3]}`);
}

function findConflictMarkerFiles(files) {
  const markerPattern = /^(?:<{7}(?: .*)?|={7}|>{7}(?: .*)?|\|{7}(?: .*)?)$/m;
  return files.filter(file => {
    try {
      return markerPattern.test(fs.readFileSync(file, 'utf-8'));
    } catch {
      return false;
    }
  });
}

// Parse arguments
const args = process.argv.slice(2);
let sourceBranch = 'training_4.0.0';
let sourceBase = '';
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
    case '--source-base': sourceBase = args[++i]; break;
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
  --source-base <ref>          Upstream PWA baseline for the source (e.g. tag 5.2.0)
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
    const url = execSilent(`git remote get-url ${remote}`);
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
      if (execSilent(`git rev-parse "${prefix}${targetTag}"`)) {
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

  if (!execSilent(`git rev-parse --verify "${targetBranch}"`)) {
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
if (!execSilent(`git rev-parse --verify "${sourceBranch}"`)) {
  log.error(`Source branch '${sourceBranch}' does not exist`);
  process.exit(1);
}

if (!validateTarget()) process.exit(1);

const sourcePackageContent = execSilent(`git show "${sourceBranch}:package.json"`);
let sourceVersion = '';
if (sourcePackageContent) {
  try {
    sourceVersion = JSON.parse(sourcePackageContent).version || '';
  } catch (error) {
    if (error instanceof SyntaxError) {
      log.error(`Could not parse ${sourceBranch}:package.json: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

const sourceBaseCommit = sourceBase ? execSilent(`git rev-parse --verify "${sourceBase}^{commit}"`) : '';
if (sourceBase && !sourceBaseCommit) {
  log.error(`Source baseline '${sourceBase}' is not a valid commit or tag.`);
  process.exit(1);
}

if (sourceBaseCommit) {
  const baselinePackageContent = execSilent(`git show "${sourceBaseCommit}:package.json"`);
  if (baselinePackageContent && sourceVersion) {
    try {
      const baselineVersion = JSON.parse(baselinePackageContent).version;
      if (baselineVersion && baselineVersion !== sourceVersion) {
        log.error(`Source baseline '${sourceBase}' declares PWA ${baselineVersion}, but '${sourceBranch}' declares PWA ${sourceVersion}.`);
        log.info('Choose the upstream tag that matches the source PWA version. No migration branch was created.');
        process.exit(1);
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        log.error(`Could not parse ${sourceBase}:package.json: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }
  }
}

if (!sourceBaseCommit && sourceVersion && /^\d+\.\d+\.\d+$/.test(sourceVersion)) {
  const sourceTagRef = `refs/tags/${sourceVersion}`;
  if (execSilent(`git rev-parse --verify "${sourceTagRef}"`) &&
      !execSilent(`git merge-base --is-ancestor "${sourceTagRef}" "${sourceBranch}" && echo yes`)) {
    log.error(`Source branch '${sourceBranch}' declares PWA ${sourceVersion}, but tag '${sourceVersion}' is not in its history.`);
    log.info(`Retry with --source-base ${sourceVersion} after verifying that tag matches the source PWA baseline.`);
    process.exit(1);
  }
}

// Check uncommitted changes
if (execSilent('git diff-index HEAD --') !== '') {
  log.error('You have uncommitted changes. Please commit or stash them first.');
  process.exit(1);
}

if (execSilent(`git rev-parse --verify "${migrationBranch}"`)) {
  log.error(`Migration branch '${migrationBranch}' already exists. It was not changed.`);
  log.info('Choose a new --migration-branch name, or inspect and remove the old branch yourself.');
  process.exit(1);
}

const historyMergeBase = execSilent(`git merge-base "${sourceBranch}" "${targetBranch}"`);
const migrationBase = sourceBaseCommit || historyMergeBase;
if (!migrationBase) {
  log.error(`No common ancestor found between '${sourceBranch}' and '${targetBranch}'.`);
  log.info('Specify --source-base with the upstream PWA commit or tag matching the source tree.');
  process.exit(1);
}

if (!execSilent(`git merge-base --is-ancestor "${migrationBase}" "${targetBranch}" && echo yes`)) {
  log.error(`Migration base '${sourceBase || migrationBase}' is not an ancestor of target '${targetBranch}'.`);
  log.info('Choose a target version that descends from the source baseline, or establish a separate migration plan.');
  process.exit(1);
}

log.info('============================================');
log.info('Automated PWA Migration');
log.info('============================================');
log.info(`Source Branch (Customizations): ${sourceBranch}`);
log.info(`Source PWA Baseline: ${sourceBase || historyMergeBase}`);
log.info(`Target Branch (New PWA Version): ${targetBranch}`);
log.info(`Migration Branch: ${migrationBranch}`);
log.info(`Auto-resolve conflicts: ${autoResolve}`);
log.info(`Dry Run: ${dryRun}`);
log.info('============================================');
showVideoTutorials(sourceBranch, targetTag || targetBranch);
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
  const checkoutResult = exec(`git checkout "${targetBranch}"`, { silent: true });
  if (!checkoutResult.success) {
    log.error(`Could not check out target '${targetBranch}'.`);
    console.log(checkoutResult.error || checkoutResult.output);
    process.exit(1);
  }
  const branchResult = exec(`git checkout -b "${migrationBranch}"`, { silent: true });
  if (!branchResult.success) {
    log.error(`Could not create migration branch '${migrationBranch}'.`);
    console.log(branchResult.error || branchResult.output);
    process.exit(1);
  }
  log.success('Migration branch created');
} else {
  log.info(`Would create branch: ${migrationBranch} from ${targetBranch}`);
}
console.log();

// Step 2: Identify customization files
log.info('Step 2: Analyzing customization files...');
let customFilesList = '';
if (!dryRun) {
  customFilesList = execSilent(`git diff --name-only "${migrationBase}" "${sourceBranch}"`);
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

// Step 2b: Detect file renames/moves between versions
log.info('Step 2b: Detecting file renames/moves between versions...');
if (!dryRun) {
  // Detect renames between the target (new PWA) and the merge-base of source
  const renameBase = migrationBase;
  if (renameBase) {
    const renames = execSilent(`git diff --name-status --find-renames --diff-filter=R "${renameBase}" "${targetBranch}"`);
    const deletes = execSilent(`git diff --name-status --diff-filter=D "${renameBase}" "${targetBranch}"`);

    const renamedFiles = renames ? renames.split('\n').filter(Boolean).map(line => {
      const parts = line.split('\t');
      return { similarity: parts[0], from: parts[1], to: parts[2] };
    }) : [];

    const deletedFiles = deletes ? deletes.split('\n').filter(Boolean).map(line => {
      const parts = line.split('\t');
      return { from: parts[1] };
    }) : [];

    if (renamedFiles.length > 0 || deletedFiles.length > 0) {
      console.log();
      if (renamedFiles.length > 0) {
        log.warning(`Detected ${renamedFiles.length} renamed/moved file(s) between versions:`);
        renamedFiles.forEach(({ from, to, similarity }) => {
          console.log(`  ${from}`);
          console.log(`    → ${to} (${similarity})`);
        });
        console.log();
        log.info('ACTION REQUIRED: If you have customizations in the OLD file paths above,');
        log.info('you must manually migrate those customizations to the NEW file paths.');
      }

      if (deletedFiles.length > 0) {
        console.log();
        log.warning(`Detected ${deletedFiles.length} deleted file(s) in the new version:`);
        deletedFiles.slice(0, 20).forEach(({ from }) => console.log(`  ${from}`));
        if (deletedFiles.length > 20) log.info(`  ... and ${deletedFiles.length - 20} more`);
        console.log();
        log.info('ACTION REQUIRED: If you have customizations in deleted files,');
        log.info('check if the functionality was moved elsewhere or removed entirely.');
      }

      // Cross-reference with customization files
      if (customFilesList) {
        const customFiles = customFilesList.split('\n').filter(Boolean);
        const affectedRenames = renamedFiles.filter(r => customFiles.includes(r.from));
        const affectedDeletes = deletedFiles.filter(d => customFiles.includes(d.from));

        if (affectedRenames.length > 0 || affectedDeletes.length > 0) {
          console.log();
          log.error('⚠ CRITICAL: Some of YOUR customized files were renamed/deleted in the new version:');
          affectedRenames.forEach(({ from, to }) => {
            console.log(`  ${chalk.red(from)} → ${chalk.green(to)}`);
          });
          affectedDeletes.forEach(({ from }) => {
            console.log(`  ${chalk.red(from)} (DELETED)`);
          });
          console.log();
          log.info('Your customizations in these files will NOT be automatically migrated.');
          log.info('You must manually move your changes to the new file locations.');
        }
      }
    } else {
      log.success('No file renames/moves detected between versions');
    }
  } else {
    log.warning('Could not determine merge base for rename detection');
  }
} else {
  log.info(`Would detect file renames/moves between ${sourceBranch} and ${targetBranch}`);
}
console.log();

// Pre-merge: Extract custom values from hybrid files (environment, docker-compose, i18n)
// These files need both upstream structure AND custom config preserved.
const ALWAYS_UPSTREAM_FILES = [
  'server.ts', 'package.json', 'package-lock.json',
  'angular.json', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.spec.json',
  'jest.config.ts', 'eslint.config.mjs',
];
const customFeatureToggles = new Map();
const customEnvironmentValues = new Map();

if (!dryRun) {
  log.info('Pre-merge: Extracting custom values from hybrid files...');
  // Extract custom feature toggles from environment files on the source branch
  const envFiles = execSilent(`git ls-tree -r --name-only "${sourceBranch}" -- "src/environments/"`);
  if (envFiles) {
    // Get upstream environment files for comparison
    for (const envFile of envFiles.split('\n').filter(Boolean)) {
      const customContent = execSilent(`git show "${sourceBranch}:${envFile}"`);
      const upstreamContent = execSilent(`git show "${targetBranch}:${envFile}"`);
      if (!customContent) continue;

      // Extract features array values from custom branch
      const customFeatures = extractFeaturesArray(customContent);
      const upstreamFeatures = upstreamContent ? extractFeaturesArray(upstreamContent) : [];

      // Find custom-only toggles (not in upstream)
      const customOnly = customFeatures.filter(f => !upstreamFeatures.includes(f));
      if (customOnly.length > 0) {
        customFeatureToggles.set(envFile, customOnly);
        log.info(`  ${envFile}: found ${customOnly.length} custom feature toggle(s): ${customOnly.join(', ')}`);
      }
    }
  }
  if (customFeatureToggles.size === 0) {
    log.info('  No custom feature toggles found in environment files');
  }
  console.log();
}

// Step 3: Merge source into migration branch
log.info('Step 3: Merging customizations into migration branch...');
if (!dryRun) {
  let mergeSourceRef = sourceBranch;
  if (sourceBaseCommit) {
    const sourceTree = execSilent(`git rev-parse "${sourceBranch}^{tree}"`);
    const bridgeResult = exec(`git commit-tree "${sourceTree}" -p "${sourceBranch}" -p "${sourceBaseCommit}" -m "chore: bridge ${sourceBranch} onto PWA baseline ${sourceBase}"`, { silent: true });
    if (!bridgeResult.success || !bridgeResult.output) {
      log.error('Could not create the synthetic source snapshot for the explicit baseline.');
      console.log(bridgeResult.error || bridgeResult.output);
      process.exit(1);
    }
    mergeSourceRef = bridgeResult.output;
    log.info(`Using a synthetic source snapshot based on ${sourceBase}; source branch remains unchanged.`);
  }

  const mergeResult = exec(`git merge --no-commit --no-ff "${mergeSourceRef}" 2>&1`, { silent: true });

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

      // Explicit ours/theirs guidance — critical for correct conflict resolution
      console.log(chalk.yellow('╔══════════════════════════════════════════════════════════════════╗'));
      console.log(chalk.yellow('║  IMPORTANT: Merge direction in this migration                   ║'));
      console.log(chalk.yellow('║                                                                 ║'));
      console.log(chalk.yellow(`║  --ours   = upstream ${(targetTag || targetBranch).padEnd(12)} (NEW PWA version)       ║`));
      console.log(chalk.yellow(`║  --theirs = ${sourceBranch.padEnd(20)} (YOUR custom branch)       ║`));
      console.log(chalk.yellow('║                                                                 ║'));
      console.log(chalk.yellow('║  To accept UPSTREAM version:  git checkout --ours -- <file>      ║'));
      console.log(chalk.yellow('║  To keep YOUR customization:  git checkout --theirs -- <file>    ║'));
      console.log(chalk.yellow('╚══════════════════════════════════════════════════════════════════╝'));
      console.log();

      if (autoResolve) {
        log.info('Step 3b: Attempting smart conflict resolution...');
        log.info('NOTE: In merge context, "ours" = target (new PWA), "theirs" = source (customizations)');
        console.log();

        // Collect files per strategy for separate commits
        const resolvedByImports = [];
        const resolvedByStyles = [];
        const resolvedByTests = [];
        const needsManualReview = [];

        for (const file of files) {
          log.info(`Processing: ${file}`);
          const content = fs.readFileSync(file, 'utf-8');

          // Strategy 1: Smart import merging for .ts files (import-only blocks)
          if (file.endsWith('.ts') && !file.endsWith('.spec.ts') && content.includes('import ')) {
            const result = autoResolveImports(file, content);
            if (result === true) {
              resolvedByImports.push(file);
              log.success('  ✓ Resolved (merged imports — all blocks were import-only)');
              continue;
            } else if (result === 'partial') {
              needsManualReview.push({ file, reason: 'mixed conflict blocks (some imports resolved, code conflicts remain)' });
              log.warning('  ⚠ Partially resolved (import-only blocks merged, code conflicts remain — needs manual review)');
              continue;
            }
          }

          // Strategy 2: Smart SCSS merging (keeps both sides with clear markers)
          if (file.endsWith('.scss') || file.endsWith('.css')) {
            if (autoResolveStyles(file, content)) {
              resolvedByStyles.push(file);
              log.success('  ✓ Resolved (merged styles — both sides kept with markers for review)');
              continue;
            }
          }

          // Strategy 3: Test files — keep customizations (theirs = source)
          if (file.endsWith('.spec.ts')) {
            const res = exec(`git checkout --theirs "${file}"`, { silent: true });
            if (res.success) {
              resolvedByTests.push(file);
              log.success('  ✓ Resolved (kept custom tests)');
              continue;
            }
          }

          // Strategy 4: No fallback — leave conflict for manual review
          needsManualReview.push({ file, reason: 'conflict requires manual review' });
          log.warning('  ⚠ Needs manual review (no safe auto-resolve strategy available)');
        }

        // Validation: check resolved files for leftover conflict markers before staging
        log.info('');
        log.info('Validating resolved files for leftover conflict markers...');
        const allResolved = [...resolvedByImports, ...resolvedByStyles, ...resolvedByTests];
        for (const file of allResolved) {
          try {
            const fileContent = fs.readFileSync(file, 'utf-8');
            if (/^<{7}\s|^>{7}\s/m.test(fileContent)) {
              // Remove from resolved lists, add to manual review
              [resolvedByImports, resolvedByStyles, resolvedByTests].forEach(list => {
                const idx = list.indexOf(file);
                if (idx !== -1) list.splice(idx, 1);
              });
              needsManualReview.push({ file, reason: 'leftover conflict markers detected after auto-resolve' });
              log.error(`  ✗ ${file} — conflict markers found, needs manual review`);
            }
          } catch (e) {
            // binary file or read error, skip validation
          }
        }

        // Stage safe resolutions, but create no commit while any conflict needs review.
        console.log();
        log.info('Step 3c: Staging resolved conflicts...');
        const resolvedFiles = [...resolvedByImports, ...resolvedByStyles, ...resolvedByTests];
        const stageFailures = resolvedFiles.filter(file => !exec(`git add -- "${file}"`, { silent: true }).success);
        if (stageFailures.length > 0) {
          log.error(`Could not stage ${stageFailures.length} automatically resolved file(s):`);
          stageFailures.forEach(file => console.log(`  ${file}`));
          process.exit(1);
        }

        // Summary
        console.log();
        const totalResolved = resolvedByImports.length + resolvedByStyles.length + resolvedByTests.length;
        log.info('Auto-resolution summary:');
        if (resolvedByImports.length > 0) log.info(`  Import conflicts resolved: ${resolvedByImports.length}`);
        if (resolvedByStyles.length > 0)  log.info(`  Style conflicts resolved:  ${resolvedByStyles.length}`);
        if (resolvedByTests.length > 0)   log.info(`  Test files resolved:       ${resolvedByTests.length}`);
        log.info(`  Total resolved: ${totalResolved}`);
        log.info(`  Needs manual review: ${needsManualReview.length}`);

        if (needsManualReview.length > 0) {
          console.log();
          log.warning(`${needsManualReview.length} file(s) need manual review:`);
          needsManualReview.forEach(({ file, reason }) => {
            console.log(`  ${file}`);
            console.log(`    → ${reason}`);
          });
          console.log();
          log.info('No merge commit was created. After resolving every conflict, verify markers and run:');
          log.info("  git grep -n -E '^(<<<<<<<|=======|>>>>>>>)'");
          log.info('  git add <resolved-files>');
          log.info(`  git commit -m 'feat: merge customizations from ${sourceBranch} (manual)'`);
          process.exit(1);
        } else {
          const remainingConflicts = execSilent('git diff --name-only --diff-filter=U');
          if (remainingConflicts) {
            log.error('Git still reports unresolved conflicts; no merge commit was created.');
            console.log(remainingConflicts);
            process.exit(1);
          }

          const stagedFiles = execSilent('git diff --cached --name-only').split('\n').filter(Boolean);
          const markerFiles = findConflictMarkerFiles(stagedFiles);
          if (markerFiles.length > 0) {
            log.error('Conflict markers remain in staged files; no merge commit was created:');
            markerFiles.forEach(file => console.log(`  ${file}`));
            process.exit(1);
          }

          const commitResult = exec(`git commit -m "feat: merge customizations from ${sourceBranch} (auto-resolved)"`, { silent: true });
          if (!commitResult.success) {
            log.error('Git could not create the merge commit.');
            console.log(commitResult.error || commitResult.output);
            process.exit(1);
          }
          log.success('All conflicts were resolved, checked for markers, and committed');
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

// Post-merge: Re-inject custom feature toggles into environment files
if (!dryRun && customFeatureToggles.size > 0) {
  log.info('Post-merge: Re-injecting custom feature toggles into environment files...');
  let togglesRestored = 0;
  for (const [envFile, toggles] of customFeatureToggles) {
    if (!fs.existsSync(envFile)) continue;
    const content = fs.readFileSync(envFile, 'utf-8');
    const updated = reinjectFeatureToggles(content, toggles);
    if (updated !== content) {
      fs.writeFileSync(envFile, updated, 'utf-8');
      togglesRestored += toggles.length;
      log.success(`  ${envFile}: restored ${toggles.join(', ')}`);
    } else {
      // Check if toggles are already present
      const existing = extractFeaturesArray(content);
      const missing = toggles.filter(t => !existing.includes(t));
      if (missing.length > 0) {
        log.warning(`  ${envFile}: could not auto-restore ${missing.join(', ')} — please add manually`);
      }
    }
  }
  if (togglesRestored > 0) {
    exec('git add src/environments/', { silent: true });
    exec(`git commit -m "fix: restore custom feature toggles in environment files\n\nRestored: ${[...customFeatureToggles.entries()].map(([f, t]) => `${f}: ${t.join(', ')}`).join('; ')}"`, { silent: true });
    log.success(`Restored ${togglesRestored} custom feature toggle(s)`);
  }
  console.log();
}

// Post-merge: Auto-resolve "always-upstream" conflict files
if (!dryRun) {
  const stillConflicted = execSilent('git diff --name-only --diff-filter=U');
  if (stillConflicted) {
    const conflictFiles = stillConflicted.split('\n').filter(Boolean);
    const autoUpstream = conflictFiles.filter(f => ALWAYS_UPSTREAM_FILES.includes(path.basename(f)));
    if (autoUpstream.length > 0) {
      log.info(`Auto-resolving ${autoUpstream.length} infrastructure file(s) to upstream version:`);
      for (const f of autoUpstream) {
        exec(`git checkout --ours -- "${f}"`, { silent: true });
        exec(`git add "${f}"`, { silent: true });
        log.success(`  ${f} → upstream (${targetTag || targetBranch})`);
      }
      exec(`git commit -m "fix: resolve infrastructure files to upstream version\n\nFiles: ${autoUpstream.join(', ')}"`, { silent: true });
      console.log();
    }
  }
}

// Post-merge verification: Ensure non-custom files match upstream exactly
if (!dryRun) {
  log.info('Post-merge verification: Checking non-custom files against upstream...');
  const upstreamRef = targetTag || targetBranch;
  const customFiles = customFilesList ? new Set(customFilesList.split('\n').filter(Boolean)) : new Set();

  // Get all tracked files
  const allFiles = execSilent('git ls-files');
  if (allFiles) {
    const filesToCheck = allFiles.split('\n').filter(f => {
      if (!f) return false;
      if (customFiles.has(f)) return false;
      // Only check source files, not generated/config
      if (!f.match(/\.(ts|html|scss|css)$/)) return false;
      // Skip custom directories
      if (f.includes('/extensions/') && customFiles.size > 0) return false;
      return true;
    });

    let restored = 0;
    const restoredFiles = [];
    for (const file of filesToCheck) {
      const upstreamContent = execSilent(`git show "${upstreamRef}:${file}"`);
      if (upstreamContent === null) continue;
      try {
        const currentContent = fs.readFileSync(file, 'utf-8');
        if (currentContent !== upstreamContent) {
          fs.writeFileSync(file, upstreamContent, 'utf-8');
          restored++;
          restoredFiles.push(file);
        }
      } catch { /* file might not exist locally */ }
    }

    if (restored > 0) {
      log.warning(`Restored ${restored} non-custom file(s) to upstream version (git auto-merge picked wrong hunks):`);
      restoredFiles.slice(0, 10).forEach(f => console.log(`  ${f}`));
      if (restoredFiles.length > 10) console.log(`  ... and ${restoredFiles.length - 10} more`);
      exec('git add -A', { silent: true });
      exec(`git commit -m "fix: restore ${restored} non-custom files to upstream version\n\nPost-merge verification detected files where git auto-merge picked wrong hunks."`, { silent: true });
    } else {
      log.success('All non-custom files match upstream — no corrections needed');
    }
  }
  console.log();
}

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

// Step 7: Pattern detection — show required action items
log.info('Step 7: Checking for required action items...');
const detectScript = path.join(__dirname, 'detect-pattern-changes.js');
if (fs.existsSync(detectScript)) {
  const svMatch = sourceBranch.match(/\d+\.\d+\.\d+/);
  const tvMatch2 = targetBranch.match(/\d+\.\d+\.\d+/);
  const sv = svMatch ? svMatch[0] : '4.0.0';
  const tv2 = tvMatch2 ? tvMatch2[0] : '12.0.0';
  if (!dryRun) {
    const detectResult = exec(`node "${detectScript}" ${sv} ${tv2}`, { silent: true });
    if (detectResult.output) {
      console.log(detectResult.output);
    }
  } else {
    log.info(`Would run: node scripts/detect-pattern-changes.js ${sv} ${tv2}`);
  }
} else {
  log.warning('detect-pattern-changes.js not found, skipping action items check');
}
console.log();

// Step 8: Generate report
log.info('Step 8: Generating migration report...');
const reportDate = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const reportFile = `MIGRATION_REPORT_${reportDate}.md`;

if (!dryRun) {
  const changedFiles = execSilent(`git diff --name-only "${targetBranch}" "${migrationBranch}"`) || 'Could not determine changed files';
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
if (dryRun) {
  log.info('Dry Run Complete - No migration branch or merge was created.');
} else {
  log.success('Migration Process Complete!');
}
log.info('============================================');
console.log();
const currentBranch = execSilent('git branch --show-current');
log.info(`Current branch: ${currentBranch}`);
if (dryRun) {
  log.info(`Planned migration branch: ${migrationBranch} (not created)`);
  log.info('Review the plan, then rerun without --dry-run to start the migration.');
} else {
  log.info(`Migration report: ${reportFile}`);
  console.log();
  log.info('Next steps:');
  log.info(`  1. Review changes: git diff ${targetBranch}`);
  log.info(`  2. Review migration report: cat ${reportFile}`);
  log.info('  3. Run tests: npm test');
  log.info('  4. Push only after review, and only to your project remote (never Intershop upstream).');
}
console.log();
