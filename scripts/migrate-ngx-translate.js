#!/usr/bin/env node

/**
 * PWA 12.0 Migration: ngx-translate 16 → 17 → 18
 *
 * Orchestrates the ngx-translate migration using the best available strategy:
 *   1. Official intershop-schematics (if available, from PWA 12.1+)
 *   2. Regex-based fixes (fallback)
 *
 * Usage:
 *   node scripts/migrate-ngx-translate.js                          # Detect only
 *   node scripts/migrate-ngx-translate.js --fix                    # Apply fixes (auto-selects strategy)
 *   node scripts/migrate-ngx-translate.js --fix --strategy=schematic  # Force official schematic
 *   node scripts/migrate-ngx-translate.js --fix --strategy=regex      # Force regex fixes
 *   node scripts/migrate-ngx-translate.js --fix --open             # Open modified files in VS Code
 *   node scripts/migrate-ngx-translate.js --project-dir /path/to   # Specify project
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { log, findFiles, grepFiles, findMatchingBracket, findPropertyArray, chalk } = require('./_utils');
const { projectDir } = require('./_project-dir');

const args = process.argv.slice(2);
const doFix = args.includes('--fix');
const openFiles = args.includes('--open');
const strategyArg = args.find(a => a.startsWith('--strategy='));
const forcedStrategy = strategyArg ? strategyArg.split('=')[1] : null;

const srcDir = path.join(projectDir, 'src');

// ─── Detection Patterns ─────────────────────────────────────────────────────

const PATTERNS = {
  currentLang: {
    regex: /\.currentLang(?!\s*\()/g,
    description: 'currentLang property → getCurrentLang() method (ngx-translate 17)',
  },
  translateModuleForRoot: {
    regex: /TranslateModule\.forRoot\s*\(/g,
    description: 'TranslateModule.forRoot() → provideTranslateService() (ngx-translate 18)',
  },
  translateModuleForChild: {
    regex: /TranslateModule\.forChild\s*\(/g,
    description: 'TranslateModule.forChild() → remove (ngx-translate 18)',
  },
  translateModuleImport: {
    regex: /\bTranslateModule\b/g,
    description: 'TranslateModule import → TranslatePipe/TranslateDirective (ngx-translate 18)',
  },
  elementTextAsKey: {
    regex: /<([a-z][a-z0-9]*)\s[^>]*\btranslate\b[^>]*>([a-z][a-z0-9_.]*)<\/\1>/gi,
    description: '<span translate>key</span> → {{ \'key\' | translate }} (ngx-translate 18)',
  },
};

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  log.header('ngx-translate Migration (v16 → v17 → v18)');

  if (!fs.existsSync(srcDir)) {
    log.error(`Source directory not found: ${srcDir}`);
    process.exit(1);
  }

  const tsFiles = findFiles(srcDir, /\.(ts|module\.ts)$/);
  const htmlFiles = findFiles(srcDir, /\.html$/);

  log.info(`Scanning ${tsFiles.length} TypeScript and ${htmlFiles.length} HTML files...`);
  console.log();

  const findings = detect(tsFiles, htmlFiles);
  printReport(findings);

  if (findings.total === 0) return;

  if (!doFix) {
    console.log();
    log.info(`Run with ${chalk.cyan('--fix')} to apply automated fixes.`);
    return;
  }

  // ─── Strategy Selection ─────────────────────────────────────────────────
  console.log();
  const strategy = selectStrategy();
  let modifiedFiles;

  if (strategy === 'schematic') {
    modifiedFiles = applySchematic();
  } else {
    modifiedFiles = applyRegexFixes(findings);
  }

  // ─── Post-migration verification ───────────────────────────────────────
  if (modifiedFiles.size > 0) {
    console.log();
    printModifiedFiles(modifiedFiles);

    if (openFiles) {
      openInVSCode(modifiedFiles);
    }

    console.log();
    log.info('Next steps:');
    console.log('  1. Review the changes');
    console.log('  2. Run the build: npm run build');
    console.log('  3. Re-run this script without --fix to verify no issues remain');
  }
}

// ─── Strategy ───────────────────────────────────────────────────────────────

function selectStrategy() {
  if (forcedStrategy) {
    log.info(`Strategy: ${forcedStrategy} (forced via --strategy)`);
    return forcedStrategy;
  }

  if (hasSchematic()) {
    log.info('Strategy: official intershop-schematics (detected in project)');
    return 'schematic';
  }

  log.info('Strategy: regex-based fixes (intershop-schematics not available yet)');
  log.info(`${chalk.dim('Tip: After upgrading to PWA 12.1+, re-run with --strategy=schematic for AST-based transforms')}`);
  return 'regex';
}

function hasSchematic() {
  try {
    const pkgPath = path.join(projectDir, 'node_modules', 'intershop-schematics', 'package.json');
    if (!fs.existsSync(pkgPath)) return false;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    // Schematics with migration support ship from 12.1.0
    const migrationsJson = path.join(projectDir, 'node_modules', 'intershop-schematics', 'src', 'migrations', 'migrations.json');
    return fs.existsSync(migrationsJson);
  } catch {
    return false;
  }
}

function applySchematic() {
  log.section('Running official intershop-schematics migration...');
  const modifiedFiles = new Set();

  try {
    // Capture file state before
    const before = getFileHashes(srcDir);

    const cmd = 'npx ng update intershop-schematics --migrate-only --from=11.2.0 --to=12.1.0';
    log.info(`Executing: ${chalk.cyan(cmd)}`);
    execSync(cmd, { cwd: projectDir, stdio: 'inherit' });

    // Detect what changed
    const after = getFileHashes(srcDir);
    for (const [file, hash] of after) {
      if (before.get(file) !== hash) modifiedFiles.add(file);
    }

    log.success(`Schematic completed. ${modifiedFiles.size} file(s) modified.`);
  } catch (e) {
    log.error(`Schematic failed: ${e.message}`);
    log.info('Falling back to regex-based fixes...');
    return applyRegexFixes({ ...detect(findFiles(srcDir, /\.ts$/), findFiles(srcDir, /\.html$/)) });
  }

  return modifiedFiles;
}

function getFileHashes(dir) {
  const hashes = new Map();
  const files = findFiles(dir, /\.(ts|html)$/);
  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      hashes.set(file, `${stat.size}:${stat.mtimeMs}`);
    } catch { /* skip */ }
  }
  return hashes;
}

