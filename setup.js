#!/usr/bin/env node

/**
 * PWA Migration Toolkit - One-Time Setup
 *
 * Run this once to generate your VS Code workspace file.
 * After that, just open the workspace and ask Copilot to help you migrate.
 *
 * Usage:
 *   node setup.js /path/to/your/custom-pwa
 *
 * Example:
 *   node setup.js /home/training/developer/pwa/developer-pwa
 *   node setup.js ../pwa/developer-pwa
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');

const SCRIPT_DIR = __dirname;
const WORKSPACE_FILE = path.join(SCRIPT_DIR, 'pwa-migration.code-workspace');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

async function main() {
  console.log();
  console.log(chalk.blue.bold('PWA Migration Toolkit - Setup'));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  // Get PWA path
  let pwaPath = process.argv[2] || '';

  if (!pwaPath) {
    console.log('Where is your custom PWA project?');
    console.log(chalk.yellow('(the folder with package.json and src/)'));
    console.log();
    pwaPath = await ask('Path: ');
  }

  if (!pwaPath) {
    console.log(chalk.red('No path provided. Exiting.'));
    process.exit(1);
  }

  // Resolve to absolute path
  pwaPath = path.resolve(SCRIPT_DIR, pwaPath);

  // Validate
  if (!fs.existsSync(pwaPath)) {
    console.log(chalk.red(`Directory does not exist: ${pwaPath}`));
    process.exit(1);
  }

  if (!fs.existsSync(path.join(pwaPath, 'package.json'))) {
    console.log(chalk.yellow(`Warning: No package.json found in ${pwaPath}`));
    console.log('Are you sure this is the PWA project root?');
    const confirm = await ask('Continue anyway? (y/N): ');
    if (!/^[yY]/.test(confirm)) process.exit(1);
  }

  // Calculate relative path (for portability)
  const relPath = path.relative(SCRIPT_DIR, pwaPath).split(path.sep).join('/');

  // Generate workspace file
  const workspace = {
    folders: [
      { name: 'Custom PWA', path: relPath },
      { name: 'Migration Toolkit', path: '.' },
    ],
    settings: {
      'files.exclude': { '**/node_modules': true },
      'terminal.integrated.env.linux': { PWA_PROJECT_DIR: pwaPath },
      'terminal.integrated.env.osx': { PWA_PROJECT_DIR: pwaPath },
      'terminal.integrated.env.windows': { PWA_PROJECT_DIR: pwaPath },
    },
  };

  fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(workspace, null, 2) + '\n');

  console.log();
  console.log(chalk.green.bold('✅ Setup complete!'));
  console.log();
  console.log(`Workspace file created: ${chalk.blue('pwa-migration.code-workspace')}`);
  console.log(`Custom PWA path:        ${chalk.blue(pwaPath)}`);
  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();
  console.log('Next steps:');
  console.log(`  1. Open in VS Code: ${chalk.cyan('code pwa-migration.code-workspace')}`);
  console.log('  2. Ask Copilot to help with your migration!');
  console.log();
}

main();
