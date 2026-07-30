#!/usr/bin/env node

/**
 * PWA 12.0 Migration: Add explicit `standalone: false` to NgModule-declared artifacts.
 *
 * In Angular 19, standalone: true is the default. Components/Directives/Pipes
 * that are declared in an NgModule MUST have standalone: false explicitly.
 *
 * Strategy:
 *   1. Parse all *.module.ts → extract declarations arrays
 *   2. Resolve each declared symbol to its source file
 *   3. Add standalone: false where missing
 *   4. Sync override files (*.component.brand.ts) with their base
 *
 * Usage:
 *   node scripts/migrate-standalone-false.js                        # Detect only
 *   node scripts/migrate-standalone-false.js --fix                  # Apply fixes
 *   node scripts/migrate-standalone-false.js --fix --open           # Apply + open in VS Code
 *   node scripts/migrate-standalone-false.js --project-dir /path
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { log, findFiles, chalk } = require('./_utils');
const { projectDir } = require('./_project-dir');

const args = process.argv.slice(2);
const doFix = args.includes('--fix');
const openFiles = args.includes('--open');
const useNgSchematic = args.includes('--ng-schematic');

const srcDir = path.join(projectDir, 'src');

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  log.header('Angular 19: explicit standalone: false migration');

  if (!fs.existsSync(srcDir)) {
    log.error(`Source directory not found: ${srcDir}`);
    process.exit(1);
  }

  // Step 1: Find all NgModule declarations
  const moduleFiles = findFiles(srcDir, /\.module\.ts$/);
  log.info(`Found ${moduleFiles.length} NgModule files`);

  const declaredSymbols = extractAllDeclarations(moduleFiles);
  log.info(`Found ${declaredSymbols.size} declared symbols across all modules`);

  // Step 2: Resolve symbols to source files
  const filesToFix = resolveSymbolsToFiles(declaredSymbols, moduleFiles);
  log.info(`Resolved ${filesToFix.length} files needing standalone: false`);

  // Step 3: Check which files already have standalone: false
  const { missing, alreadySet } = checkStandaloneStatus(filesToFix);

  console.log();
  log.info(`Already has standalone: false — ${alreadySet.length} file(s)`);
  log.warning(`Missing standalone: false — ${missing.length} file(s)`);

  if (missing.length === 0) {
    console.log();
    log.success('All NgModule-declared artifacts already have standalone: false.');
    return;
  }

  // Step 4: Check override files
  const overrides = findOverrideFiles(missing);
  if (overrides.length > 0) {
    log.info(`Found ${overrides.length} override file(s) to sync`);
  }

  // Print findings
  console.log();
  log.section(`Files needing standalone: false (${missing.length}):`);
  for (const f of missing.slice(0, 20)) {
    console.log(`  ${chalk.yellow('!')} ${path.relative(projectDir, f)}`);
  }
  if (missing.length > 20) {
    console.log(`  ... and ${missing.length - 20} more`);
  }

  if (!doFix) {
    console.log();
    log.info(`Run with ${chalk.cyan('--fix')} to add standalone: false to these files.`);
    log.info(`Or use ${chalk.cyan('--fix --ng-schematic')} to use Angular's built-in migration (requires Angular 19 CLI).`);
    return;
  }

  // Apply fixes
  console.log();
  let modifiedFiles;

  if (useNgSchematic) {
    modifiedFiles = applyViaAngularSchematic();
  } else {
    modifiedFiles = applyRegexFix(missing, overrides);
  }

  if (modifiedFiles.size > 0) {
    console.log();
    printModifiedFiles(modifiedFiles);
    if (openFiles) openInVSCode(modifiedFiles);

    console.log();
    log.info('Next steps:');
    console.log('  1. Review the changes');
    console.log('  2. Run: npm run build');
    console.log('  3. Re-run this script without --fix to verify');
  }
}

// ─── Declaration Extraction ─────────────────────────────────────────────────

function extractAllDeclarations(moduleFiles) {
  const declaredSymbols = new Map(); // symbolName → moduleFile

  for (const file of moduleFiles) {
    const content = readSafe(file);
    if (!content) continue;

    // Match declarations: [...] in @NgModule
    const declarationsMatch = content.match(/declarations\s*:\s*\[([\s\S]*?)\]/);
    if (!declarationsMatch) continue;

    const declarationsBlock = declarationsMatch[1];
    // Extract symbol names (identifiers, not strings)
    const symbols = declarationsBlock.match(/\b([A-Z][a-zA-Z0-9]+)\b/g);
    if (!symbols) continue;

    for (const sym of symbols) {
      declaredSymbols.set(sym, file);
    }
  }

  return declaredSymbols;
}

// ─── Symbol Resolution ──────────────────────────────────────────────────────

function resolveSymbolsToFiles(declaredSymbols, moduleFiles) {
  const resolvedFiles = new Set();

  for (const moduleFile of moduleFiles) {
    const content = readSafe(moduleFile);
    if (!content) continue;
    const dir = path.dirname(moduleFile);

    // Parse imports to map symbols to relative paths
    const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importedSymbols = match[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop().trim());
      const importPath = match[2];

      // Skip node_modules imports
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) continue;

      for (const sym of importedSymbols) {
        if (declaredSymbols.has(sym)) {
          const resolved = resolveImportPath(dir, importPath);
          if (resolved) resolvedFiles.add(resolved);
        }
      }
    }
  }

  return [...resolvedFiles];
}

function resolveImportPath(fromDir, importPath) {
  const base = path.resolve(fromDir, importPath);

  // Try exact .ts match
  if (fs.existsSync(base + '.ts')) return base + '.ts';
  // Try index.ts
  if (fs.existsSync(path.join(base, 'index.ts'))) return path.join(base, 'index.ts');
  // Try the file itself (if it ends with .ts already)
  if (fs.existsSync(base) && base.endsWith('.ts')) return base;

  return null;
}

// ─── Standalone Status Check ────────────────────────────────────────────────

function checkStandaloneStatus(files) {
  const missing = [];
  const alreadySet = [];

  for (const file of files) {
    const content = readSafe(file);
    if (!content) continue;

    // Check if file has a @Component/@Directive/@Pipe decorator
    if (!/@(Component|Directive|Pipe)\s*\(/.test(content)) continue;

    // Check if standalone is already set
    if (/standalone\s*:\s*(true|false)/.test(content)) {
      alreadySet.push(file);
    } else {
      missing.push(file);
    }
  }

  return { missing, alreadySet };
}

// ─── Override Files ─────────────────────────────────────────────────────────

const OVERRIDE_REGEX = /\.(component|directive|pipe)\.[^.]+\.ts$/;

function findOverrideFiles(baseFiles) {
  const overrides = [];

  for (const baseFile of baseFiles) {
    const dir = path.dirname(baseFile);
    const baseName = path.basename(baseFile, '.ts');
    // Match: foo.component.ts → foo.component.brand.ts, foo.component.multi.ts, etc.
    const baseMatch = baseName.match(/^(.+\.(component|directive|pipe))$/);
    if (!baseMatch) continue;

    const prefix = baseMatch[1]; // e.g. "greeting.component"
    try {
      const siblings = fs.readdirSync(dir);
      for (const sibling of siblings) {
        if (sibling === path.basename(baseFile)) continue;
        if (sibling.startsWith(prefix + '.') && sibling.endsWith('.ts') && !sibling.endsWith('.spec.ts')) {
          const overridePath = path.join(dir, sibling);
          if (OVERRIDE_REGEX.test(overridePath)) {
            overrides.push({ base: baseFile, override: overridePath });
          }
        }
      }
    } catch { /* skip */ }
  }

  return overrides;
}

