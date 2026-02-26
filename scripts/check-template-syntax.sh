#!/bin/bash
# Detects empty paired tags that should be self-closing
# Usage: ./scripts/check-template-syntax.sh [--fix]

FIX_MODE=false
if [ "$1" = "--fix" ]; then
  FIX_MODE=true
fi

echo "🔍 Checking template syntax for empty paired tags..."
echo ""

# Find all HTML files
HTML_FILES=$(find src -name "*.html" -type f)

TOTAL_ISSUES=0
FILES_WITH_ISSUES=0

for file in $HTML_FILES; do
  # Find empty paired tags: <tag></tag> (no content between)
  # Match both ish- components and Angular elements
  MATCHES=$(grep -n -E '<(ish-[a-z-]+)([^>]*)></\1>' "$file" 2>/dev/null)
  
  if [ -n "$MATCHES" ]; then
    COUNT=$(echo "$MATCHES" | wc -l)
    TOTAL_ISSUES=$((TOTAL_ISSUES + COUNT))
    FILES_WITH_ISSUES=$((FILES_WITH_ISSUES + 1))
    
    echo "📄 $file ($COUNT issues)"
    echo "$MATCHES" | head -3
    
    if [ $COUNT -gt 3 ]; then
      echo "   ... and $((COUNT - 3)) more"
    fi
    echo ""
  fi
done

echo "────────────────────────────────────────────────"
echo "📊 Summary:"
echo "   Files with issues: $FILES_WITH_ISSUES"
echo "   Total empty paired tags: $TOTAL_ISSUES"
echo ""

if [ $TOTAL_ISSUES -eq 0 ]; then
  echo "✅ All templates use modern syntax!"
  exit 0
fi

if [ "$FIX_MODE" = false ]; then
  echo "💡 To automatically fix these issues, run:"
  echo "   ./scripts/check-template-syntax.sh --fix"
  exit 1
else
  echo "🔧 Fixing issues..."
  node scripts/fix-template-syntax.js
fi
