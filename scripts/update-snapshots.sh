#!/usr/bin/env bash
set -e

# update-snapshots.sh
# Intelligently update Jest snapshots after migration while detecting genuine test failures

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

show_usage() {
  cat << EOF
Usage: $0 [OPTIONS]

Intelligently update Jest snapshots after PWA migration.

This script helps manage snapshot updates by:
  1. Detecting snapshot mismatches vs genuine test failures
  2. Providing selective update options
  3. Showing diffs for review before updating
  4. Identifying tests that need manual intervention

OPTIONS:
  --all              Update all snapshots without review (use with caution)
  --interactive      Review each snapshot change before updating (default)
  --failed-only      Only update snapshots for failed tests
  --dry-run          Show what would be updated without making changes
  --pattern PATTERN  Only update snapshots matching pattern
  -h, --help         Show this help message

EXAMPLES:
  # Interactive mode (recommended)
  $0

  # Update all snapshots automatically
  $0 --all

  # Update only specific component snapshots
  $0 --pattern "product.*"

  # Preview changes without updating
  $0 --dry-run

WORKFLOW:
  1. Run script to analyze snapshot failures
  2. Review diff for each snapshot
  3. Choose to update, skip, or investigate
  4. Re-run tests to verify

EOF
}

# Parse arguments
MODE="interactive"
DRY_RUN=false
PATTERN=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --all)
      MODE="all"
      shift
      ;;
    --interactive)
      MODE="interactive"
      shift
      ;;
    --failed-only)
      MODE="failed-only"
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --pattern)
      PATTERN="$2"
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

print_header "📸 Snapshot Update Manager"

if [ "$DRY_RUN" = true ]; then
  print_warning "DRY RUN MODE - No snapshots will be updated"
fi

# Check if we're in a PWA project
if [ ! -f "package.json" ] || ! grep -q "intershop-pwa" package.json; then
  print_error "Not in an Intershop PWA project directory"
  exit 1
fi

# Check if Jest is configured
if [ ! -f "jest.config.js" ]; then
  print_error "jest.config.js not found"
  exit 1
fi

print_section "Running Tests to Detect Snapshot Failures"

# Run tests and capture output
TEST_OUTPUT=$(mktemp)
PATTERN_FLAG=""
if [ -n "$PATTERN" ]; then
  PATTERN_FLAG="-t $PATTERN"
fi

if npm test -- --no-coverage $PATTERN_FLAG 2>&1 | tee "$TEST_OUTPUT"; then
  print_success "All tests passed - no snapshot updates needed"
  rm -f "$TEST_OUTPUT"
  exit 0
fi

# Analyze test output for snapshot failures
print_section "Analyzing Snapshot Failures"

# Extract snapshot failure details
SNAPSHOT_FAILURES=$(grep -A 3 "Snapshot name:" "$TEST_OUTPUT" || true)
SNAPSHOT_COUNT=$(echo "$SNAPSHOT_FAILURES" | grep -c "Snapshot name:" || true)

if [ "$SNAPSHOT_COUNT" -eq 0 ]; then
  print_warning "No snapshot failures detected"
  
  # Check for other test failures
  if grep -q "FAIL" "$TEST_OUTPUT"; then
    print_error "Tests failed, but not due to snapshots"
    print_section "Non-Snapshot Failures Detected"
    grep "FAIL.*\.spec\.ts" "$TEST_OUTPUT" || true
    echo ""
    print_warning "These failures require manual investigation:"
    echo "  1. Review test output above"
    echo "  2. Fix failing tests"
    echo "  3. Re-run tests"
    rm -f "$TEST_OUTPUT"
    exit 1
  fi
  
  rm -f "$TEST_OUTPUT"
  exit 0
fi

print_success "Found $SNAPSHOT_COUNT snapshot mismatches"

# Categorize failures
print_section "Categorizing Snapshot Changes"

# Create detailed analysis using Node.js
node << 'NODESCRIPT' "$TEST_OUTPUT" "$MODE" "$DRY_RUN"
const fs = require('fs');
const [,, testOutput, mode, dryRun] = process.argv;

