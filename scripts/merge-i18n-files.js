#!/usr/bin/env node

/**
 * Enhanced Localization File Merger for PWA Migrations
 * 
 * Intelligently merges localization JSON files from three sources:
 * - Base: Common ancestor (before both branches diverged)
 * - Theirs: New PWA version changes
 * - Ours: Custom PWA changes
 * 
 * Features:
 * - Detects and categorizes conflicts
 * - Provides AI-parseable output
 * - Generates recommendations for manual review
 * - Creates detailed merge report
 */

const fs = require('fs');
const path = require('path');

// Conflict categories
const ConflictCategory = {
  CUSTOM_ONLY: 'CUSTOM_ONLY',           // Key only in custom version
  PWA_ONLY: 'PWA_ONLY',                 // Key only in PWA version
  SEMANTIC_CONFLICT: 'SEMANTIC_CONFLICT', // Both modified with different meanings
  FORMATTING_ONLY: 'FORMATTING_ONLY',   // Same meaning, different formatting
  IDENTICAL: 'IDENTICAL',               // Same in both versions
};

// Recommendation types
const Recommendation = {
  KEEP_CUSTOM: 'KEEP_CUSTOM',
  USE_PWA: 'USE_PWA',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  AUTO_MERGED: 'AUTO_MERGED',
};

/**
 * Analyzes a conflict and determines its category and recommendation
 */
function analyzeConflict(key, baseValue, theirsValue, oursValue) {
  // Custom feature (key doesn't exist in PWA)
  if (!theirsValue && oursValue) {
    return {
      category: ConflictCategory.CUSTOM_ONLY,
      recommendation: Recommendation.KEEP_CUSTOM,
      reason: 'Custom feature translation not in base PWA',
    };
  }

  // New PWA feature (key doesn't exist in custom)
  if (theirsValue && !oursValue) {
    return {
      category: ConflictCategory.PWA_ONLY,
      recommendation: Recommendation.USE_PWA,
      reason: 'New PWA feature translation',
    };
  }

  // Identical values
  if (theirsValue === oursValue) {
    return {
      category: ConflictCategory.IDENTICAL,
      recommendation: Recommendation.AUTO_MERGED,
      reason: 'Identical in both versions',
    };
  }

  // Both sides modified - need deeper analysis
  const baseExists = baseValue !== undefined && baseValue !== null;
  
  if (!baseExists) {
    // Both added the same key with different values
    return {
      category: ConflictCategory.SEMANTIC_CONFLICT,
      recommendation: Recommendation.MANUAL_REVIEW,
      reason: 'Both versions added this key with different values',
    };
  }

  // Check if custom version is unchanged from base
  if (baseValue === oursValue && theirsValue !== baseValue) {
    return {
      category: ConflictCategory.PWA_ONLY,
      recommendation: Recommendation.USE_PWA,
      reason: 'PWA improved translation, custom version unchanged from base',
    };
  }

  // Check if PWA version is unchanged from base
  if (baseValue === theirsValue && oursValue !== baseValue) {
    return {
      category: ConflictCategory.CUSTOM_ONLY,
      recommendation: Recommendation.KEEP_CUSTOM,
      reason: 'Custom version improved translation, PWA unchanged from base',
    };
  }

  // Both modified from base - genuine conflict
  const similarity = calculateSimilarity(theirsValue, oursValue);
  
  if (similarity > 0.8) {
    return {
      category: ConflictCategory.FORMATTING_ONLY,
      recommendation: Recommendation.KEEP_CUSTOM,
      reason: 'Minor formatting differences, keeping custom version',
    };
  }

  return {
    category: ConflictCategory.SEMANTIC_CONFLICT,
    recommendation: Recommendation.MANUAL_REVIEW,
    reason: 'Both versions modified translation with different meanings',
  };
}

/**
 * Simple similarity calculation (Levenshtein-like)
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance calculation
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Merges localization files and generates detailed report
 */
function mergeI18nFiles(locale, basePath, theirsPath, oursPath, outputPath) {
  console.log(`\n📝 Merging ${locale}.json...`);
  
  const base = fs.existsSync(basePath) ? JSON.parse(fs.readFileSync(basePath, 'utf8')) : {};
  const theirs = JSON.parse(fs.readFileSync(theirsPath, 'utf8'));
  const ours = JSON.parse(fs.readFileSync(oursPath, 'utf8'));
  
  const merged = {};
  const conflicts = [];
  const stats = {
    customOnly: 0,
    pwaOnly: 0,
    semanticConflicts: 0,
    formattingOnly: 0,
    identical: 0,
    total: 0,
  };
  
  // Get all unique keys
  const allKeys = new Set([
    ...Object.keys(base),
    ...Object.keys(theirs),
    ...Object.keys(ours)
  ]);
  
  // Process each key
  for (const key of allKeys) {
    const baseValue = base[key];
    const theirsValue = theirs[key];
    const oursValue = ours[key];
    
    const analysis = analyzeConflict(key, baseValue, theirsValue, oursValue);
    
    // Apply merge strategy based on recommendation
    let finalValue;
    let needsReview = false;
    
    switch (analysis.recommendation) {
      case Recommendation.KEEP_CUSTOM:
        finalValue = oursValue;
        break;
      case Recommendation.USE_PWA:
        finalValue = theirsValue;
        break;
      case Recommendation.MANUAL_REVIEW:
        finalValue = oursValue; // Default to custom, but flag for review
        needsReview = true;
        break;
      case Recommendation.AUTO_MERGED:
        finalValue = theirsValue; // Same value, doesn't matter which
        break;
    }
    
    merged[key] = finalValue;
    
    // Track statistics
    stats.total++;
    switch (analysis.category) {
      case ConflictCategory.CUSTOM_ONLY:
        stats.customOnly++;
        break;
      case ConflictCategory.PWA_ONLY:
        stats.pwaOnly++;
        break;
      case ConflictCategory.SEMANTIC_CONFLICT:
        stats.semanticConflicts++;
        break;
      case ConflictCategory.FORMATTING_ONLY:
        stats.formattingOnly++;
        break;
      case ConflictCategory.IDENTICAL:
        stats.identical++;
        break;
    }
    
    // Record conflicts that need attention
    if (needsReview || analysis.category === ConflictCategory.SEMANTIC_CONFLICT) {
      conflicts.push({
        key,
        base: baseValue,
        theirs: theirsValue,
        ours: oursValue,
        selected: finalValue,
        category: analysis.category,
        recommendation: analysis.recommendation,
        reason: analysis.reason,
      });
    }
  }
  
  // Sort keys alphabetically for consistency
  const sorted = Object.keys(merged)
    .sort()
    .reduce((acc, key) => {
      acc[key] = merged[key];
      return acc;
    }, {});
  
  // Write merged result
  fs.writeFileSync(outputPath, JSON.stringify(sorted, null, 2) + '\n');
  
  return { locale, stats, conflicts };
}

