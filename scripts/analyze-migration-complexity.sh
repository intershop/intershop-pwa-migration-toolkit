#!/bin/bash

###############################################################################
# Migration Complexity Analyzer
#
# Analyzes your PWA migration to recommend the appropriate pattern detection
# tier based on:
# - Version gap between source and target
# - Degree of customization
# - Number of custom extensions
# - Modified core files percentage
#
# Usage:
#   ./scripts/analyze-migration-complexity.sh [source-version] [target-version]
#   ./scripts/analyze-migration-complexity.sh 4.0.0 9.1.0
###############################################################################

set -e

# Resolve project directory (supports --project-dir and PWA_PROJECT_DIR)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_project-dir.sh"
cd "$PROJECT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
EXTENSIONS_DIR="src/app/extensions"
THEMES_DIR="src/styles/themes"
COMPONENTS_DIR="src/app"
CORE_DIRS=("src/app/core" "src/app/shared")

###############################################################################
# Functions
###############################################################################

print_header() {
  echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}      ${BLUE}Migration Complexity Analyzer${NC}                          ${CYAN}║${NC}"
  echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

# Parse semantic version
parse_version() {
  local version=$1
  echo "$version" | sed 's/[^0-9.]//g'
}

# Calculate version gap
calculate_version_gap() {
  local source=$1
  local target=$2
  
  source_major=$(echo "$source" | cut -d. -f1)
  target_major=$(echo "$target" | cut -d. -f1)
  
  echo $((target_major - source_major))
}

