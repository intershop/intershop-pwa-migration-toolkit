#!/usr/bin/env node

/**
 * GitHub Issue Checker for PWA Migration
 *
 * Checks if issues encountered during migration are known bugs
 * already fixed in later PWA versions.
 *
 * Usage:
 *   node scripts/check-github-issues.js --version 9.1.0
 *   node scripts/check-github-issues.js --version 9.1.0 --search "SCSS variable"
 */

const fs = require('fs');
const path = require('path');
const { log, execSilent, chalk } = require('./_utils');

const GITHUB_API = 'https://api.github.com/repos/intershop/intershop-pwa';

// Parse arguments
const args = process.argv.slice(2);
let targetVersion = '';
let issueSearch = '';

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--version': targetVersion = args[++i]; break;
    case '--search': issueSearch = args[++i]; break;
    case '-h': case '--help':
      console.log(`Usage: node scripts/check-github-issues.js [OPTIONS]

Check if issues encountered during migration are known bugs already fixed in GitHub.

OPTIONS:
  --version VERSION      Target PWA version (e.g., 9.1.0)
  --search "KEYWORDS"    Search for specific issue keywords
  -h, --help             Show this help message

EXAMPLES:
  node scripts/check-github-issues.js --version 9.1.0
  node scripts/check-github-issues.js --version 9.1.0 --search "SCSS variable"`);
      process.exit(0);
  }
}

if (!targetVersion) {
  console.log('Error: --version is required');
  process.exit(1);
}

log.header('🔍 GitHub Issue Checker for PWA Migration');

// Detect current version
log.section('Detecting Current Version');
const currentVersion = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    return pkg.version || 'unknown';
  } catch { return 'unknown'; }
})();

console.log(`Current version: ${currentVersion}`);
console.log(`Target version:  ${targetVersion}`);

// Fetch recent closed issues
log.section('Fetching Recent Fixes from GitHub');

async function fetchIssues() {
  console.log('Querying GitHub API for closed issues...');

  try {
    const response = await fetch(`${GITHUB_API}/issues?state=closed&per_page=50&labels=bug`);
    if (!response.ok) {
      log.error('Failed to fetch issues from GitHub');
      log.warning('Check your internet connection or GitHub API rate limits');
      process.exit(1);
    }

    const issues = await response.json();
    if (!Array.isArray(issues)) {
      log.error('Unexpected response from GitHub API');
      process.exit(1);
    }

    // Filter by keywords if provided
    let filtered = issues;
    if (issueSearch) {
      const keywords = issueSearch.toLowerCase().split(/\s+/);
      filtered = issues.filter(issue => {
        const text = (`${issue.title} ${issue.body || ''}`).toLowerCase();
        return keywords.some(kw => text.includes(kw));
      });
    }

    // Group by milestone
    const byVersion = {};
    for (const issue of filtered) {
      const milestone = issue.milestone ? issue.milestone.title : 'No milestone';
      if (!byVersion[milestone]) byVersion[milestone] = [];
      byVersion[milestone].push(issue);
    }

    // Display
    log.section('Recent Bugs Fixed in PWA (Last 50)');
    console.log(`\nFound ${filtered.length} relevant closed issues:\n`);

    for (const version of Object.keys(byVersion).sort()) {
      console.log(`\n📌 ${version}`);
      for (const issue of byVersion[version]) {
        console.log(`   #${issue.number}: ${issue.title}`);
        console.log(`   URL: ${issue.html_url}`);
        if (issue.labels?.length > 0) {
          console.log(`   Labels: ${issue.labels.map(l => l.name).join(', ')}`);
        }
        console.log();
      }
    }

    // Recommendations
    console.log('━'.repeat(80));
    console.log('📋 RECOMMENDATIONS:\n');

    if (filtered.length === 0) {
      console.log('✓ No known issues match your search criteria.');
      console.log('  Your issue might be new or require different search terms.');
    } else {
      console.log(`✓ Found ${filtered.length} related issues that were fixed.`);
      console.log();
      console.log('ACTION STEPS:');
      console.log('1. Review the issues above to see if they match your problem');
      console.log('2. Check which version the fix was released in');
      console.log('3. Verify your target version includes the fix');
      console.log('4. If the fix is in a later version, consider upgrading');
      console.log('5. If the fix is in your target version, applying migration should resolve it');
    }
  } catch (err) {
    log.error(`Failed to fetch issues: ${err.message}`);
    process.exit(1);
  }
}

fetchIssues();
