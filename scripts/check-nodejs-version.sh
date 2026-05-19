#!/bin/bash

###############################################################################
# Node.js Version Checker and Updater
#
# Verifies that the current Node.js and npm versions meet the requirements
# for the target PWA version. Provides instructions to update if needed.
#
# Usage:
#   ./scripts/check-nodejs-version.sh [target-pwa-version]
#   ./scripts/check-nodejs-version.sh 10.0.0
#
# Options:
#   --auto-update    Automatically update .nvmrc and switch Node.js version
#   --skip-check     Skip version check (not recommended)
###############################################################################

set -e

# Resolve project directory (supports --project-dir and PWA_PROJECT_DIR)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_project-dir.sh"
cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Parse arguments
TARGET_VERSION="${1:-11.0.0}"
AUTO_UPDATE=false
SKIP_CHECK=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --auto-update)
      AUTO_UPDATE=true
      shift
      ;;
    --skip-check)
      SKIP_CHECK=true
      shift
      ;;
    --help)
      grep '^#' "$0" | tail -n +3 | head -n -1 | cut -c 3-
      exit 0
      ;;
    *)
      TARGET_VERSION="$1"
      shift
      ;;
  esac
done

if [ "$SKIP_CHECK" = true ]; then
  echo -e "${YELLOW}⚠️  Node.js version check skipped${NC}"
  exit 0
fi

echo -e "${BOLD}${BLUE}🔍 Node.js Version Checker${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Detect current versions
CURRENT_NODE=$(node --version 2>/dev/null | sed 's/v//' || echo "not installed")
CURRENT_NPM=$(npm --version 2>/dev/null || echo "not installed")

echo -e "${BOLD}Current Environment:${NC}"
echo -e "  Node.js: ${CYAN}${CURRENT_NODE}${NC}"
echo -e "  npm:     ${CYAN}${CURRENT_NPM}${NC}"
echo ""

# Determine required versions based on target PWA version
MAJOR_VERSION=$(echo "$TARGET_VERSION" | cut -d'.' -f1)

case "$MAJOR_VERSION" in
  10)
    REQUIRED_NODE="22"
    REQUIRED_NPM="10"
    ;;
  9)
    REQUIRED_NODE="18"
    REQUIRED_NPM="9"
    ;;
  8)
    REQUIRED_NODE="16"
    REQUIRED_NPM="8"
    ;;
  *)
    REQUIRED_NODE="22"
    REQUIRED_NPM="10"
    ;;
esac

echo -e "${BOLD}Required for PWA ${TARGET_VERSION}:${NC}"
echo -e "  Node.js: ${GREEN}${REQUIRED_NODE}.x.x${NC}"
echo -e "  npm:     ${GREEN}${REQUIRED_NPM}.x.x${NC}"
echo ""

# Check Node.js version
CURRENT_NODE_MAJOR=$(echo "$CURRENT_NODE" | cut -d'.' -f1)
NODE_OK=false

if [ "$CURRENT_NODE_MAJOR" = "$REQUIRED_NODE" ]; then
  echo -e "${GREEN}✅ Node.js version is compatible${NC}"
  NODE_OK=true
else
  echo -e "${RED}❌ Node.js version mismatch!${NC}"
  echo -e "   Current: ${CURRENT_NODE}"
  echo -e "   Required: ${REQUIRED_NODE}.x.x"
  echo ""
fi

# Check npm version
CURRENT_NPM_MAJOR=$(echo "$CURRENT_NPM" | cut -d'.' -f1)
NPM_OK=false

if [ "$CURRENT_NPM_MAJOR" = "$REQUIRED_NPM" ]; then
  echo -e "${GREEN}✅ npm version is compatible${NC}"
  NPM_OK=true
else
  echo -e "${RED}❌ npm version mismatch!${NC}"
  echo -e "   Current: ${CURRENT_NPM}"
  echo -e "   Required: ${REQUIRED_NPM}.x.x"
  echo ""
fi