// ─── Fix Application ────────────────────────────────────────────────────────

function applyRegexFix(files, overrides) {
  log.section('Adding standalone: false...');
  const modified = new Set();

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    const before = content;

    // Insert standalone: false after the decorator opening
    content = content.replace(
      /(@(?:Component|Directive|Pipe)\s*\(\s*\{)(\s*)/,
      (match, decorator, whitespace) => {
        // Detect indentation from next line
        const indent = whitespace.includes('\n') ? whitespace.replace(/\n/, '\n  standalone: false,\n') : '\n  standalone: false,' + whitespace;
        return decorator + indent;
      }
    );

    if (content !== before) {
      fs.writeFileSync(file, content, 'utf-8');
      modified.add(file);
    }
  }

  log.success(`Added standalone: false to ${modified.size} file(s)`);

  // Sync overrides
  if (overrides.length > 0) {
    for (const { base, override } of overrides) {
      let content = readSafe(override);
      if (!content) continue;
      if (/standalone\s*:/.test(content)) continue;

      const before = content;
      content = content.replace(
        /(@(?:Component|Directive|Pipe)\s*\(\s*\{)(\s*)/,
        (match, decorator, whitespace) => {
          const indent = whitespace.includes('\n') ? whitespace.replace(/\n/, '\n  standalone: false,\n') : '\n  standalone: false,' + whitespace;
          return decorator + indent;
        }
      );

      if (content !== before) {
        fs.writeFileSync(override, content, 'utf-8');
        modified.add(override);
      }
    }
    log.success(`Synced ${overrides.length} override file(s)`);
  }

  return modified;
}

function applyViaAngularSchematic() {
  log.section('Running Angular CLI migration...');
  const modified = new Set();

  try {
    const cmd = 'npx ng generate @angular/core:explicit-standalone-flag';
    log.info(`Executing: ${chalk.cyan(cmd)}`);
    const output = execSync(cmd, { cwd: projectDir, encoding: 'utf-8', stdio: 'pipe' });

    // Parse output for modified files
    const lines = output.split('\n');
    for (const line of lines) {
      const fileMatch = line.match(/UPDATE\s+(.+)/);
      if (fileMatch) {
        modified.add(path.resolve(projectDir, fileMatch[1]));
      }
    }

    log.success(`Angular schematic modified ${modified.size} file(s)`);
  } catch (e) {
    log.error(`Angular schematic failed: ${e.message}`);
    log.info('Falling back to regex-based fix...');
    // Re-detect and fix
    const moduleFiles = findFiles(srcDir, /\.module\.ts$/);
    const declaredSymbols = extractAllDeclarations(moduleFiles);
    const filesToFix = resolveSymbolsToFiles(declaredSymbols, moduleFiles);
    const { missing } = checkStandaloneStatus(filesToFix);
    const overrides = findOverrideFiles(missing);
    return applyRegexFix(missing, overrides);
  }

  return modified;
}

// ─── Output ─────────────────────────────────────────────────────────────────

function printModifiedFiles(files) {
  log.section(`Modified files (${files.size}):`);
  const sorted = [...files].sort().map(f => path.relative(projectDir, f));
  for (const f of sorted) {
    console.log(`  ${chalk.green('M')} ${f}`);
  }
}

function openInVSCode(files) {
  try {
    for (const file of [...files].sort()) {
      execSync(`code "${file}"`, { stdio: 'ignore' });
    }
    log.info(`Opened ${files.size} file(s) in VS Code.`);
  } catch {
    log.warning('Could not open files in VS Code (is "code" in PATH?).');
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function readSafe(file) {
  try { return fs.readFileSync(file, 'utf-8'); } catch { return null; }
}

// ─── Run ────────────────────────────────────────────────────────────────────

main();
