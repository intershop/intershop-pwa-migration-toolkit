#!/bin/bash

##############################################################################
# Automated Migration Script: Customization Branch → Feature Branch
#
# This script automates the migration of customizations from an old PWA version
# to a new PWA version by:
#   1. Creating a new branch based on upstream PWA (target)
#   2. Merging your customizations from old branch (source) into it
#   3. Reporting conflicts for manual resolution
#
# Usage: ./scripts/migrate-custom-branch.sh [OPTIONS]
#
# Options:
#   --source-branch <branch>    Your OLD custom branch (default: training_4.0.0)
#   --target-branch <branch>    Upstream PWA version reference (default: feature/migration-4.0-to-9.1)
#                               This is the PWA tag/branch to base your new branch on
#   --migration-branch <branch> Your NEW custom branch name (default: migration/training-to-9.1)
#                               This is what your final migrated branch will be called
#   --target-tag <tag>          Use a tag instead of branch for upstream (e.g., 9.1.0)
#   --intershop-remote <name>   Name of Intershop PWA remote (default: auto-detect)
#   --auto-resolve              Automatically resolve simple conflicts
#   --skip-nodejs-check         Skip Node.js version validation (not recommended)
#   --dry-run                   Show what would be done without making changes
#   --help                      Show this help message
#
# Example:
#   # Migrate training_4.0.0 → training_10.0.0 (based on PWA 10.0.0)
#   ./scripts/migrate-custom-branch.sh \
#     --source-branch training_4.0.0 \
#     --target-branch intershop-pwa/10.0.0 \
#     --migration-branch training_10.0.0
#
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
SOURCE_BRANCH="training_4.0.0"
TARGET_BRANCH="feature/migration-4.0-to-9.1"
TARGET_TAG=""
INTERSHOP_REMOTE=""
MIGRATION_BRANCH="migration/training-to-9.1"
AUTO_RESOLVE=false
SKIP_NODEJS_CHECK=false
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --source-branch)
      SOURCE_BRANCH="$2"
      shift 2
      ;;
    --target-branch)
      TARGET_BRANCH="$2"
      shift 2
      ;;
    --target-tag)
      TARGET_TAG="$2"
      shift 2
      ;;
    --intershop-remote)
      INTERSHOP_REMOTE="$2"
      shift 2
      ;;
    --migration-branch)
      MIGRATION_BRANCH="$2"
      shift 2
      ;;
    --auto-resolve)
      AUTO_RESOLVE=true
      shift
      ;;
    --skip-nodejs-check)
      SKIP_NODEJS_CHECK=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help)
      grep '^#' "$0" | tail -n +3 | head -n -1 | cut -c 3-
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Helper functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Auto-detect Intershop PWA remote if not specified
detect_intershop_remote() {
  if [ -n "$INTERSHOP_REMOTE" ]; then
    return 0
  fi
  
  log_info "Auto-detecting Intershop PWA remote..."
  
  # Check for common remote names that point to intershop-pwa
  for remote in upstream intershop-pwa intershop origin; do
    if git remote get-url "$remote" 2>/dev/null | grep -q "intershop/intershop-pwa"; then
      INTERSHOP_REMOTE="$remote"
      log_success "Detected Intershop PWA remote: $INTERSHOP_REMOTE"
      return 0
    fi
  done
  
  log_warning "Could not auto-detect Intershop PWA remote"
  echo "Please specify with --intershop-remote option"
  echo ""
  echo "Available remotes:"
  git remote -v
  return 1
}

