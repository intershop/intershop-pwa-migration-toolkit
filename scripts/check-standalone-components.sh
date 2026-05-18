#!/bin/bash
# Analyzes component architecture (NgModule vs Standalone)
# Usage: ./scripts/check-standalone-components.sh [--project-dir <path>]

# Resolve project directory (supports --project-dir and PWA_PROJECT_DIR)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_project-dir.sh"
cd "$PROJECT_DIR"

echo "🔍 Analyzing component architecture..."
echo ""

# Count standalone components
STANDALONE=$(grep -r "standalone: true" src/app --include="*.ts" 2>/dev/null | wc -l)

# Count NgModule declarations
MODULE_COMPONENTS=$(grep -r "declarations:" src/app --include="*.module.ts" 2>/dev/null | wc -l)

echo "📊 Component Architecture:"
echo "   Standalone components: $STANDALONE"
echo "   NgModule-based components: ~$MODULE_COMPONENTS modules"
echo ""

if [ $STANDALONE -gt 0 ] && [ $MODULE_COMPONENTS -gt 0 ]; then
  echo "✅ Mixed architecture detected (both patterns coexist)"
  echo "   This is NORMAL and SUPPORTED by Angular."
  echo ""
  echo "💡 Recommendations:"
  echo "   - Keep custom NgModule components as-is (no migration needed)"
  echo "   - New PWA standalone components work alongside your modules"
  echo "   - Only migrate to standalone if there's clear benefit"
  echo ""
  echo "📋 Decision Required:"
  echo "   For each custom feature, decide:"
  echo "   A) Keep NgModule pattern (recommended for stable code)"
  echo "   B) Migrate to standalone (only if justified)"
  echo ""
  echo "   Document your decision in docs/architecture-decisions.md"
elif [ $STANDALONE -eq 0 ]; then
  echo "✅ Pure NgModule architecture"
  echo "   No migration needed - this pattern is fully supported."
  echo ""
  echo "💡 Note: New PWA may use standalone components."
  echo "   Your NgModule components will work alongside them."
else
  echo "✅ Pure standalone architecture"
  echo "   All components use the modern standalone pattern."
fi
