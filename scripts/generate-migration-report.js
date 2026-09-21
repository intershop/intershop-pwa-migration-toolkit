#!/usr/bin/env node

/**
 * Migration Report Generator
 *
 * Generates a comprehensive migration report documenting versions, changes,
 * pattern detection findings, build/test/lint status, and recommendations.
 *
 * Usage:
 *   node scripts/generate-migration-report.js [migration-branch-name]
 *   node scripts/generate-migration-report.js migration/4.0-to-9.1
 */

const fs = require('fs');
const path = require('path');
const { projectDir } = require('./_project-dir');
const { log, exec, execFileSilent, execSilent, findFiles, chalk } = require('./_utils');

process.chdir(projectDir);

const migrationBranch = process.argv[2] || execSilent('git branch --show-current') || 'unknown';
const reportDate = new Date().toISOString().slice(0, 10);
const reportFile = `migration-report-${reportDate}.md`;

console.log(chalk.cyan('╔════════════════════════════════════════════════════════════════╗'));
console.log(chalk.cyan('║') + chalk.blue('      Migration Report Generator') + '                            ' + chalk.cyan('║'));
console.log(chalk.cyan('╚════════════════════════════════════════════════════════════════╝'));
console.log();

// Helpers
function getPackageVersion(name) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
    if (name === 'version') return pkg.version || 'N/A';
    return pkg.dependencies?.[name] || pkg.devDependencies?.[name] || 'N/A';
  } catch { return 'N/A'; }
}

console.log(chalk.blue('📊 Collecting migration data...\n'));

const currentCommit = execSilent('git rev-parse --short HEAD') || 'unknown';
const angularVersion = getPackageVersion('@angular/core');
const pwaVersion = getPackageVersion('version');
const nodeVersion = process.version;
const npmVersion = execSilent('npm --version') || 'N/A';

// Build status
console.log(chalk.yellow('Checking build status...'));
let buildStatus = 'Unknown', buildOutput = '';
const buildResult = exec('npm run build 2>&1', { silent: true });
if (buildResult.success) { buildStatus = '✅ Success'; buildOutput = 'Build completed successfully'; }
else { buildStatus = '❌ Failed'; buildOutput = (buildResult.output || '').split('\n').slice(-20).join('\n'); }

// Test status
console.log(chalk.yellow('Checking test status...'));
let testStatus = 'Unknown', testOutput = '';
const testResult = exec('npm test -- --passWithNoTests 2>&1', { silent: true });
if (testResult.success) { testStatus = '✅ Success'; testOutput = 'All tests passed'; }
else { testStatus = '⚠️ Some issues'; testOutput = (testResult.output || '').split('\n').slice(-20).join('\n'); }

// Lint status
console.log(chalk.yellow('Checking lint status...'));
let lintStatus = 'Unknown', lintErrors = 0, lintWarnings = 0;
const lintResult = exec('npm run lint 2>&1', { silent: true });
if (lintResult.success) { lintStatus = '✅ No issues'; }
else {
  lintStatus = '⚠️ Issues found';
  const lintLines = (lintResult.output || '').split('\n');
  lintErrors = lintLines.filter(l => /error/i.test(l)).length;
  lintWarnings = lintLines.filter(l => /warning/i.test(l)).length;
}

// Custom features
const customExtensions = fs.existsSync(path.join(projectDir, 'src/app/extensions'))
  ? fs.readdirSync(path.join(projectDir, 'src/app/extensions'), { withFileTypes: true }).filter(e => e.isDirectory()).length : 0;
const customThemes = fs.existsSync(path.join(projectDir, 'src/styles/themes'))
  ? fs.readdirSync(path.join(projectDir, 'src/styles/themes'), { withFileTypes: true }).filter(e => e.isDirectory()).length : 0;
const customComponents = findFiles(path.join(projectDir, 'src/app'), /\.component\.ts$/).length;

// Extensions list
let extensionsList = '  - None detected';
try {
  const extDir = path.join(projectDir, 'src/app/extensions');
  if (fs.existsSync(extDir)) {
    const exts = fs.readdirSync(extDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => `  - ${e.name}`);
    if (exts.length > 0) extensionsList = exts.join('\n');
  }
} catch {}

// Theme list
let themesList = '  - None detected';
try {
  const thDir = path.join(projectDir, 'src/styles/themes');
  if (fs.existsSync(thDir)) {
    const ths = fs.readdirSync(thDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => `  - ${e.name}`);
    if (ths.length > 0) themesList = ths.join('\n');
  }
} catch {}

// Branch info
const branchCreated = execFileSilent('git', ['log', '--reverse', '--format=%ci', migrationBranch], projectDir).split('\n')[0];
const lastCommit = execFileSilent('git', ['log', '-1', '--format=%ci'], projectDir);

