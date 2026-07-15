#!/usr/bin/env node

/**
 * Migration Strategy Advisor
 *
 * Analyzes your project and recommends the best migration approach:
 * - Big Bang (direct jump to latest version)
 * - Incremental (step through intermediate versions)
 * - Hybrid (skip strategically to stable milestones)
 *
 * Usage:
 *   node scripts/recommend-migration-strategy.js [current-version] [target-version]
 *   node scripts/recommend-migration-strategy.js 4.0.0 10.0.0
 *
 * Options:
 *   --interactive    Run full questionnaire for team/project context
 *   --quick          Skip questions, analyze code only
 */

const fs = require('fs');
const path = require('path');
const { log, execSilent, parseVersion, chalk, askYesNo } = require('./_utils');

// Parse arguments
let currentVersion = '';
let targetVersion = '';
let interactive = true;
let quick = false;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--interactive': interactive = true; break;
    case '--quick': quick = true; interactive = false; break;
    case '--help':
      console.log(`Usage: node scripts/recommend-migration-strategy.js [current-version] [target-version] [options]
Options:
  --interactive    Run full questionnaire for team/project context
  --quick          Skip questions, analyze code only`);
      process.exit(0);
    default:
      if (!args[i].startsWith('-')) {
        if (!currentVersion) currentVersion = args[i];
        else if (!targetVersion) targetVersion = args[i];
      }
  }
}

if (!currentVersion) currentVersion = '4.0.0';
if (!targetVersion) targetVersion = '11.0.0';

