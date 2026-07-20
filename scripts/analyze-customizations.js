#!/usr/bin/env node

/**
 * Analyze Customizations: Overview of custom vs. standard files
 *
 * Provides a clear overview of the customization landscape BEFORE migration:
 *   - Custom files (project-specific, not in standard PWA)
 *   - Customized standard files (standard files modified by the project)
 *   - Unchanged standard files (untouched, will auto-update)
 *   - Updated upstream files (changed in the new PWA version)
 *   - Conflict-prone files (both customized AND updated upstream)
 *
 * Works with any git hosting (Azure DevOps, GitHub, GitLab, Bitbucket).
 * The standard PWA is always the Intershop GitHub remote.
 *
 * Usage:
 *   node scripts/analyze-customizations.js [OPTIONS]
 *
 * Options:
 *   --source-branch <branch>    Your custom branch (default: current branch)
 *   --target-tag <tag>          Target PWA version tag (e.g., 10.0.0)
 *   --target-branch <branch>   Target PWA version branch
 *   --intershop-remote <name>  Name of Intershop PWA remote (default: auto-detect)
 *   --themes <list>            Comma-separated theme names for override detection
 *   --json                     Output as JSON
 *   --project-dir <dir>        Path to PWA project (default: cwd)
 *   --help                     Show this help message
 */

const fs = require('fs');
const path = require('path');
const { log, exec, execSilent, chalk } = require('./_utils');

// Parse arguments
const args = process.argv.slice(2);
let sourceBranch = '';
let targetBranch = '';
let targetTag = '';
let intershopRemote = '';
let themes = [];
let outputJson = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--source-branch': sourceBranch = args[++i]; break;
    case '--target-branch': targetBranch = args[++i]; break;
    case '--target-tag': targetTag = args[++i]; break;
    case '--intershop-remote': intershopRemote = args[++i]; break;
    case '--themes': themes = args[++i].split(',').map(t => t.trim()); break;
    case '--project-dir': i++; break; // handled by _project-dir.js
    case '--json': outputJson = true; break;
    case '--help':
      console.log(`Usage: node scripts/analyze-customizations.js [OPTIONS]

Options:
  --source-branch <branch>    Your custom branch (default: current branch)
  --target-tag <tag>          Target PWA version tag (e.g., 10.0.0)
  --target-branch <branch>    Target PWA version branch
  --intershop-remote <name>   Name of Intershop PWA remote (default: auto-detect)
  --themes <list>             Comma-separated override theme names (e.g., multi,performance,modern)
  --json                      Output as JSON
  --project-dir <dir>         Path to PWA project (default: cwd)

Examples:
  # Analyze before migrating from 9.0.0 to 10.0.0
  node scripts/analyze-customizations.js --target-tag 10.0.0

  # With explicit source branch
  node scripts/analyze-customizations.js --source-branch develop --target-tag 10.0.0

  # With override theme detection
  node scripts/analyze-customizations.js --target-tag 10.0.0 --themes multi,performance,modern`);
      process.exit(0);
  }
}

// ─── Setup ──────────────────────────────────────────────────────────────────

// Detect current branch if not specified
if (!sourceBranch) {
  sourceBranch = execSilent('git rev-parse --abbrev-ref HEAD');
  if (!sourceBranch) {
    log.error('Could not detect current branch. Use --source-branch.');
    process.exit(1);
  }
}

// Auto-detect Intershop remote
if (!intershopRemote) {
  for (const remote of ['upstream', 'intershop-pwa', 'intershop', 'origin']) {
    const url = execSilent(`git remote get-url ${remote} 2>/dev/null`);
    if (url && url.includes('intershop/intershop-pwa')) {
      intershopRemote = remote;
      break;
    }
  }
  if (!intershopRemote) {
    log.error('Could not auto-detect Intershop PWA remote.');
    log.info('Add it with: git remote add intershop https://github.com/intershop/intershop-pwa.git');
    log.info('Or specify with: --intershop-remote <name>');
    process.exit(1);
  }
}

