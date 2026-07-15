#!/usr/bin/env node

/**
 * Lint Issue Analyzer
 *
 * Runs npm lint and categorizes error/warning counts.
 *
 * Usage:
 *   node scripts/check-lint-issues.js [--project-dir <path>]
 */

const fs = require('fs');
const path = require('path');
const { projectDir } = require('./_project-dir');
const { log, exec, tempFile, chalk } = require('./_utils');

console.log('📋 Analyzing linting issues...');
console.log();

// Run lint and capture output
const tmpLog = tempFile('lint-output-', '.log');
const result = exec(`npm run lint 2>&1`, { silent: true, cwd: projectDir });
const output = result.output || '';

// Write output for reference
fs.writeFileSync(tmpLog, output);
console.log(output);
console.log();

// Count errors and warnings
const lines = output.split('\n');
const errorCount = lines.filter(l => / error /i.test(l)).length;
const warningCount = lines.filter(l => / warning /i.test(l)).length;

console.log('────────────────────────────────────────────────');
console.log('📊 Linting Summary:');
console.log(`   Errors: ${errorCount}`);
console.log(`   Warnings: ${warningCount}`);
console.log();

// Analyze error types
const rulePattern = /@[a-z-]+\/[a-z-]+/g;
const ruleCounts = {};
for (const line of lines) {
  const matches = line.match(rulePattern);
  if (matches) {
    for (const m of matches) {
      ruleCounts[m] = (ruleCounts[m] || 0) + 1;
    }
  }
}

const topRules = Object.entries(ruleCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
if (topRules.length > 0) {
  console.log('📈 Top Issue Categories:');
  for (const [rule, count] of topRules) {
    console.log(`   ${String(count).padStart(4)} ${rule}`);
  }
  console.log();
}

// Cleanup temp file
try { fs.unlinkSync(tmpLog); } catch {}

if (errorCount > 0) {
  console.log('❌ Linting errors must be fixed before deployment');
  console.log();
  console.log('💡 Quick Fixes:');
  console.log('   1. Auto-fix simple issues: npm run lint -- --fix');
  console.log('   2. Review remaining errors: npm run lint 2>&1 | grep error');
  console.log('   3. See migration-issues.instructions.md section 8 for guidance');
  process.exit(1);
} else {
  console.log('✅ No linting errors');
  if (warningCount > 0) {
    console.log(`⚠️  ${warningCount} warnings detected`);
    console.log();
    console.log('💡 Recommendations:');
    console.log('   - Review warnings (many auto-fixable)');
    console.log('   - Run: npm run lint -- --fix');
    console.log('   - Document exceptions if needed');
  } else {
    console.log('✅ No warnings - excellent code quality!');
  }
  process.exit(0);
}