# Validate and resolve target (branch or tag)
validate_target() {
  local target="$1"
  local is_tag="$2"
  
  # If using a tag
  if [ -n "$TARGET_TAG" ]; then
    log_info "Validating tag: $TARGET_TAG"
    
    # Try tags/ prefix first
    if git rev-parse "tags/$TARGET_TAG" > /dev/null 2>&1; then
      TARGET_BRANCH="tags/$TARGET_TAG"
      log_success "Found tag: $TARGET_TAG"
      return 0
    fi
    
    # Try remote/tag format
    if [ -n "$INTERSHOP_REMOTE" ]; then
      if git rev-parse "$INTERSHOP_REMOTE/$TARGET_TAG" > /dev/null 2>&1; then
        TARGET_BRANCH="$INTERSHOP_REMOTE/$TARGET_TAG"
        log_success "Found tag: $INTERSHOP_REMOTE/$TARGET_TAG"
        return 0
      fi
    fi
    
    # Tag not found, show available tags
    log_error "Tag '$TARGET_TAG' not found"
    echo ""
    echo "Available release tags (last 10):"
    git tag -l | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -10
    echo ""
    echo "Hint: Fetch tags with: git fetch $INTERSHOP_REMOTE --tags"
    return 1
  fi
  
  # Validate branch
  if ! git rev-parse --verify "$TARGET_BRANCH" > /dev/null 2>&1; then
    log_error "Target branch '$TARGET_BRANCH' does not exist"
    echo ""
    echo "Available branches:"
    git branch -a | grep -E "remotes/.*/" | head -10
    echo ""
    echo "Hint: Fetch branches with: git fetch $INTERSHOP_REMOTE"
    return 1
  fi
  
  return 0
}

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  log_error "Not in a git repository"
  exit 1
fi

# Detect Intershop remote
detect_intershop_remote || {
  log_error "Please set up Intershop PWA remote or specify with --intershop-remote"
  exit 1
}

# Fetch latest from Intershop remote
log_info "Fetching from $INTERSHOP_REMOTE..."
git fetch "$INTERSHOP_REMOTE" --tags > /dev/null 2>&1 || {
  log_warning "Failed to fetch from $INTERSHOP_REMOTE"
}

# Check if branches exist
if ! git rev-parse --verify "$SOURCE_BRANCH" > /dev/null 2>&1; then
  log_error "Source branch '$SOURCE_BRANCH' does not exist"
  exit 1
fi

# Validate target branch/tag
validate_target "$TARGET_BRANCH" "$TARGET_TAG" || {
  exit 1
}

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  log_error "You have uncommitted changes. Please commit or stash them first."
  exit 1
fi

log_info "============================================"
log_info "Automated PWA Migration"
log_info "============================================"
log_info "Source Branch (Customizations): $SOURCE_BRANCH"
log_info "Target Branch (New PWA Version): $TARGET_BRANCH"
log_info "Migration Branch: $MIGRATION_BRANCH"
log_info "Auto-resolve conflicts: $AUTO_RESOLVE"
log_info "Dry Run: $DRY_RUN"
log_info "============================================"
echo ""

# Check Node.js version requirements
if [ "$SKIP_NODEJS_CHECK" = false ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -f "$SCRIPT_DIR/check-nodejs-version.sh" ]; then
    log_info "Checking Node.js version requirements..."
    
    # Extract target version from branch/tag name
    TARGET_VERSION=$(echo "$TARGET_BRANCH" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "11.0.0")
    
    if ! "$SCRIPT_DIR/check-nodejs-version.sh" "$TARGET_VERSION"; then
      log_error "Node.js version check failed"
      echo ""
      log_info "You can:"
      log_info "  1. Update automatically: $SCRIPT_DIR/check-nodejs-version.sh $TARGET_VERSION --auto-update"
      log_info "  2. Skip check (not recommended): Re-run with --skip-nodejs-check"
      exit 1
    fi
    echo ""
  else
    log_warning "Node.js version checker not found, skipping check"
  fi
else
  log_warning "Node.js version check skipped (--skip-nodejs-check)"
fi

if [ "$DRY_RUN" = true ]; then
  log_warning "DRY RUN MODE - No changes will be made"
  echo ""
fi

