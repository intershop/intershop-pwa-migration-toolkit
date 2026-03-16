#!/usr/bin/env bash
set -e

# check-github-issues.sh
# Checks if issues encountered during migration are known bugs already fixed in later PWA versions

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GITHUB_API="https://api.github.com/repos/intershop/intershop-pwa"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_section() {
  echo ""
  echo -e "${YELLOW}▶ $1${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

# Parse command line arguments
TARGET_VERSION=""
ISSUE_SEARCH=""

show_usage() {
  cat << EOF
Usage: $0 [OPTIONS]

Check if issues encountered during migration are known bugs already fixed in GitHub.

OPTIONS:
  --version VERSION      Target PWA version you're migrating to (e.g., 9.1.0)
  --search "KEYWORDS"    Search for specific issue keywords (e.g., "SCSS variable undefined")
  -h, --help             Show this help message

EXAMPLES:
  # Check for issues fixed after version 4.0.0 up to current target 9.1.0
  $0 --version 9.1.0

  # Search for specific error
  $0 --version 9.1.0 --search "SCSS variable"

  # Check what's been fixed in recent releases
  $0 --version develop

EOF
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --version)
      TARGET_VERSION="$2"
      shift 2
      ;;
    --search)
      ISSUE_SEARCH="$2"
      shift 2
      ;;
    -h|--help)
      show_usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      show_usage
      exit 1
      ;;
  esac
done

if [ -z "$TARGET_VERSION" ]; then
  echo "Error: --version is required"
  show_usage
  exit 1
fi

print_header "🔍 GitHub Issue Checker for PWA Migration"

# Detect current version
print_section "Detecting Current Version"
CURRENT_VERSION=$(grep '"version"' package.json | head -1 | cut -d'"' -f4)
echo "Current version: $CURRENT_VERSION"
echo "Target version:  $TARGET_VERSION"

# Fetch recent closed issues from GitHub
print_section "Fetching Recent Fixes from GitHub"

# Build search query
QUERY="repo:intershop/intershop-pwa is:closed is:issue"
if [ -n "$ISSUE_SEARCH" ]; then
  QUERY="$QUERY $ISSUE_SEARCH"
fi

echo "Querying GitHub API for closed issues..."
echo "Query: $QUERY"

# Use GitHub API to search issues
TEMP_FILE=$(mktemp)
curl -s "$GITHUB_API/issues?state=closed&per_page=50&labels=bug" > "$TEMP_FILE"

if [ ! -s "$TEMP_FILE" ]; then
  print_error "Failed to fetch issues from GitHub"
  print_warning "Check your internet connection or GitHub API rate limits"
  rm -f "$TEMP_FILE"
  exit 1
fi

# Parse and display relevant issues
print_section "Recent Bugs Fixed in PWA (Last 50)"

# Extract issue numbers, titles, and associated milestones/versions
node << 'NODESCRIPT' "$TEMP_FILE" "$ISSUE_SEARCH" "$TARGET_VERSION"
const fs = require('fs');
const [,, tempFile, searchKeywords, targetVersion] = process.argv;

const issues = JSON.parse(fs.readFileSync(tempFile, 'utf8'));

if (!Array.isArray(issues)) {
  console.log('No issues found or API rate limit exceeded');
  process.exit(1);
}

// Filter issues by keywords if provided
let filteredIssues = issues;
if (searchKeywords) {
  const keywords = searchKeywords.toLowerCase().split(/\s+/);
  filteredIssues = issues.filter(issue => {
    const searchText = (issue.title + ' ' + (issue.body || '')).toLowerCase();
    return keywords.some(kw => searchText.includes(kw));
  });
}

// Group by milestone/version
const byVersion = {};
filteredIssues.forEach(issue => {
  const milestone = issue.milestone ? issue.milestone.title : 'No milestone';
  if (!byVersion[milestone]) {
    byVersion[milestone] = [];
  }
  byVersion[milestone].push(issue);
});

// Display grouped results
console.log(`\nFound ${filteredIssues.length} relevant closed issues:\n`);

Object.keys(byVersion).sort().forEach(version => {
  console.log(`\n📌 ${version}`);
  byVersion[version].forEach(issue => {
    console.log(`   #${issue.number}: ${issue.title}`);
    console.log(`   URL: ${issue.html_url}`);
    if (issue.labels && issue.labels.length > 0) {
      const labels = issue.labels.map(l => l.name).join(', ');
      console.log(`   Labels: ${labels}`);
    }
    console.log('');
  });
});

// Provide actionable recommendations
console.log('\n' + '━'.repeat(80));
console.log('📋 RECOMMENDATIONS:\n');

if (filteredIssues.length === 0) {
  console.log('✓ No known issues match your search criteria.');
  console.log('  Your issue might be new or require different search terms.');
} else {
  console.log(`✓ Found ${filteredIssues.length} related issues that were fixed.`);
  console.log('');
  console.log('ACTION STEPS:');
  console.log('1. Review the issues above to see if they match your problem');
  console.log('2. Check which version the fix was released in');
  console.log('3. Verify your target version includes the fix');
  console.log('4. If the fix is in a later version, consider upgrading');
  console.log('5. If the fix is in your target version, applying migration should resolve it');
}

NODESCRIPT

# Cleanup
rm -f "$TEMP_FILE"

print_section "Additional Resources"
echo "• View all closed issues: https://github.com/intershop/intershop-pwa/issues?q=is%3Aissue+is%3Aclosed"
echo "• View CHANGELOG:         https://github.com/intershop/intershop-pwa/blob/develop/CHANGELOG.md"
echo "• View releases:          https://github.com/intershop/intershop-pwa/releases"

print_success "Check complete"

print_section "Next Steps"
cat << EOF

If you found a related issue:
  1. Check the version where it was fixed
  2. Ensure your target version (${TARGET_VERSION}) includes the fix
  3. If not, consider migrating to a later version

If your issue is not listed:
  1. Search GitHub with different keywords: $0 --version $TARGET_VERSION --search "your keywords"
  2. Check CHANGELOG.md manually for breaking changes
  3. Consider opening a new issue if the problem persists after migration

EOF

exit 0
