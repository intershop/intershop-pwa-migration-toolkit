#!/usr/bin/env node

/**
 * Migration Progress Tracker
 *
 * Persists migration state to a JSON file so work can resume after VM shutdown.
 *
 * Usage:
 *   node scripts/migration-progress.js init <source_version> <target_version>
 *   node scripts/migration-progress.js status
 *   node scripts/migration-progress.js update <step_id> <completed|in-progress|skipped> [notes]
 *   node scripts/migration-progress.js note "Free-form note about current state"
 *   node scripts/migration-progress.js summary
 */

const fs = require('fs');
const path = require('path');
const { log, chalk } = require('./_utils');

// Resolve project directory
let projectDir = process.env.PWA_PROJECT_DIR || process.cwd();
const pdIdx = process.argv.indexOf('--project-dir');
if (pdIdx !== -1 && process.argv[pdIdx + 1]) projectDir = process.argv[pdIdx + 1];
projectDir = path.resolve(projectDir);

const PROGRESS_FILE = path.join(projectDir, '.migration-progress.json');

const STEPS = [
  { id: 'version-identification', description: 'Document source and target versions' },
  { id: 'angular-version-check', description: 'Check Angular version compatibility' },
  { id: 'node-version-check', description: 'Verify Node.js version requirements' },
  { id: 'git-remote-setup', description: 'Configure git remotes (intershop + project)' },
  { id: 'branch-creation', description: 'Create migration branch' },
  { id: 'theme-validation', description: 'Validate custom theme completeness' },
  { id: 'theme-sync', description: 'Sync missing theme variables' },
  { id: 'first-build', description: 'First build attempt and error capture' },
  { id: 'typescript-fixes', description: 'Fix TypeScript compilation errors' },
  { id: 'scss-fixes', description: 'Fix SCSS compilation errors' },
  { id: 'template-fixes', description: 'Fix template errors' },
  { id: 'removed-features', description: 'Handle removed features/extensions' },
  { id: 'i18n-merge', description: 'Merge localization files' },
  { id: 'control-flow-migration', description: 'Migrate Angular control flow (PWA 10+)' },
  { id: 'icon-migration', description: 'Migrate icons (PWA 10+)' },
  { id: 'clean-build', description: 'Achieve clean build (browser + SSR)' },
  { id: 'lint-check', description: 'Run and fix lint issues' },
  { id: 'test-run', description: 'Run unit tests' },
  { id: 'smoke-test', description: 'Manual smoke test of custom features' },
  { id: 'documentation', description: 'Update documentation and changelog' },
  { id: 'commit-and-push', description: 'Final commit and push to project remote' },
];

function timestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function readProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) return null;
  return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
}

function writeProgress(data) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2) + '\n');
}

function initProgress(sourceVersion, targetVersion) {
  const ts = timestamp();
  const data = {
    migrationId: `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${sourceVersion}-to-${targetVersion}`,
    sourceVersion: sourceVersion || 'unknown',
    targetVersion: targetVersion || 'unknown',
    approach: '',
    startedAt: ts,
    lastUpdated: ts,
    currentStep: 'version-identification',
    overallStatus: 'in-progress',
    notes: [],
    steps: STEPS.map(s => ({
      id: s.id,
      description: s.description,
      status: 'not-started',
      notes: '',
      updatedAt: '',
    })),
  };
  writeProgress(data);
  console.log(`✅ Migration progress initialized: ${PROGRESS_FILE}`);
  console.log(`   Source: PWA ${sourceVersion} → Target: PWA ${targetVersion}`);
  console.log();
  console.log('💡 Copilot will read this file to understand migration state.');
  console.log('   Update progress with: node scripts/migration-progress.js update <step_id> completed');
}

