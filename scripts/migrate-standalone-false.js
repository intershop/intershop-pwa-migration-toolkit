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
const { log, findFiles, findMatchingBracket, chalk } = require('./_utils');
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
    // Still check spec files (Step 5) below
    runSpecFixStep(new Set());
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

  // Step 5: Fix inline components in spec files (TestBed declarations)
  runSpecFixStep(modifiedFiles);

  // Step 6: Detect external components in TestBed declarations not covered by NgModule scan
  const testBedExtras = detectTestBedExternalComponents(new Set(filesToFix));
  if (testBedExtras.length > 0) {
    console.log();
    log.section(`External components in TestBed declarations missing standalone: false (${testBedExtras.length}):`);
    for (const f of testBedExtras.slice(0, 10)) {
      console.log(`  ${chalk.yellow('!')} ${path.relative(projectDir, f)}`);
    }
    if (testBedExtras.length > 10) console.log(`  ... and ${testBedExtras.length - 10} more`);

    if (doFix) {
      const extraFixed = applyRegexFix(testBedExtras, findOverrideFiles(testBedExtras));
      for (const f of extraFixed) modifiedFiles.add(f);
    } else {
      log.info(`Run with ${chalk.cyan('--fix')} to auto-fix these.`);
    }
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
    if (!fs.existsSync(file)) continue;
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
    if (!fs.existsSync(file)) {
      log.warning(`Skipping deleted file: ${path.relative(projectDir, file)}`);
      continue;
    }
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

// ─── Spec File Inline Components ────────────────────────────────────────────

// Detect external components referenced in TestBed declarations that were not found via NgModule scan
function detectTestBedExternalComponents(alreadyCoveredFiles) {
  const specFiles = findFiles(srcDir, /\.spec\.ts$/);
  const extraFiles = new Set();

  for (const specFile of specFiles) {
    const content = readSafe(specFile);
    if (!content) continue;
    const dir = path.dirname(specFile);

    // Find symbols in TestBed declarations arrays
    const declMatch = content.match(/declarations\s*:\s*\[([\s\S]*?)\]/g);
    if (!declMatch) continue;

    for (const block of declMatch) {
      const symbols = block.match(/\b([A-Z][a-zA-Z0-9]+)\b/g);
      if (!symbols) continue;

      for (const sym of symbols) {
        // Find import path for this symbol
        const importMatch = content.match(new RegExp(`import\\s*\\{[^}]*\\b${sym}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`));
        if (!importMatch) continue;
        const importPath = importMatch[1];
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) continue;

        const resolved = resolveImportPath(dir, importPath);
        if (!resolved || !fs.existsSync(resolved)) continue;
        if (alreadyCoveredFiles.has(resolved)) continue;

        const fileContent = readSafe(resolved);
        if (!fileContent) continue;
        if (!/@(Component|Directive|Pipe)\s*\(/.test(fileContent)) continue;
        if (/standalone\s*:\s*(true|false)/.test(fileContent)) continue;

        extraFiles.add(resolved);
      }
    }
  }

  return [...extraFiles];
}

function runSpecFixStep(modifiedFiles) {
  const specFindings = detectSpecInlineComponents();
  if (specFindings.length > 0) {
    console.log();
    log.section(`Inline components in spec files (TestBed declarations): ${specFindings.length}`);
    for (const f of specFindings.slice(0, 10)) {
      console.log(`  ${chalk.yellow('!')} ${path.relative(projectDir, f.file)} — ${f.components.join(', ')}`);
    }
    if (specFindings.length > 10) console.log(`  ... and ${specFindings.length - 10} more`);

    if (doFix) {
      const specFixed = fixSpecInlineComponents(specFindings);
      for (const f of specFixed) modifiedFiles.add(f);
    } else {
      log.info(`Run with ${chalk.cyan('--fix')} to auto-fix these.`);
    }
  }
}

function detectSpecInlineComponents() {
  const specFiles = findFiles(srcDir, /\.spec\.ts$/);
  const results = [];

  for (const file of specFiles) {
    const content = readSafe(file);
    if (!content) continue;

    // Find inline @Component declarations without explicit standalone flag
    const componentRegex = /@Component\s*\(\s*\{([^}]*)\}\s*\)\s*\n?\s*class\s+(\w+)/g;
    let match;
    const components = [];
    while ((match = componentRegex.exec(content)) !== null) {
      const decoratorBody = match[1];
      const className = match[2];
      if (/standalone\s*:/.test(decoratorBody)) continue;

      // Check if this component is in a TestBed declarations array
      if (new RegExp(`declarations\\s*:\\s*\\[[^\\]]*\\b${className}\\b`).test(content)) {
        components.push(className);
      }
    }

    if (components.length > 0) {
      results.push({ file, components });
    }
  }

  return results;
}