// ─── File output + VS Code integration ──────────────────────────────────────

function printModifiedFiles(files) {
  log.section(`Modified files (${files.size}):`);
  const sorted = [...files].sort().map(f => path.relative(projectDir, f));
  for (const f of sorted) {
    console.log(`  ${chalk.green('M')} ${f}`);
  }
}

function openInVSCode(files) {
  const sorted = [...files].sort();
  try {
    for (const file of sorted) {
      execSync(`code "${file}"`, { stdio: 'ignore' });
    }
    log.info(`Opened ${sorted.length} file(s) in VS Code.`);
  } catch {
    log.warning('Could not open files in VS Code (is "code" in PATH?).');
  }
}

// ─── Detection ──────────────────────────────────────────────────────────────

function detect(tsFiles, htmlFiles) {
  const findings = { currentLang: [], translateModuleForRoot: [], translateModuleForChild: [], translateModuleImport: [], elementTextAsKey: [], total: 0 };

  for (const file of tsFiles) {
    const content = readSafe(file);
    if (!content) continue;

    findMatches(content, file, PATTERNS.currentLang, findings.currentLang);
    findMatches(content, file, PATTERNS.translateModuleForRoot, findings.translateModuleForRoot);
    findMatches(content, file, PATTERNS.translateModuleForChild, findings.translateModuleForChild);

    // Only flag TranslateModule in NgModule imports arrays (not the forRoot/forChild calls)
    if (/TranslateModule(?!\s*\.)/.test(content) && !/TranslateModule\.for/.test(content)) {
      findMatches(content, file, PATTERNS.translateModuleImport, findings.translateModuleImport);
    } else if (/TranslateModule(?!\s*\.)/.test(content)) {
      // File has both forRoot/forChild AND bare TranslateModule references
      const barePattern = /\bTranslateModule\b(?!\s*\.)/g;
      findMatches(content, file, { regex: barePattern, description: PATTERNS.translateModuleImport.description }, findings.translateModuleImport);
    }
  }

  for (const file of htmlFiles) {
    const content = readSafe(file);
    if (!content) continue;
    findMatches(content, file, PATTERNS.elementTextAsKey, findings.elementTextAsKey);
  }

  findings.total = findings.currentLang.length + findings.translateModuleForRoot.length +
    findings.translateModuleForChild.length + findings.translateModuleImport.length +
    findings.elementTextAsKey.length;

  return findings;
}

function findMatches(content, file, pattern, results) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(lines[i])) {
      results.push({ file, line: i + 1, content: lines[i].trim() });
    }
  }
}

// ─── Report ─────────────────────────────────────────────────────────────────

