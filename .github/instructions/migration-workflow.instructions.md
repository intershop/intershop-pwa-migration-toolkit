---
applyTo: '**/migration*.{js,sh,ts}'
---

# PWA Migration - Workflow and Automation

This guide covers the recommended workflow patterns, build cycles, testing strategies, and automation opportunities for PWA migrations.

## Migration Workflow Pattern

### Recommended Iterative Build Cycle

```bash
# 0. Verify Angular version compatibility (CRITICAL - do this FIRST)
# Check that Angular versions match between branches
grep '"@angular/core"' package.json
# If mismatch, see migration-checklist.instructions.md for update steps

# 1. First build attempt (expect ~10-20 errors)
npm run build 2>&1 | tee build-errors-1.log

# 2. Fix category 1: TypeScript errors (environment, imports)
# Fix errors, then rebuild
npm run build 2>&1 | tee build-errors-2.log

# 3. Fix category 2: SCSS errors (missing variables)
# Add variables systematically, rebuild
npm run build 2>&1 | tee build-errors-3.log

# 4. Verify clean build
npm run build
```

**Expected Error Categories**:

0. **Angular Version Mismatch** (0 or 100+ errors): If Angular versions don't match, you'll see massive errors. Stop and update Angular first.
1. **TypeScript** (2-5 errors): Environment features, module imports, type mismatches
2. **SCSS** (5-15 errors): Missing theme variables, deprecated functions
3. **Templates** (0-3 errors): Unknown component selectors, removed directives
4. **Removed Features** (0-3): Extensions that existed in old PWA but removed in new version

## Angular Template Syntax Modernization

### Problem: Empty Paired Tags vs Self-Closing Tags

**Old Syntax** (Angular 14 and earlier):
```html
<ish-product-brand></ish-product-brand>
<ish-product-inventory></ish-product-inventory>
<ish-loading></ish-loading>
```

**New Syntax** (Angular 15+, preferred):
```html
<ish-product-brand />
<ish-product-inventory />
<ish-loading />
```

**Benefits**:
- Cleaner, more concise templates
- Consistent with modern web component standards
- Reduced template file size
- Better readability

### Detection Script

Create `scripts/check-template-syntax.sh`:

```bash
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
  MATCHES=$(grep -n -E '<(ish-[a-z-]+|ng-container|ng-template)([^>]*)></\1>' "$file" 2>/dev/null)
  
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

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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
```

### Automated Fix Script

Create `scripts/fix-template-syntax.js`:

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * Converts empty paired tags to self-closing tags in Angular templates.
 * Example: <ish-loading></ish-loading> -> <ish-loading />
 */

