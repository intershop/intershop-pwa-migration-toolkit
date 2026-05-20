#!/bin/bash
# ICM Compatibility Check Script
#
# Checks if your ICM backend version is compatible with your PWA version
# Based on requirements from: https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/migrations.md
#
# Usage:
#   ./scripts/check-icm-compatibility.sh
#   ./scripts/check-icm-compatibility.sh --pwa-version 11.0.0
#   ./scripts/check-icm-compatibility.sh --icm-url https://your-icm-server.com

set -e

# Resolve project directory (supports --project-dir and PWA_PROJECT_DIR)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_project-dir.sh"
cd "$PROJECT_DIR"

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=================================================="
echo "  ICM Compatibility Check"
echo "=================================================="
echo ""

# Parse arguments
PWA_VERSION=""
ICM_BASE_URL=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --pwa-version)
      PWA_VERSION="$2"
      shift 2
      ;;
    --icm-url)
      ICM_BASE_URL="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --pwa-version <version>   Specify PWA version (default: from package.json)"
      echo "  --icm-url <url>           Specify ICM base URL (default: from environment.ts)"
      echo "  -h, --help                Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Function to compare versions
version_compare() {
  # Returns 0 if $1 >= $2, 1 otherwise
  if [ "$1" == "$2" ]; then
    return 0
  fi
  
  local IFS=.
  local i ver1=($1) ver2=($2)
  
  # Fill empty positions with zeros
  for ((i=${#ver1[@]}; i<${#ver2[@]}; i++)); do
    ver1[i]=0
  done
  
  for ((i=0; i<${#ver1[@]}; i++)); do
    if [[ -z ${ver2[i]} ]]; then
      ver2[i]=0
    fi
    if ((10#${ver1[i]} > 10#${ver2[i]})); then
      return 0
    fi
    if ((10#${ver1[i]} < 10#${ver2[i]})); then
      return 1
    fi
  done
  return 0
}

# Step 1: Detect PWA version
if [ -z "$PWA_VERSION" ]; then
  if [ -f "package.json" ]; then
    PWA_VERSION=$(grep -m 1 '"version"' package.json | sed 's/.*: "\(.*\)".*/\1/')
    echo -e "${BLUE}🔍 Detected PWA Version:${NC} $PWA_VERSION (from package.json)"
  else
    echo -e "${RED}❌ Error: Could not detect PWA version. package.json not found.${NC}"
    echo "   Please specify with --pwa-version <version>"
    exit 1
  fi
else
  echo -e "${BLUE}📦 PWA Version:${NC} $PWA_VERSION (from argument)"
fi

# Remove -SNAPSHOT or other suffixes for comparison
PWA_VERSION_CLEAN=$(echo "$PWA_VERSION" | sed 's/-.*$//')
PWA_MAJOR=$(echo "$PWA_VERSION_CLEAN" | cut -d. -f1)
PWA_MINOR=$(echo "$PWA_VERSION_CLEAN" | cut -d. -f2)
echo ""

# Step 2: Load requirements from pattern-migrations.json
if [ ! -f "data/pattern-migrations.json" ]; then
  echo -e "${YELLOW}⚠️  Warning: pattern-migrations.json not found${NC}"
  echo "   Cannot verify detailed ICM requirements"
  echo ""
  USE_FALLBACK=true
else
  USE_FALLBACK=false
fi

# Step 3: Detect ICM base URL
if [ -z "$ICM_BASE_URL" ]; then
  # Try to find ICM URL from environment files
  for env_file in src/environments/environment.ts src/environments/environment.model.ts; do
    if [ -f "$env_file" ]; then
      ICM_BASE_URL=$(grep -m 1 'icmBaseURL' "$env_file" | sed "s/.*['\"]\\(https\\?:\/\/[^'\"]*\\)['\"].*/\\1/")
      if [ -n "$ICM_BASE_URL" ]; then
        echo -e "${BLUE}🔍 Detected ICM URL:${NC} $ICM_BASE_URL (from $env_file)"
        break
      fi
    fi
  done
  
  if [ -z "$ICM_BASE_URL" ]; then
    echo -e "${YELLOW}⚠️  Could not auto-detect ICM URL${NC}"
    echo "   Please specify with --icm-url <url>"
    echo ""
    echo "Skipping live ICM version check..."
    SKIP_LIVE_CHECK=true
  fi
else
  echo -e "${BLUE}🌐 ICM URL:${NC} $ICM_BASE_URL (from argument)"
fi
echo ""

# Step 4: Fetch ICM version from REST API (if URL available)
if [ "$SKIP_LIVE_CHECK" != "true" ]; then
  echo -e "${BLUE}🔄 Fetching ICM version from REST API...${NC}"
  
  # Try different REST endpoints
  CONFIG_URL="${ICM_BASE_URL}/INTERSHOP/rest/WFS/-;loc=en_US;cur=USD/configurations"
  
  # Try with timeout
  ICM_RESPONSE=$(curl -s --connect-timeout 10 --max-time 30 "$CONFIG_URL" 2>/dev/null || echo "")
  
  if [ -z "$ICM_RESPONSE" ] || echo "$ICM_RESPONSE" | grep -q "error\|Error\|404\|500"; then
    echo -e "${YELLOW}⚠️  Could not fetch ICM version from REST API${NC}"
    echo "   URL tried: $CONFIG_URL"
    echo "   Response: ${ICM_RESPONSE:0:100}"
    echo ""
    ICM_VERSION="unknown"
  else
    # Try to extract version from JSON response
    if command -v jq &> /dev/null; then
      ICM_VERSION=$(echo "$ICM_RESPONSE" | jq -r '.version // .data.version // empty' 2>/dev/null || echo "")
    else
      # Fallback: simple grep if jq not available
      ICM_VERSION=$(echo "$ICM_RESPONSE" | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
    fi
    
    if [ -z "$ICM_VERSION" ]; then
      echo -e "${YELLOW}⚠️  Could not parse ICM version from response${NC}"
      echo "   Install 'jq' for better JSON parsing: apt-get install jq / brew install jq"
      ICM_VERSION="unknown"
    else
      echo -e "${GREEN}✅ ICM Version:${NC} $ICM_VERSION"
    fi
  fi
else
  ICM_VERSION="unknown"
fi
echo ""

# Step 5: Check requirements from pattern database or fallback rules
echo "=================================================="
echo "  Compatibility Analysis"
echo "=================================================="
echo ""

# Define ICM requirements (fallback if pattern-migrations.json unavailable)
declare -A ICM_REQUIREMENTS
ICM_REQUIREMENTS["11.0"]="14.0.1"
ICM_REQUIREMENTS["10.0"]="11.0.0"
ICM_REQUIREMENTS["9.1"]="11.0.0"
ICM_REQUIREMENTS["9.0"]="11.0.0"
ICM_REQUIREMENTS["8.0"]="11.0.0"
ICM_REQUIREMENTS["7.1"]="7.10.38.0"
ICM_REQUIREMENTS["7.0"]="7.10.0.0"

# Try to load from JSON if available
if [ "$USE_FALLBACK" != "true" ] && command -v jq &> /dev/null; then
  PWA_KEY="${PWA_MAJOR}.${PWA_MINOR}"
  REQUIRED_ICM=$(jq -r ".migrations[] | select(.toVersion==\"${PWA_KEY}.0\" or .toVersion==\"${PWA_KEY}\") | .icmRequirements.minimum // empty" data/pattern-migrations.json 2>/dev/null || echo "")
  
  if [ -n "$REQUIRED_ICM" ]; then
    ICM_REQUIREMENTS["${PWA_KEY}"]="$REQUIRED_ICM"
  fi
fi

# Get minimum ICM version for this PWA
PWA_KEY="${PWA_MAJOR}.${PWA_MINOR}"
REQUIRED_ICM_VERSION="${ICM_REQUIREMENTS[$PWA_KEY]:-unknown}"

if [ "$REQUIRED_ICM_VERSION" == "unknown" ]; then
  echo -e "${YELLOW}⚠️  No specific ICM requirement found for PWA $PWA_VERSION${NC}"
  echo "   Using general compatibility rules..."
  echo ""
  
  # General rules
  if [ "$PWA_MAJOR" -ge 8 ]; then
    REQUIRED_ICM_VERSION="11.0.0"
    echo -e "   PWA $PWA_MAJOR.x generally requires ${BLUE}ICM 11.0.0+${NC}"
  else
    REQUIRED_ICM_VERSION="7.10.38.0"
    echo -e "   PWA $PWA_MAJOR.x generally requires ${BLUE}ICM 7.10.38+${NC}"
  fi
else
  echo -e "${BLUE}📋 Minimum ICM Version Required:${NC} $REQUIRED_ICM_VERSION"
fi
echo ""

# Step 6: Compare versions if ICM version is known
if [ "$ICM_VERSION" != "unknown" ]; then
  ICM_VERSION_CLEAN=$(echo "$ICM_VERSION" | sed 's/-.*$//')
  
  if version_compare "$ICM_VERSION_CLEAN" "$REQUIRED_ICM_VERSION"; then
    echo -e "${GREEN}✅ ICM VERSION COMPATIBLE${NC}"
    echo "   Your ICM $ICM_VERSION_CLEAN meets the minimum requirement of $REQUIRED_ICM_VERSION"
  else
    echo -e "${RED}❌ ICM VERSION TOO OLD${NC}"
    echo "   Your ICM: $ICM_VERSION_CLEAN"
    echo "   Required: $REQUIRED_ICM_VERSION or higher"
    echo ""
    echo -e "${YELLOW}⚠️  Warning: Some PWA features may not work correctly!${NC}"
    COMPATIBILITY_ISSUES=true
  fi
else
  echo -e "${YELLOW}⚠️  Cannot verify compatibility - ICM version unknown${NC}"
  echo "   Please check manually that your ICM is at least version $REQUIRED_ICM_VERSION"
fi
echo ""

# Step 7: Check for version-specific feature requirements
if [ "$USE_FALLBACK" != "true" ] && command -v jq &> /dev/null; then
  echo "=================================================="
  echo "  Feature-Specific Requirements"
  echo "=================================================="
  echo ""
  
  FEATURES=$(jq -r ".migrations[] | select(.toVersion==\"${PWA_KEY}.0\" or .toVersion==\"${PWA_KEY}\") | .icmRequirements.features[]? | \"- \\(.feature): ICM \\(.icmMinVersion)+ (\\(.description))\"" data/pattern-migrations.json 2>/dev/null || echo "")
  
  if [ -n "$FEATURES" ]; then
    echo "Some features have specific ICM requirements:"
    echo ""
    echo "$FEATURES"
    echo ""
  fi
  
  # Check for required extensions
  EXTENSIONS=$(jq -r ".migrations[] | select(.toVersion==\"${PWA_KEY}.0\" or .toVersion==\"${PWA_KEY}\") | .icmRequirements.extensions[]? | \"- \\(.name): \\(.packageId):\\(.minVersion)\"" data/pattern-migrations.json 2>/dev/null || echo "")
  
  if [ -n "$EXTENSIONS" ]; then
    echo "Required ICM Extensions:"
    echo ""
    echo "$EXTENSIONS"
    echo ""
  fi
fi

# Step 8: Summary and recommendations
echo "=================================================="
echo "  Summary"
echo "=================================================="
echo ""

if [ "$COMPATIBILITY_ISSUES" == "true" ]; then
  echo -e "${RED}⚠️  COMPATIBILITY ISSUES DETECTED${NC}"
  echo ""
  echo "Recommendations:"
  echo "  1. Upgrade your ICM to at least version $REQUIRED_ICM_VERSION"
  echo "  2. Review migration notes: https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/migrations.md"
  echo "  3. Test thoroughly in staging environment"
  echo ""
  exit 1
elif [ "$ICM_VERSION" != "unknown" ]; then
  echo -e "${GREEN}✅ No compatibility issues detected${NC}"
  echo ""
  echo "Your ICM version appears compatible with PWA $PWA_VERSION"
else
  echo -e "${YELLOW}⚠️  Manual verification needed${NC}"
  echo ""
  echo "Could not automatically verify ICM compatibility."
  echo "Please ensure your ICM is at least version $REQUIRED_ICM_VERSION"
  echo ""
  echo "To enable automatic check:"
  echo "  1. Ensure ICM REST API is accessible"
  echo "  2. Install 'jq' for JSON parsing: apt-get install jq / brew install jq"
  echo "  3. Run: ./scripts/check-icm-compatibility.sh --icm-url <your-icm-url>"
fi

echo "For detailed migration information, see:"
echo "  https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/migrations.md"
echo ""
