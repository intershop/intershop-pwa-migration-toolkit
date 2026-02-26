#!/bin/bash
# Analyzes and categorizes linting issues after migration
# Usage: ./scripts/check-lint-issues.sh

echo "📋 Analyzing linting issues..."
echo ""

# Run lint and capture output
npm run lint 2>&1 | tee /tmp/lint-output.log

# Count errors and warnings
ERRORS=$(grep -c " error " /tmp/lint-output.log 2>/dev/null || echo "0")
WARNINGS=$(grep -c " warning " /tmp/lint-output.log 2>/dev/null || echo "0")

echo ""
echo "────────────────────────────────────────────────"
echo "📊 Linting Summary:"
echo "   Errors: $ERRORS"
echo "   Warnings: $WARNINGS"
echo ""

# Analyze error types
if [ -f /tmp/lint-output.log ]; then
  echo "📈 Top Issue Categories:"
  grep -oP '@[a-z-]+/[a-z-]+' /tmp/lint-output.log 2>/dev/null | sort | uniq -c | sort -rn | head -5
  echo ""
fi

if [ $ERRORS -gt 0 ]; then
  echo "❌ Linting errors must be fixed before deployment"
  echo ""
  echo "💡 Quick Fixes:"
  echo "   1. Auto-fix simple issues: npm run lint -- --fix"
  echo "   2. Review remaining errors: npm run lint 2>&1 | grep error"
  echo "   3. See migration-issues.instructions.md section 8 for guidance"
  exit 1
else
  echo "✅ No linting errors"
  if [ $WARNINGS -gt 0 ]; then
    echo "⚠️  $WARNINGS warnings detected"
    echo ""
    echo "💡 Recommendations:"
    echo "   - Review warnings (many auto-fixable)"
    echo "   - Run: npm run lint -- --fix"
    echo "   - Document exceptions if needed"
  else
    echo "✅ No warnings - excellent code quality!"
  fi
  exit 0
fi
