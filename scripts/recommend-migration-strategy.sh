#!/bin/bash

###############################################################################
# Migration Strategy Advisor
#
# Analyzes your project and recommends the best migration approach:
# - Big Bang (direct jump to latest version)
# - Incremental (step through intermediate versions)
# - Hybrid (skip strategically to stable milestones)
#
# Factors analyzed:
# - Customization depth (how many files modified)
# - Baseline drift (original files changed during customization)
# - Version gap (number of major versions to jump)
# - Breaking changes count
# - Team expertise and constraints
#
# Usage:
#   ./scripts/recommend-migration-strategy.sh [current-version] [target-version]
#   ./scripts/recommend-migration-strategy.sh 4.0.0 10.0.0
#
# Options:
#   --interactive    Run full questionnaire for team/project context
#   --quick          Skip questions, analyze code only
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

# Default versions
CURRENT_VERSION="${1:-4.0.0}"
TARGET_VERSION="${2:-10.0.0}"
INTERACTIVE=true
QUICK=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --interactive)
      INTERACTIVE=true
      shift
      ;;
    --quick)
      QUICK=true
      INTERACTIVE=false
      shift
      ;;
    --help)
      grep '^#' "$0" | tail -n +3 | head -n -1 | cut -c 3-
      exit 0
      ;;
    *)
      if [ -z "$CURRENT_VERSION" ] || [ "$CURRENT_VERSION" = "$1" ]; then
        CURRENT_VERSION="$1"
      elif [ -z "$TARGET_VERSION" ] || [ "$TARGET_VERSION" = "$1" ]; then
        TARGET_VERSION="$1"
      fi
      shift
      ;;
  esac
done

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}         🎯 Migration Strategy Advisor${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}Helping you choose the best migration approach...${NC}"
echo ""

# Scoring system
SCORE_BIG_BANG=0
SCORE_INCREMENTAL=0
SCORE_HYBRID=0

###############################################################################
# 1. Analyze Customization Depth
###############################################################################

echo -e "${BOLD}📊 Analyzing Your Project...${NC}"
echo ""

# Count custom files (files different from develop branch)
if git rev-parse --verify develop &>/dev/null || git rev-parse --verify main &>/dev/null; then
  BASE_BRANCH=$(git rev-parse --verify develop &>/dev/null && echo "develop" || echo "main")
  
  # Count modified files
  CUSTOM_FILES=$(git diff --name-only $BASE_BRANCH 2>/dev/null | wc -l || echo "0")
  
  # Count files in src/ (approximate custom code)
  CUSTOM_SRC=$(git diff --name-only $BASE_BRANCH -- src/ 2>/dev/null | wc -l || echo "0")
  
  # Count copied vs overridden theme files
  THEME_COPIED=$(find src/styles -name "*.scss" 2>/dev/null | wc -l || echo "0")
  
  echo -e "${CYAN}Customization Analysis:${NC}"
  echo -e "  Total modified files: ${BOLD}${CUSTOM_FILES}${NC}"
  echo -e "  Custom src/ files:    ${BOLD}${CUSTOM_SRC}${NC}"
  echo -e "  Theme files:          ${BOLD}${THEME_COPIED}${NC}"
  echo ""
  
  # Score based on customization
  if [ "$CUSTOM_FILES" -lt 20 ]; then
    echo -e "  ${GREEN}✓ Low customization${NC} - Big bang is feasible"
    SCORE_BIG_BANG=$((SCORE_BIG_BANG + 3))
    SCORE_HYBRID=$((SCORE_HYBRID + 2))
    CUSTOM_LEVEL="low"
  elif [ "$CUSTOM_FILES" -lt 50 ]; then
    echo -e "  ${YELLOW}⚠ Medium customization${NC} - Hybrid recommended"
    SCORE_HYBRID=$((SCORE_HYBRID + 3))
    SCORE_BIG_BANG=$((SCORE_BIG_BANG + 1))
    SCORE_INCREMENTAL=$((SCORE_INCREMENTAL + 2))
    CUSTOM_LEVEL="medium"
  else
    echo -e "  ${RED}⚠ Heavy customization${NC} - Incremental safer"
    SCORE_INCREMENTAL=$((SCORE_INCREMENTAL + 3))
    SCORE_HYBRID=$((SCORE_HYBRID + 1))
    CUSTOM_LEVEL="high"
  fi