function fixTemplate(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let changeCount = 0;

  // Pattern 1: Component tags without attributes: <ish-tag></ish-tag>
  const pattern1 = /<(ish-[a-z-]+)><\/\1>/g;
  const matches1 = content.match(pattern1);
  if (matches1) {
    changeCount += matches1.length;
    content = content.replace(pattern1, '<$1 />');
    modified = true;
  }

  // Pattern 2: Component tags with attributes: <ish-tag attr="value"></ish-tag>
  // More complex - need to handle multi-line attributes
  const pattern2 = /<(ish-[a-z-]+)([^>]+)><\/\1>/g;
  const matches2 = content.match(pattern2);
  if (matches2) {
    changeCount += matches2.length;
    content = content.replace(pattern2, '<$1$2 />');
    modified = true;
  }

  // Pattern 3: Multi-line component tags
  // <ish-tag
  //   [attr]="value"
  // ></ish-tag>
  const pattern3 = /<(ish-[a-z-]+)([^>]*\n[^>]*)><\/\1>/g;
  const matches3 = content.match(pattern3);
  if (matches3) {
    changeCount += matches3.length;
    content = content.replace(pattern3, '<$1$2 />');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✓ ${filePath} (${changeCount} fixes)`);
    return changeCount;
  }
  
  return 0;
}

function processDirectory(dir) {
  const pattern = path.join(dir, '**/*.html');
  const files = glob.sync(pattern, { ignore: ['**/node_modules/**', '**/dist/**'] });
  
  let totalFixed = 0;
  let filesFixed = 0;

  files.forEach(file => {
    const fixed = fixTemplate(file);
    if (fixed > 0) {
      totalFixed += fixed;
      filesFixed++;
    }
  });

  return { totalFixed, filesFixed };
}

console.log('🔧 Fixing template syntax...\n');

const { totalFixed, filesFixed } = processDirectory('src');

if (totalFixed === 0) {
  console.log('✅ No issues found - all templates already use modern syntax!');
} else {
  console.log(`\n✅ Fixed ${totalFixed} empty paired tags in ${filesFixed} files`);
  console.log('\n⚠️  Please review changes and test your application:');
  console.log('   npm run lint');
  console.log('   npm run build');
  console.log('   git diff');
}
```

### Integration with Migration Workflow

**Step 1: After Merge, Check Syntax**

```bash
# After resolving merge conflicts and before building
./scripts/check-template-syntax.sh

# If issues found, review output
# Decide: fix now or after successful build
```

**Step 2: Apply Fixes** (After successful build)

```bash
# Recommended: After migration builds successfully
npm run build  # Ensure base migration works

# Then modernize templates
./scripts/check-template-syntax.sh --fix

# Verify fixes
npm run lint
npm run build

# Review changes
git diff

# Commit separately
git add .
git commit -m "refactor: modernize template syntax to self-closing tags"
```

### Manual Review Checklist

**Important**: Automated script handles most cases, but review these:

✅ **Safe to convert** (no content between tags):
```html
<!-- Before -->
<ish-loading></ish-loading>
<ish-product-image></ish-product-image>

<!-- After -->
<ish-loading />
<ish-product-image />
```

❌ **Do NOT convert** (has content between tags):
```html
<!-- Keep as-is (has content) -->
<ish-product-label>Featured</ish-product-label>
<div>Content here</div>

<!-- Keep as-is (has ng-content) -->
<ish-modal-dialog>
  <p>Modal content</p>
</ish-modal-dialog>
```

❌ **Do NOT convert** (special Angular syntax):
```html
<!-- Keep as-is (structural directives) -->
<ng-container *ngIf="condition">
  <p>Content</p>
</ng-container>

<!-- But convert empty ones -->
<ng-container *ngTemplateOutlet="myTemplate" />  <!-- ✅ OK -->
```

### Common Patterns

**Pattern 1: Component lists**
```html
<!-- Before -->
<ish-product-brand></ish-product-brand>
<ish-product-sku></ish-product-sku>
<ish-product-inventory></ish-product-inventory>

<!-- After -->
<ish-product-brand />
<ish-product-sku />
<ish-product-inventory />
```

**Pattern 2: Multi-line attributes**
```html
<!-- Before -->
<ish-search-box
  [configuration]="config"
  [deviceType]="device"
></ish-search-box>

<!-- After -->
<ish-search-box
  [configuration]="config"
  [deviceType]="device"
/>
```

**Pattern 3: Conditional rendering**
```html
<!-- Before -->
<ish-login-status *ngIf="!sticky"></ish-login-status>

<!-- After -->
<ish-login-status *ngIf="!sticky" />
```

### Verification After Fix

```bash
# 1. Lint check
npm run lint -- --fix

# 2. Build verification
npm run build

# 3. Visual diff check (ensure only syntax changed)
git diff src/app/**/*.html | grep -E '^[+-]' | head -20

# 4. Count changes
echo "Files modified: $(git diff --name-only | wc -l)"
echo "Lines changed: $(git diff --shortstat)"
```

### When to Apply Template Modernization

**Option A: After Migration** (Recommended)
- ✅ Cleaner migration history
- ✅ Isolates syntax changes from migration changes
- ✅ Can be reverted independently
- Separate commit: `refactor: modernize template syntax`

**Option B: Before Migration**
- May reduce merge conflicts
- Harder to separate migration issues from syntax changes

**Option C: During Migration**
- Not recommended - too many changes at once
- Hard to debug if issues arise

### Add to package.json Scripts

```json
{
  "scripts": {
    "check:templates": "bash scripts/check-template-syntax.sh",
    "fix:templates": "bash scripts/check-template-syntax.sh --fix"
  }
}
```

Then use:
```bash
npm run check:templates
npm run fix:templates
```

## Testing Strategy After Migration

### Comprehensive Test Checklist

```bash
# 1. Build verification
npm run build              # Both B2B and B2C configs

# 2. Unit tests
npm test                   # All test suites

# 3. Lint check
npm run lint               # Code quality

# 4. E2E tests (if available)
npm run e2e                # Critical user flows

# 5. Manual testing focus areas
# - Custom theme rendering
# - Custom extension features
# - B2B-specific functionality
# - Navigation (if customized)
```

## Lint-Driven Migration Strategy

**Use Lint Warnings as Migration Guide:**

Lint errors often highlight deprecated patterns that need updating:

```bash
# Run lint to identify deprecated patterns
npm run lint 2>&1 | tee lint-report.log

# Common lint warnings during migration:
# - scss/no-global-function-names: Sass module system migrations needed
# - @typescript-eslint/*: TypeScript strict mode issues
# - @angular-eslint/*: Angular best practices
```

**Example Workflow:**

1. **Run lint after merge**: `npm run lint`
2. **Filter SCSS warnings**: `grep "scss/no-global-function-names" lint-report.log`
3. **Systematic fix**:

   ```bash
   # Find all occurrences of deprecated function
   grep -r "map-get(" src/styles/themes/[your-theme]/

   # Add required module import
   # Add: @use 'sass:map';

   # Replace: map-get() → map.get()
   ```

4. **Verify fix**: `npm run lint`
5. **Repeat for next warning category**

**Benefits:**

- Systematic identification of deprecated patterns
- No manual searching required
- Ensures consistency across codebase
- Catches issues before runtime errors

## Automation Opportunities

### Create Theme Variable Sync Script

```bash
# scripts/sync-theme-variables.sh
#!/bin/bash
# Extracts variables from b2b theme and suggests additions for custom themes
# Usage: ./sync-theme-variables.sh [your-theme-name]

TARGET_THEME=${1}
if [ -z "$TARGET_THEME" ]; then
  echo "Usage: $0 <theme-name>"
  echo "Example: $0 my-custom-theme"
  exit 1
fi

B2B_VARS="src/styles/themes/b2b/variables.scss"
CUSTOM_VARS="src/styles/themes/$TARGET_THEME/variables.scss"

if [ ! -f "$CUSTOM_VARS" ]; then
  echo "Error: Theme '$TARGET_THEME' not found"
  exit 1
fi

echo "=== Variables in B2B but missing in $TARGET_THEME ==="
grep '^\$' "$B2B_VARS" | cut -d: -f1 | while read var; do
  if ! grep -q "^$var:" "$CUSTOM_VARS"; then
    echo "Missing: $var"
    grep "^$var:" "$B2B_VARS"
  fi
done
```

## Performance Considerations

### Build Performance

- First build after migration: ~3-5 minutes
- Incremental builds: ~1-2 minutes
- Expected bundle size: 1.5 MB → 350 KB (gzipped)

### Test Performance

- Unit tests should complete in < 2 minutes
- E2E test suite: ~5-10 minutes

## Time Estimates (Conservative)

### Major Version Migration

(e.g., 4.0 → 9.1 with custom themes and extensions)

- Automated merge: ~5-10 minutes
- Conflict resolution: ~30-60 minutes (custom code integration complexity)
- Build error fixes: ~60-120 minutes (iterative, multiple error categories, SCSS migrations)
- Testing:
  - Unit tests: ~20-30 minutes
  - Manual feature testing: ~30-45 minutes
  - E2E tests (if available): ~15-30 minutes
- Documentation updates: ~15-30 minutes
- Buffer for unexpected issues: ~30-60 minutes
- **Total**: ~3-6 hours for major version migration

### Minor Version Migration

(e.g., 9.1 → 9.2)

- **Total**: ~1-2 hours

### First-Time Migration

(includes learning the process)

- **Total**: ~8-12 hours

### Factors That Increase Time

- Number of custom themes
- Number of custom extensions
- Extent of B2B customizations
- Breaking changes in new PWA version
- Team unfamiliarity with migration process
- Incomplete documentation of custom features

### Efficiency Gains

- Use migration helper scripts: Saves ~30-45 minutes
- Pre-check theme variables: Saves ~15-20 minutes build cycles
- Systematic approach: Reduces debugging time by 40-50%
- Well-documented customizations: Reduces conflict resolution time by 30-40%

## Future Improvements

### Tooling Enhancements

1. Create `sync-theme-variables.sh` script
2. Add pre-commit hook to check environment.model.ts consistency
3. Create migration test suite to verify custom features
4. Add SCSS variable diff checker to CI/CD pipeline

### Documentation Enhancements

1. Maintain PWA version compatibility matrix
2. Document all custom features and dependencies
3. Create migration runbook for each PWA major version
4. Add architectural decision records (ADRs) for customizations
