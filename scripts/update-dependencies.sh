#!/bin/bash
# PWA Dependency Update Workflow
#
# Interactive script that guides through the 8-step dependency update process
# Based on: https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/updating-pwa.md
#
# This script helps maintain dependencies current while avoiding breaking changes
#
# Usage:
#   ./scripts/update-dependencies.sh
#   ./scripts/update-dependencies.sh --auto  # Skip prompts (for CI/CD)

set -e

# Resolve project directory (supports --project-dir and PWA_PROJECT_DIR)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_project-dir.sh"
cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Parse arguments
AUTO_MODE=false
if [ "$1" == "--auto" ]; then
  AUTO_MODE=true
fi

# Helper function to wait for user
wait_for_user() {
  if [ "$AUTO_MODE" != "true" ]; then
    echo ""
    read -p "Press Enter to continue..."
    echo ""
  fi
}

# Helper function to ask yes/no
ask_yes_no() {
  if [ "$AUTO_MODE" == "true" ]; then
    return 0  # Auto-accept in auto mode
  fi
  
  local prompt="$1"
  local response
  read -p "$prompt (y/N): " response
  case "$response" in
    [yY][eE][sS]|[yY]) 
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

echo ""
echo "=========================================================="
echo "  PWA Dependency Update Workflow"
echo "=========================================================="
echo ""
echo -e "${BLUE}Based on official Intershop PWA Updating Guide${NC}"
echo "  https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/updating-pwa.md"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "  - This workflow is for PWA ${BOLD}development${NC}, not customer projects"
echo "  - Customer projects should consume PWA updates via migration"
echo "  - Create commits after each step for better tracking"
echo "  - Run 'npm run check' frequently to ensure consistency"
echo ""

if ! ask_yes_no "Ready to start dependency update workflow?"; then
  echo "Update cancelled."
  exit 0
fi

# Store original directory
ORIGINAL_DIR=$(pwd)

# Verify we're in a PWA project
if [ ! -f "package.json" ] || ! grep -q "intershop-pwa\|@angular/core" package.json; then
  echo -e "${RED}❌ Error: Not in a PWA project directory${NC}"
  echo "   package.json not found or doesn't look like a PWA project"
  exit 1
fi

# Create update branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ -n "$CURRENT_BRANCH" ]; then
  echo -e "${BLUE}📍 Current branch:${NC} $CURRENT_BRANCH"
  
  if ask_yes_no "Create new branch for updates? (recommended)"; then
    UPDATE_BRANCH="update/dependencies-$(date +%Y%m%d)"
    git checkout -b "$UPDATE_BRANCH"
    echo -e "${GREEN}✅ Created branch:${NC} $UPDATE_BRANCH"
  fi
fi

echo ""
echo "=========================================================="
echo "  Step 0: Pre-Update Checks"
echo "=========================================================="
echo ""

# Check Node.js version
CURRENT_NODE=$(node --version | sed 's/v//')
echo -e "${BLUE}Current Node.js:${NC} $CURRENT_NODE"

# Check Angular version
CURRENT_ANGULAR=$(grep '"@angular/core"' package.json | sed 's/.*: "\\^\\?\\([0-9]*\\).*/\\1/')
echo -e "${BLUE}Current Angular:${NC} $CURRENT_ANGULAR"
echo ""

# Check for compatibility issues
echo "Checking for known incompatibilities..."
echo ""

# Angular compatibility check
if [ "$CURRENT_ANGULAR" == "16" ]; then
  echo -e "${YELLOW}⚠️  Note:${NC} Angular 16 officially supports Node.js up to 18"
  echo "   However, Node.js 22 is used by PWA for development"
fi

wait_for_user

echo "=========================================================="
echo "  Step 1: Check for Angular Updates"
echo "=========================================================="
echo ""
echo "Running: ng update"
echo ""

ng update || true

echo ""
echo -e "${BLUE}ℹ️  Review the output above for available Angular updates${NC}"
echo ""

wait_for_user

echo "=========================================================="
echo "  Step 2: Update Angular Dependencies"
echo "=========================================================="
echo ""
echo -e "${YELLOW}This will update @angular/cli and @angular/core${NC}"
echo "The -C flag creates commits for each update (recommended)"
echo ""

if ask_yes_no "Update Angular now?"; then
  echo ""
  echo "Running: ng update @angular/cli @angular/core -C"
  echo ""
  
  ng update @angular/cli @angular/core -C || {
    echo ""
    echo -e "${RED}❌ Angular update failed${NC}"
    echo "Review errors above and fix before continuing"
    exit 1
  }
  
  echo ""
  echo -e "${GREEN}✅ Angular updated successfully${NC}"
  
  # Quick verification
  echo ""
  echo "Running quick check..."
  npm run build 2>&1 | head -20 || true
