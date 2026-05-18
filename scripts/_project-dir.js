/**
 * Shared helper: Resolve the target PWA project directory
 *
 * Usage (require from any JS script):
 *   const { projectDir } = require('./_project-dir');
 *   // projectDir is the absolute path to the PWA project root
 *
 * Resolution order:
 *   1. --project-dir <path> CLI argument
 *   2. PWA_PROJECT_DIR environment variable
 *   3. Current working directory (legacy behavior)
 */

const path = require('path');
const fs = require('fs');

function resolveProjectDir() {
  let dir = null;

  // 1. Check --project-dir CLI argument
  const args = process.argv.slice(2);
  const idx = args.indexOf('--project-dir');
  if (idx !== -1 && args[idx + 1]) {
    dir = args[idx + 1];
  }

  // 2. Fall back to environment variable
  if (!dir && process.env.PWA_PROJECT_DIR) {
    dir = process.env.PWA_PROJECT_DIR;
  }

  // 3. Fall back to current working directory
  if (!dir) {
    dir = process.cwd();
  }

  // Resolve to absolute path
  dir = path.resolve(dir);

  if (!fs.existsSync(dir)) {
    console.error(`ERROR: Project directory does not exist: ${dir}`);
    process.exit(1);
  }

  // Validate it looks like a PWA project
  if (!fs.existsSync(path.join(dir, 'package.json'))) {
    console.warn(`WARNING: No package.json found in ${dir}`);
    console.warn('         Ensure --project-dir or PWA_PROJECT_DIR points to the PWA project root.');
  }

  return dir;
}

const projectDir = resolveProjectDir();

module.exports = { projectDir };
