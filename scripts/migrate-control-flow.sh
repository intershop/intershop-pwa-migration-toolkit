#!/bin/bash

# PWA 10.0 Migration: Angular Control Flow Syntax Migration
# Converts *ngIf, *ngFor, *ngSwitch to @if, @for, @switch using Angular CLI schematics
#
# IMPORTANT: The Angular CLI schematic has limitations:
#   • Only processes components registered in angular.json
#   • May skip custom theme templates or components outside standard paths
#   • Complex template expressions might require manual migration
#   • Extension templates in non-standard locations need manual review
#
# This script searches src/ and projects/ directories and reports any unmigrated files.
# You'll need to manually migrate files that the schematic couldn't process.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}${BLUE}🔄 Angular 17 Control Flow Migration${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if Angular CLI is available
if ! command -v ng &> /dev/null; then
    echo -e "${RED}❌ Angular CLI not found${NC}"
    echo -e "${YELLOW}Install it with: npm install -g @angular/cli${NC}"
    exit 1
fi

# Check Angular version
ANGULAR_VERSION=$(grep -o '"@angular/core"[^"]*"[^"]*"' package.json | grep -o '[0-9]*' | head -1)
if [ "$ANGULAR_VERSION" -lt 17 ]; then
    echo -e "${RED}❌ Angular 17+ required for control flow migration${NC}"
    echo -e "${YELLOW}Current version: ${ANGULAR_VERSION}${NC}"
    echo -e "${YELLOW}Update Angular first: ng update @angular/core@17 @angular/cli@17${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Angular CLI detected (version ${ANGULAR_VERSION})${NC}"
echo ""

# Step 1: Detect usage
echo -e "${BOLD}Step 1: Detecting old control flow syntax...${NC}"

# Search in all common template locations
SEARCH_PATHS="src/"
if [ -d "projects" ]; then
    SEARCH_PATHS="$SEARCH_PATHS projects/"
fi

echo -e "${CYAN}Searching in: ${SEARCH_PATHS}${NC}"
NGIF_COUNT=$(find $SEARCH_PATHS -name "*.html" -type f -exec grep -l "\*ngIf=" {} \; 2>/dev/null | wc -l || echo "0")
NGFOR_COUNT=$(find $SEARCH_PATHS -name "*.html" -type f -exec grep -l "\*ngFor=" {} \; 2>/dev/null | wc -l || echo "0")
NGSWITCH_COUNT=$(find $SEARCH_PATHS -name "*.html" -type f -exec grep -l "\*ngSwitch" {} \; 2>/dev/null | wc -l || echo "0")

TOTAL=$((NGIF_COUNT + NGFOR_COUNT + NGSWITCH_COUNT))

echo -e "  ${CYAN}*ngIf:${NC}     $NGIF_COUNT files"
echo -e "  ${CYAN}*ngFor:${NC}    $NGFOR_COUNT files"
echo -e "  ${CYAN}*ngSwitch:${NC} $NGSWITCH_COUNT files"
echo -e "  ${BOLD}Total:${NC}     $TOTAL files"
echo ""

# Show detailed counts
echo -e "${CYAN}Detailed occurrence counts:${NC}"
NGIF_OCCURRENCES=$(find $SEARCH_PATHS -name "*.html" -type f -exec grep -o "\*ngIf=" {} \; 2>/dev/null | wc -l || echo "0")
NGFOR_OCCURRENCES=$(find $SEARCH_PATHS -name "*.html" -type f -exec grep -o "\*ngFor=" {} \; 2>/dev/null | wc -l || echo "0")
NGSWITCH_OCCURRENCES=$(find $SEARCH_PATHS -name "*.html" -type f -exec grep -o "\*ngSwitch" {} \; 2>/dev/null | wc -l || echo "0")
echo -e "  ${CYAN}*ngIf:${NC}     $NGIF_OCCURRENCES occurrences"
echo -e "  ${CYAN}*ngFor:${NC}    $NGFOR_OCCURRENCES occurrences"
echo -e "  ${CYAN}*ngSwitch:${NC} $NGSWITCH_OCCURRENCES occurrences"
echo ""

if [ "$TOTAL" -eq 0 ]; then
    echo -e "${GREEN}✅ No old control flow syntax found - already migrated!${NC}"
    exit 0
fi

# Step 2: Confirm migration
echo -e "${YELLOW}⚠️  This migration will modify your template files${NC}"
echo -e "${YELLOW}   Make sure you have committed any pending changes${NC}"
echo ""
read -p "Do you want to proceed with the migration? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Migration cancelled${NC}"
    exit 0
fi

# Step 3: Run Angular schematic
echo ""
echo -e "${BOLD}Step 2: Running Angular migration schematic...${NC}"
echo -e "${CYAN}This may take a few minutes...${NC}"
echo ""

# Create backup branch before migration
BACKUP_BRANCH="backup-before-control-flow-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP_BRANCH" 2>/dev/null || true
echo -e "${GREEN}✓ Created backup branch: ${BACKUP_BRANCH}${NC}"
echo ""

