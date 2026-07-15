#!/usr/bin/env node

/**
 * Template Syntax Checker
 *
 * Detects empty paired tags that should be self-closing.
 * Also checks themed template variants (.b2c.html, .b2b.html, etc.)
 *
 * Usage:
 *   node scripts/check-template-syntax.js [--fix] [--project-dir <path>]
 */

const fs = require('fs');
const path = require('path');
const { projectDir } = require('./_project-dir');
const { log, findFiles, chalk } = require('./_utils');

const fixMode = process.argv.includes('--fix');

process.chdir(projectDir);

console.log('🔍 Checking template syntax for empty paired tags...');
console.log();

// Find all HTML files (including themed variants)
const htmlFiles = findFiles(path.join(projectDir, 'src'), /\.html$/);
const themedFiles = htmlFiles.filter(f => /\.component\.[a-z0-9-]+\.html$/.test(f));

if (themedFiles.length > 0) {
  console.log(`📌 Found ${themedFiles.length} themed template(s) (.b2c.html, .b2b.html, etc.)`);
  console.log();
}

let totalIssues = 0;
let filesWithIssues = 0;

const emptyPairedTagRegex = /<(ish-[a-z-]+)([^>]*)><\/\1>/g;

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const matches = [];

  lines.forEach((line, idx) => {
    let match;
    const lineRegex = new RegExp(emptyPairedTagRegex.source, 'g');
    while ((match = lineRegex.exec(line)) !== null) {
      matches.push({ line: idx + 1, text: line.trim() });
    }
  });

  if (matches.length > 0) {
    totalIssues += matches.length;
    filesWithIssues++;

    const relPath = path.relative(projectDir, file);
    console.log(`📄 ${relPath} (${matches.length} issues)`);
    matches.slice(0, 3).forEach(m => console.log(`  ${m.line}: ${m.text}`));
    if (matches.length > 3) {
      console.log(`   ... and ${matches.length - 3} more`);
    }
    console.log();
  }
}

console.log('────────────────────────────────────────────────');
console.log('📊 Summary:');
console.log(`   Files with issues: ${filesWithIssues}`);
console.log(`   Total empty paired tags: ${totalIssues}`);
console.log();

if (totalIssues === 0) {
  console.log('✅ All templates use modern syntax!');
  process.exit(0);
}

if (!fixMode) {
  console.log('💡 To automatically fix these issues, run:');
  console.log('   node scripts/check-template-syntax.js --fix');
  process.exit(1);
} else {
  console.log('🔧 Fixing issues...');
  require('./fix-template-syntax');
}
