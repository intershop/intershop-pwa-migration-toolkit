#!/usr/bin/env node

/**
 * Migration Analyzer & Strategy Advisor
 *
 * Analyzes your PWA project to determine:
 *   1. Migration complexity (version gap, customization depth, extensions)
 *   2. Recommended pattern detection tier (1/2/3)
 *   3. Best migration strategy (Big Bang / Hybrid / Incremental)
 *
 * Usage:
 *   node scripts/analyze-migration.js [source-version] [target-version]
 *   node scripts/analyze-migration.js 4.0.0 10.0.0
 *   node scripts/analyze-migration.js 4.0.0 10.0.0 --quick
 *   node scripts/analyze-migration.js --interactive 4.0.0 11.0.0
 *
 * Options:
 *   --quick          Skip interactive questions, analyze code only
 *   --interactive    Run full questionnaire (default unless --quick)
 *   --help           Show this help message
 */

const fs = require('fs');
const path = require('path');
const { projectDir } = require('./_project-dir');
const { log, execFileSilent, execSilent, parseVersion, findFiles, chalk, askYesNo } = require('./_utils');

process.chdir(projectDir);

const EXTENSIONS_DIR = path.join(projectDir, 'src', 'app', 'extensions');
const THEMES_DIR = path.join(projectDir, 'src', 'styles', 'themes');
const COMPONENTS_DIR = path.join(projectDir, 'src', 'app');
const STANDARD_THEMES = ['b2b', 'b2c'];
const STANDARD_EXTENSIONS = ['sentry', 'tacton', 'tracking', 'quoting'];

// Parse arguments
const args = process.argv.slice(2);
let sourceVersion = '';
let targetVersion = '';
let quick = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--quick') { quick = true; }
  else if (args[i] === '--interactive') { /* default behavior, accepted for compat */ }
  else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`Usage: node scripts/analyze-migration.js [source-version] [target-version] [--quick|--interactive]`);
    process.exit(0);
  } else if (!args[i].startsWith('-')) {
    if (!sourceVersion) sourceVersion = args[i];
    else if (!targetVersion) targetVersion = args[i];
  }
}

// Auto-detect source version
if (!sourceVersion) {
  const branch = execSilent('git branch --show-current', projectDir);
  const match = (branch || '').match(/\d+\.\d+\.\d+/);
  if (match) sourceVersion = match[0];
  if (!sourceVersion) {
    try {
      sourceVersion = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8')).version || '';
    } catch {
      sourceVersion = '';
    }
  }
}

if (!sourceVersion || !targetVersion) {
  console.log('Usage: node scripts/analyze-migration.js <source-version> <target-version>');
  console.log('Example: node scripts/analyze-migration.js 4.0.0 10.0.0');
  process.exit(1);
}

// --- Analysis functions ---

function detectCustomExtensions() {
  if (!fs.existsSync(EXTENSIONS_DIR)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(EXTENSIONS_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && !STANDARD_EXTENSIONS.includes(entry.name)) count++;
  }
  return count;
}

function detectCustomThemes() {
  if (!fs.existsSync(THEMES_DIR)) return [];
  return fs.readdirSync(THEMES_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && !STANDARD_THEMES.includes(e.name))
    .map(e => e.name);
}

function countCustomComponents() {
  if (!fs.existsSync(COMPONENTS_DIR)) return 0;
  return findFiles(COMPONENTS_DIR, /\.component\.ts$/).filter(f => {
    const rel = path.relative(COMPONENTS_DIR, f);
    return !rel.startsWith('core') && !rel.startsWith('shared') && !rel.startsWith('extensions') && !rel.startsWith('shell') && !rel.startsWith('pages');
  }).length;
}

function countModifiedFiles() {
  const base = execFileSilent('git', ['rev-parse', '--verify', 'develop'], projectDir) ? 'develop' :
    (execFileSilent('git', ['rev-parse', '--verify', 'main'], projectDir) ? 'main' : '');
  if (!base) return 0;
  const modified = execFileSilent('git', ['diff', '--name-only', base, '--', 'src/'], projectDir);
  return modified ? modified.split('\n').filter(Boolean).length : 0;
}

function calculateCustomizationPercentage() {
  const allTs = findFiles(path.join(projectDir, 'src', 'app'), /\.ts$/);
  if (allTs.length === 0) return 0;
  const customFiles = execSilent('git log --oneline --name-only --since="1 year ago" -- src/app/', projectDir);
  const uniqueTs = [...new Set((customFiles || '').split('\n').filter(f => f.endsWith('.ts')))];
  return Math.min(Math.round((uniqueTs.length * 100) / allTs.length), 100);
}