function printReport(findings) {
  const sections = [
    { key: 'currentLang', label: 'currentLang → getCurrentLang()', severity: 'high' },
    { key: 'translateModuleForRoot', label: 'TranslateModule.forRoot() → provideTranslateService()', severity: 'critical' },
    { key: 'translateModuleForChild', label: 'TranslateModule.forChild() → remove', severity: 'critical' },
    { key: 'translateModuleImport', label: 'TranslateModule → TranslatePipe/TranslateDirective', severity: 'high' },
    { key: 'elementTextAsKey', label: '<el translate>key → {{ key | translate }}', severity: 'high' },
  ];

  for (const { key, label, severity } of sections) {
    const items = findings[key];
    if (items.length === 0) continue;

    const color = severity === 'critical' ? chalk.red : chalk.yellow;
    console.log(color(`  ${label} (${items.length} occurrences)`));
    for (const item of items.slice(0, 5)) {
      const rel = path.relative(projectDir, item.file);
      console.log(chalk.dim(`    ${rel}:${item.line}  ${item.content.substring(0, 80)}`));
    }
    if (items.length > 5) {
      console.log(chalk.dim(`    ... and ${items.length - 5} more`));
    }
    console.log();
  }

  if (findings.total === 0) {
    log.success('No ngx-translate migration issues found.');
  } else {
    log.warning(`Found ${findings.total} issues requiring migration.`);
  }
}

// ─── Regex Fixes (fallback when schematics unavailable) ─────────────────────

function applyRegexFixes(findings) {
  log.section('Applying regex-based fixes...');
  let fixedFiles = new Set();

  // Fix 1: .currentLang → .getCurrentLang()
  if (findings.currentLang.length > 0) {
    const files = [...new Set(findings.currentLang.map(f => f.file))];
    for (const file of files) {
      let content = fs.readFileSync(file, 'utf-8');
      const before = content;
      content = content.replace(/\.currentLang(?!\s*\()/g, '.getCurrentLang()');
      if (content !== before) {
        fs.writeFileSync(file, content, 'utf-8');
        fixedFiles.add(file);
      }
    }
    log.success(`Fixed ${files.length} file(s): currentLang → getCurrentLang()`);
  }

  // Fix 2: TranslateModule.forRoot(...) → provideTranslateService(...)
  if (findings.translateModuleForRoot.length > 0) {
    const files = [...new Set(findings.translateModuleForRoot.map(f => f.file))];
    for (const file of files) {
      let content = fs.readFileSync(file, 'utf-8');
      const before = content;

      // Replace TranslateModule.forRoot({...}) with provideTranslateService({...}) in providers
      content = content.replace(
        /TranslateModule\.forRoot\s*\(([^)]*)\)/g,
        'provideTranslateService($1)'
      );

      // Move from imports to providers if in NgModule
      content = moveForRootToProviders(content);

      // Add TranslatePipe to imports (TranslateModule previously provided both service and pipe)
      content = addToImportsArray(content, 'TranslatePipe');

      // Update import statement
      content = ensureImport(content, 'provideTranslateService', '@ngx-translate/core');
      content = ensureImport(content, 'TranslatePipe', '@ngx-translate/core');

      // Clean up unused TranslateModule from TS import if no longer referenced in module arrays
      content = removeUnusedTsImport(content, 'TranslateModule', '@ngx-translate/core');

      if (content !== before) {
        fs.writeFileSync(file, content, 'utf-8');
        fixedFiles.add(file);
      }
    }
    log.success(`Fixed ${files.length} file(s): TranslateModule.forRoot() → provideTranslateService()`);
  }

  // Fix 3: TranslateModule.forChild() → remove
  if (findings.translateModuleForChild.length > 0) {
    const files = [...new Set(findings.translateModuleForChild.map(f => f.file))];
    for (const file of files) {
      let content = fs.readFileSync(file, 'utf-8');
      const before = content;
      content = content.replace(/,?\s*TranslateModule\.forChild\s*\([^)]*\)/g, '');
      content = content.replace(/TranslateModule\.forChild\s*\([^)]*\),?\s*/g, '');
      if (content !== before) {
        fs.writeFileSync(file, content, 'utf-8');
        fixedFiles.add(file);
      }
    }
    log.success(`Fixed ${files.length} file(s): removed TranslateModule.forChild()`);
  }

  // Fix 4: bare TranslateModule → TranslatePipe in module/TestBed arrays
  if (findings.translateModuleImport.length > 0) {
    const files = [...new Set(findings.translateModuleImport.map(f => f.file))];
    for (const file of files) {
      let content = fs.readFileSync(file, 'utf-8');
      const before = content;
      // Replace bare TranslateModule with TranslatePipe in config arrays, using bracket-matching
      content = replaceInPropertyArrays(content, ['imports', 'declarations', 'exports'],
        /\bTranslateModule\b(?!\s*\.)/g, 'TranslatePipe');
      // Update the import statement from @ngx-translate/core
      content = ensureImport(content, 'TranslatePipe', '@ngx-translate/core');
      content = removeUnusedTsImport(content, 'TranslateModule', '@ngx-translate/core');
      if (content !== before) {
        fs.writeFileSync(file, content, 'utf-8');
        fixedFiles.add(file);
      }
    }
    log.success(`Fixed ${files.length} file(s): TranslateModule → TranslatePipe`);
  }

  // Fix 5: <el translate>key</el> → {{ 'key' | translate }}
  if (findings.elementTextAsKey.length > 0) {
    const files = [...new Set(findings.elementTextAsKey.map(f => f.file))];
    for (const file of files) {
      let content = fs.readFileSync(file, 'utf-8');
      const before = content;
      content = content.replace(
        /<([a-z][a-z0-9]*)\s([^>]*)\btranslate\b([^>]*)>([a-z][a-z0-9_.]*)<\/\1>/gi,
        (match, tag, attrsBefore, attrsAfter, key) => {
          // Remove the translate attribute, keep other attrs
          const attrs = (attrsBefore + attrsAfter).replace(/\s*translate\s*/g, ' ').trim();
          const attrStr = attrs ? ` ${attrs}` : '';
          return `<${tag}${attrStr}>{{ '${key}' | translate }}</${tag}>`;
        }
      );
      if (content !== before) {
        fs.writeFileSync(file, content, 'utf-8');
        fixedFiles.add(file);
      }
    }
    log.success(`Fixed ${files.length} file(s): element-text-as-key → translate pipe`);
  }

  console.log();
  log.success(`Total: ${fixedFiles.size} file(s) modified.`);
  if (fixedFiles.size > 0) {
    log.warning('Manual review needed: getCurrentLang() can return undefined in v18 — add ?? fallback where needed.');
    validateFixedFiles(fixedFiles);
  }

  return fixedFiles;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function validateFixedFiles(fixedFiles) {
  const BAD_PATTERNS = [
    { regex: /RouterModule\.forRoot\s*\([^)]*TranslatePipe/, msg: 'TranslatePipe inside RouterModule.forRoot()' },
    { regex: /RouterModule\.forRoot\s*\([^)]*provideTranslateService/, msg: 'provideTranslateService inside RouterModule.forRoot()' },
    { regex: /provideRouter\s*\([^)]*TranslatePipe/, msg: 'TranslatePipe inside provideRouter()' },
    { regex: /provideRouter\s*\([^)]*provideTranslateService/, msg: 'provideTranslateService inside provideRouter()' },
  ];

  let warnings = 0;
  for (const file of fixedFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    for (const { regex, msg } of BAD_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          log.warning(`${path.relative(projectDir, file)}:${i + 1} — ${msg} (needs manual fix)`);
          warnings++;
        }
      }
    }
  }
  if (warnings > 0) {
    log.warning(`${warnings} suspicious placement(s) found — please review above.`);
  }
}

