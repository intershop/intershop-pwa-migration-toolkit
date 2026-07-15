#!/usr/bin/env node

/**
 * Migration Complexity Analyzer
 *
 * Analyzes your PWA migration to recommend the appropriate pattern detection
 * tier based on version gap, customization depth, custom extensions, and more.
 *
 * Usage:
 *   node scripts/analyze-migration-complexity.js [source-version] [target-version]
 *   node scripts/analyze-migration-complexity.js 4.0.0 9.1.0
 */

const fs = require('fs');
const path = require('path');
const { projectDir } = require('./_project-dir');
const { log, execSilent, parseVersion, findFiles, chalk } = require('./_utils');

process.chdir(projectDir);

const EXTENSIONS_DIR = path.join(projectDir, 'src', 'app', 'extensions');
const THEMES_DIR = path.join(projectDir, 'src', 'styles', 'themes');
const COMPONENTS_DIR = path.join(projectDir, 'src', 'app');
const STANDARD_THEMES = ['b2b', 'b2c'];
const STANDARD_EXTENSIONS = ['sentry', 'tacton', 'tracking', 'quoting'];

// Parse arguments
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
let sourceVersion = args[0] || '';
let targetVersion = args[1] || '';

function detectCustomExtensions() {
  if (!fs.existsSync(EXTENSIONS_DIR)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(EXTENSIONS_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && !STANDARD_EXTENSIONS.includes(entry.name)) count++;
  }
  return count;
}

function detectCustomThemes() {
  if (!fs.existsSync(THEMES_DIR)) return 'none';
  const custom = [];
  for (const entry of fs.readdirSync(THEMES_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && !STANDARD_THEMES.includes(entry.name)) custom.push(entry.name);
  }
  return custom.length === 0 ? 'none' : custom.join(', ');
}

function countCustomComponents() {
  if (!fs.existsSync(COMPONENTS_DIR)) return 0;
  const all = findFiles(COMPONENTS_DIR, /\.component\.ts$/);
  return all.filter(f => {
    const rel = path.relative(COMPONENTS_DIR, f);
    return !rel.startsWith('core') && !rel.startsWith('shared') && !rel.startsWith('extensions') && !rel.startsWith('shell') && !rel.startsWith('pages');
  }).length;
}

function calculateCustomizationPercentage() {
  const allTs = findFiles(path.join(projectDir, 'src', 'app'), /\.ts$/);
  if (allTs.length === 0) return 0;
  const customFiles = execSilent('git log --oneline --name-only --since="1 year ago" -- src/app/', projectDir);
  const uniqueTs = [...new Set(customFiles.split('\n').filter(f => f.endsWith('.ts')))];
  const pct = Math.round((uniqueTs.length * 100) / allTs.length);
  return Math.min(pct, 100);
}

function recommendTier(versionGap, customPct, customExts) {
  let score = 0;
  if (versionGap >= 5) score += 40; else if (versionGap >= 3) score += 25; else if (versionGap >= 1) score += 10;
  if (customPct >= 50) score += 40; else if (customPct >= 20) score += 25; else if (customPct >= 10) score += 10;
  if (customExts >= 3) score += 20; else if (customExts >= 1) score += 10;
  if (score >= 60) return 3;
  if (score >= 25) return 2;
  return 1;
}

// Main
console.log(chalk.cyan('╔════════════════════════════════════════════════════════════════╗'));
console.log(chalk.cyan('║') + chalk.blue('      Migration Complexity Analyzer') + '                          ' + chalk.cyan('║'));
console.log(chalk.cyan('╚════════════════════════════════════════════════════════════════╝'));
console.log();

if (!sourceVersion) {
  console.log(chalk.yellow('Source version not provided. Attempting to detect from current branch...'));
  const branch = execSilent('git branch --show-current', projectDir);
  const match = branch.match(/\d+\.\d+\.\d+/);
  if (match) sourceVersion = match[0];
  if (!sourceVersion) {
    const pkg = execSilent('grep \'"version"\' package.json', projectDir);
    const pkgMatch = pkg.match(/\d+\.\d+\.\d+/);
    if (pkgMatch) sourceVersion = pkgMatch[0];
  }
}

if (!targetVersion) {
  console.log(chalk.yellow('Target version not provided. Please specify.'));
  console.log();
  console.log('Usage: node scripts/analyze-migration-complexity.js <source-version> <target-version>');
  console.log('Example: node scripts/analyze-migration-complexity.js 4.0.0 9.1.0');
  process.exit(1);
}

console.log(chalk.blue('🔍 Analyzing migration complexity...'));
console.log();

const srcVer = parseVersion(sourceVersion);
const tgtVer = parseVersion(targetVersion);
const versionGap = tgtVer.major - srcVer.major;

console.log(`📦 Source version: ${chalk.green(sourceVersion)}`);
console.log(`📦 Target version: ${chalk.green(targetVersion)}`);
console.log(`📊 Version gap: ${chalk.yellow(String(versionGap))} major version(s)`);
if (versionGap >= 5) console.log(chalk.red('   ⚠️  Large gap detected'));
if (versionGap < 0) { log.error('Target version is older than source version'); process.exit(1); }