function analyzeBreakingChanges(source, target) {
  const detectScript = path.join(__dirname, 'detect-pattern-changes.js');
  if (!fs.existsSync(detectScript)) return null;
  const output = execSilent(`node "${detectScript}" "${source}" "${target}"`);
  if (!output) return null;
  return (output.match(/Severity:/g) || []).length;
}

function recommendTier(versionGap, customFiles, customExts, customPct) {
  let score = 0;
  if (versionGap >= 5) score += 40; else if (versionGap >= 3) score += 25; else if (versionGap >= 1) score += 10;
  if (customFiles >= 50) score += 30; else if (customFiles >= 20) score += 20; else if (customFiles >= 10) score += 10;
  if (customPct >= 50) score += 20; else if (customPct >= 20) score += 10;
  if (customExts >= 3) score += 20; else if (customExts >= 1) score += 10;
  if (score >= 60) return 3;
  if (score >= 25) return 2;
  return 1;
}

// --- Main ---

async function run() {
  console.log(chalk.bold.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold.blue('  Migration Analyzer & Strategy Advisor'));
  console.log(chalk.bold.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log();

  const srcVer = parseVersion(sourceVersion);
  const tgtVer = parseVersion(targetVersion);
  const versionGap = tgtVer.major - srcVer.major;

  if (versionGap < 0) { log.error('Target version is older than source version'); process.exit(1); }

  // 1. Project Analysis
  console.log(chalk.bold('1. Project Analysis'));
  console.log();
  console.log(`  Source: ${chalk.green(sourceVersion)}`);
  console.log(`  Target: ${chalk.green(targetVersion)}`);
  console.log(`  Gap:    ${chalk.yellow(String(versionGap))} major version(s)${versionGap >= 5 ? chalk.red(' (large)') : ''}`);
  console.log();

  const customExts = detectCustomExtensions();
  const customThemes = detectCustomThemes();
  const customComponents = countCustomComponents();
  const customFiles = countModifiedFiles();
  const customPct = calculateCustomizationPercentage();

  console.log(`  Custom extensions:  ${chalk.cyan(String(customExts))}`);
  console.log(`  Custom themes:      ${customThemes.length > 0 ? chalk.cyan(customThemes.join(', ')) : chalk.green('none')}`);
  console.log(`  Custom components:  ${chalk.cyan(String(customComponents))}`);
  console.log(`  Modified src files: ${chalk.cyan(String(customFiles))}`);
  console.log(`  Customization:      ${chalk.cyan(customPct + '%')} of codebase`);
  console.log();

  // 2. Breaking Changes Analysis
  console.log(chalk.bold('2. Breaking Changes Analysis'));
  console.log();
  console.log(chalk.blue('  Running pattern detection...'));
  const breakingChanges = analyzeBreakingChanges(sourceVersion, targetVersion);
  if (breakingChanges !== null) {
    console.log(`  Breaking patterns found: ${chalk.bold(String(breakingChanges))}`);
    if (breakingChanges < 20) console.log(chalk.green('  ✓ Few breaking changes'));
    else if (breakingChanges < 40) console.log(chalk.yellow('  ⚠ Moderate breaking changes'));
    else console.log(chalk.red('  ⚠ Many breaking changes'));
  } else {
    console.log(chalk.yellow('  ⚠ Pattern detection not available (no data for this version range)'));
  }
  console.log();

  // 3. Pattern Detection Tier
  const tier = recommendTier(versionGap, customFiles, customExts, customPct);

  console.log(chalk.bold('3. Recommended Pattern Detection Tier'));
  console.log();
  if (tier === 1) {
    console.log(chalk.green('  TIER 1: CHANGELOG Review'));
    console.log('  → Review CHANGELOG.md from Intershop PWA repository');
    console.log('  → Follow manual checklist in migration instructions');
    console.log('  → Use build cycle to catch issues iteratively');
    console.log('  → Est. time: 1-2 hours');
  } else if (tier === 2) {
    console.log(chalk.yellow('  TIER 2: Pattern Detection'));
    console.log(`  → Run: ${chalk.cyan('node scripts/detect-pattern-changes.js ' + sourceVersion + ' ' + targetVersion)}`);
    console.log('  → Review generated report of affected files');
    console.log('  → Apply suggested pattern updates');
    console.log('  → Est. time savings: 2-3 hours');
  } else {
    console.log(chalk.red('  TIER 3: Comprehensive Analysis'));
    console.log(`  → Run: ${chalk.cyan('node scripts/detect-pattern-changes.js --comprehensive ' + sourceVersion + ' ' + targetVersion)}`);
    console.log(`  → Review: ${chalk.cyan('data/pattern-migrations.json')}`);
    console.log('  → Review multi-version breaking changes');
    console.log('  → Consider incremental migration strategy');
    console.log('  → Use automated code transformation where possible');
    console.log('  → Est. time savings: 4-6 hours');
    console.log();
    console.log(chalk.yellow('  💡 Consider migrating in stages if version gap is large'));
  }
  console.log();

  // 4. Why this recommendation (reasoning)
  console.log(chalk.bold('4. Why This Recommendation'));
  console.log();
  if (versionGap >= 5) console.log(chalk.red(`  ⚠ Large version gap (${versionGap} major versions)`));
  else if (versionGap >= 3) console.log(chalk.yellow(`  ! Moderate version gap (${versionGap} major versions)`));
  else console.log(chalk.green(`  ✓ Small version gap (${versionGap} major versions)`));

  if (customPct >= 50) console.log(chalk.red(`  ⚠ Heavy customization (${customPct}% of codebase)`));
  else if (customPct >= 20) console.log(chalk.yellow(`  ! Moderate customization (${customPct}% of codebase)`));
  else console.log(chalk.green(`  ✓ Light customization (${customPct}% of codebase)`));

  if (customFiles >= 50) console.log(chalk.red(`  ⚠ Many modified files (${customFiles})`));
  else if (customFiles >= 20) console.log(chalk.yellow(`  ! Some modified files (${customFiles})`));
  else console.log(chalk.green(`  ✓ Few modified files (${customFiles})`));

  if (customExts >= 3) console.log(chalk.red(`  ⚠ Multiple custom extensions (${customExts})`));
  else if (customExts >= 1) console.log(chalk.yellow(`  ! Custom extensions present (${customExts})`));
  else console.log(chalk.green('  ✓ No custom extensions'));

  if (breakingChanges !== null) {
    if (breakingChanges >= 40) console.log(chalk.red(`  ⚠ Many breaking patterns (${breakingChanges})`));
    else if (breakingChanges >= 20) console.log(chalk.yellow(`  ! Some breaking patterns (${breakingChanges})`));
    else console.log(chalk.green(`  ✓ Few breaking patterns (${breakingChanges})`));
  }
  console.log();

  // 5. Strategy Recommendation
  console.log(chalk.bold('5. Migration Strategy'));
  console.log();

  let scoreBigBang = 0, scoreHybrid = 0, scoreIncremental = 0;

  // Version gap scoring
  if (versionGap <= 1) { scoreBigBang += 3; }
  else if (versionGap <= 3) { scoreHybrid += 3; scoreBigBang += 1; }
  else { scoreIncremental += 3; scoreHybrid += 2; }

  // Customization scoring
  if (customFiles < 20) { scoreBigBang += 3; scoreHybrid += 2; }
  else if (customFiles < 50) { scoreHybrid += 3; scoreBigBang += 1; scoreIncremental += 2; }
  else { scoreIncremental += 3; scoreHybrid += 1; }

  // Breaking changes scoring
  if (breakingChanges !== null) {
    if (breakingChanges < 20) { scoreBigBang += 2; }
    else if (breakingChanges < 40) { scoreHybrid += 2; }
    else { scoreIncremental += 2; scoreHybrid += 1; }
  }

  // Interactive questions (unless --quick)
  if (!quick) {
    console.log(chalk.bold('  Team & Project Context (5 questions):'));
    console.log();

    if (await askYesNo('  Strong Angular/TypeScript expertise on the team?')) {
      scoreBigBang += 2;
      console.log(chalk.green('    → Big bang more feasible'));
    } else {
      scoreIncremental += 2;
      console.log(chalk.yellow('    → Incremental reduces learning curve'));
    }

    if (await askYesNo('  Under tight deadlines / production pressure?')) {
      scoreIncremental += 2; scoreHybrid += 1;
      console.log(chalk.yellow('    → Incremental allows intermediate deployments'));
    } else {
      scoreBigBang += 1;
      console.log(chalk.green('    → Can afford time for big bang'));
    }

    if (await askYesNo('  Good automated test coverage (>50%)?')) {
      scoreBigBang += 2;
      console.log(chalk.green('    → Tests help catch big bang issues'));
    } else {
      scoreIncremental += 1;
      console.log(chalk.yellow('    → Incremental safer without tests'));
    }

    if (await askYesNo('  Customizations well-documented (clear markers, override pattern)?')) {
      scoreBigBang += 1; scoreHybrid += 1;
      console.log(chalk.green('    → Good practices make migration easier'));
    } else {
      scoreIncremental += 2;
      console.log(chalk.red('    → Poor practices need careful migration'));
    }

    if (await askYesNo('  Can afford 1-2 weeks in broken state during migration?')) {
      scoreBigBang += 2;
      console.log(chalk.green('    → Big bang feasible with downtime buffer'));
    } else {
      scoreIncremental += 2; scoreHybrid += 1;
      console.log(chalk.yellow('    → Incremental allows stable checkpoints'));
    }
    console.log();
  }

  // Determine winner
  let strategy, icon;
  if (scoreBigBang >= scoreIncremental && scoreBigBang >= scoreHybrid) { strategy = 'Big Bang'; icon = '🚀'; }
  else if (scoreHybrid >= scoreIncremental) { strategy = 'Hybrid (Strategic Incremental)'; icon = '🎯'; }
  else { strategy = 'Incremental'; icon = '📊'; }

  console.log(chalk.bold(`  ${icon} RECOMMENDED: ${strategy}`));
  console.log();
  console.log(`  Scores: Big Bang ${scoreBigBang} | Hybrid ${scoreHybrid} | Incremental ${scoreIncremental}`);
  console.log();

  // Detailed execution plan per strategy
  if (strategy === 'Big Bang') {
    console.log(chalk.bold.green('  ✓ Big Bang Migration (Direct Jump)'));
    console.log();
    console.log(`    ${sourceVersion} → ${targetVersion} directly`);
    console.log();
    console.log('    Execution plan:');
    console.log(`      1. Pre-analysis: ${chalk.cyan(`node scripts/detect-pattern-changes.js ${sourceVersion} ${targetVersion}` + (tier === 3 ? ' --comprehensive' : ''))}`);
    console.log('      2. Merge directly');
    console.log('      3. Fix systematically (one category at a time)');
    console.log('      4. Build & test');
    console.log();
    console.log('    Est. time: 1-2 weeks');
  } else if (strategy.startsWith('Hybrid')) {
    const midVersion = tgtVer.major >= 10 ? '9.1.0' : `${srcVer.major + Math.floor(versionGap / 2)}.0.0`;
    console.log(chalk.bold.cyan('  🎯 Hybrid Migration (Strategic Stepping Stones)'));
    console.log();
    console.log(`    ${sourceVersion} → ${midVersion} → ${targetVersion}`);
    console.log();
    console.log('    Execution plan:');
    console.log(`      Phase 1: ${sourceVersion} → ${midVersion} (consolidation, ~1 week)`);
    console.log(`      Phase 2: ${midVersion} → ${targetVersion} (final upgrade, ~1 week)`);
    console.log();
    console.log('    Est. time: 2-3 weeks total');
  } else {
    // Build intermediate version path
    const steps = [];
    for (let v = srcVer.major + 1; v <= tgtVer.major; v++) {
      steps.push(`${v}.0`);
    }
    console.log(chalk.bold.yellow('  📊 Incremental Migration (Step-by-Step)'));
    console.log();
    console.log(`    ${sourceVersion} → ${steps.join(' → ')}`);
    console.log();
    console.log('    Execution plan:');
    console.log('      Migrate one major version at a time');
    console.log('      Build & validate at each step');
    console.log('      Commit stable checkpoints');
    console.log();
    console.log('    Est. time: 4-6 weeks total');
  }

  // 6. Next steps
  console.log();
  console.log(chalk.bold('6. Next Steps'));
  console.log();
  console.log(`  1. Review the recommendation with your team`);
  if (tier >= 2) console.log(`  2. Run pattern detection: ${chalk.cyan('node scripts/detect-pattern-changes.js ' + sourceVersion + ' ' + targetVersion)}`);
  console.log(`  ${tier >= 2 ? '3' : '2'}. Start migration: ${chalk.cyan('node scripts/migrate-custom-branch.js --help')}`);
  console.log(`  ${tier >= 2 ? '4' : '3'}. Read: ${chalk.cyan('.github/instructions/migration-approaches.instructions.md')}`);
  if (!quick) console.log(`\n  💡 Tip: Re-run with --quick to skip interactive questions`);
  console.log();
}

run();