function showStatus() {
  const data = readProgress();
  if (!data) {
    console.log('❌ No migration in progress. Run: node scripts/migration-progress.js init <source> <target>');
    process.exit(1);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Migration Progress');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Source: PWA ${data.sourceVersion} → Target: PWA ${data.targetVersion}`);
  console.log(`   Status: ${data.overallStatus}`);
  console.log(`   Last updated: ${data.lastUpdated}`);
  console.log(`   Current step: ${data.currentStep}`);
  console.log();

  const completed = data.steps.filter(s => s.status === 'completed').length;
  const inProgress = data.steps.filter(s => s.status === 'in-progress').length;
  const skipped = data.steps.filter(s => s.status === 'skipped').length;
  const total = data.steps.length;

  console.log(`   Progress: ${completed}/${total} completed, ${inProgress} in-progress, ${skipped} skipped`);
  console.log();

  for (const step of data.steps) {
    const icon = step.status === 'completed' ? '✅' :
                 step.status === 'in-progress' ? '🔄' :
                 step.status === 'skipped' ? '⏭️ ' : '⬚ ';
    const notes = step.notes ? ` (${step.notes})` : '';
    console.log(`${icon} ${step.id} - ${step.description}${notes}`);
  }
  console.log();

  if (data.notes.length > 0) {
    console.log('📝 Recent notes:');
    for (const note of data.notes.slice(-3)) {
      console.log(`   [${note.timestamp}] ${note.text}`);
    }
    console.log();
  }
}

function updateStep(stepId, newStatus, notes) {
  const data = readProgress();
  if (!data) {
    console.log('❌ No migration in progress. Run: node scripts/migration-progress.js init <source> <target>');
    process.exit(1);
  }

  const step = data.steps.find(s => s.id === stepId);
  if (!step) {
    console.log(`❌ Unknown step: ${stepId}`);
    console.log('   Valid steps:');
    data.steps.forEach(s => console.log(`     ${s.id}`));
    process.exit(1);
  }

  const validStatuses = ['completed', 'in-progress', 'skipped', 'not-started'];
  if (!validStatuses.includes(newStatus)) {
    console.log(`❌ Invalid status: ${newStatus} (use: ${validStatuses.join(', ')})`);
    process.exit(1);
  }

  const ts = timestamp();
  step.status = newStatus;
  step.notes = notes || step.notes;
  step.updatedAt = ts;
  data.lastUpdated = ts;
  if (newStatus === 'in-progress') data.currentStep = stepId;

  writeProgress(data);

  const icon = newStatus === 'completed' ? '✅' :
               newStatus === 'in-progress' ? '🔄' :
               newStatus === 'skipped' ? '⏭️' : '⬚';
  console.log(`${icon} Step '${stepId}' → ${newStatus}`);
  if (notes) console.log(`   Notes: ${notes}`);
}

function addNote(text) {
  const data = readProgress();
  if (!data) {
    console.log('❌ No migration in progress.');
    process.exit(1);
  }

  data.notes.push({ timestamp: timestamp(), text });
  data.lastUpdated = timestamp();
  writeProgress(data);
  console.log(`📝 Note added: ${text}`);
}

function showSummary() {
  const data = readProgress();
  if (!data) {
    console.log('❌ No migration in progress.');
    process.exit(1);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Migration Summary (for Copilot context)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();
  console.log('Copy-paste this into a new Copilot chat to resume:');
  console.log();
  console.log('---');
  console.log(`I'm continuing a PWA migration from ${data.sourceVersion} to ${data.targetVersion}.`);
  if (data.approach) console.log(`Approach: ${data.approach}`);
  console.log(`Current step: ${data.currentStep}`);
  console.log();
  console.log('Completed steps:');
  data.steps.filter(s => s.status === 'completed').forEach(s => {
    console.log(`- ${s.description}${s.notes ? ` (${s.notes})` : ''}`);
  });
  console.log();
  console.log('Next steps:');
  data.steps.filter(s => s.status === 'not-started').slice(0, 3).forEach(s => {
    console.log(`- ${s.description}`);
  });
  console.log();

  if (data.notes.length > 0) {
    console.log('Important notes:');
    data.notes.slice(-5).forEach(n => console.log(`- ${n.text}`));
  }

  console.log('---');
  console.log();
  console.log('Please read .migration-progress.json for full state and continue the migration.');
}

// Main dispatch
const args = process.argv.slice(2).filter(a => a !== '--project-dir' && !(pdIdx !== -1 && process.argv[pdIdx + 1] === a));
const command = args[0] || 'status';

switch (command) {
  case 'init':
    initProgress(args[1], args[2]);
    break;
  case 'status':
    showStatus();
    break;
  case 'update':
    if (!args[1] || !args[2]) {
      console.log('Usage: node scripts/migration-progress.js update <step_id> <status> [notes]');
      process.exit(1);
    }
    updateStep(args[1], args[2], args[3]);
    break;
  case 'note':
    if (!args[1]) {
      console.log('Usage: node scripts/migration-progress.js note "Your note here"');
      process.exit(1);
    }
    addNote(args[1]);
    break;
  case 'summary':
    showSummary();
    break;
  default:
    console.log(`Migration Progress Tracker

Usage:
  node scripts/migration-progress.js init <source_version> <target_version>
  node scripts/migration-progress.js status
  node scripts/migration-progress.js update <step_id> <status> [notes]
  node scripts/migration-progress.js note "Free-form note"
  node scripts/migration-progress.js summary

Statuses: completed, in-progress, skipped, not-started`);
}