else
  echo -e "  ${YELLOW}⚠ Cannot analyze customization (no baseline branch)${NC}"
  CUSTOM_FILES="unknown"
  CUSTOM_LEVEL="unknown"
fi

echo ""

###############################################################################
# 2. Analyze Version Gap
###############################################################################

CURRENT_MAJOR=$(echo "$CURRENT_VERSION" | cut -d'.' -f1)
TARGET_MAJOR=$(echo "$TARGET_VERSION" | cut -d'.' -f1)
VERSION_GAP=$((TARGET_MAJOR - CURRENT_MAJOR))

echo -e "${CYAN}Version Gap Analysis:${NC}"
echo -e "  Current: ${BOLD}PWA ${CURRENT_VERSION}${NC}"
echo -e "  Target:  ${BOLD}PWA ${TARGET_VERSION}${NC}"
echo -e "  Gap:     ${BOLD}${VERSION_GAP} major versions${NC}"
echo ""

if [ "$VERSION_GAP" -le 1 ]; then
  echo -e "  ${GREEN}✓ Small gap${NC} - Big bang is safe"
  SCORE_BIG_BANG=$((SCORE_BIG_BANG + 3))
  VERSION_RISK="low"
elif [ "$VERSION_GAP" -le 3 ]; then
  echo -e "  ${YELLOW}⚠ Medium gap${NC} - Consider hybrid approach"
  SCORE_HYBRID=$((SCORE_HYBRID + 3))
  SCORE_BIG_BANG=$((SCORE_BIG_BANG + 1))
  VERSION_RISK="medium"
else
  echo -e "  ${RED}⚠ Large gap${NC} - Incremental recommended"
  SCORE_INCREMENTAL=$((SCORE_INCREMENTAL + 3))
  SCORE_HYBRID=$((SCORE_HYBRID + 2))
  VERSION_RISK="high"
fi

echo ""

###############################################################################
# 3. Check for Pattern Detection Results
###############################################################################

echo -e "${CYAN}Breaking Changes Analysis:${NC}"

# Try to run pattern detection
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BREAKING_CHANGES=0

if [ -f "$SCRIPT_DIR/detect-pattern-changes.js" ]; then
  echo -e "  ${BLUE}Running pattern detection...${NC}"
  
  # Run detection silently
  PATTERN_OUTPUT=$(node "$SCRIPT_DIR/detect-pattern-changes.js" "$CURRENT_VERSION" "$TARGET_VERSION" 2>/dev/null || echo "")
  
  if [ -n "$PATTERN_OUTPUT" ]; then
    BREAKING_CHANGES=$(echo "$PATTERN_OUTPUT" | grep -c "Severity:" || echo "0")
    echo -e "  Breaking patterns: ${BOLD}${BREAKING_CHANGES}${NC}"
    
    if [ "$BREAKING_CHANGES" -lt 20 ]; then
      echo -e "  ${GREEN}✓ Few breaking changes${NC}"
      SCORE_BIG_BANG=$((SCORE_BIG_BANG + 2))
    elif [ "$BREAKING_CHANGES" -lt 40 ]; then
      echo -e "  ${YELLOW}⚠ Moderate breaking changes${NC}"
      SCORE_HYBRID=$((SCORE_HYBRID + 2))
    else
      echo -e "  ${RED}⚠ Many breaking changes${NC}"
      SCORE_INCREMENTAL=$((SCORE_INCREMENTAL + 2))
      SCORE_HYBRID=$((SCORE_HYBRID + 1))
    fi
  fi
else
  echo -e "  ${YELLOW}⚠ Pattern detection not available${NC}"
fi

echo ""

###############################################################################
# 4. Interactive Questions (if enabled)
###############################################################################

ask_yes_no() {
  local question=$1
  local response
  read -p "$(echo -e ${question} [y/N]) " response
  [[ "$response" =~ ^[Yy]$ ]]
}