console.log(chalk.bold.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
console.log(chalk.bold.blue('         🎯 Migration Strategy Advisor'));
console.log(chalk.bold.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
console.log();
console.log(chalk.cyan('Helping you choose the best migration approach...'));
console.log();

let scoreBigBang = 0;
let scoreIncremental = 0;
let scoreHybrid = 0;
let customLevel = 'unknown';
let versionRisk = 'low';
let breakingChanges = 0;

// 1. Analyze Customization Depth
console.log(chalk.bold('📊 Analyzing Your Project...'));
console.log();

let customFiles = 'unknown';
const baseBranch = execSilent('git rev-parse --verify develop 2>/dev/null && echo develop || (git rev-parse --verify main 2>/dev/null && echo main)');

if (baseBranch) {
  const modified = execSilent(`git diff --name-only ${baseBranch} 2>/dev/null`);
  customFiles = modified ? modified.split('\n').filter(Boolean).length : 0;
  const customSrc = execSilent(`git diff --name-only ${baseBranch} -- src/ 2>/dev/null`);
  const customSrcCount = customSrc ? customSrc.split('\n').filter(Boolean).length : 0;

  console.log(chalk.cyan('Customization Analysis:'));
  console.log(`  Total modified files: ${chalk.bold(String(customFiles))}`);
  console.log(`  Custom src/ files:    ${chalk.bold(String(customSrcCount))}`);
  console.log();

  if (customFiles < 20) {
    console.log(chalk.green('  ✓ Low customization') + ' - Big bang is feasible');
    scoreBigBang += 3; scoreHybrid += 2; customLevel = 'low';
  } else if (customFiles < 50) {
    console.log(chalk.yellow('  ⚠ Medium customization') + ' - Hybrid recommended');
    scoreHybrid += 3; scoreBigBang += 1; scoreIncremental += 2; customLevel = 'medium';
  } else {
    console.log(chalk.red('  ⚠ Heavy customization') + ' - Incremental safer');
    scoreIncremental += 3; scoreHybrid += 1; customLevel = 'high';
  }
} else {
  console.log(chalk.yellow('  ⚠ Cannot analyze customization (no baseline branch)'));
}
console.log();

// 2. Analyze Version Gap
const currentMajor = parseVersion(currentVersion).major;
const targetMajor = parseVersion(targetVersion).major;
const versionGap = targetMajor - currentMajor;

console.log(chalk.cyan('Version Gap Analysis:'));
console.log(`  Current: ${chalk.bold('PWA ' + currentVersion)}`);
console.log(`  Target:  ${chalk.bold('PWA ' + targetVersion)}`);
console.log(`  Gap:     ${chalk.bold(String(versionGap) + ' major versions')}`);
console.log();

if (versionGap <= 1) {
  console.log(chalk.green('  ✓ Small gap') + ' - Big bang is safe');
  scoreBigBang += 3; versionRisk = 'low';
} else if (versionGap <= 3) {
  console.log(chalk.yellow('  ⚠ Medium gap') + ' - Consider hybrid approach');
  scoreHybrid += 3; scoreBigBang += 1; versionRisk = 'medium';
} else {
  console.log(chalk.red('  ⚠ Large gap') + ' - Incremental recommended');
  scoreIncremental += 3; scoreHybrid += 2; versionRisk = 'high';
}
console.log();

// 3. Check Pattern Detection
console.log(chalk.cyan('Breaking Changes Analysis:'));
const detectScript = path.join(__dirname, 'detect-pattern-changes.js');
if (fs.existsSync(detectScript)) {
  console.log(chalk.blue('  Running pattern detection...'));
  const output = execSilent(`node "${detectScript}" "${currentVersion}" "${targetVersion}" 2>/dev/null`);
  if (output) {
    breakingChanges = (output.match(/Severity:/g) || []).length;
    console.log(`  Breaking patterns: ${chalk.bold(String(breakingChanges))}`);
    if (breakingChanges < 20) { console.log(chalk.green('  ✓ Few breaking changes')); scoreBigBang += 2; }
    else if (breakingChanges < 40) { console.log(chalk.yellow('  ⚠ Moderate breaking changes')); scoreHybrid += 2; }
    else { console.log(chalk.red('  ⚠ Many breaking changes')); scoreIncremental += 2; scoreHybrid += 1; }
  }
} else {
  console.log(chalk.yellow('  ⚠ Pattern detection not available'));
}
console.log();

// 4. Interactive Questions
async function runInteractive() {
  if (interactive) {
    console.log(chalk.bold('📋 Team & Project Context (5 questions)'));
    console.log();

    if (await askYesNo('Q1: Does your team have strong Angular/TypeScript expertise?')) {
      scoreBigBang += 2; console.log(chalk.green('  → Big bang more feasible'));
    } else {
      scoreIncremental += 2; console.log(chalk.yellow('  → Incremental reduces learning curve'));
    }
    console.log();

    if (await askYesNo('Q2: Are you under tight deadlines (production pressure)?')) {
      scoreIncremental += 2; scoreHybrid += 1; console.log(chalk.yellow('  → Incremental allows intermediate deployments'));
    } else {
      scoreBigBang += 1; console.log(chalk.green('  → Can afford time for big bang'));
    }
    console.log();

    if (await askYesNo('Q3: Do you have good automated test coverage (>50%)?')) {
      scoreBigBang += 2; console.log(chalk.green('  → Tests help catch big bang issues'));
    } else {
      scoreIncremental += 1; console.log(chalk.yellow('  → Incremental safer without tests'));
    }
    console.log();

    if (await askYesNo('Q4: Are your customizations well-documented (clear markers, override pattern)?')) {
      scoreBigBang += 1; scoreHybrid += 1; console.log(chalk.green('  → Good practices make migration easier'));
    } else {
      scoreIncremental += 2; console.log(chalk.red('  → Poor practices need careful migration'));
    }
    console.log();

    if (await askYesNo('Q5: Can you afford 1-2 weeks in \'broken\' state during migration?')) {
      scoreBigBang += 2; console.log(chalk.green('  → Big bang feasible with downtime buffer'));
    } else {
      scoreIncremental += 2; scoreHybrid += 1; console.log(chalk.yellow('  → Incremental allows stable checkpoints'));
    }
    console.log();
  }

  printRecommendation();
}

function printRecommendation() {
  console.log(chalk.bold.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold.blue('         Recommendation'));
  console.log(chalk.bold.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log();

  let strategy, icon;
  if (scoreBigBang >= scoreIncremental && scoreBigBang >= scoreHybrid) {
    strategy = 'Big Bang'; icon = '🚀';
  } else if (scoreHybrid >= scoreIncremental) {
    strategy = 'Hybrid (Strategic Incremental)'; icon = '🎯';
  } else {
    strategy = 'Incremental'; icon = '📊';
  }

  console.log(chalk.bold(`${icon} RECOMMENDED: ${strategy}`));
  console.log();
  console.log(chalk.cyan('Decision Scores:'));
  console.log(`  Big Bang:     ${scoreBigBang} points`);
  console.log(`  Hybrid:       ${scoreHybrid} points`);
  console.log(`  Incremental:  ${scoreIncremental} points`);
  console.log();

  // Detailed explanation
  if (strategy === 'Big Bang') {
    console.log(chalk.bold.green('✓ Big Bang Migration (Direct Jump)'));
    console.log();
    console.log(`  ${currentVersion} → ${targetVersion} directly`);
    console.log();
    console.log(chalk.bold('Execution plan:'));
    console.log(`  1. Pre-analysis: ${chalk.cyan(`node scripts/detect-pattern-changes.js ${currentVersion} ${targetVersion} --comprehensive`)}`);
    console.log(`  2. Merge directly`);
    console.log(`  3. Fix systematically (one category at a time)`);
    console.log('  4. Build & test');
    console.log();
    console.log(chalk.bold('Estimated time:') + ' 1-2 weeks');
  } else if (strategy === 'Hybrid (Strategic Incremental)') {
    console.log(chalk.bold.cyan('🎯 Hybrid Migration (Strategic Stepping Stones)'));
    console.log();
    console.log(`  ${currentVersion} → 9.1.0 → ${targetVersion}`);
    console.log();
    console.log(chalk.bold('Phase 1:') + ` ${currentVersion} → 9.1.0 (Angular consolidation, 1 week)`);
    console.log(chalk.bold('Phase 2:') + ` 9.1.0 → ${targetVersion} (Angular 17 changes, 1 week)`);
    console.log();
    console.log(chalk.bold('Estimated time:') + ' 2-3 weeks total');
  } else {
    console.log(chalk.bold.yellow('📊 Incremental Migration (Step-by-Step)'));
    console.log();
    console.log(`  ${currentVersion} → 6.0 → 7.0 → 8.0 → 9.0 → 9.1 → ${targetVersion}`);
    console.log();
    console.log(chalk.bold('Estimated time:') + ' 4-6 weeks total');
  }

  // Next steps
  console.log();
  console.log(chalk.bold.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold.blue('         Next Steps'));
  console.log(chalk.bold.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log();
  console.log(chalk.bold('1. Review the recommendation with your team'));
  console.log();
  console.log(chalk.bold('2. Run pre-migration analysis'));
  console.log(`   ${chalk.cyan(`node scripts/analyze-migration-complexity.js ${currentVersion} ${targetVersion}`)}`);
  console.log();
  console.log(chalk.bold('3. Read the official guides'));
  console.log(`   ${chalk.cyan('.github/instructions/migration-approaches.instructions.md')}`);
  console.log();
  console.log(chalk.bold('4. Start migration with chosen strategy'));
  console.log(`   ${chalk.cyan('node scripts/migrate-custom-branch.js --help')}`);
  console.log();
  console.log(chalk.cyan('💡 Tip: Re-run this tool with --interactive for more personalized advice'));
  console.log();
}

runInteractive();