else
  echo "Skipping Angular update"
fi

echo ""
wait_for_user

echo "=========================================================="
echo "  Step 3: Check Third-Party Dependencies"
echo "=========================================================="
echo ""
echo "Checking for outdated packages..."
echo ""

npm outdated --long || true

echo ""
echo -e "${BLUE}ℹ️  Package Categories:${NC}"
echo "  - ${BOLD}Production dependencies${NC} (dependencies): Used in running PWA"
echo "  - ${BOLD}Development dependencies${NC} (devDependencies): Build tools, testing"
echo "  - ${BOLD}@types/*${NC}: TypeScript type definitions"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "  - @types/node should stay on LTS version (currently 22)"
echo "  - Update one category at a time"
echo "  - Test after each major update"
echo ""

if ask_yes_no "Update third-party dependencies interactively?"; then
  echo ""
  echo "Update recommendations:"
  echo "  1. Security-critical packages first"
  echo "  2. Major version updates one at a time"
  echo "  3. Test between updates"
  echo ""
  echo "To update a specific package:"
  echo "  ng update <package-name>          (for Angular-related)"
  echo "  npm install <package-name>@latest (for others)"
  echo ""
  echo -e "${CYAN}When done, press Enter to continue...${NC}"
  read
else
  echo "Skipping third-party updates (you can do this manually later)"
fi

echo ""
wait_for_user

echo "=========================================================="
echo "  Step 4: Check for Unused Dependencies"
echo "=========================================================="
echo ""
echo "Sometimes dependencies become obsolete after updates."
echo "Use 'npm ls <package>' to check if a package is still needed."
echo ""

echo -e "${BLUE}Current dependencies:${NC}"
npm ls --depth=0 2>/dev/null | grep -v "^[└├]" | head -20 || true
echo "  ... (showing first 20)"
echo ""

if ask_yes_no "Review dependencies for removal?"; then
  echo ""
  echo "To check if a package is used:"
  echo "  npm ls <package-name>"
  echo ""
  echo "To remove:"
  echo "  npm uninstall <package-name>"
  echo ""
  echo -e "${CYAN}Review and remove unused packages, then press Enter...${NC}"
  read
else
  echo "Skipping dependency cleanup"
fi

echo ""
wait_for_user

echo "=========================================================="
echo "  Step 5: Update Formatting Tools"
echo "=========================================================="
echo ""
echo -e "${YELLOW}Prettier and ESLint updates may change code formatting${NC}"
echo ""

if ask_yes_no "Update prettier and eslint?"; then
  echo ""
  echo "Updating formatting tools..."
  
  # Check current versions
  PRETTIER_VERSION=$(npm list prettier --depth=0 2>/dev/null | grep prettier | sed 's/.*@//' || echo "not installed")
  ESLINT_VERSION=$(npm list eslint --depth=0 2>/dev/null | grep eslint | sed 's/.*@//' || echo "not installed")
  
  echo "Current versions:"
  echo "  prettier: $PRETTIER_VERSION"
  echo "  eslint: $ESLINT_VERSION"
  echo ""
  
  # Update (if they exist)
  if [ "$PRETTIER_VERSION" != "not installed" ]; then
    npm install prettier@latest --save-dev
  fi
  
  if [ "$ESLINT_VERSION" != "not installed" ]; then
    npm install eslint@latest --save-dev
  fi
  
  echo ""
  echo -e "${GREEN}✅ Formatting tools updated${NC}"
  echo ""
  echo -e "${YELLOW}⚠️  Important:${NC} Run 'npm run format' to apply new formatting"
  echo "   Commit formatting changes separately from updates"
  
  if ask_yes_no "Run formatting now?"; then
    echo ""
    npm run format || {
      echo -e "${YELLOW}⚠️  Formatting script not found or failed${NC}"
    }
  fi
else
  echo "Skipping formatting tools update"
fi

echo ""
wait_for_user

echo "=========================================================="
echo "  Step 6: Apply Refactoring and Deprecations"
echo "=========================================================="
echo ""
echo "After updates, some code may use deprecated APIs."
echo ""
echo "Common deprecations to address:"
echo "  - Angular: async test helper → async/await"
echo "  - RxJS: .toPromise() → firstValueFrom/lastValueFrom"
echo "  - Angular: TestBed.get() → TestBed.inject()"
echo ""

