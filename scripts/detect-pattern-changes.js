#!/usr/bin/env node

/**
 * Pattern Change Detection Script (Tier 2 & 3)
 * 
 * Fetches CHANGELOG from Intershop PWA, parses breaking changes,
 * and scans your codebase for affected patterns.
 * 
 * Usage:
 *   ./scripts/detect-pattern-changes.js [source-version] [target-version]
 *   ./scripts/detect-pattern-changes.js --comprehensive [source-version] [target-version]
 * 
 * Examples:
 *   ./scripts/detect-pattern-changes.js 4.0.0 9.1.0
 *   ./scripts/detect-pattern-changes.js --comprehensive 4.0.0 9.1.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const INTERSHOP_REPO = 'https://raw.githubusercontent.com/intershop/intershop-pwa';
const PATTERN_DB_PATH = path.join(__dirname, '..', 'data', 'pattern-migrations.json');
const OUTPUT_REPORT = 'pattern-detection-report.json';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Fetch CHANGELOG.md from Intershop PWA repository
 */
async function fetchChangelog(targetVersion) {
  console.log(`${colors.cyan}📥 Fetching CHANGELOG.md from Intershop PWA...${colors.reset}`);
  
  try {
    // Try to fetch from develop branch first, then try specific version tag
    const branches = ['develop', targetVersion, `v${targetVersion}`, `${targetVersion}.0`];
    
    for (const branch of branches) {
      try {
        const url = `${INTERSHOP_REPO}/${branch}/CHANGELOG.md`;
        const response = await fetch(url);
        
        if (response.ok) {
          const content = await response.text();
          console.log(`${colors.green}✓ Fetched CHANGELOG from ${branch}${colors.reset}`);
          return content;
        }
      } catch (e) {
        // Try next branch
      }
    }
    
    throw new Error('Could not fetch CHANGELOG from any branch');
  } catch (error) {
    console.error(`${colors.red}❌ Failed to fetch CHANGELOG: ${error.message}${colors.reset}`);
    console.log(`${colors.yellow}💡 Falling back to local pattern database${colors.reset}`);
    return null;
  }
}

/**
 * Parse CHANGELOG to extract breaking changes between versions
 */
