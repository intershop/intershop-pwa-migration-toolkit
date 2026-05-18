#!/bin/bash
# Synchronizes SCSS variables from reference theme to custom themes
# Usage: ./scripts/sync-custom-theme-variables.sh [theme-name]
#        ./scripts/sync-custom-theme-variables.sh              # Sync all custom themes
#        ./scripts/sync-custom-theme-variables.sh training     # Sync specific theme
#
# This script adds missing variables from b2b theme to custom themes while preserving
# existing custom values. It helps prevent the "build-fix-rebuild" cycle during migration.

set -e

# Resolve project directory (supports --project-dir and PWA_PROJECT_DIR)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_project-dir.sh"
cd "$PROJECT_DIR"

THEMES_DIR="src/styles/themes"
REFERENCE_THEME="b2b"
TARGET_THEME="${1:-}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Verify themes directory exists
if [ ! -d "$THEMES_DIR" ]; then
  echo -e "${RED}❌ Error: Themes directory not found: $THEMES_DIR${NC}"
  exit 1
fi

# Verify reference theme exists
REFERENCE_FILE="$THEMES_DIR/$REFERENCE_THEME/variables.scss"
if [ ! -f "$REFERENCE_FILE" ]; then
  echo -e "${RED}❌ Error: Reference theme not found: $REFERENCE_FILE${NC}"
  exit 1
fi

echo -e "${BLUE}🔧 PWA Theme Variable Synchronizer${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Reference theme: $REFERENCE_THEME"
echo ""

# Determine which themes to sync
STANDARD_THEMES=("b2b" "b2c")
THEMES_TO_SYNC=()

if [ -n "$TARGET_THEME" ]; then
  # Specific theme requested
  if [ ! -d "$THEMES_DIR/$TARGET_THEME" ]; then
    echo -e "${RED}❌ Error: Theme not found: $TARGET_THEME${NC}"
    exit 1
  fi
  
  # Don't sync standard themes
  is_standard=false
  for std in "${STANDARD_THEMES[@]}"; do
    if [ "$TARGET_THEME" = "$std" ]; then
      is_standard=true
      break
    fi
  done
  
  if [ "$is_standard" = true ]; then
    echo -e "${YELLOW}⚠️  $TARGET_THEME is a standard theme - sync not needed${NC}"
    exit 0
  fi
  
  THEMES_TO_SYNC+=("$TARGET_THEME")
