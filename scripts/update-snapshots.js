#!/usr/bin/env node

/**
 * Snapshot Update Manager
 *
 * Intelligently update Jest snapshots after migration while
 * detecting genuine test failures vs snapshot mismatches.
 *
 * Usage:
 *   node scripts/update-snapshots.js [options]
 *
 * Options:
 *   --all              Update all snapshots without review
 *   --interactive      Review each snapshot change before updating (default)
 *   --failed-only      Only update snapshots for failed tests
 *   --dry-run          Show what would be updated without making changes
 *   --pattern PATTERN  Only update snapshots matching pattern
 *   -h, --help         Show this help message
 */

const fs = require('fs');
const path = require('path');
const { log, exec, tempFile, chalk, askYesNo } = require('./_utils');

// Parse arguments
const args = process.argv.slice(2);
let mode = 'interactive';
let dryRun = false;
let pattern = '';

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--all': mode = 'all'; break;
    case '--interactive': mode = 'interactive'; break;
    case '--failed-only': mode = 'failed-only'; break;
    case '--dry-run': dryRun = true; break;
    case '--pattern': pattern = args[++i] || ''; break;
    case '-h': case '--help':
      console.log(`Usage: node scripts/update-snapshots.js [OPTIONS]

Intelligently update Jest snapshots after PWA migration.

This script helps manage snapshot updates by:
  1. Detecting snapshot mismatches vs genuine test failures
  2. Providing selective update options
  3. Showing diffs for review before updating
  4. Identifying tests that need manual intervention

OPTIONS:
  --all              Update all snapshots without review (use with caution)
  --interactive      Review each snapshot change before updating (default)
  --failed-only      Only update snapshots for failed tests
  --dry-run          Show what would be updated without making changes
  --pattern PATTERN  Only update snapshots matching pattern
  -h, --help         Show this help message

EXAMPLES:
  node scripts/update-snapshots.js
  node scripts/update-snapshots.js --all
  node scripts/update-snapshots.js --pattern "product.*"
  node scripts/update-snapshots.js --dry-run`);
      process.exit(0);
  }
}

log.header('📸 Snapshot Update Manager');

if (dryRun) {
  log.warning('DRY RUN MODE - No snapshots will be updated');
}

// Check if we're in a PWA project
const pkgPath = path.resolve('package.json');
if (!fs.existsSync(pkgPath) || !fs.readFileSync(pkgPath, 'utf-8').includes('intershop-pwa')) {
  log.error('Not in an Intershop PWA project directory');
  process.exit(1);
}

// Check if Jest is configured
if (!fs.existsSync(path.resolve('jest.config.js'))) {
  log.error('jest.config.js not found');
  process.exit(1);
}

log.section('Running Tests to Detect Snapshot Failures');

// Run tests and capture output
const tmpOutput = tempFile('snapshot-test-', '.log');
const patternFlag = pattern ? `-t ${pattern}` : '';

const testResult = exec(`npm test -- --no-coverage ${patternFlag} 2>&1`, { silent: true });
const output = testResult.output || '';
fs.writeFileSync(tmpOutput, output);

if (testResult.success) {
  log.success('All tests passed - no snapshot updates needed');
  try { fs.unlinkSync(tmpOutput); } catch {}
  process.exit(0);
}

// Analyze test output for snapshot failures
log.section('Analyzing Snapshot Failures');

const lines = output.split('\n');
const snapshotFailureLines = lines.filter(l => l.includes('Snapshot name:'));
const snapshotCount = snapshotFailureLines.length;

if (snapshotCount === 0) {
  log.warning('No snapshot failures detected');

  // Check for other test failures
  if (lines.some(l => l.includes('FAIL'))) {
    log.error('Tests failed, but not due to snapshots');
    log.section('Non-Snapshot Failures Detected');
    lines.filter(l => /FAIL.*\.spec\.ts/.test(l)).forEach(l => console.log(l));
    console.log();
    log.warning('These failures require manual investigation:');
    console.log('  1. Review test output above');
    console.log('  2. Fix failing tests');
    console.log('  3. Re-run tests');
    try { fs.unlinkSync(tmpOutput); } catch {}
    process.exit(1);
  }

  try { fs.unlinkSync(tmpOutput); } catch {}
  process.exit(0);
}

log.success(`Found ${snapshotCount} snapshot mismatches`);

// Categorize failures
log.section('Categorizing Snapshot Changes');

const failures = [];
let currentTest = null;

lines.forEach(line => {
  if (line.includes('FAIL ')) {
    const match = line.match(/FAIL\s+(.+\.spec\.ts)/);
    if (match) {
      currentTest = { file: match[1], snapshots: [] };
      failures.push(currentTest);
    }
  }
  if (currentTest && line.includes('Snapshot name:')) {
    currentTest.snapshots.push(line.trim());
  }
});

// Display categorized results
for (const fail of failures) {
  console.log(`\n  ${chalk.red('FAIL')} ${fail.file}`);
  for (const snap of fail.snapshots) {
    console.log(`    ${chalk.dim(snap)}`);
  }
}
console.log();

// Handle mode
if (mode === 'all') {
  if (dryRun) {
    log.info(`Would update ${snapshotCount} snapshots in ${failures.length} files`);
  } else {
    log.info('Updating all snapshots...');
    const updateResult = exec(`npm test -- --no-coverage --updateSnapshot ${patternFlag} 2>&1`, { silent: true });
    if (updateResult.success) {
      log.success(`Updated ${snapshotCount} snapshots`);
    } else {
      log.warning('Some tests still failing after snapshot update');
      console.log(updateResult.output);
    }
  }
} else {
  console.log('To update all snapshots:');
  console.log(chalk.bold('  node scripts/update-snapshots.js --all'));
  console.log();
  console.log('To update for a specific pattern:');
  console.log(chalk.bold('  node scripts/update-snapshots.js --all --pattern "component-name"'));
}

// Cleanup
try { fs.unlinkSync(tmpOutput); } catch {}