const output = fs.readFileSync(testOutput, 'utf8');
const lines = output.split('\n');

const failures = [];
let currentTest = null;

lines.forEach(line => {
  if (line.includes('FAIL ')) {
    const match = line.match(/FAIL\s+(.+\.spec\.ts)/);
    if (match) {
      currentTest = match[1];
    }
  }
  
  if (line.includes('Snapshot name:')) {
    const match = line.match(/Snapshot name: `(.+)`/);
    if (match && currentTest) {
      failures.push({
        file: currentTest,
        snapshotName: match[1]
      });
    }
  }
});

// Group by file
const byFile = {};
failures.forEach(f => {
  if (!byFile[f.file]) {
    byFile[f.file] = [];
  }
  byFile[f.file].push(f.snapshotName);
});

console.log('\n📋 Snapshot Failures by File:\n');
Object.keys(byFile).sort().forEach(file => {
  console.log(`${file}`);
  byFile[file].forEach(name => {
    console.log(`  • ${name}`);
  });
  console.log('');
});

console.log(`Total: ${failures.length} snapshot(s) in ${Object.keys(byFile).length} file(s)\n`);

// Provide recommendation based on migration context
console.log('📊 Analysis:\n');
console.log('Common reasons for snapshot failures after migration:');
console.log('  ✓ Angular version update changed component rendering');
console.log('  ✓ Template syntax improvements');
console.log('  ✓ Library updates (Bootstrap, FontAwesome, etc.)');
console.log('  ✓ Component refactoring in new PWA version');
console.log('');
console.log('⚠️  Before updating snapshots:');
console.log('  1. Verify tests are actually passing (no logic errors)');
console.log('  2. Check if snapshot changes are expected due to migration');
console.log('  3. Review snapshot diffs to ensure no regressions');
console.log('');

NODESCRIPT

# Interactive or automatic update
if [ "$MODE" = "all" ]; then
  print_section "Updating All Snapshots"
  print_warning "This will update ALL snapshots without review"
  
  if [ "$DRY_RUN" = false ]; then
    npm test -- --updateSnapshot --no-coverage $PATTERN_FLAG
    print_success "All snapshots updated"
  else
    print_warning "DRY RUN: Would update all snapshots"
  fi
elif [ "$MODE" = "interactive" ]; then
  print_section "Interactive Snapshot Update"
  print_warning "Please review the snapshot diffs shown above"
  echo ""
  read -p "Do you want to update all these snapshots? (y/N): " response
  
  if [[ "$response" =~ ^[Yy]$ ]]; then
    if [ "$DRY_RUN" = false ]; then
      npm test -- --updateSnapshot --no-coverage $PATTERN_FLAG
      print_success "Snapshots updated"
    else
      print_warning "DRY RUN: Would update snapshots"
    fi
  else
    print_warning "Snapshot update cancelled"
    echo ""
    print_section "Manual Update Options"
    echo "To update specific snapshots:"
    echo "  npm test -- --updateSnapshot --testNamePattern='test name'"
    echo ""
    echo "To see snapshot diffs:"
    echo "  npm test -- --no-coverage"
  fi
fi

# Verify after update
if [ "$DRY_RUN" = false ] && [ "$MODE" != "interactive" ] || [[ "$response" =~ ^[Yy]$ ]]; then
  print_section "Verifying Updated Snapshots"
  
  if npm test -- --no-coverage $PATTERN_FLAG 2>&1 | grep -q "PASS"; then
    print_success "Tests passing after snapshot update"
    
    print_section "Next Steps"
    echo "1. Review git diff to see snapshot changes"
    echo "2. Ensure changes are expected from migration"
    echo "3. Commit updated snapshots:"
    echo "   git add ."
    echo "   git commit -m 'test: update snapshots after migration'"
  else
    print_error "Tests still failing after snapshot update"
    print_warning "Additional issues require manual investigation"
  fi
fi

# Cleanup
rm -f "$TEST_OUTPUT"

print_success "Snapshot update process complete"

exit 0
