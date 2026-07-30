#!/usr/bin/env node

/**
 * PWA 12.0 Migration: ngx-translate 16 → 17 → 18
 *
 * Detects and migrates ngx-translate breaking changes:
 *   - v17: currentLang → getCurrentLang()
 *   - v18: TranslateModule removed → provideTranslateService()
 *   - v18: TranslatePipe/TranslateDirective now standalone (must be imported directly)
 *   - v18: Element-text-as-key <span translate>key</span> deprecated
 *
 * Usage:
 *   node scripts/migrate-ngx-translate.js                          # Detect only
 *   node scripts/migrate-ngx-translate.js --fix                    # Apply fixes
 *   node scripts/migrate-ngx-translate.js --phase detect           # Detection phase only
 *   node scripts/migrate-ngx-translate.js --phase fix              # Fix phase only
 *   node scripts/migrate-ngx-translate.js --project-dir /path/to   # Specify project
 */

const fs = require('fs');
const path = require('path');
const { log, findFiles, grepFiles, chalk } = require('./_utils');
const { projectDir } = require('./_project-dir');

const args = process.argv.slice(2);
const doFix = args.includes('--fix') || args.includes('--phase') && args[args.indexOf('--phase') + 1] === 'fix';
const detectOnly = args.includes('--phase') && args[args.indexOf('--phase') + 1] === 'detect';

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
  const allFiles = [...tsFiles, ...htmlFiles];

  log.info(`Scanning ${tsFiles.length} TypeScript and ${htmlFiles.length} HTML files...`);
  console.log();

  const findings = detect(tsFiles, htmlFiles);
  printReport(findings);

  if (doFix && !detectOnly) {
    console.log();
    applyFixes(findings);
  } else if (!detectOnly && findings.total > 0) {
    console.log();
    log.info(`Run with ${chalk.cyan('--fix')} to apply automated fixes.`);
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

// ─── Fixes ──────────────────────────────────────────────────────────────────

function applyFixes(findings) {
  log.section('Applying automated fixes...');
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

      // Update import statement
      content = ensureImport(content, 'provideTranslateService', '@ngx-translate/core');

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

  // Fix 4: bare TranslateModule → TranslatePipe in imports
  if (findings.translateModuleImport.length > 0) {
    const files = [...new Set(findings.translateModuleImport.map(f => f.file))];
    for (const file of files) {
      let content = fs.readFileSync(file, 'utf-8');
      const before = content;
      // Replace bare TranslateModule with TranslatePipe in imports arrays
      content = content.replace(/\bTranslateModule\b(?!\s*\.)/g, 'TranslatePipe');
      // Update the import statement from @ngx-translate/core
      content = ensureImport(content, 'TranslatePipe', '@ngx-translate/core');
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
    log.info('Review changes and run the build to verify.');
    log.warning('Manual review needed: getCurrentLang() can return undefined in v18 — add ?? fallback where needed.');
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function readSafe(file) {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return null;
  }
}

function moveForRootToProviders(content) {
  // If provideTranslateService is inside an imports array, move it to providers
  const importsRegex = /(imports\s*:\s*\[)([^\]]*)(provideTranslateService\([^)]*\))([^\]]*)\]/g;
  return content.replace(importsRegex, (match, start, before, provider, after) => {
    const cleanedImports = (before + after).replace(/,\s*,/g, ',').replace(/,\s*$/, '').replace(/^\s*,/, '');
    const hasProviders = content.includes('providers:');
    if (hasProviders) {
      // Will need manual placement - leave a comment
      return `${start}${cleanedImports}] /* TODO: move ${provider} to providers array */`;
    }
    return `${start}${cleanedImports}],\n    providers: [${provider}]`;
  });
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