// Resolve target
if (targetTag) {
  for (const prefix of ['', 'tags/', `${intershopRemote}/`]) {
    if (execSilent(`git rev-parse "${prefix}${targetTag}" 2>/dev/null`)) {
      targetBranch = `${prefix}${targetTag}`;
      break;
    }
  }
  if (!targetBranch) {
    log.error(`Tag '${targetTag}' not found. Try: git fetch ${intershopRemote} --tags`);
    process.exit(1);
  }
} else if (!targetBranch) {
  log.error('Please specify --target-tag or --target-branch');
  process.exit(1);
}

// ─── Analysis ───────────────────────────────────────────────────────────────

if (!outputJson) {
  log.header('Customization Analysis');
  log.info(`Source (your project):  ${sourceBranch}`);
  log.info(`Target (new PWA):      ${targetBranch}`);
  log.info(`Intershop remote:      ${intershopRemote}`);
  if (themes.length > 0) log.info(`Override themes:       ${themes.join(', ')}`);
  console.log();
}

// Find the common ancestor (where project forked from standard PWA)
const mergeBase = execSilent(`git merge-base "${sourceBranch}" "${targetBranch}" 2>/dev/null`);
if (!mergeBase) {
  log.error('Could not find merge base between source and target.');
  log.info('Ensure both branches share a common history (Intershop PWA base).');
  process.exit(1);
}

const mergeBaseShort = mergeBase.substring(0, 8);
if (!outputJson) {
  log.info(`Common ancestor:       ${mergeBaseShort}`);
  console.log();
}

// 1. Files changed by the PROJECT (source vs merge-base) = customizations
const projectChangesRaw = execSilent(`git diff --name-status "${mergeBase}" "${sourceBranch}" 2>/dev/null`);
const projectChanges = projectChangesRaw ? projectChangesRaw.split('\n').filter(Boolean).map(line => {
  const [status, ...fileParts] = line.split('\t');
  return { status: status[0], file: fileParts[fileParts.length - 1] };
}) : [];

// 2. Files changed UPSTREAM (merge-base vs target) = what the new version brings
const upstreamChangesRaw = execSilent(`git diff --name-status "${mergeBase}" "${targetBranch}" 2>/dev/null`);
const upstreamChanges = upstreamChangesRaw ? upstreamChangesRaw.split('\n').filter(Boolean).map(line => {
  const [status, ...fileParts] = line.split('\t');
  return { status: status[0], file: fileParts[fileParts.length - 1] };
}) : [];

// Build lookup sets
const projectFileMap = new Map(projectChanges.map(c => [c.file, c.status]));
const upstreamFileMap = new Map(upstreamChanges.map(c => [c.file, c.status]));

// 3. Files that exist in source but not in standard (project added them)
const allSourceFiles = execSilent(`git ls-tree -r --name-only "${sourceBranch}" 2>/dev/null`);
const allTargetFiles = execSilent(`git ls-tree -r --name-only "${targetBranch}" 2>/dev/null`);
const targetFileSet = new Set(allTargetFiles ? allTargetFiles.split('\n').filter(Boolean) : []);

// ─── Categorize ─────────────────────────────────────────────────────────────

// Filter for relevant source files (src/, projects/)
const relevantFilter = f => f.startsWith('src/') || f.startsWith('projects/');
const isOverrideFile = f => themes.length > 0 && themes.some(t => f.includes(`.${t}.`));

const categories = {
  // Custom-only: files added by project, not in standard PWA
  customOnly: [],
  // Override files: .multi/.performance/.modern theme overrides
  overrideFiles: [],
  // Customized standard: standard files modified by the project
  customizedStandard: [],
  // Conflict-prone: customized AND updated upstream
  conflictProne: [],
  // Updated upstream only: changed in new version, NOT customized
  updatedUpstream: [],
  // Deleted upstream: removed in new version
  deletedUpstream: [],
  // Unchanged: not touched by either side
  unchanged: 0,
};