# Step 1: Create migration branch from target
log_info "Step 1: Creating migration branch from target branch..."
if [ "$DRY_RUN" = false ]; then
  # Delete migration branch if it exists
  if git rev-parse --verify "$MIGRATION_BRANCH" > /dev/null 2>&1; then
    log_warning "Migration branch already exists, deleting it..."
    git branch -D "$MIGRATION_BRANCH" 2>/dev/null || true
  fi
  
  git checkout "$TARGET_BRANCH"
  git checkout -b "$MIGRATION_BRANCH"
  log_success "Migration branch created"
else
  log_info "Would create branch: $MIGRATION_BRANCH from $TARGET_BRANCH"
fi
echo ""

# Step 2: Identify customization files
log_info "Step 2: Analyzing customization files..."

if [ "$DRY_RUN" = false ]; then
  # Get list of changed files in source branch compared to original 4.0
  CUSTOM_FILES=$(git diff --name-only "$SOURCE_BRANCH" $(git merge-base "$SOURCE_BRANCH" develop) 2>/dev/null || echo "")
  
  if [ -z "$CUSTOM_FILES" ]; then
    log_warning "No customization files found"
  else
    log_success "Found $(echo "$CUSTOM_FILES" | wc -l) customized files"
    echo "$CUSTOM_FILES" | head -20
    if [ $(echo "$CUSTOM_FILES" | wc -l) -gt 20 ]; then
      log_info "... and $(( $(echo "$CUSTOM_FILES" | wc -l) - 20 )) more files"
    fi
  fi
else
  log_info "Would analyze customization files between $SOURCE_BRANCH and original version"
fi
echo ""

# Step 3: Merge source branch into migration branch
log_info "Step 3: Merging customizations into migration branch..."

if [ "$DRY_RUN" = false ]; then
  if git merge --no-commit --no-ff "$SOURCE_BRANCH" 2>&1 | tee /tmp/merge-output.txt; then
    log_success "Merge successful without conflicts"
    git commit -m "feat: merge customizations from $SOURCE_BRANCH"
  else
    # Check if there are conflicts
    if git diff --name-only --diff-filter=U | grep -q .; then
      CONFLICT_FILES=$(git diff --name-only --diff-filter=U)
      CONFLICT_COUNT=$(echo "$CONFLICT_FILES" | wc -l)
      
      log_warning "Found $CONFLICT_COUNT files with merge conflicts:"
      echo "$CONFLICT_FILES"
      echo ""
      
      if [ "$AUTO_RESOLVE" = true ]; then
        log_info "Attempting automatic conflict resolution..."
        
        # Try to resolve conflicts automatically
        RESOLVED=0
        FAILED=0
        
        for file in $CONFLICT_FILES; do
          log_info "Processing: $file"
          
          # Try git mergetool with strategy
          if git checkout --ours "$file" 2>/dev/null; then
            git add "$file"
            RESOLVED=$((RESOLVED + 1))
            log_success "  ✓ Resolved using 'ours' strategy"
          else
            FAILED=$((FAILED + 1))
            log_warning "  ✗ Could not auto-resolve"
          fi
        done
        
        log_info "Auto-resolution summary: $RESOLVED resolved, $FAILED need manual review"
        
        if [ $FAILED -eq 0 ]; then
          git commit -m "feat: merge customizations from $SOURCE_BRANCH (auto-resolved)"
          log_success "All conflicts automatically resolved and committed"
        else
          log_warning "Some conflicts require manual resolution"
          log_warning "Please resolve conflicts in the following files:"
          git diff --name-only --diff-filter=U
          log_info ""
          log_info "After resolving conflicts manually, run:"
          log_info "  git add <resolved-files>"
          log_info "  git commit -m 'feat: merge customizations from $SOURCE_BRANCH'"
          exit 1
        fi
      else
        log_warning "Merge has conflicts. Please resolve manually or run with --auto-resolve flag"
        log_info ""
        log_info "Conflict files:"
        echo "$CONFLICT_FILES"
        log_info ""
        log_info "To resolve conflicts:"
        log_info "  1. Edit the conflicted files"
        log_info "  2. git add <resolved-files>"
        log_info "  3. git commit -m 'feat: merge customizations from $SOURCE_BRANCH'"
        log_info ""
        log_info "Or abort the merge:"
        log_info "  git merge --abort"
        exit 1
      fi
    fi
  fi