# Detect custom extensions
detect_custom_extensions() {
  if [ ! -d "$EXTENSIONS_DIR" ]; then
    echo 0
    return
  fi
  
  # Count non-standard extensions (excluding common ones from base PWA)
  local standard_extensions=("sentry" "tacton" "tracking" "quoting")
  local custom_count=0
  
  for ext_dir in "$EXTENSIONS_DIR"/*; do
    if [ -d "$ext_dir" ]; then
      ext_name=$(basename "$ext_dir")
      is_standard=0
      
      for standard in "${standard_extensions[@]}"; do
        if [ "$ext_name" = "$standard" ]; then
          is_standard=1
          break
        fi
      done
      
      if [ $is_standard -eq 0 ]; then
        ((custom_count++))
      fi
    fi
  done
  
  echo $custom_count
}

# Detect custom themes
detect_custom_themes() {
  if [ ! -d "$THEMES_DIR" ]; then
    echo "none"
    return
  fi
  
  # Standard themes from base PWA
  local standard_themes=("b2b" "b2c")
  local custom_themes=()
  
  for theme_dir in "$THEMES_DIR"/*; do
    if [ -d "$theme_dir" ]; then
      theme_name=$(basename "$theme_dir")
      is_standard=0
      
      for standard in "${standard_themes[@]}"; do
        if [ "$theme_name" = "$standard" ]; then
          is_standard=1
          break
        fi
      done
      
      if [ $is_standard -eq 0 ]; then
        custom_themes+=("$theme_name")
      fi
    fi
  done
  
  if [ ${#custom_themes[@]} -eq 0 ]; then
    echo "none"
  else
    echo "${custom_themes[*]}"
  fi
}

# Count custom components
count_custom_components() {
  if [ ! -d "$COMPONENTS_DIR" ]; then
    echo 0
    return
  fi
  
  # Find component files not in core/shared (likely custom)
  local custom_count=$(find "$COMPONENTS_DIR" -name "*.component.ts" \
    -not -path "*/core/*" \
    -not -path "*/shared/*" \
    -not -path "*/extensions/*" \
    -not -path "*/shell/*" \
    -not -path "*/pages/*" | wc -l)
  
  echo $custom_count
}

# Calculate customization percentage
calculate_customization_percentage() {
  # This is a rough estimate based on modified files vs total files
  local total_ts_files=$(find src/app -name "*.ts" | wc -l)
  
  if [ $total_ts_files -eq 0 ]; then
    echo 0
    return
  fi
  
  # Look for files with recent commits (customizations)
  # This is approximate - in real scenario you'd compare with base PWA
  local custom_files=$(git log --oneline --name-only --since="1 year ago" -- src/app/ | \
    grep "\.ts$" | sort -u | wc -l)
  
  local percentage=$((custom_files * 100 / total_ts_files))
  
  # Cap at 100%
  if [ $percentage -gt 100 ]; then
    percentage=100
  fi
  
  echo $percentage
}

# Recommend tier based on analysis
recommend_tier() {
  local version_gap=$1
  local custom_percentage=$2
  local custom_extensions=$3
  
  # Scoring system
  local score=0
  
  # Version gap scoring (0-40 points)
  if [ $version_gap -ge 5 ]; then
    score=$((score + 40))
  elif [ $version_gap -ge 3 ]; then
    score=$((score + 25))
  elif [ $version_gap -ge 1 ]; then
    score=$((score + 10))
  fi
  
  # Customization percentage scoring (0-40 points)
  if [ $custom_percentage -ge 50 ]; then
    score=$((score + 40))
  elif [ $custom_percentage -ge 20 ]; then
    score=$((score + 25))
  elif [ $custom_percentage -ge 10 ]; then
    score=$((score + 10))
  fi
  
  # Custom extensions scoring (0-20 points)
  if [ $custom_extensions -ge 3 ]; then
    score=$((score + 20))
  elif [ $custom_extensions -ge 1 ]; then
    score=$((score + 10))
  fi
  
  # Determine tier
  if [ $score -ge 60 ]; then
    echo "3"
  elif [ $score -ge 25 ]; then
    echo "2"
  else
    echo "1"
  fi
}

# Print tier recommendation
print_tier_recommendation() {
  local tier=$1
  local version_gap=$2
  local custom_percentage=$3
  local custom_extensions=$4
  
  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
  
  case $tier in
    1)
      echo -e "${GREEN}📋 RECOMMENDED APPROACH: TIER 1 (CHANGELOG Review)${NC}"
      echo ""
      echo -e "${GREEN}✓ Lightweight approach suitable for your migration${NC}"
      echo ""
      echo "What to do:"
      echo "  1. Review CHANGELOG.md from Intershop PWA repository"
      echo "  2. Follow manual checklist in migration instructions"
      echo "  3. Use build cycle to catch issues iteratively"
      echo ""
      echo "Estimated time: 1-2 hours"
      ;;
      
    2)
      echo -e "${YELLOW}⚙️  RECOMMENDED APPROACH: TIER 2 (Pattern Detection)${NC}"
      echo ""
      echo -e "${YELLOW}✓ Automated scanning recommended for your migration${NC}"
      echo ""
      echo "What to do:"
      echo "  1. Run: ${CYAN}./scripts/detect-pattern-changes.js${NC}"
      echo "  2. Review generated report of affected files"
      echo "  3. Apply suggested pattern updates"
      echo "  4. Follow build cycle for remaining issues"
      echo ""
      echo "Estimated time savings: 2-3 hours"
      ;;
      
    3)
      echo -e "${RED}🔧 RECOMMENDED APPROACH: TIER 3 (Comprehensive Analysis)${NC}"
      echo ""
      echo -e "${RED}✓ Complex migration - full tooling recommended${NC}"
      echo ""
      echo "What to do:"
      echo "  1. Review: ${CYAN}data/pattern-migrations.json${NC}"
      echo "  2. Run: ${CYAN}./scripts/detect-pattern-changes.js --comprehensive${NC}"
      echo "  3. Review multi-version breaking changes"
      echo "  4. Consider incremental migration strategy"
      echo "  5. Use automated code transformation where possible"
      echo ""
      echo "Estimated time savings: 4-6 hours"
      echo ""
      echo -e "${YELLOW}💡 Consider migrating in stages if possible${NC}"
      ;;
  esac
  
  echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
}

# Print reasoning
print_reasoning() {
  local tier=$1
  local version_gap=$2
  local custom_percentage=$3
  local custom_extensions=$4
  
  echo ""
  echo -e "${BLUE}Why this recommendation?${NC}"
  echo ""
  
  # Version gap
  if [ $version_gap -ge 5 ]; then
    echo -e "  ${RED}⚠${NC}  Large version gap (${version_gap} major versions)"
  elif [ $version_gap -ge 3 ]; then
    echo -e "  ${YELLOW}!${NC}  Moderate version gap (${version_gap} major versions)"
  else
    echo -e "  ${GREEN}✓${NC}  Small version gap (${version_gap} major versions)"
  fi
  
  # Customization
  if [ $custom_percentage -ge 50 ]; then
    echo -e "  ${RED}⚠${NC}  Heavy customization (${custom_percentage}% of codebase)"
  elif [ $custom_percentage -ge 20 ]; then
    echo -e "  ${YELLOW}!${NC}  Moderate customization (${custom_percentage}% of codebase)"
  else
    echo -e "  ${GREEN}✓${NC}  Light customization (${custom_percentage}% of codebase)"
  fi
  
  # Extensions
  if [ $custom_extensions -ge 3 ]; then
    echo -e "  ${RED}⚠${NC}  Multiple custom extensions (${custom_extensions})"
  elif [ $custom_extensions -ge 1 ]; then
    echo -e "  ${YELLOW}!${NC}  Custom extensions present (${custom_extensions})"
  else
    echo -e "  ${GREEN}✓${NC}  No custom extensions"
  fi
}

###############################################################################
# Main Execution
###############################################################################

main() {
  print_header
  
  # Parse arguments
  local source_version="${1:-}"
  local target_version="${2:-}"
  
  # Try to detect versions from git branches or package.json if not provided
  if [ -z "$source_version" ]; then
    echo -e "${YELLOW}Source version not provided. Attempting to detect from current branch...${NC}"
    source_version=$(git branch --show-current | grep -oP '\d+\.\d+\.\d+' | head -1)
    if [ -z "$source_version" ]; then
      source_version=$(grep '"version"' package.json | head -1 | grep -oP '\d+\.\d+\.\d+')
    fi
  fi
  
  if [ -z "$target_version" ]; then
    echo -e "${YELLOW}Target version not provided. Please specify.${NC}"
    echo ""
    echo "Usage: $0 <source-version> <target-version>"
    echo "Example: $0 4.0.0 9.1.0"
    exit 1
  fi
  
  echo -e "🔍 ${BLUE}Analyzing migration complexity...${NC}"
  echo ""
  
  # Clean versions
  source_version=$(parse_version "$source_version")
  target_version=$(parse_version "$target_version")
  
  echo -e "📦 Source version: ${GREEN}${source_version}${NC}"
  echo -e "📦 Target version: ${GREEN}${target_version}${NC}"
  
  # Calculate version gap
  version_gap=$(calculate_version_gap "$source_version" "$target_version")
  
  if [ $version_gap -lt 0 ]; then
    echo -e "${RED}❌ Error: Target version is older than source version${NC}"
    exit 1
  fi
  
  echo -e "📊 Version gap: ${YELLOW}${version_gap}${NC} major version(s)"
  
  if [ $version_gap -ge 5 ]; then
    echo -e "   ${RED}⚠️  Large gap detected${NC}"
  fi
  
  echo ""
  echo -e "🔍 ${BLUE}Analyzing customizations...${NC}"
  echo ""
  
  # Analyze customizations
  custom_extensions=$(detect_custom_extensions)
  custom_themes=$(detect_custom_themes)
  custom_components=$(count_custom_components)
  custom_percentage=$(calculate_customization_percentage)
  
  echo -e "📁 Custom extensions: ${CYAN}${custom_extensions}${NC}"
  
  if [ "$custom_themes" != "none" ]; then
    echo -e "🎨 Custom themes: ${CYAN}${custom_themes}${NC}"
  else
    echo -e "🎨 Custom themes: ${GREEN}none (using standard themes)${NC}"
  fi
  
  echo -e "🧩 Custom components: ${CYAN}${custom_components}${NC}"
  echo -e "📈 Estimated customization: ${CYAN}${custom_percentage}%${NC} of codebase"
  
  # Recommend tier
  recommended_tier=$(recommend_tier $version_gap $custom_percentage $custom_extensions)
  
  # Print recommendation
  print_tier_recommendation $recommended_tier $version_gap $custom_percentage $custom_extensions
  
  # Print reasoning
  print_reasoning $recommended_tier $version_gap $custom_percentage $custom_extensions
  
  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${BLUE}Next steps:${NC}"
  echo ""
  
  case $recommended_tier in
    1)
      echo "  1. Review migration-checklist.instructions.md"
      echo "  2. Check CHANGELOG.md in Intershop PWA repo"
      echo "  3. Start migration with standard workflow"
      ;;
    2)
      echo "  1. Run pattern detection: ./scripts/detect-pattern-changes.js"
      echo "  2. Review generated report"
      echo "  3. Follow migration-workflow.instructions.md"
      ;;
    3)
      echo "  1. Review data/pattern-migrations.json for your version range"
      echo "  2. Run comprehensive scan: ./scripts/detect-pattern-changes.js --comprehensive"
      echo "  3. Consider incremental migration strategy"
      echo "  4. Use migration-patterns-detection.instructions.md"
      ;;
  esac
  
  echo ""
  
  # Option to run pattern detection immediately
  if [ $recommended_tier -ge 2 ]; then
    echo -e "${YELLOW}Would you like to run pattern detection now? (y/n)${NC}"
    read -r run_detection
    
    if [ "$run_detection" = "y" ] || [ "$run_detection" = "Y" ]; then
      echo ""
      if [ $recommended_tier -eq 3 ]; then
        ./scripts/detect-pattern-changes.js --comprehensive "$source_version" "$target_version"
      else
        ./scripts/detect-pattern-changes.js "$source_version" "$target_version"
      fi
    fi
  fi
}

# Run main function
main "$@"