# Run the migration
if ng generate @angular/core:control-flow; then
    echo ""
    echo -e "${GREEN}✅ Control flow migration completed${NC}"
    echo ""
    
    # Step 4: Verify results
    echo -e "${BOLD}Step 3: Verifying migration results...${NC}"
    
    NEW_NGIF=$(find $SEARCH_PATHS -name "*.html" -type f -exec grep -o "\*ngIf=" {} \; 2>/dev/null | wc -l || echo "0")
    NEW_NGFOR=$(find $SEARCH_PATHS -name "*.html" -type f -exec grep -o "\*ngFor=" {} \; 2>/dev/null | wc -l || echo "0")
    NEW_NGSWITCH=$(find $SEARCH_PATHS -name "*.html" -type f -exec grep -o "\*ngSwitch" {} \; 2>/dev/null | wc -l || echo "0")
    
    IF_COUNT=$(find $SEARCH_PATHS -name "*.html" -type f -exec grep -o "@if\s*(" {} \; 2>/dev/null | wc -l || echo "0")
    FOR_COUNT=$(find $SEARCH_PATHS -name "*.html" -type f -exec grep -o "@for\s*(" {} \; 2>/dev/null | wc -l || echo "0")
    SWITCH_COUNT=$(find $SEARCH_PATHS -name "*.html" -type f -exec grep -o "@switch\s*(" {} \; 2>/dev/null | wc -l || echo "0")
    
    echo ""
    echo -e "${CYAN}New control flow syntax:${NC}"
    echo -e "  ${GREEN}@if:${NC}     $IF_COUNT occurrences"
    echo -e "  ${GREEN}@for:${NC}    $FOR_COUNT occurrences"
    echo -e "  ${GREEN}@switch:${NC} $SWITCH_COUNT occurrences"
    echo ""
    
    if [ "$NEW_NGIF" -gt 0 ] || [ "$NEW_NGFOR" -gt 0 ] || [ "$NEW_NGSWITCH" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Some old syntax remains:${NC}"
        echo -e "  ${YELLOW}*ngIf:${NC}     $NEW_NGIF"
        echo -e "  ${YELLOW}*ngFor:${NC}    $NEW_NGFOR"
        echo -e "  ${YELLOW}*ngSwitch:${NC} $NEW_NGSWITCH"
        echo ""
        echo -e "${YELLOW}📋 Files requiring manual migration:${NC}"
        echo ""
        
        # List files with remaining old syntax
        UNMIGRATED_FILES=$(find $SEARCH_PATHS -name "*.html" -type f -exec grep -l "\*ngIf=\|\*ngFor=\|\*ngSwitch" {} \; 2>/dev/null | sort)
        
        if [ -n "$UNMIGRATED_FILES" ]; then
            echo "$UNMIGRATED_FILES" | while read -r file; do
                NGIF_IN_FILE=$(grep -c "\*ngIf=" "$file" 2>/dev/null || echo "0")
                NGFOR_IN_FILE=$(grep -c "\*ngFor=" "$file" 2>/dev/null || echo "0")
                NGSWITCH_IN_FILE=$(grep -c "\*ngSwitch" "$file" 2>/dev/null || echo "0")
                TOTAL_IN_FILE=$((NGIF_IN_FILE + NGFOR_IN_FILE + NGSWITCH_IN_FILE))
                echo -e "  ${CYAN}$file${NC} (${TOTAL_IN_FILE} occurrences)"
            done
            echo ""
            echo -e "${YELLOW}💡 Reasons for unmigrated files:${NC}"
            echo -e "   • Complex template expressions the schematic couldn't parse"
            echo -e "   • Custom components not registered in angular.json"
            echo -e "   • Templates in non-standard locations (themes, extensions)"
            echo -e "   • Standalone templates without component decorators"
            echo ""
            echo -e "${CYAN}To migrate manually:${NC}"
            echo -e "   1. Review each file listed above"
            echo -e "   2. Convert: *ngIf=\"expr\" → @if (expr) { }"
            echo -e "   3. Convert: *ngFor=\"let x of items\" → @for (x of items; track x) { }"
            echo -e "   4. Convert: [ngSwitch] → @switch"
        fi
        echo ""
    else
        echo -e "${GREEN}✅ All old syntax successfully migrated!${NC}"
        echo ""
    fi
    
    # Step 5: Next steps
    echo ""
    echo -e "${BOLD}${GREEN}✅ Migration Complete!${NC}"
    echo ""
    echo -e "${BOLD}Next Steps:${NC}"
    echo -e "  1. Review changes: ${CYAN}git diff${NC}"
    echo -e "  2. Run linting:    ${CYAN}npm run lint${NC}"
    echo -e "  3. Build project:  ${CYAN}npm run build${NC}"
    echo -e "  4. Run tests:      ${CYAN}npm test${NC}"
    echo -e "  5. Commit changes: ${CYAN}git commit -m 'feat: migrate to Angular 17 control flow syntax'${NC}"
    echo ""
    echo -e "${CYAN}💡 If something went wrong, restore from backup:${NC}"
    echo -e "   ${CYAN}git checkout ${BACKUP_BRANCH}${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Migration failed${NC}"
    echo -e "${YELLOW}Restore from backup with: git checkout ${BACKUP_BRANCH}${NC}"
    exit 1
fi
