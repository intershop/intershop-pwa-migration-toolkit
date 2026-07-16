#!/usr/bin/env node

/**
 * Node.js Version Checker and Updater
 *
 * Verifies that the current Node.js and npm versions meet the requirements
 * for the target PWA version. Provides instructions to update if needed.
 *
 * Usage:
 *   node scripts/check-nodejs-version.js [target-pwa-version]
 *   node scripts/check-nodejs-version.js 10.0.0
 *
 * Options:
 *   --auto-update    Automatically update .nvmrc and switch Node.js version
 *   --skip-check     Skip version check (not recommended)
 */

const fs = require('fs');
const path = require('path');
const { projectDir } = require('./_project-dir');
const { log, exec, execSilent, parseVersion, chalk } = require('./_utils');

// Parse arguments
const args = process.argv.slice(2).filter(a => a !== '--project-dir' && !process.argv[process.argv.indexOf('--project-dir') + 1]?.includes(a));
let targetVersion = '11.0.0';
let autoUpdate = false;
let skipCheck = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--auto-update': autoUpdate = true; break;
    case '--skip-check': skipCheck = true; break;
    case '--help':
      console.log(`Usage: node scripts/check-nodejs-version.js [target-pwa-version] [options]
Options:
  --auto-update    Automatically update .nvmrc and switch Node.js version
  --skip-check     Skip version check (not recommended)`);
      process.exit(0);
    default:
      if (!args[i].startsWith('-')) targetVersion = args[i];
  }
}

if (skipCheck) {
  log.warning('Node.js version check skipped');
  process.exit(0);
}

log.header('🔍 Node.js Version Checker');
console.log();

// Detect current versions
const currentNode = process.version.replace(/^v/, '');
const currentNpm = execSilent('npm --version') || 'not installed';

console.log(chalk.bold('Current Environment:'));
console.log(`  Node.js: ${chalk.cyan(currentNode)}`);
console.log(`  npm:     ${chalk.cyan(currentNpm)}`);
console.log();

// Determine required versions based on target PWA version
const majorVersion = parseVersion(targetVersion).major;
const requirements = {
  10: { node: '22', npm: '10' },
  9:  { node: '18', npm: '9' },
  8:  { node: '16', npm: '8' },
};
const { node: requiredNode, npm: requiredNpm } = requirements[majorVersion] || { node: '22', npm: '10' };

console.log(chalk.bold(`Required for PWA ${targetVersion}:`));
console.log(`  Node.js: ${chalk.green(`${requiredNode}.x.x`)}`);
console.log(`  npm:     ${chalk.green(`${requiredNpm}.x.x`)}`);
console.log();

// Check Node.js version
const currentNodeMajor = String(parseVersion(currentNode).major);
const nodeOk = currentNodeMajor === requiredNode;

if (nodeOk) {
  console.log(chalk.green('✅ Node.js version is compatible'));
} else {
  console.log(chalk.red('❌ Node.js version mismatch!'));
  console.log(`   Current: ${currentNode}`);
  console.log(`   Required: ${requiredNode}.x.x`);
  console.log();
}

// Check npm version
const currentNpmMajor = String(parseVersion(currentNpm).major);
const npmOk = currentNpmMajor === requiredNpm;

if (npmOk) {
  console.log(chalk.green('✅ npm version is compatible'));
} else {
  console.log(chalk.red('❌ npm version mismatch!'));
  console.log(`   Current: ${currentNpm}`);
  console.log(`   Required: ${requiredNpm}.x.x`);
  console.log();
}

// If everything is OK, exit successfully
if (nodeOk && npmOk) {
  console.log(chalk.green.bold('✅ All version requirements met!'));
  process.exit(0);
}

// Provide update instructions
console.log(chalk.yellow.bold('⚠️  Version Update Required'));
console.log();
console.log(chalk.bold('Recommended Actions:'));
console.log();

// Check if nvm is available
const nvmAvailable = !!process.env.NVM_DIR || fs.existsSync(path.join(process.env.HOME || '', '.nvm', 'nvm.sh'));

if (nvmAvailable) {
  console.log(chalk.cyan('Option 1: Update automatically (recommended)'));
  console.log(`  ${chalk.bold(`node scripts/check-nodejs-version.js ${targetVersion} --auto-update`)}`);
  console.log();
  console.log(chalk.cyan('Option 2: Update manually with nvm'));
  console.log(`  ${chalk.bold(`nvm install ${requiredNode}`)}`);
  console.log(`  ${chalk.bold(`nvm use ${requiredNode}`)}`);
  console.log(`  ${chalk.bold(`nvm alias default ${requiredNode}`)}`);
  console.log();

  if (autoUpdate) {
    console.log(chalk.blue('🔄 Auto-update enabled. Updating Node.js...'));
    console.log();

    // nvm must be invoked through bash since it's a shell function
    const nvmDir = process.env.NVM_DIR || path.join(process.env.HOME || '', '.nvm');
    const nvmCommand = `export NVM_DIR="${nvmDir}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm install ${requiredNode} && nvm use ${requiredNode}`;

    console.log(chalk.cyan(`Installing Node.js ${requiredNode}...`));
    const result = exec(`bash -c '${nvmCommand}'`);

    if (result.success) {
      // Update .nvmrc
      fs.writeFileSync(path.join(projectDir, '.nvmrc'), requiredNode + '\n');
      console.log(chalk.green('✓ Created/updated .nvmrc'));
      console.log();
      console.log(chalk.green('✅ Update complete!'));
      console.log();
      console.log(chalk.yellow("💡 Tip: Run 'npm install' to rebuild node_modules with new Node.js version"));
    } else {
      log.error('Failed to update Node.js via nvm. Please update manually.');
    }
    process.exit(0);
  }
} else {
  console.log(chalk.cyan('Option 1: Install nvm (Node Version Manager)'));
  console.log(`  ${chalk.bold('curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash')}`);
  console.log('  Then restart your terminal and run:');
  console.log(`  ${chalk.bold(`nvm install ${requiredNode}`)}`);
  console.log();
  console.log(chalk.cyan('Option 2: Install Node.js directly'));
  console.log(`  Download from: ${chalk.bold('https://nodejs.org/')}`);
  console.log(`  Choose version: ${chalk.bold(`${requiredNode}.x.x LTS`)}`);
  console.log();
}

console.log(chalk.cyan('Option 3: Update .nvmrc for team'));
console.log(`  ${chalk.bold(`echo "${requiredNode}" > .nvmrc`)}`);
console.log('  Commit this file so team members use the correct version');
console.log();
