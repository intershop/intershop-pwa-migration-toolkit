#!/usr/bin/env node

/**
 * Angular 17 Control Flow Migration
 *
 * Converts *ngIf, *ngFor, *ngSwitch to @if, @for, @switch using Angular CLI schematics.
 * Also detects themed templates that the schematic may miss.
 *
 * Usage:
 *   node scripts/migrate-control-flow.js [--project-dir <path>]
 */

const fs = require('fs');
const path = require('path');
const { projectDir } = require('./_project-dir');
const { log, exec, execSilent, findFiles, grepFiles, chalk, askYesNo } = require('./_utils');

process.chdir(projectDir);

console.log(chalk.bold.blue('🔄 Angular 17 Control Flow Migration'));
console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
console.log();

// Check Angular CLI
if (!execSilent('ng version')) {
  log.error('Angular CLI not found');
  console.log(chalk.yellow('Install it with: npm install -g @angular/cli'));
  process.exit(1);
}

// Check Angular version
let angularVersion = 0;
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
  const coreVersion = pkg.dependencies?.['@angular/core'] || '';
  const match = coreVersion.match(/(\d+)/);
  if (match) angularVersion = parseInt(match[1]);
} catch {}

if (angularVersion < 17) {
  log.error(`Angular 17+ required for control flow migration`);
  console.log(chalk.yellow(`Current version: ${angularVersion}`));
  console.log(chalk.yellow('Update Angular first: ng update @angular/core@17 @angular/cli@17'));
  process.exit(1);
}

console.log(chalk.green(`✓ Angular CLI detected (version ${angularVersion})`));
console.log();

// Step 1: Detect usage
console.log(chalk.bold('Step 1: Detecting old control flow syntax...'));

const searchPaths = [path.join(projectDir, 'src')];
if (fs.existsSync(path.join(projectDir, 'projects'))) searchPaths.push(path.join(projectDir, 'projects'));

const htmlFiles = [];
for (const sp of searchPaths) htmlFiles.push(...findFiles(sp, /\.html$/));

const themedTemplates = htmlFiles.filter(f => /\.component\.[a-z0-9-]+\.html$/.test(f));

console.log(chalk.cyan(`Total templates found: ${htmlFiles.length}`));
if (themedTemplates.length > 0) {
  console.log(chalk.yellow(`  Including ${themedTemplates.length} themed templates (.b2c.html, .b2b.html, etc.)`));
}
console.log();

const ngIfFiles = grepFiles(htmlFiles, /\*ngIf=/);
const ngForFiles = grepFiles(htmlFiles, /\*ngFor=/);
const ngSwitchFiles = grepFiles(htmlFiles, /\*ngSwitch/);

const ngIfCount = [...new Set(ngIfFiles.map(m => m.file))].length;
const ngForCount = [...new Set(ngForFiles.map(m => m.file))].length;
const ngSwitchCount = [...new Set(ngSwitchFiles.map(m => m.file))].length;
const total = new Set([...ngIfFiles, ...ngForFiles, ...ngSwitchFiles].map(m => m.file)).size;

console.log(`  ${chalk.cyan('*ngIf:')}     ${ngIfCount} files`);
console.log(`  ${chalk.cyan('*ngFor:')}    ${ngForCount} files`);
console.log(`  ${chalk.cyan('*ngSwitch:')} ${ngSwitchCount} files`);
console.log(`  ${chalk.bold('Total:')}     ${total} files`);
console.log();

console.log(chalk.cyan('Detailed occurrence counts:'));
console.log(`  ${chalk.cyan('*ngIf:')}     ${ngIfFiles.length} occurrences`);
console.log(`  ${chalk.cyan('*ngFor:')}    ${ngForFiles.length} occurrences`);
console.log(`  ${chalk.cyan('*ngSwitch:')} ${ngSwitchFiles.length} occurrences`);
console.log();

if (total === 0) {
  console.log(chalk.green('✅ No old control flow syntax found - already migrated!'));
  process.exit(0);
}