else
  log_info "Would merge $SOURCE_BRANCH into $MIGRATION_BRANCH"
fi
echo ""

# Step 4: Run automated migration scripts
log_info "Step 4: Running automated migration scripts..."

if [ "$DRY_RUN" = false ]; then
  # Check if node_modules exists, if not run npm install
  if [ ! -d "node_modules" ]; then
    log_info "Installing dependencies..."
    npm ci --prefer-offline --no-audit
  fi
  
  # Check for global Angular CLI
  log_info "Checking Angular CLI availability..."
  if ! command -v ng &> /dev/null; then
    log_warning "Global Angular CLI (ng command) is not available"
    echo ""
    echo "The local CLI is installed in node_modules, but the global"
    echo "'ng' command will not work after stopping the dev server."
    echo ""
    
    # Extract Angular CLI version from package.json
    if [ -f "package.json" ]; then
      CLI_VERSION=$(grep -oP '"@angular/cli":\s*"\K[^"]+' package.json | sed 's/[^0-9.]//g')
      if [ -n "$CLI_VERSION" ]; then
        echo -e "${BLUE}Required Angular CLI version:${NC} $CLI_VERSION"
        echo ""
        read -p "$(echo -e "${BLUE}Install Angular CLI globally now? (y/n):${NC} ")" install_cli
        
        if [[ "$install_cli" =~ ^[Yy] ]]; then
          log_info "Installing @angular/cli@$CLI_VERSION globally..."
          if npm install -g @angular/cli@$CLI_VERSION; then
            log_success "Angular CLI installed globally"
            ng version 2>/dev/null | head -n 1
          else
            log_error "Failed to install Angular CLI globally"
            log_info "You can install it manually later with:"
            echo -e "  ${BLUE}npm install -g @angular/cli@$CLI_VERSION${NC}"
          fi
        else
          log_info "Skipping global CLI installation"
          log_warning "Remember to install it later to use 'ng' commands:"
          echo -e "  ${BLUE}npm install -g @angular/cli@$CLI_VERSION${NC}"
        fi
      fi
    fi
  else
    log_success "Global Angular CLI is available"
    ng version 2>/dev/null | head -n 1 || true
  fi
  echo ""
  
  # Run linting and auto-fix
  log_info "Running ESLint auto-fix..."
  npm run lint -- --fix 2>&1 || log_warning "Some linting issues could not be auto-fixed"
  
  # Run prettier
  log_info "Running Prettier..."
  npm run format 2>&1 || log_warning "Some formatting issues remain"
  
  # Commit auto-fixes if any
  if ! git diff-index --quiet HEAD --; then
    git add -A
    git commit -m "chore: apply automated code formatting and linting fixes"
    log_success "Auto-fixes committed"
  else
    log_info "No auto-fixes needed"
  fi
else
  log_info "Would run: npm run lint -- --fix"
  log_info "Would run: npm run format"
fi
echo ""

# Step 5: Run build to check for errors
log_info "Step 5: Testing build..."

if [ "$DRY_RUN" = false ]; then
  if npm run build 2>&1 | tee /tmp/build-output.txt; then
    log_success "Build successful!"
  else
    log_error "Build failed. Please check the errors and fix them manually."
    log_info "Build output saved to: /tmp/build-output.txt"
    exit 1
  fi
else
  log_info "Would run: npm run build"
fi
echo ""

# Step 6: Run tests
log_info "Step 6: Running tests..."