# If everything is OK, exit successfully
if [ "$NODE_OK" = true ] && [ "$NPM_OK" = true ]; then
  echo -e "${GREEN}${BOLD}✅ All version requirements met!${NC}"
  exit 0
fi

# Provide update instructions
echo -e "${YELLOW}${BOLD}⚠️  Version Update Required${NC}"
echo ""
echo -e "${BOLD}Recommended Actions:${NC}"
echo ""

# Check if nvm is available
if command -v nvm &> /dev/null || [ -f "$HOME/.nvm/nvm.sh" ]; then
  echo -e "${CYAN}Option 1: Update automatically (recommended)${NC}"
  echo -e "  ${BOLD}./scripts/check-nodejs-version.sh $TARGET_VERSION --auto-update${NC}"
  echo ""
  echo -e "${CYAN}Option 2: Update manually with nvm${NC}"
  echo -e "  ${BOLD}nvm install ${REQUIRED_NODE}${NC}"
  echo -e "  ${BOLD}nvm use ${REQUIRED_NODE}${NC}"
  echo -e "  ${BOLD}nvm alias default ${REQUIRED_NODE}${NC}"
  echo ""
  
  if [ "$AUTO_UPDATE" = true ]; then
    echo -e "${BLUE}🔄 Auto-update enabled. Updating Node.js...${NC}"
    echo ""
    
    # Source nvm
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    # Install and use required Node.js version
    echo -e "${CYAN}Installing Node.js ${REQUIRED_NODE}...${NC}"
    nvm install "$REQUIRED_NODE"
    nvm use "$REQUIRED_NODE"
    
    # Update .nvmrc
    echo "$REQUIRED_NODE" > .nvmrc
    echo -e "${GREEN}✓ Created/updated .nvmrc${NC}"
    
    # Verify
    NEW_NODE=$(node --version | sed 's/v//')
    NEW_NPM=$(npm --version)
    echo ""
    echo -e "${GREEN}✅ Update complete!${NC}"
    echo -e "  Node.js: ${NEW_NODE}"
    echo -e "  npm:     ${NEW_NPM}"
    echo ""
    echo -e "${YELLOW}💡 Tip: Run 'npm install' to rebuild node_modules with new Node.js version${NC}"
    exit 0
  fi
else
  echo -e "${CYAN}Option 1: Install nvm (Node Version Manager)${NC}"
  echo -e "  ${BOLD}curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash${NC}"
  echo -e "  Then restart your terminal and run:"
  echo -e "  ${BOLD}nvm install ${REQUIRED_NODE}${NC}"
  echo ""
  echo -e "${CYAN}Option 2: Install Node.js directly${NC}"
  echo -e "  Download from: ${BOLD}https://nodejs.org/${NC}"
  echo -e "  Choose version: ${BOLD}${REQUIRED_NODE}.x.x LTS${NC}"
  echo ""
fi

echo -e "${CYAN}Option 3: Update .nvmrc for team${NC}"
echo -e "  ${BOLD}echo \"${REQUIRED_NODE}\" > .nvmrc${NC}"
echo -e "  Commit this file so team members use the correct version"
echo ""

# Additional updates needed
echo -e "${BOLD}Also update these files:${NC}"
echo ""
echo -e "${CYAN}Docker:${NC}"
echo -e "  ${BOLD}FROM node:${REQUIRED_NODE}${NC} in all Dockerfiles"
echo ""
echo -e "${CYAN}CI/CD:${NC}"
echo -e "  GitLab:  ${BOLD}image: node:${REQUIRED_NODE}${NC} in .gitlab-ci.yml"
echo -e "  GitHub:  ${BOLD}node-version: ${REQUIRED_NODE}${NC} in .github/workflows/*.yml"
echo ""

# Exit with error
echo -e "${RED}${BOLD}❌ Migration blocked due to version mismatch${NC}"
echo -e "${YELLOW}Update Node.js/npm versions before continuing migration${NC}"
exit 1