// Step 2: Confirm migration
async function run() {
  console.log(chalk.yellow('⚠️  This migration will modify your template files'));
  console.log(chalk.yellow('   Make sure you have committed any pending changes'));
  console.log();

  if (process.stdin.isTTY) {
    const proceed = await askYesNo('Do you want to proceed with the migration?');
    if (!proceed) {
      console.log(chalk.yellow('Migration cancelled'));
      process.exit(0);
    }
  }

  // Step 3: Run Angular schematic
  console.log();
  console.log(chalk.bold('Step 2: Running Angular migration schematic...'));
  console.log(chalk.cyan('This may take a few minutes...'));
  console.log();

  // Create backup branch
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupBranch = `backup-before-control-flow-${timestamp}`;
  exec(`git branch "${backupBranch}"`, { silent: true });
  console.log(chalk.green(`✓ Created backup branch: ${backupBranch}`));
  console.log();

  const result = exec('ng generate @angular/core:control-flow');

  if (!result.success) {
    console.log();
    log.error('Migration failed');
    console.log(chalk.yellow(`Restore from backup with: git checkout ${backupBranch}`));
    process.exit(1);
  }

  console.log();
  console.log(chalk.green('✅ Control flow migration completed'));
  console.log();

  // Step 4: Verify results
  console.log(chalk.bold('Step 3: Verifying migration results...'));

  const remainingNgIf = grepFiles(htmlFiles, /\*ngIf=/).length;
  const remainingNgFor = grepFiles(htmlFiles, /\*ngFor=/).length;
  const remainingNgSwitch = grepFiles(htmlFiles, /\*ngSwitch/).length;

  const newIf = grepFiles(htmlFiles, /@if\s*\(/).length;
  const newFor = grepFiles(htmlFiles, /@for\s*\(/).length;
  const newSwitch = grepFiles(htmlFiles, /@switch\s*\(/).length;

  console.log();
  console.log(chalk.cyan('New control flow syntax:'));
  console.log(`  ${chalk.green('@if:')}     ${newIf} occurrences`);
  console.log(`  ${chalk.green('@for:')}    ${newFor} occurrences`);
  console.log(`  ${chalk.green('@switch:')} ${newSwitch} occurrences`);
  console.log();

  if (remainingNgIf > 0 || remainingNgFor > 0 || remainingNgSwitch > 0) {
    console.log(chalk.yellow('⚠️  Some old syntax remains:'));
    console.log(`  ${chalk.yellow('*ngIf:')}     ${remainingNgIf}`);
    console.log(`  ${chalk.yellow('*ngFor:')}    ${remainingNgFor}`);
    console.log(`  ${chalk.yellow('*ngSwitch:')} ${remainingNgSwitch}`);
    console.log();

    const unmigrated = new Set([
      ...grepFiles(htmlFiles, /\*ngIf=/).map(m => m.file),
      ...grepFiles(htmlFiles, /\*ngFor=/).map(m => m.file),
      ...grepFiles(htmlFiles, /\*ngSwitch/).map(m => m.file),
    ]);

    console.log(chalk.yellow('📋 Files requiring manual migration:'));
    console.log();
    const themed = [...unmigrated].filter(f => /\.component\.[a-z0-9-]+\.html$/.test(f));
    const regular = [...unmigrated].filter(f => !/\.component\.[a-z0-9-]+\.html$/.test(f));

    if (regular.length > 0) {
      console.log(chalk.cyan('Regular templates:'));
      regular.forEach(f => console.log(`  ${chalk.cyan(path.relative(projectDir, f))}`));
      console.log();
    }
    if (themed.length > 0) {
      console.log(chalk.yellow('⚠️  Themed templates (custom theme variants):'));
      themed.forEach(f => console.log(`  ${chalk.yellow(path.relative(projectDir, f))}`));
      console.log();
    }

    console.log(chalk.yellow('💡 Reasons for unmigrated files:'));
    console.log('   • Complex template expressions the schematic couldn\'t parse');
    console.log('   • Custom theme templates (.b2c.html, .b2b.html, etc.)');
    console.log('   • Templates in non-standard locations (extensions)');
    console.log();
    console.log(chalk.cyan('To migrate manually:'));
    console.log('   1. Convert: *ngIf="expr" → @if (expr) { }');
    console.log('   2. Convert: *ngFor="let x of items" → @for (x of items; track x) { }');
    console.log('   3. Convert: [ngSwitch] → @switch');
    console.log();
  } else {
    console.log(chalk.green('✅ All old syntax successfully migrated!'));
    console.log();
  }

  // Step 5: Next steps
  console.log(chalk.bold.green('✅ Migration Complete!'));
  console.log();
  console.log(chalk.bold('Next Steps:'));
  console.log(`  1. Review changes: ${chalk.cyan('git diff')}`);
  console.log(`  2. Run linting:    ${chalk.cyan('npm run lint')}`);
  console.log(`  3. Build project:  ${chalk.cyan('npm run build')}`);
  console.log(`  4. Run tests:      ${chalk.cyan('npm test')}`);
  console.log(`  5. Commit changes: ${chalk.cyan("git commit -m 'feat: migrate to Angular 17 control flow syntax'")}`);
  console.log();
  console.log(chalk.cyan('💡 If something went wrong, restore from backup:'));
  console.log(`   ${chalk.cyan(`git checkout ${backupBranch}`)}`);
  console.log();
}

run();
