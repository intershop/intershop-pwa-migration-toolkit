#!/bin/bash
# Pre-Commit Customization Check
#
# This hook checks for customization anti-patterns before allowing commits.
# It helps maintain migration-friendly code by catching common issues early.
#
# Install:
#   cp scripts/pre-commit-customization-check.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
#
# Or with husky:
#   Add to .husky/pre-commit

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}🔍 Running customization checks...${NC}"
echo ""

# Flag to track if we should block the commit
BLOCK_COMMIT=false
WARNINGS=0

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  echo -e "${GREEN}✅ No files to check${NC}"
  exit 0
fi

# Define core Intershop directories (should not be modified without markers)
CORE_PATHS=(
  "src/app/core/"
  "src/app/shared/components/"
  "src/app/shared/forms/"
  "src/app/pages/"
  "src/styles/global"
)

# Exclude paths (these are OK to modify)
EXCLUDE_PATHS=(
  "src/app/custom/"
  "src/app/extensions/"
  "src/styles/themes/"
  ".spec.ts"
  ".md"
)

# Function to check if file is in core paths
is_core_file() {
  local file=$1
  
  for exclude in "${EXCLUDE_PATHS[@]}"; do
    if [[ "$file" == *"$exclude"* ]]; then
      return 1  # Not a core file (excluded)
    fi
  done
  
  for core_path in "${CORE_PATHS[@]}"; do
    if [[ "$file" == *"$core_path"* ]]; then
      return 0  # Is a core file
    fi
  done
  
  return 1  # Not a core file
}

# Function to check if file has CUSTOMIZATION markers
has_customization_markers() {
  local file=$1
  
  if [ ! -f "$file" ]; then
    return 1
  fi
  
  # Check for CUSTOMIZATION markers in the diff
  if git diff --cached "$file" | grep -qi "CUSTOMIZATION"; then
    return 0
  fi
  
  # Check if file already has CUSTOMIZATION markers (even if not in this commit)
  if grep -qi "CUSTOMIZATION" "$file"; then
    return 0
  fi
  
  return 1
}

# Function to check for deleted standard files
check_deleted_files() {
  local deleted_files=$(git diff --cached --name-only --diff-filter=D | grep -E '\.(ts|html|scss)$' || true)
  
  if [ -n "$deleted_files" ]; then
    echo -e "${YELLOW}⚠️  Warning: Standard files deleted${NC}"
    echo ""
    echo "$deleted_files" | while read file; do
      if is_core_file "$file"; then
        echo -e "  ${RED}✗${NC} $file"
        echo -e "    ${CYAN}Consider:${NC} Comment out instead of deleting"
      fi
    done
    echo ""
    WARNINGS=$((WARNINGS + 1))
  fi
}

# Function to check for renamed files without copying
check_renamed_files() {
  local renamed=$(git diff --cached --name-status --diff-filter=R | grep -E '\.(ts|html|scss)$' || true)
  
  if [ -n "$renamed" ]; then
    echo -e "${YELLOW}⚠️  Warning: Files renamed${NC}"
    echo ""
    echo "$renamed" | while read status old new; do
      if is_core_file "$old"; then
        echo -e "  ${YELLOW}⚠${NC} $old → $new"
        echo -e "    ${CYAN}Consider:${NC} Copy instead of rename (keep original for merges)"
      fi
    done
    echo ""
    WARNINGS=$((WARNINGS + 1))
  fi
}

# Function to check for ish- prefix in custom components
check_custom_prefixes() {
  local new_components=$(git diff --cached --name-only --diff-filter=A | grep 'custom.*\.component\.ts$' || true)
  
  for file in $new_components; do
    if [ -f "$file" ]; then
      # Check selector
      local selector=$(grep -o "selector: '[^']*'" "$file" | head -1 || true)
      
      if echo "$selector" | grep -q "selector: 'ish-"; then
        if [ "$WARNINGS" -eq 0 ]; then
          echo -e "${YELLOW}⚠️  Warning: Naming convention issues${NC}"
          echo ""
        fi
        echo -e "  ${YELLOW}⚠${NC} $file"
        echo -e "    Uses 'ish-' prefix: $selector"
        echo -e "    ${CYAN}Consider:${NC} Use 'custom-' or your company prefix"
        echo ""
        WARNINGS=$((WARNINGS + 1))
      fi
    fi
  done
}