// Process project changes
for (const { file, status } of projectChanges) {
  if (!relevantFilter(file)) continue;

  if (status === 'A' || !targetFileSet.has(file)) {
    // File added by project or doesn't exist in standard
    if (isOverrideFile(file)) {
      categories.overrideFiles.push(file);
    } else {
      categories.customOnly.push(file);
    }
  } else if (status === 'M' || status === 'D') {
    // Standard file modified/deleted by project
    if (upstreamFileMap.has(file)) {
      categories.conflictProne.push({
        file,
        projectChange: status,
        upstreamChange: upstreamFileMap.get(file),
      });
    } else {
      categories.customizedStandard.push({ file, status });
    }
  }
}

// Process upstream-only changes (not customized)
for (const { file, status } of upstreamChanges) {
  if (!relevantFilter(file)) continue;
  if (projectFileMap.has(file)) continue; // already in customized or conflict-prone

  if (status === 'D') {
    categories.deletedUpstream.push(file);
  } else {
    categories.updatedUpstream.push(file);
  }
}

// Count unchanged (rough estimate)
if (allSourceFiles && allTargetFiles) {
  const sourceFiles = allSourceFiles.split('\n').filter(f => f && relevantFilter(f));
  const touchedFiles = new Set([
    ...projectChanges.map(c => c.file),
    ...upstreamChanges.map(c => c.file),
  ]);
  categories.unchanged = sourceFiles.filter(f => !touchedFiles.has(f)).length;
}

// ─── Output ─────────────────────────────────────────────────────────────────

if (outputJson) {
  console.log(JSON.stringify({
    source: sourceBranch,
    target: targetBranch,
    mergeBase: mergeBaseShort,
    themes,
    categories: {
      customOnly: categories.customOnly,
      overrideFiles: categories.overrideFiles,
      customizedStandard: categories.customizedStandard.map(c => c.file),
      conflictProne: categories.conflictProne,
      updatedUpstream: categories.updatedUpstream.length,
      deletedUpstream: categories.deletedUpstream,
      unchanged: categories.unchanged,
    },
    summary: {
      customOnly: categories.customOnly.length,
      overrideFiles: categories.overrideFiles.length,
      customizedStandard: categories.customizedStandard.length,
      conflictProne: categories.conflictProne.length,
      updatedUpstream: categories.updatedUpstream.length,
      deletedUpstream: categories.deletedUpstream.length,
      unchanged: categories.unchanged,
    },
  }, null, 2));
  process.exit(0);
}

// Human-readable output
console.log();

// ── Conflict-prone files (most important)
if (categories.conflictProne.length > 0) {
  log.section(`CONFLICT-PRONE: Customized AND updated upstream (${categories.conflictProne.length})`);
  log.info('These files WILL likely cause merge conflicts. Plan review time for each.');
  console.log();
  for (const { file, projectChange, upstreamChange } of categories.conflictProne) {
    const pLabel = projectChange === 'M' ? 'modified' : projectChange === 'D' ? 'deleted' : projectChange;
    const uLabel = upstreamChange === 'M' ? 'modified' : upstreamChange === 'D' ? 'deleted' : upstreamChange === 'A' ? 'added' : upstreamChange;
    console.log(`  ${chalk.red(file)}`);
    console.log(`    project: ${pLabel}, upstream: ${uLabel}`);
  }
  console.log();
}

// ── Custom-only files
if (categories.customOnly.length > 0) {
  log.section(`CUSTOM FILES: Project-specific, not in standard PWA (${categories.customOnly.length})`);
  log.info('These are your own files. They won\'t be affected by the migration.');
  console.log();
  categories.customOnly.slice(0, 30).forEach(f => console.log(`  ${chalk.green(f)}`));
  if (categories.customOnly.length > 30) log.info(`  ... and ${categories.customOnly.length - 30} more`);
  console.log();
}