if [ "$INTERACTIVE" = true ]; then
  echo -e "${BOLD}📋 Team & Project Context (5 questions)${NC}"
  echo ""
  
  # Q1: Angular expertise
  if ask_yes_no "${CYAN}Q1: Does your team have strong Angular/TypeScript expertise?${NC}"; then
    SCORE_BIG_BANG=$((SCORE_BIG_BANG + 2))
    echo -e "  ${GREEN}→ Big bang more feasible${NC}"
  else
    SCORE_INCREMENTAL=$((SCORE_INCREMENTAL + 2))
    echo -e "  ${YELLOW}→ Incremental reduces learning curve${NC}"
  fi
  echo ""
  
  # Q2: Time constraints
  if ask_yes_no "${CYAN}Q2: Are you under tight deadlines (production pressure)?${NC}"; then
    SCORE_INCREMENTAL=$((SCORE_INCREMENTAL + 2))
    SCORE_HYBRID=$((SCORE_HYBRID + 1))
    echo -e "  ${YELLOW}→ Incremental allows intermediate deployments${NC}"
  else
    SCORE_BIG_BANG=$((SCORE_BIG_BANG + 1))
    echo -e "  ${GREEN}→ Can afford time for big bang${NC}"
  fi
  echo ""
  
  # Q3: Test coverage
  if ask_yes_no "${CYAN}Q3: Do you have good automated test coverage (>50%)?${NC}"; then
    SCORE_BIG_BANG=$((SCORE_BIG_BANG + 2))
    echo -e "  ${GREEN}→ Tests help catch big bang issues${NC}"
  else
    SCORE_INCREMENTAL=$((SCORE_INCREMENTAL + 1))
    echo -e "  ${YELLOW}→ Incremental safer without tests${NC}"
  fi
  echo ""
  
  # Q4: Customization quality
  if ask_yes_no "${CYAN}Q4: Are your customizations well-documented (clear markers, override pattern)?${NC}"; then
    SCORE_BIG_BANG=$((SCORE_BIG_BANG + 1))
    SCORE_HYBRID=$((SCORE_HYBRID + 1))
    echo -e "  ${GREEN}→ Good practices make migration easier${NC}"
  else
    SCORE_INCREMENTAL=$((SCORE_INCREMENTAL + 2))
    echo -e "  ${RED}→ Poor practices need careful migration${NC}"
  fi
  echo ""
  
  # Q5: Downtime tolerance
  if ask_yes_no "${CYAN}Q5: Can you afford 1-2 weeks in 'broken' state during migration?${NC}"; then
    SCORE_BIG_BANG=$((SCORE_BIG_BANG + 2))
    echo -e "  ${GREEN}→ Big bang feasible with downtime buffer${NC}"
  else
    SCORE_INCREMENTAL=$((SCORE_INCREMENTAL + 2))
    SCORE_HYBRID=$((SCORE_HYBRID + 1))
    echo -e "  ${YELLOW}→ Incremental allows stable checkpoints${NC}"
  fi
  echo ""
fi