function readSafe(file) {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return null;
  }
}

function moveForRootToProviders(content) {
  const arr = findPropertyArray(content, 'imports');
  if (!arr) return content;

  const items = arr.items;
  // Match provideTranslateService(...) including nested parens
  const provideIdx = items.indexOf('provideTranslateService(');
  if (provideIdx === -1) return content;

  // Find the full call expression using paren matching
  const absIdx = arr.start + 1 + provideIdx;
  const parenOpen = content.indexOf('(', absIdx);
  const parenClose = findMatchingBracket(content, parenOpen, '(', ')');
  if (parenClose === -1) return content;

  const provider = content.slice(absIdx, parenClose + 1);

  // Remove provider from imports array (including surrounding comma/whitespace)
  const beforeProvider = content.slice(0, absIdx);
  const afterProvider = content.slice(parenClose + 1);
  let joined = beforeProvider + afterProvider;
  // Clean dangling commas inside the imports array
  const newArr = findPropertyArray(joined, 'imports');
  if (newArr) {
    const cleanedItems = newArr.items.replace(/,\s*,/g, ',').replace(/^\s*,\s*/, '').replace(/,\s*$/, '');
    joined = joined.slice(0, newArr.start + 1) + cleanedItems + joined.slice(newArr.end);
  }

  // Insert into existing providers array, or create one
  const provArr = findPropertyArray(joined, 'providers');
  if (provArr) {
    const trimmed = provArr.items.trim().replace(/,\s*$/, '');
    const newItems = trimmed ? `${provArr.items.trimEnd()}, ${provider}` : provider;
    joined = joined.slice(0, provArr.start + 1) + newItems + joined.slice(provArr.end);
  } else {
    // Create providers array after imports
    const importsArr = findPropertyArray(joined, 'imports');
    if (importsArr) {
      const insertAt = importsArr.end + 1;
      joined = joined.slice(0, insertAt) + `,\n    providers: [${provider}]` + joined.slice(insertAt);
    }
  }

  return joined;
}