else
  # Find all custom themes
  for theme_dir in "$THEMES_DIR"/*; do
    if [ -d "$theme_dir" ]; then
      theme_name=$(basename "$theme_dir")
      
      # Skip standard themes
      is_standard=false
      for std in "${STANDARD_THEMES[@]}"; do
        if [ "$theme_name" = "$std" ]; then
          is_standard=true
          break
        fi
      done
      
      if [ "$is_standard" = false ]; then
        THEMES_TO_SYNC+=("$theme_name")
      fi
    fi
  done
fi

if [ ${#THEMES_TO_SYNC[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ No custom themes to sync${NC}"
  exit 0
fi

echo -e "${BLUE}Themes to sync:${NC}"
for theme in "${THEMES_TO_SYNC[@]}"; do
  echo "  - $theme"
done
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Extract all variables from reference theme
# This creates a temporary file with just the variable definitions
TEMP_REF_VARS=$(mktemp)
grep '^\$' "$REFERENCE_FILE" > "$TEMP_REF_VARS"

# Extract variable names only (for checking existence)
REFERENCE_VAR_NAMES=$(grep -o '^\$[a-zA-Z0-9_-]*' "$REFERENCE_FILE" | sort -u)

# Check for required Sass imports
REQUIRED_IMPORTS=("@use 'sass:color';" "@use 'sass:map';")

# Process each theme
for theme in "${THEMES_TO_SYNC[@]}"; do
  THEME_FILE="$THEMES_DIR/$theme/variables.scss"
  
  if [ ! -f "$THEME_FILE" ]; then
    echo -e "${RED}❌ ERROR: Theme file not found: $THEME_FILE${NC}"
    EXIT_CODE=1
    continue
  fi
  
  echo -e "${YELLOW}Processing: $theme${NC}"
  
  # Create backup
  BACKUP_FILE="${THEME_FILE}.backup-$(date +%Y%m%d-%H%M%S)"
  cp "$THEME_FILE" "$BACKUP_FILE"
  echo "  Backup created: $BACKUP_FILE"
  
  # Track changes
  ADDED_IMPORTS=0
  ADDED_VARS=0
  MISSING_VARS=()
  
  # Check and add missing Sass imports at the top
  for import in "${REQUIRED_IMPORTS[@]}"; do
    if ! grep -qF "$import" "$THEME_FILE"; then
      MISSING_VARS+=("IMPORT: $import")
      ADDED_IMPORTS=$((ADDED_IMPORTS + 1))
      
      # Add import at the beginning (after any existing imports)
      if grep -q '@use' "$THEME_FILE"; then
        # Add after last @use statement
        sed -i "0,/@use.*$/s@@&\n$import@" "$THEME_FILE"
      else
        # Add as first line
        sed -i "1i$import" "$THEME_FILE"
      fi
    fi
  done
  
  # Check each variable from reference theme
  while IFS= read -r var_name; do
    if ! grep -q "^${var_name}" "$THEME_FILE"; then
      MISSING_VARS+=("$var_name")
      
      # Extract full variable definition from reference
      var_definition=$(grep "^${var_name}" "$REFERENCE_FILE" | head -1)
      
      # Append to theme file with comment
      if [ $ADDED_VARS -eq 0 ]; then
        # First variable - add section header
        echo "" >> "$THEME_FILE"
        echo "// Variables auto-synced from $REFERENCE_THEME theme ($(date +%Y-%m-%d))" >> "$THEME_FILE"
      fi
      
      echo "$var_definition" >> "$THEME_FILE"
      ADDED_VARS=$((ADDED_VARS + 1))
    fi
  done <<< "$REFERENCE_VAR_NAMES"
  
  # Report results
  if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "  ${YELLOW}⚠️  Found ${#MISSING_VARS[@]} missing items${NC}"
    EXIT_CODE=1  # Indicate changes were made
    
    if [ $ADDED_IMPORTS -gt 0 ]; then
      echo -e "  ${GREEN}✓ Added $ADDED_IMPORTS Sass imports${NC}"
    fi
    
    if [ $ADDED_VARS -gt 0 ]; then
      echo -e "  ${GREEN}✓ Added $ADDED_VARS variables${NC}"
    fi
    
    # Show first few missing items
    echo ""
    echo "  Missing items (showing first 10):"
    for var in "${MISSING_VARS[@]:0:10}"; do
      if [[ "$var" == IMPORT:* ]]; then
        echo -e "    ${YELLOW}[IMPORT]${NC} ${var#IMPORT: }"
      else
        echo "    $var"
      fi
    done
    
    if [ ${#MISSING_VARS[@]} -gt 10 ]; then
      echo "    ... and $((${#MISSING_VARS[@]} - 10)) more"
    fi
    
    echo ""
    echo -e "  ${BLUE}📝 Action required:${NC}"
    echo "     1. Review auto-added variables in $THEME_FILE"
    echo "     2. Adjust values for your theme's color scheme"
    echo "     3. Run validation: ./scripts/validate-theme-completeness.sh"
    echo ""
    
  else
    echo -e "  ${GREEN}✅ Theme is already complete${NC}"
    # Remove backup if no changes
    rm "$BACKUP_FILE"
  fi
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
done

# Cleanup
rm "$TEMP_REF_VARS"

# Final summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📊 Sync Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ All themes synchronized successfully${NC}"
else
  echo -e "${YELLOW}⚠️  Some themes were updated${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Review changes in each theme file"
  echo "  2. Customize variable values for your brand"
  echo "  3. Run validation:"
  echo "     ./scripts/validate-theme-completeness.sh"
  echo "  4. Test build:"
  echo "     npm run build"
fi

echo ""
exit $EXIT_CODE
