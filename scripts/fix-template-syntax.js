#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

/**
 * Converts empty paired tags to self-closing tags in Angular templates.
 * Example: <ish-loading></ish-loading> -> <ish-loading />
 */

function fixTemplate(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let changeCount = 0;

  // Pattern 1: Component tags without attributes: <ish-tag></ish-tag>
  const pattern1 = /<(ish-[a-z-]+)><\/\1>/g;
  const matches1 = content.match(pattern1);
  if (matches1) {
    changeCount += matches1.length;
    content = content.replace(pattern1, '<$1 />');
    modified = true;
  }

  // Pattern 2: Component tags with attributes on same line: <ish-tag attr="value"></ish-tag>
  const pattern2 = /<(ish-[a-z-]+)\s+([^>]+)><\/\1>/g;
  const matches2 = content.match(pattern2);
  if (matches2) {
    changeCount += matches2.length;
    content = content.replace(pattern2, '<$1 $2 />');
    modified = true;
  }

  // Pattern 3: Multi-line component tags
  // <ish-tag
  //   [attr]="value"
  // ></ish-tag>
  const pattern3 = /<(ish-[a-z-]+)([\s\S]*?)><\/\1>/g;
  let match;
  const replacements = [];
  
  // Find all matches and store them
  while ((match = pattern3.exec(content)) !== null) {
    const fullMatch = match[0];
    const tagName = match[1];
    const attributes = match[2];
    
    // Only process if there's no content between tags (just whitespace/newlines in attributes)
    if (attributes.trim() || attributes.includes('\n')) {
      replacements.push({
        original: fullMatch,
        replacement: `<${tagName}${attributes} />`,
      });
      changeCount++;
      modified = true;
    }
  }

  // Apply replacements (from end to start to maintain positions)
  replacements.reverse().forEach(({ original, replacement }) => {
    content = content.replace(original, replacement);
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✓ ${filePath} (${changeCount} fixes)`);
    return changeCount;
  }

  return 0;
}

function processDirectory(dir) {
  const pattern = path.join(dir, '**/*.html');
  const files = globSync(pattern, { ignore: ['**/node_modules/**', '**/dist/**'] });

  let totalFixed = 0;
  let filesFixed = 0;

  files.forEach(file => {
    const fixed = fixTemplate(file);
    if (fixed > 0) {
      totalFixed += fixed;
      filesFixed++;
    }
  });

  return { totalFixed, filesFixed };
}

console.log('🔧 Fixing template syntax...\n');

const { totalFixed, filesFixed } = processDirectory('src');

if (totalFixed === 0) {
  console.log('✅ No issues found - all templates already use modern syntax!');
} else {
  console.log(`\n✅ Fixed ${totalFixed} empty paired tags in ${filesFixed} files`);
  console.log('\n⚠️  Please review changes and test your application:');
  console.log('   npm run lint');
  console.log('   npm run build');
  console.log('   git diff');
}
