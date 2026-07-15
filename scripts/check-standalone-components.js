#!/usr/bin/env node

/**
 * Standalone Component Architecture Analyzer
 *
 * Analyzes component architecture (NgModule vs Standalone)
 *
 * Usage:
 *   node scripts/check-standalone-components.js [--project-dir <path>]
 */

const fs = require('fs');
const path = require('path');
const { projectDir } = require('./_project-dir');
const { findFiles, countInFiles, chalk } = require('./_utils');

process.chdir(projectDir);

console.log('🔍 Analyzing component architecture...');
console.log();

const srcApp = path.join(projectDir, 'src', 'app');
const tsFiles = findFiles(srcApp, /\.ts$/);
const moduleFiles = findFiles(srcApp, /\.module\.ts$/);

// Count standalone components
const standaloneCount = countInFiles(tsFiles, /standalone:\s*true/g);

// Count NgModule declarations
const moduleCount = countInFiles(moduleFiles, /declarations:/g);

console.log('📊 Component Architecture:');
console.log(`   Standalone components: ${standaloneCount}`);
console.log(`   NgModule-based components: ~${moduleCount} modules`);
console.log();

if (standaloneCount > 0 && moduleCount > 0) {
  console.log('✅ Mixed architecture detected (both patterns coexist)');
  console.log('   This is NORMAL and SUPPORTED by Angular.');
  console.log();
  console.log('💡 Recommendations:');
  console.log('   - Keep custom NgModule components as-is (no migration needed)');
  console.log('   - New PWA standalone components work alongside your modules');
  console.log('   - Only migrate to standalone if there\'s clear benefit');
  console.log();
  console.log('📋 Decision Required:');
  console.log('   For each custom feature, decide:');
  console.log('   A) Keep NgModule pattern (recommended for stable code)');
  console.log('   B) Migrate to standalone (only if justified)');
  console.log();
  console.log('   Document your decision in docs/architecture-decisions.md');
} else if (standaloneCount === 0) {
  console.log('✅ Pure NgModule architecture');
  console.log('   No migration needed - this pattern is fully supported.');
  console.log();
  console.log('💡 Note: New PWA may use standalone components.');
  console.log('   Your NgModule components will work alongside them.');
} else {
  console.log('✅ Pure standalone architecture');
  console.log('   All components use the modern standalone pattern.');
}
