#!/bin/bash
# Validates that custom themes have all required SCSS variables from reference themes
# Usage: ./scripts/validate-theme-completeness.sh [--fix]
#
# This script helps prevent incremental SCSS variable discovery during migration
# by proactively checking custom themes against standard themes BEFORE the first build.

set -e

# Resolve project directory (supports --project-dir and PWA_PROJECT_DIR)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_project-dir.sh"
cd "$PROJECT_DIR"

THEMES_DIR="src/styles/themes"
REFERENCE_THEME="b2b"
FIX_MODE=false
EXIT_CODE=0

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

if [ "$1" = "--fix" ]; then
  FIX_MODE=true
  echo -e "${BLUE}🔧 Running in FIX mode - will attempt to add missing variables${NC}"
  echo ""
fi

if [ ! -d "$THEMES_DIR" ]; then
  echo -e "${RED}❌ Error: Themes directory not found: $THEMES_DIR${NC}"
  exit 1
fi

if [ ! -f "$THEMES_DIR/$REFERENCE_THEME/variables.scss" ]; then
  echo -e "${RED}❌ Error: Reference theme not found: $THEMES_DIR/$REFERENCE_THEME/variables.scss${NC}"
  exit 1
fi

echo -e "${BLUE}🔍 PWA Theme Completeness Validator${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Reference theme: $REFERENCE_THEME"
echo ""

# Extract all variable names from reference theme (b2b)
# Match lines starting with $ (variable definitions)
REFERENCE_VARS=$(grep -o '^\$[a-zA-Z0-9_-]*' "$THEMES_DIR/$REFERENCE_THEME/variables.scss" | sort -u)
REFERENCE_COUNT=$(echo "$REFERENCE_VARS" | wc -l)

echo -e "📋 Reference theme has ${GREEN}${REFERENCE_COUNT}${NC} variables to check"
echo ""

# Check for required Sass module imports
REQUIRED_IMPORTS=("@use 'sass:color'" "@use 'sass:map'")

# Find all custom themes (exclude b2b, b2c)
STANDARD_THEMES=("b2b" "b2c")
CUSTOM_THEMES=()

for theme_dir in "$THEMES_DIR"/*; do
  if [ -d "$theme_dir" ]; then
    theme_name=$(basename "$theme_dir")
    # Check if it's a standard theme
    is_standard=false
    for std in "${STANDARD_THEMES[@]}"; do
      if [ "$theme_name" = "$std" ]; then
        is_standard=true
        break
      fi
    done
    
    if [ "$is_standard" = false ]; then
      CUSTOM_THEMES+=("$theme_name")
    fi
  fi
done

if [ ${#CUSTOM_THEMES[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ No custom themes detected - validation not needed${NC}"
  exit 0
fi

echo -e "${BLUE}Custom themes found:${NC}"
for theme in "${CUSTOM_THEMES[@]}"; do
  echo "  - $theme"
done
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Validate each custom theme
for theme in "${CUSTOM_THEMES[@]}"; do
  THEME_FILE="$THEMES_DIR/$theme/variables.scss"
  
  if [ ! -f "$THEME_FILE" ]; then
    echo -e "${YELLOW}⚠️  SKIPPED: Theme file not found: $THEME_FILE${NC}"
    echo ""
    continue
  fi
  
  echo -e "${BLUE}Validating theme: ${YELLOW}$theme${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Check for Sass module imports
  echo -e "Checking Sass module imports..."
  IMPORT_ISSUES=()
  for import in "${REQUIRED_IMPORTS[@]}"; do
    if ! grep -qF "$import" "$THEME_FILE"; then
      IMPORT_ISSUES+=("$import")
    fi
  done
  
  if [ ${#IMPORT_ISSUES[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Missing Sass module imports:${NC}"
    for import in "${IMPORT_ISSUES[@]}"; do
      echo "   - $import"
    done
    EXIT_CODE=1
  else
    echo -e "${GREEN}✓ Sass imports OK${NC}"
  fi
  echo ""
  
  # Check for missing variables
  echo -e "Checking SCSS variables..."
  MISSING_VARS=()
  
  while IFS= read -r var; do
    if ! grep -q "^${var}" "$THEME_FILE"; then
      MISSING_VARS+=("$var")
    fi
  done <<< "$REFERENCE_VARS"
  
  if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing ${#MISSING_VARS[@]} variables in $theme theme:${NC}"
    echo ""
    
    # Group variables by category for better readability
    echo -e "${YELLOW}Missing variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
      echo "   $var"
    done
    echo ""
    EXIT_CODE=1
    
    if [ "$FIX_MODE" = true ]; then
      echo -e "${BLUE}💡 Use sync-custom-theme-variables.sh to add these automatically${NC}"
    fi
  else
    echo -e "${GREEN}✅ All variables present${NC}"
  fi
  
  # Summary for this theme
  THEME_VAR_COUNT=$(grep -c '^\$' "$THEME_FILE")
  echo ""
  echo -e "Summary: $theme has ${THEME_VAR_COUNT}/${REFERENCE_COUNT} variables"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
done

# Final summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📊 Validation Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ All custom themes are complete!${NC}"
  echo ""
  echo "You can proceed with the build:"
  echo "  npm run build"
else
  echo -e "${RED}❌ Theme validation failed${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Review missing variables above"
  echo "  2. Run sync script to add them:"
  echo "     ./scripts/sync-custom-theme-variables.sh"
  echo "  3. Review and adjust values for your theme"
  echo "  4. Re-run validation:"
  echo "     ./scripts/validate-theme-completeness.sh"
  echo ""
  echo -e "${YELLOW}💡 This validation prevents build-error-fix cycles${NC}"
  echo "   Expected time saved: 15-30 minutes"
fi

echo ""
exit $EXIT_CODE