###############################################################################
# 5. Calculate Recommendation
###############################################################################

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}         Recommendation${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Determine winner
if [ "$SCORE_BIG_BANG" -ge "$SCORE_INCREMENTAL" ] && [ "$SCORE_BIG_BANG" -ge "$SCORE_HYBRID" ]; then
  STRATEGY="Big Bang"
  ICON="🚀"
  COLOR="$GREEN"
elif [ "$SCORE_HYBRID" -ge "$SCORE_INCREMENTAL" ]; then
  STRATEGY="Hybrid (Strategic Incremental)"
  ICON="🎯"
  COLOR="$CYAN"
else
  STRATEGY="Incremental"
  ICON="📊"
  COLOR="$YELLOW"
fi

echo -e "${BOLD}${COLOR}${ICON} RECOMMENDED: ${STRATEGY}${NC}"
echo ""

# Show scores
echo -e "${CYAN}Decision Scores:${NC}"
echo -e "  Big Bang:     ${SCORE_BIG_BANG} points"
echo -e "  Hybrid:       ${SCORE_HYBRID} points"
echo -e "  Incremental:  ${SCORE_INCREMENTAL} points"
echo ""

###############################################################################
# 6. Detailed Strategy Explanation
###############################################################################

if [ "$STRATEGY" = "Big Bang" ]; then
  echo -e "${BOLD}${GREEN}✓ Big Bang Migration (Direct Jump)${NC}"
  echo ""
  echo -e "${BOLD}What this means:${NC}"
  echo -e "  ${CURRENT_VERSION} → ${TARGET_VERSION} directly"
  echo ""
  echo -e "${BOLD}Why recommended for you:${NC}"
  [ "$CUSTOM_LEVEL" = "low" ] && echo -e "  ✓ Few customizations make conflicts manageable"
  [ "$VERSION_RISK" = "low" ] && echo -e "  ✓ Small version gap reduces complexity"
  [ "$BREAKING_CHANGES" -lt 20 ] && echo -e "  ✓ Limited breaking changes"
  echo ""
  echo -e "${BOLD}Execution plan:${NC}"
  echo -e "  1. Pre-analysis:"
  echo -e "     ${CYAN}./scripts/detect-pattern-changes.js $CURRENT_VERSION $TARGET_VERSION --comprehensive${NC}"
  echo -e "  2. Merge directly:"
  echo -e "     ${CYAN}git merge intershop-pwa/${TARGET_VERSION}${NC}"
  echo -e "  3. Fix systematically (one category at a time):"
  echo -e "     ${CYAN}./scripts/migrate-control-flow.sh${NC}"
  echo -e "     ${CYAN}./scripts/migrate-bootstrap-icons.js${NC}"
  echo -e "     ${CYAN}./scripts/validate-theme-completeness.sh${NC}"
  echo -e "  4. Build & test"
  echo ""
  echo -e "${YELLOW}⚠️  Risk factors:${NC}"
  echo -e "  • All breaking changes hit at once"
  echo -e "  • Debugging can be complex (multiple variables)"
  echo -e "  • May take 1-2 weeks to stabilize"
  echo ""
  echo -e "${BOLD}Estimated time:${NC} 1-2 weeks"
  
elif [ "$STRATEGY" = "Hybrid (Strategic Incremental)" ]; then
  echo -e "${BOLD}${CYAN}🎯 Hybrid Migration (Strategic Stepping Stones)${NC}"
  echo ""
  echo -e "${BOLD}What this means:${NC}"
  echo -e "  ${CURRENT_VERSION} → 9.1.0 → ${TARGET_VERSION}"
  echo ""
  echo -e "${BOLD}Why recommended for you:${NC}"
  [ "$CUSTOM_LEVEL" = "medium" ] && echo -e "  ✓ Medium customizations benefit from staging"
  [ "$VERSION_RISK" = "medium" ] && echo -e "  ✓ Medium gap manageable with 1 intermediate step"
  [ "$BREAKING_CHANGES" -ge 20 ] && echo -e "  ✓ Breaking changes easier in chunks"
  echo ""
  echo -e "${BOLD}Migration Path:${NC}"
  echo ""
  echo -e "  ${BOLD}Phase 1: ${CURRENT_VERSION} → 9.1.0${NC}"
  echo -e "    • Consolidates: Angular 14→16, SCSS modules, standalone components"
  echo -e "    • Stable LTS version to test and deploy"
  echo -e "    • Time: 1 week"
  echo ""
  echo -e "  ${BOLD}Phase 2: 9.1.0 → ${TARGET_VERSION}${NC}"
  echo -e "    • Focus: Angular 17 changes only"
  echo -e "    • Control flow (@if, @for), Bootstrap Icons"
  echo -e "    • Easier debugging - know it's Angular 17-related"
  echo -e "    • Time: 1 week"
  echo ""
  echo -e "${GREEN}✓ Advantages:${NC}"
  echo -e "  • Can deploy on 9.1 if needed (stable intermediate)  "
  echo -e "  • Easier to attribute failures"
  echo -e "  • Team learns patterns before they accumulate"
  echo ""
  echo -e "${BOLD}Estimated time:${NC} 2-3 weeks total"
  
else
  echo -e "${BOLD}${YELLOW}📊 Incremental Migration (Step-by-Step)${NC}"
  echo ""
  echo -e "${BOLD}What this means:${NC}"
  echo -e "  ${CURRENT_VERSION} → 6.0 → 7.0 → 8.0 → 9.0 → 9.1 → ${TARGET_VERSION}"
  echo ""
  echo -e "${BOLD}Why recommended for you:${NC}"
  [ "$CUSTOM_LEVEL" = "high" ] && echo -e "  ✓ Heavy customizations need careful handling"
  [ "$VERSION_RISK" = "high" ] && echo -e "  ✓ Large version gap too risky for big bang"
  echo -e "  ✓ Lower risk at each step"
  echo -e "  ✓ Easier debugging (fewer variables per migration)"
  echo ""
  echo -e "${BOLD}Migration Path:${NC}"
  echo -e "  Stage 1: ${CURRENT_VERSION} → 6.0 (Angular 12 → 13)"
  echo -e "  Stage 2: 6.0 → 7.0 (Angular 13 → 14)"
  echo -e "  Stage 3: 7.0 → 8.0 (Angular 14 → 15)"
  echo -e "  Stage 4: 8.0 → 9.0 (Angular 15 → 16, SCSS modules)"
  echo -e "  Stage 5: 9.0 → 9.1 (Stable LTS)"
  echo -e "  Stage 6: 9.1 → ${TARGET_VERSION} (Angular 17)"
  echo ""
  echo -e "${GREEN}✓ Advantages:${NC}"
  echo -e "  • Can stop at any stable version"
  echo -e "  • Learn patterns gradually"
  echo -e "  • Easier to get team buy-in at each stage"
  echo ""
  echo -e "${RED}⚠️  Trade-offs:${NC}"
  echo -e "  • More total time investment"
  echo -e "  • Same file may conflict multiple times"
  echo ""
  echo -e "${BOLD}Estimated time:${NC} 4-6 weeks total"
fi

echo ""

###############################################################################
# 7. Next Steps
###############################################################################

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}         Next Steps${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BOLD}1. Review the recommendation with your team${NC}"
echo -e "   Consider: expertise, timeline, risk tolerance"
echo ""

