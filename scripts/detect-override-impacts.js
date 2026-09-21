#!/usr/bin/env node

/**
 * Detect Override Impacts: Find affected .multi/.performance/.modern override files
 *
 * When standard files change during a migration, override files that extend them
 * may need to be updated. This script identifies all affected override files
 * based on the Intershop PWA's theme override mechanism.
 *
 * Override hierarchy (layered, each extends the previous):
 *   standard → .multi → .performance → .modern
 *
 * Usage:
 *   node scripts/detect-override-impacts.js [OPTIONS]
 *
 * Options:
 *   --changed-files <file>      File containing list of changed files (one per line)
 *   --source <ref>              Git ref for source version (e.g., 9.0.0)
 *   --target <ref>              Git ref for target version (e.g., 10.0.0)
 *   --themes <list>             Comma-separated theme names (default: multi,performance,modern)
 *   --project-dir <dir>         Path to PWA project (default: cwd)
 *   --json                      Output as JSON instead of human-readable
 *   --help                      Show this help message
 */

const fs = require('fs');
const path = require('path');
const { log, execFileSilent, execSilent, chalk } = require('./_utils');
const { projectDir } = require('./_project-dir');

// Parse arguments
const args = process.argv.slice(2);
let changedFilesPath = '';
let sourceRef = '';
let targetRef = '';
let themes = ['multi', 'performance', 'modern'];
let outputJson = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--changed-files': changedFilesPath = args[++i]; break;
    case '--source': sourceRef = args[++i]; break;
    case '--target': targetRef = args[++i]; break;
    case '--themes': themes = args[++i].split(',').map(t => t.trim()); break;
    case '--project-dir': /* handled by _project-dir.js */ i++; break;
    case '--json': outputJson = true; break;
    case '--help':
      console.log(`Usage: node scripts/detect-override-impacts.js [OPTIONS]

Options:
  --changed-files <file>   File containing list of changed standard files (one per line)
  --source <ref>           Git ref for source version (to auto-detect changed files)
  --target <ref>           Git ref for target version (to auto-detect changed files)
  --themes <list>          Comma-separated theme names (default: multi,performance,modern)
  --project-dir <dir>      Path to PWA project (default: cwd)
  --json                   Output as JSON

Examples:
  # From a file list
  node scripts/detect-override-impacts.js --changed-files changed.txt

  # From git diff between versions
  node scripts/detect-override-impacts.js --source 9.0.0 --target 10.0.0

  # Custom themes
  node scripts/detect-override-impacts.js --source 9.0.0 --target 10.0.0 --themes edezz,multi,performance,modern`);
      process.exit(0);
  }
}

/**
 * Get the list of changed standard files (files without theme suffixes).
 */
function getChangedFiles() {
  let files = [];

  if (changedFilesPath) {
    // From file
    if (!fs.existsSync(changedFilesPath)) {
      log.error(`File not found: ${changedFilesPath}`);
      process.exit(1);
    }
    files = fs.readFileSync(changedFilesPath, 'utf-8').split('\n').filter(Boolean);
  } else if (sourceRef && targetRef) {
    // From git diff
    const diff = execFileSilent('git', ['diff', '--name-only', sourceRef, targetRef], projectDir);
    if (!diff) {
      log.error(`Could not get diff between ${sourceRef} and ${targetRef}`);
      log.info('Make sure the refs exist. Try: git fetch --tags');
      process.exit(1);
    }
    files = diff.split('\n').filter(Boolean);
  } else {
    log.error('Please provide either --changed-files or --source/--target refs');
    process.exit(1);
  }

  // Filter: only .ts, .html, .scss files in src/ or projects/ (standard files)
  return files.filter(f => {
    const ext = path.extname(f);
    if (!['.ts', '.html', '.scss'].includes(ext)) return false;
    if (!f.startsWith('src/') && !f.startsWith('projects/')) return false;
    // Exclude files that are themselves overrides
    if (themes.some(t => f.includes(`.${t}.`))) return false;
    // Exclude spec files
    if (f.endsWith('.spec.ts')) return false;
    return true;
  });
}

/**
 * For a given standard file, find all existing override files.
 * E.g., for "src/app/foo.component.ts" find:
 *   - src/app/foo.component.multi.ts
 *   - src/app/foo.component.performance.ts
 *   - src/app/foo.component.modern.ts
 */
function findOverrideFiles(standardFile) {
  const dir = path.dirname(standardFile);
  const ext = path.extname(standardFile);
  const base = path.basename(standardFile, ext);
  const overrides = [];

  for (const theme of themes) {
    const overrideName = `${base}.${theme}${ext}`;
    const overridePath = path.join(dir, overrideName);
    const fullPath = path.join(projectDir, overridePath);

    if (fs.existsSync(fullPath)) {
      overrides.push({
        theme,
        file: overridePath,
        exists: true,
      });
    }
  }

  return overrides;
}

/**
 * Determine which override files are "downstream" and need review.
 * The override chain is: standard → multi → performance → modern
 * If standard changes, ALL overrides need review.
 * If .multi changes, .performance and .modern need review.
 */
function getDownstreamThemes(changedTheme) {
  const chain = ['standard', ...themes]; // e.g., ['standard', 'multi', 'performance', 'modern']
  const idx = chain.indexOf(changedTheme);
  if (idx === -1) return themes; // unknown theme, check all
  return chain.slice(idx + 1);
}

// ─── Main ───────────────────────────────────────────────────────────────────

const changedFiles = getChangedFiles();

if (changedFiles.length === 0) {
  if (!outputJson) log.info('No relevant standard files changed.');
  else console.log(JSON.stringify({ impacts: [], summary: { total: 0 } }));
  process.exit(0);
}

if (!outputJson) {
  log.header('Override Impact Analysis');
  log.info(`Analyzing ${changedFiles.length} changed standard file(s)`);
  log.info(`Themes: ${themes.join(', ')}`);
  log.info(`Override chain: standard → ${themes.join(' → ')}`);
  console.log();
}

const impacts = [];

for (const file of changedFiles) {
  const overrides = findOverrideFiles(file);
  if (overrides.length > 0) {
    impacts.push({
      standardFile: file,
      overrides,
    });
  }
}

if (outputJson) {
  console.log(JSON.stringify({
    impacts,
    summary: {
      changedStandardFiles: changedFiles.length,
      affectedStandardFiles: impacts.length,
      totalOverrideFiles: impacts.reduce((sum, i) => sum + i.overrides.length, 0),
      themes,
    },
  }, null, 2));
} else {
  if (impacts.length === 0) {
    log.success('No override files affected by the changed standard files.');
    log.info(`Checked ${changedFiles.length} changed file(s), none have .${themes.join('/.')} overrides.`);
  } else {
    log.warning(`Found ${impacts.length} standard file(s) with override files that need review:`);
    console.log();

    let totalOverrides = 0;
    for (const { standardFile, overrides } of impacts) {
      console.log(`  ${chalk.yellow(standardFile)}`);
      for (const { theme, file } of overrides) {
        console.log(`    → ${chalk.cyan(file)} (${theme})`);
        totalOverrides++;
      }
      console.log();
    }

    log.info('Summary:');
    log.info(`  Changed standard files:    ${changedFiles.length}`);
    log.info(`  With override files:       ${impacts.length}`);
    log.info(`  Total overrides to review: ${totalOverrides}`);
    console.log();
    log.info('ACTION REQUIRED: Review each override file above.');
    log.info('For each override, decide: keep as-is, adapt to match upstream changes, or remove.');
    console.log();
    log.info('Tip: Use --json flag to pipe output to other tools or AI assistants.');
  }
}
