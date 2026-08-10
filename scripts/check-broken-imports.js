#!/usr/bin/env node

/**
 * Broken Import Checker
 *
 * Detects relative import paths that point to non-existent files.
 * Useful after migration when upstream files have been moved or deleted.
 *
 * Usage:
 *   node scripts/check-broken-imports.js [--project-dir <path>]
 */

const fs = require('fs');
const path = require('path');
const { projectDir } = require('./_project-dir');
const { log, findFiles, chalk } = require('./_utils');

const srcDir = path.join(projectDir, 'src');

if (!fs.existsSync(srcDir)) {
  log.error(`Source directory not found: ${srcDir}`);
  process.exit(1);
}

log.header('Broken Import Check');

const tsFiles = findFiles(srcDir, /\.ts$/);
log.info(`Scanning ${tsFiles.length} TypeScript files for broken relative imports...`);
console.log();

const IMPORT_REGEX = /(?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|[\w*]+(?:\s*,\s*\{[^}]*\})?)\s+from\s+['"](\.[^'"]+)['"]/g;
const DYNAMIC_IMPORT_REGEX = /(?:await\s+)?import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;

const TS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function resolveImportPath(importingFile, importPath) {
  const dir = path.dirname(importingFile);
  const resolved = path.resolve(dir, importPath);

  // Try exact path
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return true;

  // Try with extensions
  for (const ext of TS_EXTENSIONS) {
    if (fs.existsSync(resolved + ext)) return true;
  }

  // Try as directory with index
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    for (const ext of TS_EXTENSIONS) {
      if (fs.existsSync(path.join(resolved, 'index' + ext))) return true;
    }
  }

  return false;
}

const broken = [];

for (const file of tsFiles) {
  const content = fs.readFileSync(file, 'utf-8');

  for (const regex of [IMPORT_REGEX, DYNAMIC_IMPORT_REGEX]) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const importPath = match[1];
      if (!resolveImportPath(file, importPath)) {
        const lineNum = content.slice(0, match.index).split('\n').length;
        broken.push({ file, line: lineNum, importPath });
      }
    }
  }
}

if (broken.length === 0) {
  log.success('No broken relative imports found.');
  process.exit(0);
}

log.warning(`Found ${broken.length} broken import(s) in ${new Set(broken.map(b => b.file)).size} file(s):`);
console.log();

for (const { file, line, importPath } of broken) {
  const relFile = path.relative(projectDir, file);
  console.log(`  ${chalk.red('✗')} ${relFile}:${line}`);
  console.log(`    import from '${importPath}' — ${chalk.dim('file not found')}`);
}

console.log();
log.info('These files were likely moved or deleted in the upstream version.');
log.info('Check git log for renames: git log --diff-filter=R --find-renames -- "*/filename*"');

process.exit(1);
