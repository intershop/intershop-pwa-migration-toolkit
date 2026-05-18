#!/bin/bash
##############################################################################
# PWA Migration Toolkit - One-Time Setup
#
# Run this once to generate your VS Code workspace file.
# After that, just open the workspace and ask Copilot to help you migrate.
#
# Usage:
#   ./setup.sh /path/to/your/custom-pwa
#
# Example:
#   ./setup.sh /home/training/developer/pwa/developer-pwa
#   ./setup.sh ../pwa/developer-pwa
##############################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_FILE="$SCRIPT_DIR/pwa-migration.code-workspace"

echo ""
echo -e "${BLUE}${BOLD}PWA Migration Toolkit - Setup${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get PWA path
PWA_PATH="${1:-}"

if [[ -z "$PWA_PATH" ]]; then
  echo -e "Where is your custom PWA project?"
  echo -e "${YELLOW}(the folder with package.json and src/)${NC}"
  echo ""
  read -p "Path: " PWA_PATH
fi

if [[ -z "$PWA_PATH" ]]; then
  echo -e "${RED}No path provided. Exiting.${NC}"
  exit 1
fi

# Resolve to absolute path
if [[ "$PWA_PATH" != /* ]]; then
  PWA_PATH="$(cd "$SCRIPT_DIR" && cd "$PWA_PATH" 2>/dev/null && pwd)" || {
    echo -e "${RED}Cannot resolve path: $1${NC}"
    exit 1
  }
fi

# Validate
if [[ ! -d "$PWA_PATH" ]]; then
  echo -e "${RED}Directory does not exist: $PWA_PATH${NC}"
  exit 1
fi

if [[ ! -f "$PWA_PATH/package.json" ]]; then
  echo -e "${YELLOW}Warning: No package.json found in $PWA_PATH${NC}"
  echo -e "Are you sure this is the PWA project root?"
  read -p "Continue anyway? (y/N): " confirm
  [[ "$confirm" =~ ^[yY] ]] || exit 1
fi

# Calculate relative path from toolkit to PWA (for portability)
# Fall back to absolute if relative fails
REL_PATH="$(python3 -c "import os.path; print(os.path.relpath('$PWA_PATH', '$SCRIPT_DIR'))" 2>/dev/null)" || REL_PATH="$PWA_PATH"

# Generate workspace file
cat > "$WORKSPACE_FILE" << EOF
{
  "folders": [
    {
      "name": "Custom PWA",
      "path": "$REL_PATH"
    },
    {
      "name": "Migration Toolkit",
      "path": "."
    }
  ],
  "settings": {
    "files.exclude": {
      "**/node_modules": true
    },
    "terminal.integrated.env.linux": {
      "PWA_PROJECT_DIR": "$PWA_PATH"
    },
    "terminal.integrated.env.osx": {
      "PWA_PROJECT_DIR": "$PWA_PATH"
    },
    "terminal.integrated.env.windows": {
      "PWA_PROJECT_DIR": "$PWA_PATH"
    }
  }
}
EOF

echo ""
echo -e "${GREEN}${BOLD}✅ Setup complete!${NC}"
echo ""
echo -e "Workspace file created: ${BLUE}pwa-migration.code-workspace${NC}"
echo -e "Custom PWA path:        ${BLUE}$PWA_PATH${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo ""
echo -e "  1. Open the workspace in VS Code:"
echo -e "     ${GREEN}code pwa-migration.code-workspace${NC}"
echo ""
echo -e "  2. Ask Copilot to migrate your PWA:"
echo -e "     ${BLUE}\"Migrate my custom PWA from 10.0 to the latest version\"${NC}"
echo ""
echo -e "  That's it. Copilot has all the context it needs."
echo ""