if ask_yes_no "Search for common deprecations?"; then
  echo ""
  echo -e "${BLUE}Searching for deprecated patterns...${NC}"
  echo ""
  
  # TestBed.get
  TESTBED_GET=$(grep -r "TestBed\.get" src/ --include="*.spec.ts" 2>/dev/null | wc -l || echo "0")
  if [ "$TESTBED_GET" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $TESTBED_GET usages of deprecated TestBed.get()${NC}"
    echo "   Replace with: TestBed.inject()"
  fi
  
  # toPromise
  TO_PROMISE=$(grep -r "\.toPromise()" src/ --include="*.ts" 2>/dev/null | wc -l || echo "0")
  if [ "$TO_PROMISE" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $TO_PROMISE usages of deprecated .toPromise()${NC}"
    echo "   Replace with: firstValueFrom() or lastValueFrom()"
  fi
  
  # async helper
  ASYNC_HELPER=$(grep -r "import.*async.*@angular/core/testing" src/ --include="*.spec.ts" 2>/dev/null | wc -l || echo "0")
  if [ "$ASYNC_HELPER" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $ASYNC_HELPER usages of deprecated async helper${NC}"
    echo "   Replace with: native async/await"
  fi
  
  echo ""
  echo "Review and fix deprecations, then continue..."
  wait_for_user
else
  echo "Skipping deprecation search"
fi

echo ""
wait_for_user

echo "=========================================================="
echo "  Step 7: Clean Install and Verification"
echo "=========================================================="
echo ""
echo -e "${YELLOW}Regenerating package-lock.json with clean install${NC}"
echo "This ensures lock file consistency"
echo ""

if ask_yes_no "Perform clean install?"; then
  echo ""
  echo "Removing node_modules and package-lock.json..."
  rm -rf node_modules package-lock.json
  
  echo "Running: npm install"
  npm install
  
  echo ""
  echo -e "${GREEN}✅ Clean install complete${NC}"
else
  echo "Skipping clean install"
fi

echo ""
echo "Running verification checks..."
echo ""

# Build check
echo -e "${BLUE}1/4 Build check...${NC}"
if npm run build >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Build successful${NC}"
else
  echo -e "${RED}❌ Build failed${NC}"
  echo "   Run 'npm run build' to see errors"
  BUILD_FAILED=true
fi

# Lint check
echo -e "${BLUE}2/4 Lint check...${NC}"
if npm run lint >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Lint passed${NC}"
else
  echo -e "${YELLOW}⚠️  Lint issues found${NC}"
  echo "   Run 'npm run lint' to see issues"
fi

# Test check
echo -e "${BLUE}3/4 Test check...${NC}"
if npm test -- --passWithNoTests >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Tests passed${NC}"
else
  echo -e "${YELLOW}⚠️  Test issues found${NC}"
  echo  "   Run 'npm test' to see failures"
fi

# Type check
echo -e "${BLUE}4/4 Type check...${NC}"
if npm run check >/dev/null 2>&1; then
  echo -e "${GREEN}✅ All checks passed${NC}"
else
  echo -e "${YELLOW}⚠️  Some checks failed${NC}"
  echo "   Run 'npm run check' for details"
fi

echo ""
wait_for_user

echo "=========================================================="
echo "  Step 8: Documentation and Next Steps"
echo "=========================================================="
echo ""

echo -e "${BLUE}📝 Recommended commit structure:${NC}"
echo ""
echo "  1. chore: update Angular to vX.Y"
echo "  2. chore: update dependencies (major/minor/patch)"
echo "  3. refactor: apply new formatting rules"
echo "  4. refactor: replace deprecated APIs"
echo "  5. chore: regenerate package-lock.json"
echo ""

if [ "$BUILD_FAILED" == "true" ]; then
  echo -e "${RED}⚠️  Build is failing - fix errors before continuing${NC}"
  echo ""
fi

echo -e "${BLUE}📋 Create migration notes:${NC}"
echo ""
echo "Document in CHANGELOG.md or migration notes:"
echo "  - Angular version change"
echo "  - Breaking changes in dependencies"
echo "  - New features introduced"
echo "  - Deprecations addressed"
echo ""

echo "=========================================================="
echo "  Update Workflow Complete"
echo "=========================================================="
echo ""
echo -e "${GREEN}✅ Dependency update workflow finished${NC}"
echo ""
echo "Next steps:"
echo "  1. Review all changes: git diff"
echo "  2. Test application manually: npm start"
echo "  3. Run full check: npm run check"
echo "  4. Commit changes with descriptive messages"
echo "  5. Document breaking changes in CHANGELOG.md"
echo "  6. Create PR/MR for review"
echo ""
echo "For detailed guidance, see:"
echo "  https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/updating-pwa.md"
echo ""