function fixSpecInlineComponents(findings) {
  const modified = new Set();

  for (const { file, components } of findings) {
    let content = fs.readFileSync(file, 'utf-8');
    const before = content;

    for (const className of components) {
      // Add standalone: true to the inline @Component decorator
      const decoratorRegex = new RegExp(
        `(@Component\\s*\\(\\s*\\{)(\\s*)([^}]*)(}\\s*\\)\\s*\\n?\\s*class\\s+${className}\\b)`
      );
      content = content.replace(decoratorRegex, (m, open, ws, body, close) => {
        if (/standalone\s*:/.test(body)) return m;
        return `${open}${ws}standalone: true, ${body}${close}`;
      });

      // Move from declarations to imports within TestBed.configureTestingModule blocks only
      content = replaceInTestBedBlock(content, className);
    }

    if (content !== before) {
      fs.writeFileSync(file, content, 'utf-8');
      modified.add(file);
    }
  }

  log.success(`Fixed ${modified.size} spec file(s): inline components → standalone + imports`);
  return modified;
}

// Extract and modify only TestBed.configureTestingModule(...) blocks, handling nested brackets
function replaceInTestBedBlock(content, className) {
  const marker = 'TestBed.configureTestingModule(';
  let idx = 0;
  while ((idx = content.indexOf(marker, idx)) !== -1) {
    const blockStart = idx + marker.length;
    const blockEnd = findMatchingParen(content, blockStart - 1);
    if (blockEnd === -1) { idx++; continue; }

    let block = content.slice(blockStart, blockEnd);

    // Find top-level declarations array using bracket matching
    const declInfo = findTopLevelArray(block, 'declarations');
    if (!declInfo || !new RegExp(`\\b${className}\\b`).test(declInfo.items)) { idx++; continue; }

    // Remove from declarations
    const cleanedItems = declInfo.items
      .replace(new RegExp(`\\b${className}\\b\\s*,?\\s*`), '')
      .replace(/,\s*$/, '').replace(/^\s*,/, '');
    block = block.slice(0, declInfo.start) + cleanedItems + block.slice(declInfo.end);

    // Find top-level imports array and add the component
    const impInfo = findTopLevelArray(block, 'imports');
    if (impInfo) {
      if (!new RegExp(`\\b${className}\\b`).test(impInfo.items)) {
        const trimmed = impInfo.items.trim().replace(/,\s*$/, '');
        const newItems = trimmed ? `${impInfo.items.trimEnd()}, ${className}` : className;
        block = block.slice(0, impInfo.start) + newItems + block.slice(impInfo.end);
      }
    } else {
      // No imports array — add one after declarations
      const declInfo2 = findTopLevelArray(block, 'declarations');
      if (declInfo2) {
        const insertPos = declInfo2.bracketEnd + 1;
        block = block.slice(0, insertPos) + `,\n      imports: [${className}]` + block.slice(insertPos);
      }
    }

    content = content.slice(0, blockStart) + block + content.slice(blockEnd);
    idx = blockStart + block.length;
  }
  return content;
}

// Find a top-level property array (e.g. "declarations: [...]") within a config object, respecting nested brackets
function findTopLevelArray(block, propName) {
  const propRegex = new RegExp(`${propName}\\s*:\\s*\\[`);
  const match = propRegex.exec(block);
  if (!match) return null;

  const bracketOpen = match.index + match[0].length - 1;
  const bracketClose = findMatchingBracket(block, bracketOpen);
  if (bracketClose === -1) return null;

  return {
    start: bracketOpen + 1,
    end: bracketClose,
    bracketEnd: bracketClose,
    items: block.slice(bracketOpen + 1, bracketClose),
  };
}

function findMatchingParen(str, openIdx) {
  const open = str[openIdx];
  const close = open === '(' ? ')' : open === '[' ? ']' : '}';
  let depth = 1;
  for (let i = openIdx + 1; i < str.length; i++) {
    if (str[i] === open) depth++;
    else if (str[i] === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function readSafe(file) {
  try { return fs.readFileSync(file, 'utf-8'); } catch { return null; }
}

// ─── Run ────────────────────────────────────────────────────────────────────

main();