// Determine base branch
const baseBranch = execFileSilent('git', ['show-ref', '--verify', '--quiet', 'refs/heads/develop'], projectDir) === '' &&
  execFileSilent('git', ['rev-parse', '--verify', 'develop'], projectDir) ? 'develop' :
  (execFileSilent('git', ['rev-parse', '--verify', 'main'], projectDir) ? 'main' : '');

let filesChanged = 'N/A', commits = 'N/A', diffStat = '';
if (baseBranch) {
  const statLines = execFileSilent('git', ['diff', '--stat', `${baseBranch}...${migrationBranch}`], projectDir).split('\n').filter(Boolean);
  filesChanged = statLines.at(-1)?.match(/^\s*(\d+)/)?.[1] || 'N/A';
  commits = String(execFileSilent('git', ['log', '--oneline', `${baseBranch}..${migrationBranch}`], projectDir).split('\n').filter(Boolean).length);
  diffStat = statLines.slice(0, 20).join('\n') || 'Unable to determine file changes';
}

// Pattern detection
let patternSection = `**Status:** No pattern detection report found.\n\nRun: \`node scripts/detect-pattern-changes.js [source] [target]\``;
if (fs.existsSync('pattern-detection-report.json')) {
  try {
    const report = JSON.parse(fs.readFileSync('pattern-detection-report.json', 'utf-8'));
    const totalPatterns = report.results?.length || 0;
    const totalOccurrences = (report.results || []).reduce((sum, r) => sum + (r.matchCount || 0), 0);
    patternSection = `**Patterns Detected:** ${totalPatterns}\n**Total Occurrences:** ${totalOccurrences}`;
  } catch {}
}

// i18n merge
let i18nSection = 'Localization files were handled using standard git merge strategies.';
if (fs.existsSync('i18n-merge-report.json')) {
  try {
    const report = JSON.parse(fs.readFileSync('i18n-merge-report.json', 'utf-8'));
    const totalConflicts = (report.locales || []).reduce((sum, l) => sum + (l.conflicts?.length || 0), 0);
    i18nSection = `**Total Conflicts:** ${totalConflicts}\n**Locales Processed:** ${report.summary?.totalLocales || 0}`;
  } catch {}
}

const overall = buildStatus.includes('Success') ? '✅ Ready for review' : '⚠️ Needs attention';

// Generate report
console.log(chalk.blue(`📝 Generating report: ${reportFile}\n`));

const reportContent = `# PWA Migration Report

**Date:** ${reportDate}
**Migration Branch:** \`${migrationBranch}\`
**Current Commit:** \`${currentCommit}\`
**Generated by:** Migration Report Generator v2.0

---

## Executive Summary

| Aspect | Status |
|--------|--------|
| **Build** | ${buildStatus} |
| **Tests** | ${testStatus} |
| **Lint** | ${lintStatus} |
| **Overall** | ${overall} |

---

## Migration Details

### Versions
- **Angular Version:** ${angularVersion}
- **PWA Version:** ${pwaVersion}
- **Node Version:** ${nodeVersion}
- **npm Version:** ${npmVersion}

### Timeline
- **Report Generated:** ${reportDate}
- **Branch Created:** ${(branchCreated || 'N/A').split(' ')[0]}
- **Last Commit:** ${(lastCommit || 'N/A').split(' ')[0]}

---

## Customization Summary

- **Custom Extensions:** ${customExtensions}
${extensionsList}

- **Custom Themes:** ${customThemes}
${themesList}

- **Total Components:** ${customComponents}

---

## Pattern Detection Results

${patternSection}

---

## Localization Merge Results

${i18nSection}

---

## Build & Verification Results

### Build: ${buildStatus}
\`\`\`
${buildOutput}
\`\`\`

### Tests: ${testStatus}
\`\`\`
${testOutput}
\`\`\`

### Lint: ${lintStatus}
${lintStatus !== '✅ No issues' ? `- **Errors:** ${lintErrors}\n- **Warnings:** ${lintWarnings}` : ''}

---

## Files Changed

${baseBranch ? `**Base Branch:** \`${baseBranch}\`
**Files Changed:** ${filesChanged}
**Commits:** ${commits}

### Top Changed Files
\`\`\`
${diffStat}
\`\`\`` : 'Unable to determine base branch for comparison.'}

---

## Next Steps

${buildStatus.includes('Success') ? `1. Review changes: \`git diff ${baseBranch || 'develop'}...${migrationBranch} --stat\`
2. Manual testing of custom features
3. Push to remote: \`git push -u origin ${migrationBranch}\`` : `1. Fix build errors (see build output above)
2. Re-run: \`npm run build\`
3. Re-generate report: \`node scripts/generate-migration-report.js\``}
`;

fs.writeFileSync(reportFile, reportContent);
log.success(`Report saved: ${reportFile}`);
console.log();
console.log(chalk.blue(`📄 View report: cat ${reportFile}`));
console.log();