function addToImportsArray(content, symbol) {
  const regex = /imports\s*:\s*\[/g;
  let match;
  let result = content;
  let offset = 0;

  while ((match = regex.exec(content)) !== null) {
    const arrayOpen = match.index + match[0].length - 1;
    const arrayClose = findMatchingBracket(content, arrayOpen);
    if (arrayClose === -1) continue;

    const items = content.slice(arrayOpen + 1, arrayClose);
    if (new RegExp(`\\b${symbol}\\b`).test(items)) continue;

    const trimmed = items.trim().replace(/,\s*$/, '');
    const newItems = trimmed ? `${items.trimEnd()}, ${symbol}` : symbol;
    const replacement = content.slice(match.index, arrayOpen + 1) + newItems + ']';
    const original = content.slice(match.index, arrayClose + 1);

    result = result.slice(0, match.index + offset) + replacement + result.slice(match.index + offset + original.length);
    offset += replacement.length - original.length;
  }

  return result;
}

function replaceInPropertyArrays(content, propNames, pattern, replacement) {
  for (const prop of propNames) {
    const regex = new RegExp(`${prop}\\s*:\\s*\\[`, 'g');
    let match;
    let result = content;
    let offset = 0;

    while ((match = regex.exec(content)) !== null) {
      const arrayOpen = match.index + match[0].length - 1;
      const arrayClose = findMatchingBracket(content, arrayOpen);
      if (arrayClose === -1) continue;

      const items = content.slice(arrayOpen + 1, arrayClose);
      const newItems = items.replace(pattern, replacement);
      if (newItems === items) continue;

      const original = content.slice(match.index, arrayClose + 1);
      const replaced = content.slice(match.index, arrayOpen + 1) + newItems + ']';
      result = result.slice(0, match.index + offset) + replaced + result.slice(match.index + offset + original.length);
      offset += replaced.length - original.length;
    }
    content = result;
  }
  return content;
}

function removeUnusedTsImport(content, symbol, from) {
  // Remove a symbol from a TS import statement if it's no longer used in the rest of the file
  const importLineRegex = new RegExp(`(import\\s*\\{)([^}]*)(}\\s*from\\s*['"]${from.replace(/\//g, '\\/')}['"])`);
  const importMatch = content.match(importLineRegex);
  if (!importMatch) return content;

  const importedSymbols = importMatch[2];
  if (!new RegExp(`\\b${symbol}\\b`).test(importedSymbols)) return content;

  // Check if symbol is used anywhere outside the import statement
  const withoutImport = content.replace(importMatch[0], '');
  if (new RegExp(`\\b${symbol}\\b`).test(withoutImport)) return content;

  // Remove the symbol from the import
  const cleaned = importedSymbols
    .replace(new RegExp(`\\b${symbol}\\b\\s*,?\\s*`), '')
    .replace(/,\s*$/, '').replace(/^\s*,\s*/, '');

  if (!cleaned.trim()) {
    // No symbols left — remove entire import line
    return content.replace(new RegExp(`import\\s*\\{[^}]*\\}\\s*from\\s*['"]${from.replace(/\//g, '\\/')}['"]\\s*;?\\s*\\n?`), '');
  }

  return content.replace(importLineRegex, `$1 ${cleaned.trim()} $3`);
}

function ensureImport(content, symbol, from) {
  const importRegex = new RegExp(`from\\s+['"]${from.replace(/\//g, '\\/')}['"]`);
  if (!importRegex.test(content)) return content;

  const symbolRegex = new RegExp(`\\b${symbol}\\b`);
  const importLineRegex = new RegExp(`(import\\s*\\{)([^}]*)(}\\s*from\\s*['"]${from.replace(/\//g, '\\/')}['"])`);

  if (symbolRegex.test(content.match(importLineRegex)?.[2] || '')) {
    return content; // already imported
  }

  return content.replace(importLineRegex, (match, start, symbols, end) => {
    const trimmed = symbols.trim().replace(/,\s*$/, '');
    return `${start} ${trimmed}, ${symbol} ${end}`;
  });
}

// ─── Run ────────────────────────────────────────────────────────────────────

main();