function parseBreakingChanges(changelog, sourceVersion, targetVersion) {
  console.log(`${colors.cyan}🔍 Parsing breaking changes between ${sourceVersion} and ${targetVersion}...${colors.reset}`);
  
  const breakingChanges = [];
  const lines = changelog.split('\n');
  
  let currentVersion = null;
  let inBreakingSection = false;
  let breakingContent = [];
  
  for (const line of lines) {
    // Detect version headers (e.g., ## [9.1.0], # 9.0.0, ### Version 8.0)
    const versionMatch = line.match(/^#{1,3}\s+\[?v?(\d+\.\d+\.?\d*)/i);
    if (versionMatch) {
      // Save previous breaking section
      if (inBreakingSection && breakingContent.length > 0) {
        breakingChanges.push({
          version: currentVersion,
          changes: breakingContent.join('\n')
        });
        breakingContent = [];
        inBreakingSection = false;
      }
      
      currentVersion = versionMatch[1];
      continue;
    }
    
    // Detect breaking changes section
    if (/^#{2,4}\s+(breaking|BREAKING)/i.test(line)) {
      inBreakingSection = true;
      continue;
    }
    
    // Detect end of breaking section (next heading)
    if (inBreakingSection && /^#{2,4}\s+/.test(line) && !/breaking/i.test(line)) {
      if (breakingContent.length > 0) {
        breakingChanges.push({
          version: currentVersion,
          changes: breakingContent.join('\n')
        });
        breakingContent = [];
      }
      inBreakingSection = false;
      continue;
    }
    
    // Collect breaking change content
    if (inBreakingSection && line.trim()) {
      breakingContent.push(line.trim());
    }
  }
  
  // Add final breaking section if exists
  if (inBreakingSection && breakingContent.length > 0) {
    breakingChanges.push({
      version: currentVersion,
      changes: breakingContent.join('\n')
    });
  }
  
  // Filter to versions between source and target
  const relevantChanges = breakingChanges.filter(bc => {
    const v = parseFloat(bc.version);
    const source = parseFloat(sourceVersion);
    const target = parseFloat(targetVersion);
    return v > source && v <= target;
  });
  
  console.log(`${colors.green}✓ Found ${relevantChanges.length} version(s) with breaking changes${colors.reset}`);
  return relevantChanges;
}

/**
 * Load pattern migration database (Tier 3)
 */
function loadPatternDatabase() {
  if (!fs.existsSync(PATTERN_DB_PATH)) {
    console.log(`${colors.yellow}⚠  Pattern database not found at ${PATTERN_DB_PATH}${colors.reset}`);
    return null;
  }
  
  try {
    const content = fs.readFileSync(PATTERN_DB_PATH, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`${colors.red}❌ Error loading pattern database: ${error.message}${colors.reset}`);
    return null;
  }
}

/**
 * Extract pattern rules from breaking changes text
 */
function extractPatternRules(breakingChanges) {
  const patterns = [];
  
  for (const bc of breakingChanges) {
    const lines = bc.changes.split('\n');
    
    for (const line of lines) {
      // Common patterns in breaking changes
      
      // Pattern: darken() -> color.adjust()
      if (/darken\s*\(/.test(line)) {
        patterns.push({
          version: bc.version,
          type: 'scss',
          oldPattern: /darken\s*\(/g,
          newPattern: 'color.adjust($color, $lightness: -',
          description: 'SCSS: darken() → color.adjust() with negative lightness',
          searchRegex: 'darken\\s*\\(',
          files: '**/*.scss'
        });
      }
      
      // Pattern: lighten() -> color.adjust()
      if (/lighten\s*\(/.test(line)) {
        patterns.push({
          version: bc.version,
          type: 'scss',
          oldPattern: /lighten\s*\(/g,
          newPattern: 'color.adjust($color, $lightness: ',
          description: 'SCSS: lighten() → color.adjust() with positive lightness',
          searchRegex: 'lighten\\s*\\(',
          files: '**/*.scss'
        });
      }
      
      // Pattern: map-get() -> map.get()
      if (/map-get\s*\(/.test(line)) {
        patterns.push({
          version: bc.version,
          type: 'scss',
          oldPattern: /map-get\s*\(/g,
          newPattern: 'map.get(',
          description: 'SCSS: map-get() → map.get() (requires @use "sass:map")',
          searchRegex: 'map-get\\s*\\(',
          files: '**/*.scss',
          requiresImport: '@use "sass:map";'
        });
      }
      
      // Pattern: standalone components
      if (/standalone/i.test(line) && /component/i.test(line)) {
        patterns.push({
          version: bc.version,
          type: 'typescript',
          description: 'Angular: Module-based → Standalone Components',
          searchRegex: '@NgModule\\s*\\(',
          files: '**/*.module.ts',
          manual: true
        });
      }
    }
  }
  
  return patterns;
}

/**
 * Scan codebase for pattern matches
 */
function scanCodebase(patterns, comprehensive = false, cwd = process.cwd()) {
  console.log(`${colors.cyan}🔎 Scanning codebase for pattern matches...${colors.reset}`);
  
  const results = [];
  const scannedDirs = ['src/app', 'src/styles'];
  
  for (const pattern of patterns) {
    try {
      // Build grep command
      const grepCmd = `grep -r -n -E "${pattern.searchRegex}" ${scannedDirs.join(' ')} 2>/dev/null || true`;
      const output = execSync(grepCmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, cwd });
      
      if (output.trim()) {
        const matches = output.trim().split('\n').map(line => {
          const [filePath, lineNum, ...contentParts] = line.split(':');
          return {
            file: filePath.trim(),
            line: parseInt(lineNum),
            content: contentParts.join(':').trim()
          };
        });
        
        results.push({
          pattern,
          matchCount: matches.length,
          matches: comprehensive ? matches : matches.slice(0, 10) // Limit in non-comprehensive mode
        });
        
        console.log(`${colors.yellow}⚠  Found ${matches.length} occurrence(s) of: ${pattern.description}${colors.reset}`);
      }
    } catch (error) {
      // Grep errors are expected when no matches found
    }
  }
  
  return results;
}

/**
 * Apply pattern database rules (Tier 3)
 */
function applyPatternDatabase(patternDb, sourceVersion, targetVersion, comprehensive, cwd) {
  console.log(`${colors.cyan}📚 Applying pattern migration database...${colors.reset}`);
  
  const relevantPatterns = [];
  
  for (const migration of patternDb.migrations) {
    const fromVer = parseFloat(migration.fromVersion);
    const toVer = parseFloat(migration.toVersion);
    const source = parseFloat(sourceVersion);
    const target = parseFloat(targetVersion);
    
    // Check if migration is relevant to version range
    if (toVer > source && fromVer <= target) {
      relevantPatterns.push(...migration.patterns);
    }
  }
  
  console.log(`${colors.green}✓ Found ${relevantPatterns.length} relevant pattern(s) from database${colors.reset}`);
  
  return scanCodebase(relevantPatterns, comprehensive, cwd);
}

/**
 * Collect critical action items that apply regardless of scan results
 */
function getRequiredActionItems(patternDb, sourceVersion, targetVersion, detectedDescriptions) {
  if (!patternDb) return [];

  const items = [];
  for (const migration of patternDb.migrations) {
    const fromVer = parseFloat(migration.fromVersion);
    const toVer = parseFloat(migration.toVersion);
    const source = parseFloat(sourceVersion);
    const target = parseFloat(targetVersion);

    if (toVer > source && fromVer <= target) {
      for (const p of migration.patterns) {
        if (p.severity === 'critical' && p.manual && !detectedDescriptions.has(p.description)) {
          items.push(p);
        }
      }
    }
  }
  return items;
}

/**
 * Generate human-readable report
 */
function printReport(results, breakingChanges, actionItems) {
  console.log('\n' + '='.repeat(70));
  console.log(`${colors.bright}${colors.blue}Pattern Detection Report${colors.reset}`);
  console.log('='.repeat(70) + '\n');
  
  if (breakingChanges && breakingChanges.length > 0) {
    console.log(`${colors.bright}Breaking Changes by Version:${colors.reset}\n`);
    
    for (const bc of breakingChanges) {
      console.log(`${colors.cyan}Version ${bc.version}:${colors.reset}`);
      console.log(bc.changes.split('\n').map(l => `  ${l}`).join('\n'));
      console.log('');
    }
  }
  
  if (results.length === 0 && (!actionItems || actionItems.length === 0)) {
    console.log(`${colors.green}✅ No deprecated patterns detected in your codebase${colors.reset}\n`);
    return;
  }
  
  if (results.length === 0) {
    console.log(`${colors.green}✅ No deprecated patterns detected in your codebase${colors.reset}\n`);
  } else {
    console.log(`${colors.bright}Detected Patterns Requiring Updates:${colors.reset}\n`);
  
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      console.log(`${colors.yellow}${i + 1}. ${result.pattern.description}${colors.reset}`);
      console.log(`   Version: ${result.pattern.version || 'N/A'}`);
      console.log(`   Type: ${result.pattern.type}`);
      console.log(`   Occurrences: ${result.matchCount}`);
    
      if (result.pattern.requiresImport) {
        console.log(`   ${colors.cyan}Required import: ${result.pattern.requiresImport}${colors.reset}`);
      }
    
      if (result.pattern.manual) {
        console.log(`   ${colors.red}⚠ Requires manual review${colors.reset}`);
      }
    
      console.log(`   Files affected:`);
      const fileList = [...new Set(result.matches.map(m => m.file))];
      fileList.slice(0, 5).forEach(file => {
        console.log(`     - ${file}`);
      });
    
      if (fileList.length > 5) {
        console.log(`     ... and ${fileList.length - 5} more`);
      }
    
      console.log('');
    }
  }
  
  if (actionItems && actionItems.length > 0) {
    console.log(`${colors.bright}${colors.red}Required Action Items (config/deployment changes):${colors.reset}\n`);
    for (let i = 0; i < actionItems.length; i++) {
      const item = actionItems[i];
      console.log(`${colors.red}❗ ${i + 1}. ${item.description}${colors.reset}`);
      console.log(`   Severity: ${item.severity}`);
      if (item.migration) {
        console.log(`   Action: ${item.migration}`);
      }
      if (item.example) {
        console.log(`   Example: ${item.example.after}`);
      }
      console.log('');
    }
  }

  console.log('='.repeat(70));
  console.log(`${colors.bright}Summary:${colors.reset}`);
  console.log(`  Total pattern types detected: ${results.length}`);
  console.log(`  Total occurrences: ${results.reduce((sum, r) => sum + r.matchCount, 0)}`);
  console.log(`  Files affected: ${[...new Set(results.flatMap(r => r.matches.map(m => m.file)))].length}`);
  if (actionItems && actionItems.length > 0) {
    console.log(`  ${colors.red}Required action items: ${actionItems.length}${colors.reset}`);
  }
  console.log('='.repeat(70) + '\n');
  
  console.log(`${colors.cyan}📊 Detailed report saved to: ${OUTPUT_REPORT}${colors.reset}\n`);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const comprehensive = args.includes('--comprehensive');

  // Parse --project-dir
  const { projectDir } = require('./_project-dir');

  const filteredArgs = args.filter(a => a !== '--comprehensive' && a !== '--project-dir')
    .filter(a => a !== projectDir);
  
  const sourceVersion = filteredArgs[0] || '4.0.0';
  const targetVersion = filteredArgs[1] || '9.1.0';
  
  console.log(`${colors.bright}${colors.blue}`);
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       Pattern Change Detection (Tier 2/3)                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);
  
  console.log(`Mode: ${comprehensive ? 'Comprehensive (Tier 3)' : 'Standard (Tier 2)'}`);
  console.log(`Project: ${projectDir}`);
  console.log(`Source: ${sourceVersion} → Target: ${targetVersion}\n`);
  
  let allPatterns = [];
  let breakingChanges = null;
  let results = [];
  
  // Fetch and parse CHANGELOG (Tier 2)
  const changelog = await fetchChangelog(targetVersion);
  
  if (changelog) {
    breakingChanges = parseBreakingChanges(changelog, sourceVersion, targetVersion);
    const extractedPatterns = extractPatternRules(breakingChanges);
    allPatterns.push(...extractedPatterns);
  }
  
  // Load pattern database (Tier 3)
  const patternDb = loadPatternDatabase();
  if (comprehensive && patternDb) {
    const dbResults = applyPatternDatabase(patternDb, sourceVersion, targetVersion, comprehensive, projectDir);
    results.push(...dbResults);
  }
  
  // Scan for extracted patterns
  if (allPatterns.length > 0) {
    const scanResults = scanCodebase(allPatterns, comprehensive, projectDir);
    results.push(...scanResults);
  }
  
  // Collect critical action items not caught by scanning
  const detectedDescriptions = new Set(results.map(r => r.pattern.description));
  const actionItems = getRequiredActionItems(patternDb, sourceVersion, targetVersion, detectedDescriptions);

  // Generate report
  printReport(results, breakingChanges, actionItems);
  
  // Save detailed JSON report
  const report = {
    timestamp: new Date().toISOString(),
    mode: comprehensive ? 'comprehensive' : 'standard',
    sourceVersion,
    targetVersion,
    breakingChanges,
    actionItems,
    results: results.map(r => ({
      pattern: {
        ...r.pattern,
        oldPattern: r.pattern.oldPattern ? r.pattern.oldPattern.toString() : undefined,
      },
      matchCount: r.matchCount,
      matches: r.matches
    }))
  };
  
  fs.writeFileSync(OUTPUT_REPORT, JSON.stringify(report, null, 2));
  
  // Exit with appropriate code
  if (results.length > 0 || actionItems.length > 0) {
    console.log(`${colors.yellow}⚠  Patterns detected - please review and update${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`${colors.green}✅ All clear - no deprecated patterns found${colors.reset}`);
    process.exit(0);
  }
}

// Handle Node.js version compatibility
if (typeof fetch === 'undefined') {
  console.error(`${colors.red}❌ This script requires Node.js 18+ with native fetch support${colors.reset}`);
  console.error(`${colors.yellow}Your Node version: ${process.version}${colors.reset}`);
  console.error(`${colors.yellow}Please upgrade Node.js or use pattern database only (Tier 3)${colors.reset}`);
  process.exit(1);
}

// Run
main().catch(error => {
  console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
  console.error(error.stack);
  process.exit(1);
});