echo -e "${BOLD}2. Run pre-migration analysis${NC}"
echo -e "   ${CYAN}./scripts/analyze-migration-complexity.sh $CURRENT_VERSION $TARGET_VERSION${NC}"
echo -e "   ${CYAN}./scripts/detect-pattern-changes.js $CURRENT_VERSION $TARGET_VERSION --comprehensive${NC}"
echo ""

echo -e "${BOLD}3. Read the official guides${NC}"
echo -e "   ${CYAN}.github/instructions/migration-approaches.instructions.md${NC}"
echo -e "   ${CYAN}.github/instructions/migration-checklist.instructions.md${NC}"
echo ""

echo -e "${BOLD}4. Start migration with chosen strategy${NC}"
if [ "$STRATEGY" = "Big Bang" ]; then
  echo -e "   ${CYAN}./scripts/migrate-custom-branch.sh \\${NC}"
  echo -e "   ${CYAN}  --source-branch your-custom-branch \\${NC}"
  echo -e "   ${CYAN}  --target-branch intershop-pwa/${TARGET_VERSION} \\${NC}"
  echo -e "   ${CYAN}  --migration-branch your-new-branch${NC}"
elif [ "$STRATEGY" = "Hybrid (Strategic Incremental)" ]; then
  echo -e "   ${CYAN}# Phase 1:${NC}"
  echo -e "   ${CYAN}./scripts/migrate-custom-branch.sh ... --target-branch intershop-pwa/9.1.0${NC}"
  echo -e "   ${CYAN}# Test, stabilize, then Phase 2:${NC}"
  echo -e "   ${CYAN}./scripts/migrate-custom-branch.sh ... --target-branch intershop-pwa/${TARGET_VERSION}${NC}"
else
  echo -e "   ${CYAN}# Migrate one version at a time${NC}"
  echo -e "   ${CYAN}./scripts/migrate-custom-branch.sh ... --target-branch intershop-pwa/6.0.0${NC}"
  echo -e "   ${CYAN}# Repeat for each subsequent version${NC}"
fi

echo ""
echo -e "${CYAN}💡 Tip: Re-run this tool with --interactive for more personalized advice${NC}"
echo ""