# Main check: Core files without CUSTOMIZATION markers
echo -e "${BLUE}Checking core file modifications...${NC}"

CORE_FILES_MODIFIED=()

for file in $STAGED_FILES; do
  # Skip deleted files (checked separately)
  if [ ! -f "$file" ]; then
    continue
  fi
  
  if is_core_file "$file"; then
    # This is a core file being modified
    if ! has_customization_markers "$file"; then
      CORE_FILES_MODIFIED+=("$file")
    fi
  fi
done

if [ ${#CORE_FILES_MODIFIED[@]} -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}⚠️  Warning: Core Intershop files modified without CUSTOMIZATION markers${NC}"
  echo ""
  
  for file in "${CORE_FILES_MODIFIED[@]}"; do
    echo -e "  ${YELLOW}⚠${NC} $file"
  done
  
  echo ""
  echo -e "${CYAN}Recommendation:${NC}"
  echo "  1. Add // CUSTOMIZATION: <reason> comments to your changes"
  echo "  2. Or use theme overrides (.mytheme.html suffix)"
  echo "  3. Or copy to custom/ folder with custom- prefix"
  echo ""
  echo "Example:"
  echo -e "  ${GREEN}// CUSTOMIZATION: Added custom validation for B2B users${NC}"
  echo -e "  ${GREEN}if (this.isB2BUser()) { ... }${NC}"
  echo ""
  
  WARNINGS=$((WARNINGS + 1))
fi

# Run additional checks
check_deleted_files
check_renamed_files
check_custom_prefixes

# Check for modifications to global styles
GLOBAL_STYLES=$(echo "$STAGED_FILES" | grep "src/styles/global" | grep -v "themes/" || true)
if [ -n "$GLOBAL_STYLES" ]; then
  echo -e "${RED}❌ Error: Global styles modified${NC}"
  echo ""
  echo "$GLOBAL_STYLES" | while read file; do
    echo -e "  ${RED}✗${NC} $file"
  done
  echo ""
  echo -e "${CYAN}Solution:${NC} Override in your theme folder instead:"
  echo "  src/styles/themes/mytheme/custom-overrides.scss"
  echo ""
  BLOCK_COMMIT=true
fi

# Check for package-lock.json manual modifications
if echo "$STAGED_FILES" | grep -q "package-lock.json"; then
  # Check if package.json also changed
  if ! echo "$STAGED_FILES" | grep -q "package.json"; then
    echo -e "${YELLOW}⚠️  Warning: package-lock.json modified without package.json change${NC}"
    echo ""
    echo "  This usually indicates manual editing of package-lock.json"
    echo ""
    echo -e "${CYAN}Recommendation:${NC}"
    echo "  1. Only modify package.json directly"
    echo "  2. Run 'npm install' to update package-lock.json"
    echo "  3. During migration: accept Intershop's package-lock.json"
    echo ""
    WARNINGS=$((WARNINGS + 1))
  fi
fi

# Summary
echo ""
echo -e "${BLUE}================================${NC}"

if [ "$BLOCK_COMMIT" = true ]; then
  echo -e "${RED}❌ Commit blocked${NC}"
  echo ""
  echo "Critical issues found that will cause migration problems."
  echo "Please fix the issues above before committing."
  echo ""
  echo "To bypass this check (not recommended):"
  echo "  git commit --no-verify"
  echo ""
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found${NC}"
  echo ""
  echo "Customizations detected that may complicate future migrations."
  echo "Review the warnings above and consider following best practices."
  echo ""
  echo "See: docs/guides/customization-best-practices.md"
  echo ""
  
  # Ask for confirmation in interactive mode
  if [ -t 0 ]; then
    read -p "Continue with commit? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Commit cancelled."
      exit 1
    fi
  else
    # Non-interactive (CI/CD) - allow with warnings
    echo "Non-interactive mode: Proceeding with warnings"
  fi
  
  echo -e "${GREEN}✅ Proceeding with commit${NC}"
  exit 0
else
  echo -e "${GREEN}✅ All checks passed${NC}"
  echo ""
  echo "No customization issues detected."
  echo "Your code follows migration-friendly practices."
  exit 0
fi