// ── Override files
if (categories.overrideFiles.length > 0) {
  log.section(`OVERRIDE FILES: Theme overrides .${themes.join('/.')} (${categories.overrideFiles.length})`);
  log.info('These extend standard files. Check if the base file changed upstream.');
  console.log();
  categories.overrideFiles.slice(0, 30).forEach(f => console.log(`  ${chalk.cyan(f)}`));
  if (categories.overrideFiles.length > 30) log.info(`  ... and ${categories.overrideFiles.length - 30} more`);
  console.log();
}

// ── Customized standard files (no upstream change)
if (categories.customizedStandard.length > 0) {
  log.section(`CUSTOMIZED STANDARD: Modified standard files, no upstream change (${categories.customizedStandard.length})`);
  log.info('These were modified by your project but NOT changed in the new version. Safe.');
  console.log();
  categories.customizedStandard.slice(0, 30).forEach(({ file, status }) => {
    const label = status === 'D' ? chalk.red('deleted') : chalk.yellow('modified');
    console.log(`  ${file} (${label})`);
  });
  if (categories.customizedStandard.length > 30) log.info(`  ... and ${categories.customizedStandard.length - 30} more`);
  console.log();
}

// ── Updated upstream (not customized)
if (categories.updatedUpstream.length > 0) {
  log.section(`UPDATED UPSTREAM: Changed in new version, NOT customized (${categories.updatedUpstream.length})`);
  log.info('These will auto-update cleanly during migration. No action needed.');
  console.log();
}

// ── Deleted upstream
if (categories.deletedUpstream.length > 0) {
  log.section(`DELETED UPSTREAM: Removed in the new version (${categories.deletedUpstream.length})`);
  log.info('These files no longer exist in the new PWA. Check for references.');
  console.log();
  categories.deletedUpstream.slice(0, 20).forEach(f => console.log(`  ${chalk.dim(f)}`));
  if (categories.deletedUpstream.length > 20) log.info(`  ... and ${categories.deletedUpstream.length - 20} more`);
  console.log();
}

// ── Summary
log.header('Summary');
console.log();
const total = categories.customOnly.length + categories.overrideFiles.length
  + categories.customizedStandard.length + categories.conflictProne.length
  + categories.updatedUpstream.length + categories.unchanged;

console.log(`  ${chalk.red('⚠ Conflict-prone')}       ${String(categories.conflictProne.length).padStart(5)}  ← review required`);
console.log(`  ${chalk.green('✚ Custom files')}          ${String(categories.customOnly.length).padStart(5)}  ← your own, safe`);
if (themes.length > 0) {
  console.log(`  ${chalk.cyan('◈ Override files')}         ${String(categories.overrideFiles.length).padStart(5)}  ← check base changes`);
}
console.log(`  ${chalk.yellow('✎ Customized standard')}   ${String(categories.customizedStandard.length).padStart(5)}  ← safe (no upstream change)`);
console.log(`  ${chalk.blue('↑ Updated upstream')}      ${String(categories.updatedUpstream.length).padStart(5)}  ← auto-update`);
if (categories.deletedUpstream.length > 0) {
  console.log(`  ${chalk.dim('✗ Deleted upstream')}      ${String(categories.deletedUpstream.length).padStart(5)}  ← check references`);
}
console.log(`  ${chalk.dim('─ Unchanged')}             ${String(categories.unchanged).padStart(5)}  ← no action`);
console.log();

if (categories.conflictProne.length > 0) {
  const effort = categories.conflictProne.length <= 5 ? 'Low' :
    categories.conflictProne.length <= 20 ? 'Medium' :
    categories.conflictProne.length <= 50 ? 'High' : 'Very High';
  log.info(`Estimated migration effort: ${effort} (${categories.conflictProne.length} conflict-prone file(s))`);
}

console.log();
log.info('Tip: Use --json flag to pipe output to other tools or AI assistants.');