if [ "$DRY_RUN" = false ]; then
  if npm test -- --ci --maxWorkers=2 2>&1 | tee /tmp/test-output.txt; then
    log_success "All tests passed!"
  else
    log_warning "Some tests failed. You may need to update them manually."
    log_info "Test output saved to: /tmp/test-output.txt"
  fi
else
  log_info "Would run: npm test -- --ci"
fi
echo ""

# Step 7: Generate migration report
log_info "Step 7: Generating migration report..."

REPORT_FILE="MIGRATION_REPORT_$(date +%Y%m%d_%H%M%S).md"

if [ "$DRY_RUN" = false ]; then
  cat > "$REPORT_FILE" << EOF
# Migration Report

**Date:** $(date +"%Y-%m-%d %H:%M:%S")  
**Source Branch:** $SOURCE_BRANCH  
**Target Branch:** $TARGET_BRANCH  
**Migration Branch:** $MIGRATION_BRANCH

## Summary

This report documents the automated migration of customizations from the source branch to the target branch.

## Files Changed

\`\`\`
$(git diff --name-only "$TARGET_BRANCH" "$MIGRATION_BRANCH" 2>/dev/null || echo "Could not determine changed files")
\`\`\`

## Conflicts Resolved

$(if [ "$AUTO_RESOLVE" = true ]; then echo "Conflicts were automatically resolved"; else echo "No automatic conflict resolution was performed"; fi)

## Next Steps

### 1. Review Changes
Review all changes in the migration branch:
\`\`\`bash
git diff $TARGET_BRANCH..$MIGRATION_BRANCH
\`\`\`

### 2. Manual Adjustments

Based on the migration guide, check for:

- [ ] Control flow syntax (@if, @for instead of *ngIf, *ngFor)
- [ ] Functional guards (replace class-based guards)
- [ ] Standalone components migration
- [ ] FormlyFieldConfig updates (templateOptions -> props)
- [ ] Icon references (Font Awesome -> Bootstrap Icons)
- [ ] Environment configuration changes
- [ ] Route configuration updates

### 3. Update Tests

- [ ] Update component tests with new TestBed configuration
- [ ] Check for deprecated async() usage
- [ ] Update mocking patterns if needed

### 4. Final Verification

\`\`\`bash
# Run full test suite
npm run test

# Run e2e tests
npm run e2e:local

# Check for build issues
npm run build

# Run linting
npm run lint
\`\`\`

### 5. Documentation

- [ ] Update README if customization patterns changed
- [ ] Document any breaking changes
- [ ] Update deployment documentation if needed

## Build Status

$(if [ -f /tmp/build-output.txt ]; then echo "Build output available in /tmp/build-output.txt"; else echo "No build output available"; fi)

## Test Status

$(if [ -f /tmp/test-output.txt ]; then echo "Test output available in /tmp/test-output.txt"; else echo "No test output available"; fi)

## References

- [PWA Migration Guide](docs/guides/migrations.md)
- [Component Patterns](.github/instructions/component-patterns.instructions.md)
- [Testing Patterns](.github/instructions/testing-patterns.instructions.md)

EOF

  log_success "Migration report saved to: $REPORT_FILE"
  cat "$REPORT_FILE"
else
  log_info "Would generate migration report: $REPORT_FILE"
fi
echo ""

# Final summary
log_info "============================================"
log_success "Migration Process Complete!"
log_info "============================================"
echo ""
log_info "Current branch: $(git branch --show-current)"
log_info "Migration report: $REPORT_FILE"
echo ""
log_info "Next steps:"
log_info "  1. Review changes: git diff $TARGET_BRANCH"
log_info "  2. Review migration report: cat $REPORT_FILE"
log_info "  3. Run tests: npm test"
log_info "  4. Choose workflow:"
log_info "     - Test locally: npm run start"
log_info "     - Push to remote: git push -u origin $MIGRATION_BRANCH"
log_info "     - Create patch: git format-patch $TARGET_BRANCH..$MIGRATION_BRANCH"
echo ""