/**
 * Prints conflict details for human review
 */
function printConflict(conflict, index, total) {
  console.log(`\n⚠️  CONFLICT ${index}/${total}: "${conflict.key}"`);
  console.log(`   Category: ${conflict.category}`);
  
  if (conflict.base !== undefined && conflict.base !== null) {
    console.log(`   Base:   "${conflict.base}"`);
  } else {
    console.log(`   Base:   [not present]`);
  }
  
  console.log(`   PWA:    "${conflict.theirs || '[not present]'}"`);
  console.log(`   Custom: "${conflict.ours || '[not present]'}"`);
  console.log(`   → Selected: "${conflict.selected}"`);
  console.log(`   Reason: ${conflict.reason}`);
}

/**
 * Generates AI-parseable JSON report
 */
function generateJsonReport(results, outputPath) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalLocales: results.length,
      totalKeys: results.reduce((sum, r) => sum + r.stats.total, 0),
      totalConflicts: results.reduce((sum, r) => sum + r.conflicts.length, 0),
      semanticConflicts: results.reduce((sum, r) => sum + r.stats.semanticConflicts, 0),
      customOnlyKeys: results.reduce((sum, r) => sum + r.stats.customOnly, 0),
      pwaOnlyKeys: results.reduce((sum, r) => sum + r.stats.pwaOnly, 0),
    },
    locales: results.map(r => ({
      locale: r.locale,
      stats: r.stats,
      conflicts: r.conflicts,
    })),
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`\n📊 Detailed JSON report: ${outputPath}`);
}

/**
 * Main execution
 */
function main() {
  console.log('🔄 Enhanced Localization File Merger');
  console.log('=====================================\n');
  
  const locales = ['en_US', 'de_DE', 'fr_FR'];
  const i18nDir = 'src/assets/i18n';
  const results = [];
  
  // Process each locale
  for (const locale of locales) {
    const basePath = `${locale}.base.json`;
    const theirsPath = `${locale}.theirs.json`;
    const oursPath = `${locale}.ours.json`;
    const outputPath = path.join(i18nDir, `${locale}.json`);
    
    if (!fs.existsSync(theirsPath) || !fs.existsSync(oursPath)) {
      console.log(`⏭️  Skipping ${locale} (missing input files)`);
      continue;
    }
    
    const result = mergeI18nFiles(locale, basePath, theirsPath, oursPath, outputPath);
    results.push(result);
    
    // Print statistics
    console.log(`\n✓ Merged to: ${outputPath}`);
    console.log(`  Total keys: ${result.stats.total}`);
    console.log(`  - Custom only: ${result.stats.customOnly}`);
    console.log(`  - PWA only: ${result.stats.pwaOnly}`);
    console.log(`  - Identical: ${result.stats.identical}`);
    console.log(`  - Semantic conflicts: ${result.stats.semanticConflicts}`);
    console.log(`  - Formatting only: ${result.stats.formattingOnly}`);
    
    // Print conflicts that need review
    if (result.conflicts.length > 0) {
      console.log(`\n🔍 ${result.conflicts.length} conflict(s) need review:`);
      result.conflicts.forEach((conflict, idx) => {
        printConflict(conflict, idx + 1, result.conflicts.length);
      });
    }
    
    // Clean up temporary files
    if (fs.existsSync(basePath)) fs.unlinkSync(basePath);
    if (fs.existsSync(theirsPath)) fs.unlinkSync(theirsPath);
    if (fs.existsSync(oursPath)) fs.unlinkSync(oursPath);
  }
  
  // Generate JSON report for AI assistants
  if (results.length > 0) {
    generateJsonReport(results, 'i18n-merge-report.json');
  }
  
  // Summary
  console.log('\n=====================================');
  console.log('✅ All localization files merged');
  
  const totalConflicts = results.reduce((sum, r) => sum + r.conflicts.length, 0);
  
  if (totalConflicts > 0) {
    console.log(`\n⚠️  ${totalConflicts} conflict(s) detected and flagged for review`);
    console.log('Please review the conflicts above and verify the selected values are correct.');
    console.log('\nFor AI assistants: Parse i18n-merge-report.json for structured conflict data.');
  } else {
    console.log('\n✓ No conflicts detected - all translations merged automatically');
  }
}

// Run the script
try {
  main();
} catch (error) {
  console.error('❌ Error during merge:', error.message);
  console.error(error.stack);
  process.exit(1);
}