console.log();
console.log(chalk.blue('🔍 Analyzing customizations...'));
console.log();

const customExtensions = detectCustomExtensions();
const customThemes = detectCustomThemes();
const customComponents = countCustomComponents();
const customPercentage = calculateCustomizationPercentage();

console.log(`📁 Custom extensions: ${chalk.cyan(String(customExtensions))}`);
console.log(`🎨 Custom themes: ${customThemes !== 'none' ? chalk.cyan(customThemes) : chalk.green('none (using standard themes)')}`);
console.log(`🧩 Custom components: ${chalk.cyan(String(customComponents))}`);
console.log(`📈 Estimated customization: ${chalk.cyan(customPercentage + '%')} of codebase`);

const tier = recommendTier(versionGap, customPercentage, customExtensions);

// Print recommendation
console.log();
console.log(chalk.cyan('════════════════════════════════════════════════════════════════'));

if (tier === 1) {
  console.log(chalk.green('📋 RECOMMENDED APPROACH: TIER 1 (CHANGELOG Review)'));
  console.log();
  console.log(chalk.green('✓ Lightweight approach suitable for your migration'));
  console.log();
  console.log('What to do:');
  console.log('  1. Review CHANGELOG.md from Intershop PWA repository');
  console.log('  2. Follow manual checklist in migration instructions');
  console.log('  3. Use build cycle to catch issues iteratively');
  console.log();
  console.log('Estimated time: 1-2 hours');
} else if (tier === 2) {
  console.log(chalk.yellow('⚙️  RECOMMENDED APPROACH: TIER 2 (Pattern Detection)'));
  console.log();
  console.log(chalk.yellow('✓ Automated scanning recommended for your migration'));
  console.log();
  console.log('What to do:');
  console.log(`  1. Run: ${chalk.cyan('node scripts/detect-pattern-changes.js')}`);
  console.log('  2. Review generated report of affected files');
  console.log('  3. Apply suggested pattern updates');
  console.log('  4. Follow build cycle for remaining issues');
  console.log();
  console.log('Estimated time savings: 2-3 hours');
} else {
  console.log(chalk.red('🔧 RECOMMENDED APPROACH: TIER 3 (Comprehensive Analysis)'));
  console.log();
  console.log(chalk.red('✓ Complex migration - full tooling recommended'));
  console.log();
  console.log('What to do:');
  console.log(`  1. Review: ${chalk.cyan('data/pattern-migrations.json')}`);
  console.log(`  2. Run: ${chalk.cyan('node scripts/detect-pattern-changes.js --comprehensive')}`);
  console.log('  3. Review multi-version breaking changes');
  console.log('  4. Consider incremental migration strategy');
  console.log('  5. Use automated code transformation where possible');
  console.log();
  console.log('Estimated time savings: 4-6 hours');
  console.log();
  console.log(chalk.yellow('💡 Consider migrating in stages if possible'));
}

console.log(chalk.cyan('════════════════════════════════════════════════════════════════'));

// Reasoning
console.log();
console.log(chalk.blue('Why this recommendation?'));
console.log();
if (versionGap >= 5) console.log(chalk.red(`  ⚠  Large version gap (${versionGap} major versions)`));
else if (versionGap >= 3) console.log(chalk.yellow(`  !  Moderate version gap (${versionGap} major versions)`));
else console.log(chalk.green(`  ✓  Small version gap (${versionGap} major versions)`));

if (customPercentage >= 50) console.log(chalk.red(`  ⚠  Heavy customization (${customPercentage}% of codebase)`));
else if (customPercentage >= 20) console.log(chalk.yellow(`  !  Moderate customization (${customPercentage}% of codebase)`));
else console.log(chalk.green(`  ✓  Light customization (${customPercentage}% of codebase)`));

if (customExtensions >= 3) console.log(chalk.red(`  ⚠  Multiple custom extensions (${customExtensions})`));
else if (customExtensions >= 1) console.log(chalk.yellow(`  !  Custom extensions present (${customExtensions})`));
else console.log(chalk.green('  ✓  No custom extensions'));

console.log();
console.log(chalk.cyan('════════════════════════════════════════════════════════════════'));
console.log();
console.log(chalk.blue('Next steps:'));
console.log();
if (tier === 1) {
  console.log('  1. Review migration-checklist.instructions.md');
  console.log('  2. Check CHANGELOG.md in Intershop PWA repo');
  console.log('  3. Start migration with standard workflow');
} else if (tier === 2) {
  console.log('  1. Run pattern detection: node scripts/detect-pattern-changes.js');
  console.log('  2. Review generated report');
  console.log('  3. Follow migration-workflow.instructions.md');
} else {
  console.log('  1. Review data/pattern-migrations.json for your version range');
  console.log('  2. Run comprehensive scan: node scripts/detect-pattern-changes.js --comprehensive');
  console.log('  3. Consider incremental migration strategy');
  console.log('  4. Use migration-patterns-detection.instructions.md');
}
console.log();
