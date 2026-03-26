#!/bin/bash

# Verification script: Check that all toolkit files are properly ignored
# Run this in your custom PWA project after copying toolkit files and adding .gitignore patterns

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Verifying .gitignore coverage for PWA Migration Toolkit${NC}"
echo ""

ERRORS=0
WARNINGS=0

# Function to check if files are ignored
check_ignored() {
    local pattern="$1"
    local description="$2"
    local count="$3"
    
    # Find matching files
    local files=$(find . -path "./$pattern" 2>/dev/null | head -n 5)
    
    if [ -z "$files" ]; then
        echo -e "${YELLOW}⚠️  $description: No files found${NC}"
        ((WARNINGS++))
        return
    fi
    
    # Check if they're ignored
    local ignored=true
    for file in $files; do
        if git check-ignore -q "$file" 2>/dev/null; then
            :  # File is ignored, good
        else
            ignored=false
            echo -e "${RED}❌ $description: $file is NOT ignored${NC}"
            ((ERRORS++))
        fi
    done
    
    if [ "$ignored" = true ]; then
        echo -e "${GREEN}✅ $description: Properly ignored ($count files)${NC}"
    fi
}

# Check each category
echo "Checking toolkit files..."
echo ""

check_ignored ".github/instructions/migration-*.instructions.md" "Migration instructions" "9"
check_ignored ".github/skills/pwa-*.SKILL.md" "PWA skills" "2"
check_ignored ".github/skills/README.md" "Skills README" "1"
check_ignored "scripts/migrate-*.sh" "Migration shell scripts" "2"
check_ignored "scripts/migrate-*.js" "Migration JS scripts" "1"
check_ignored "scripts/check-*.sh" "Check scripts" "5"
check_ignored "scripts/*-migration-*.js" "Other migration scripts" "1"
check_ignored "scripts/analyze-*.sh" "Analysis scripts" "1"
check_ignored "scripts/detect-*.js" "Detection scripts" "1"
check_ignored "scripts/generate-*.sh" "Report generation scripts" "1"
check_ignored "scripts/merge-*.sh" "Merge shell scripts" "1"
check_ignored "scripts/merge-*.js" "Merge JS scripts" "1"
check_ignored "scripts/compare-*.js" "Comparison scripts" "1"
check_ignored "scripts/fix-*.js" "Fix scripts" "2"
check_ignored "scripts/sync-*.sh" "Sync scripts" "1"
check_ignored "scripts/update-*.sh" "Update scripts" "2"
check_ignored "scripts/validate-*.sh" "Validation scripts" "1"
check_ignored "scripts/pre-commit-*.sh" "Pre-commit scripts" "1"
check_ignored "data/pattern-migrations.json" "Pattern database" "1"
check_ignored "docs/guides/migration-*.md" "Migration guides" "1"
check_ignored "docs/guides/customization-*.md" "Customization guides" "1"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ Success! All toolkit files are properly ignored.${NC}"
    echo ""
    echo "Your custom PWA repository is clean - toolkit files won't be committed."
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Verification complete with $WARNINGS warnings.${NC}"
    echo ""
    echo "Some toolkit files weren't found - this is OK if you haven't copied them yet."
    exit 0
else
    echo -e "${RED}❌ Verification failed! $ERRORS toolkit files are NOT ignored.${NC}"
    echo ""
    echo "Fix this by adding the .gitignore patterns:"
    echo "  cat .gitignore-toolkit-template >> .gitignore"
    exit 1
fi
