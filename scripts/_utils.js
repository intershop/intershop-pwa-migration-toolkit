/**
 * Shared utilities for PWA Migration Toolkit
 *
 * Provides cross-platform helpers for logging, git operations,
 * command execution, version comparison, and file operations.
 *
 * Usage:
 *   const { log, exec, compareVersions, findFiles } = require('./_utils');
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// ─── Logging ────────────────────────────────────────────────────────────────

const log = {
  info: msg => console.log(`${chalk.blue('[INFO]')} ${msg}`),
  success: msg => console.log(`${chalk.green('[SUCCESS]')} ${msg}`),
  warning: msg => console.log(`${chalk.yellow('[WARNING]')} ${msg}`),
  error: msg => console.log(`${chalk.red('[ERROR]')} ${msg}`),
  step: (num, msg) => console.log(`\n${chalk.cyan(`Step ${num}:`)} ${msg}`),
  header: title => {
    const line = '━'.repeat(50);
    console.log(chalk.blue(line));
    console.log(chalk.blue.bold(title));
    console.log(chalk.blue(line));
  },
  section: msg => console.log(`\n${chalk.yellow(`▶ ${msg}`)}`),
  dim: msg => console.log(chalk.dim(msg)),
};

// ─── Command Execution ─────────────────────────────────────────────────────

/**
 * Execute a shell command and return result.
 * @param {string} command - Command to run
 * @param {object} [options] - Options
 * @param {boolean} [options.silent=false] - Suppress stdout/stderr
 * @param {string} [options.cwd] - Working directory
 * @returns {{ success: boolean, output: string, error?: string }}
 */
function exec(command, options = {}) {
  const { silent = false, cwd } = options;
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
      cwd,
    });
    return { success: true, output: (output || '').trim() };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      output: (error.stdout || '').toString().trim(),
    };
  }
}

/**
 * Execute a shell command silently and return trimmed output.
 * @param {string} command
 * @param {string} [cwd]
 * @returns {string}
 */
function execSilent(command, cwd) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe', cwd }).trim();
  } catch {
    return '';
  }
}

// ─── Version Comparison ─────────────────────────────────────────────────────

/**
 * Parse a version string into its components.
 * @param {string} version - e.g. "10.0.0", "v22.1.0"
 * @returns {{ major: number, minor: number, patch: number }}
 */
function parseVersion(version) {
  const match = String(version).replace(/^v/, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return { major: 0, minor: 0, patch: 0 };
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2] || '0', 10),
    patch: parseInt(match[3] || '0', 10),
  };
}

/**
 * Compare two version strings.
 * @returns {number} -1 if a < b, 0 if equal, 1 if a > b
 */
function compareVersions(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (va.major !== vb.major) return va.major < vb.major ? -1 : 1;
  if (va.minor !== vb.minor) return va.minor < vb.minor ? -1 : 1;
  if (va.patch !== vb.patch) return va.patch < vb.patch ? -1 : 1;
  return 0;
}

// ─── File Operations ────────────────────────────────────────────────────────

/**
 * Recursively find files matching a pattern.
 * @param {string} dir - Directory to search
 * @param {RegExp|string} pattern - Filename pattern (RegExp or glob-like string)
 * @param {object} [options]
 * @param {string[]} [options.exclude] - Directory names to exclude
 * @returns {string[]} - Array of absolute file paths
 */
function findFiles(dir, pattern, options = {}) {
  const { exclude = ['node_modules', '.git', 'dist', 'coverage'] } = options;
  const results = [];
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));

  function walk(currentDir) {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (exclude.includes(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (regex.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Count occurrences of a pattern in files.
 * @param {string[]} files - File paths
 * @param {RegExp} pattern - Pattern to search for
 * @returns {number}
 */
function countInFiles(files, pattern) {
  let count = 0;
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const matches = content.match(pattern);
      if (matches) count += matches.length;
    } catch {
      // skip unreadable files
    }
  }
  return count;
}

/**
 * Search for a pattern in files and return matches with file/line info.
 * @param {string[]} files - File paths
 * @param {RegExp} pattern - Pattern to search for
 * @returns {{ file: string, line: number, match: string }[]}
 */
function grepFiles(files, pattern) {
  const results = [];
  for (const file of files) {
    try {
      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      lines.forEach((lineContent, idx) => {
        if (pattern.test(lineContent)) {
          results.push({ file, line: idx + 1, match: lineContent.trim() });
        }
      });
    } catch {
      // skip unreadable files
    }
  }
  return results;
}

// ─── Interactive Prompts ────────────────────────────────────────────────────

const readline = require('readline');

/**
 * Ask a yes/no question interactively.
 * @param {string} question
 * @returns {Promise<boolean>}
 */
function askYesNo(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`${chalk.cyan(question)} (y/n): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Ask for text input.
 * @param {string} question
 * @returns {Promise<string>}
 */
function askInput(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`${chalk.cyan(question)} `, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ─── Temp Files ─────────────────────────────────────────────────────────────

const os = require('os');

/**
 * Create a temporary file path.
 * @param {string} [prefix='pwa-migration-']
 * @param {string} [ext='.tmp']
 * @returns {string}
 */
function tempFile(prefix = 'pwa-migration-', ext = '.tmp') {
  return path.join(os.tmpdir(), `${prefix}${Date.now()}${ext}`);
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  log,
  exec,
  execSilent,
  parseVersion,
  compareVersions,
  findFiles,
  countInFiles,
  grepFiles,
  askYesNo,
  askInput,
  tempFile,
  chalk,
};
