#!/usr/bin/env node

/**
 * Docker Compose Merge Tool
 *
 * Intelligently merges docker-compose.yml files between custom PWA and new PWA versions.
 * Detects custom services, preserves custom environment variables, merges base PWA updates.
 *
 * Usage:
 *   node scripts/merge-docker-compose.js [OPTIONS]
 *
 * Options:
 *   --auto       Automatically merge (default: interactive)
 *   --dry-run    Show what would be merged without making changes
 *   -h, --help   Show this help message
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { log, execSilent, chalk } = require('./_utils');

// Parse arguments
let autoMode = false;
let dryRun = false;

for (const arg of process.argv.slice(2)) {
  switch (arg) {
    case '--auto': autoMode = true; break;
    case '--dry-run': dryRun = true; break;
    case '-h': case '--help':
      console.log(`Usage: node scripts/merge-docker-compose.js [OPTIONS]

Intelligently merge docker-compose.yml from custom PWA and new PWA version.

OPTIONS:
  --auto       Automatically merge
  --dry-run    Show what would be merged without making changes
  -h, --help   Show this help message`);
      process.exit(0);
  }
}

log.header('🐳 Docker Compose Merge Tool');

// Check merge conflict state
const inConflict = !!execSilent('git status 2>/dev/null').match(/both modified.*docker-compose\.yml/);
if (inConflict) {
  log.section('Detected Merge Conflict');
} else {
  log.section('Checking for docker-compose.yml');
}

if (!fs.existsSync('docker-compose.yml')) {
  log.error('docker-compose.yml not found in current directory');
  process.exit(1);
}

// Backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupFile = `docker-compose.yml.backup.${timestamp}`;
fs.copyFileSync('docker-compose.yml', backupFile);
log.success(`Backup created: ${backupFile}`);

// Extract conflict versions
let oursContent, theirsContent;

if (inConflict) {
  log.section('Extracting Conflict Versions');
  const theirs = execSilent('git show :2:docker-compose.yml 2>/dev/null');
  const ours = execSilent('git show :3:docker-compose.yml 2>/dev/null');
  theirsContent = theirs || '';
  oursContent = ours || '';
  if (!theirs) log.warning("Could not extract 'theirs' version (new PWA)");
  if (!ours) log.warning("Could not extract 'ours' version (custom PWA)");
} else {
  log.warning('Not in a merge conflict. Using current file as base.');
  const content = fs.readFileSync('docker-compose.yml', 'utf-8');
  oursContent = content;
  theirsContent = content;
}

// Parse YAML
log.section('Analyzing Docker Compose Configurations');

function loadYaml(content) {
  try { return yaml.load(content) || {}; } catch { return {}; }
}

const ours = loadYaml(oursContent);
const theirs = loadYaml(theirsContent);

if (!ours.services && !theirs.services) {
  log.error('Failed to parse docker-compose files');
  process.exit(1);
}

const oursServices = Object.keys(ours.services || {});
const theirsServices = Object.keys(theirs.services || {});
const customOnly = oursServices.filter(s => !theirsServices.includes(s));
const pwaOnly = theirsServices.filter(s => !oursServices.includes(s));
const common = oursServices.filter(s => theirsServices.includes(s));

console.log(`\n📊 Analysis Results:\n`);
console.log(`Custom-only services: ${customOnly.length}`);
customOnly.forEach(s => console.log(`  • ${s}`));
console.log(`\nPWA-only services: ${pwaOnly.length}`);
pwaOnly.forEach(s => console.log(`  • ${s}`));
console.log(`\nCommon services: ${common.length}`);
common.forEach(s => console.log(`  • ${s}`));

// Detect customizations
console.log('\n\n🔍 Customizations Detected:\n');
for (const svc of common) {
  const ourSvc = ours.services[svc] || {};
  const theirSvc = theirs.services[svc] || {};
  const diffs = [];

  const ourEnv = ourSvc.environment || {};
  const theirEnv = theirSvc.environment || {};
  for (const key of Object.keys(ourEnv)) {
    if (!theirEnv[key] || ourEnv[key] !== theirEnv[key]) {
      diffs.push(`  • environment: ${key}: "${ourEnv[key]}" (custom) vs "${theirEnv[key] || '(not in PWA)'}"`);
    }
  }
  if (JSON.stringify(ourSvc.ports) !== JSON.stringify(theirSvc.ports)) {
    diffs.push(`  • ports differ`);
  }
  if (JSON.stringify(ourSvc.volumes) !== JSON.stringify(theirSvc.volumes)) {
    diffs.push(`  • volumes differ`);
  }

  if (diffs.length > 0) {
    console.log(`${svc}:`);
    diffs.forEach(d => console.log(d));
    console.log();
  }
}

// Merge strategy
console.log('\n📝 Merge Strategy:\n');
console.log('1. Keep all custom-only services');
console.log('2. Add all new PWA services');
console.log('3. For common services: PWA base + custom env vars');
console.log();

if (dryRun) {
  console.log('🔍 DRY RUN MODE - No changes will be made');
  process.exit(0);
}

// Create merged config
const merged = {
  version: theirs.version || ours.version,
  services: {},
};

const allServices = new Set([...oursServices, ...theirsServices]);

for (const svc of allServices) {
  if (customOnly.includes(svc)) {
    merged.services[svc] = ours.services[svc];
  } else if (pwaOnly.includes(svc)) {
    merged.services[svc] = theirs.services[svc];
  } else {
    // Merge: PWA base + custom env
    const base = { ...(theirs.services[svc] || {}) };
    base.environment = {
      ...(theirs.services[svc]?.environment || {}),
      ...(ours.services[svc]?.environment || {}),
    };
    // Keep custom ports and volumes if they differ
    if (ours.services[svc]?.ports) base.ports = ours.services[svc].ports;
    if (ours.services[svc]?.volumes) base.volumes = ours.services[svc].volumes;
    merged.services[svc] = base;
  }
}

// Preserve other top-level keys
for (const key of ['networks', 'volumes', 'configs', 'secrets']) {
  if (ours[key] || theirs[key]) {
    merged[key] = { ...(theirs[key] || {}), ...(ours[key] || {}) };
  }
}

// Write merged file
fs.writeFileSync('docker-compose.yml', yaml.dump(merged, { lineWidth: -1 }));
log.success('docker-compose.yml successfully merged');

console.log('\n📋 Summary:');
console.log(`   • Total services: ${allServices.size}`);
console.log(`   • Custom services preserved: ${customOnly.length}`);
console.log(`   • New PWA services added: ${pwaOnly.length}`);
console.log(`   • Common services merged: ${common.length}`);

if (inConflict) {
  execSilent('git add docker-compose.yml');
  log.success('Conflict marked as resolved in git');
}

log.section('Next Steps');
console.log('1. Review docker-compose.yml for correctness');
console.log('2. Test with: docker-compose config');
console.log('3. Verify services start: docker-compose up -d');
console.log();
console.log(`Backup saved at: ${backupFile}`);
