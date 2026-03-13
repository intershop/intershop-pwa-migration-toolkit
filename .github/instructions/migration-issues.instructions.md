---
applyTo: '**/migration*.{js,sh,ts}'
---

# PWA Migration - Common Issues and Solutions

This guide documents common problems encountered during PWA migrations and their solutions.

## -1. AI Assistant Renaming Git Remotes

**Problem**: AI coding assistants following migration instructions literally try to rename git remotes to match documentation examples (`origin` → Intershop, `gitlab` → project), breaking existing git workflows.

**Symptoms**:

```bash
# AI suggests or executes:
git remote rename origin upstream
git remote rename gitlab origin
# Or pushes to wrong remote
git push origin develop  # Pushes to Intershop (READ-ONLY) instead of project repo
```

**Root Cause**: Migration documentation previously used specific remote names (`origin`, `gitlab`) as if they were universal standards, when they're just examples. Each project has its own remote naming conventions.

**Prevention**:

1. **For humans**: Understand that `<intershop-remote>` and `<project-remote>` are placeholders  
   Replace with your actual remote names (use `git remote -v` to identify them)

2. **For AI assistants**: Documentation now uses placeholders (`<intershop-remote>`, `<project-remote>`)  
   **NEVER rename remotes** - identify which remote points to which repository and use those names

**Solution if remotes were renamed**:

```bash
# Check current remotes
git remote -v

# Restore to your project's conventions (example, adjust to your actual names):
git remote rename upstream origin
git remote rename origin gitlab

# Or remove and re-add with correct names:
git remote remove problematic-name
git remote add correct-name <url>

# Verify
git remote -v
```

**Key Principle**: Remote names are project-specific conventions. The documentation describes the **concept** (two remotes: one for Intershop, one for your project), not mandatory naming.

## -1. Missing Global Angular CLI After Migration

**Problem**: After completing the migration and installing dependencies, the `ng` command is no longer available in the terminal, even though the project builds successfully.

**Symptoms**:

```bash
# Dev server runs fine
npm start  # Works

# Stop the server (Ctrl+C)
# Try to run ng command
ng serve
# Output: bash: ng: command not found

ng build
# Output: ng: command not found
```

**Root Cause**: 
- `npm ci` or `npm install` installs Angular CLI **locally** in `node_modules/.bin/`
- Local CLI is used by npm scripts but not available as global command
- During migration, the old global CLI may have been removed/uninstalled
- The new global CLI is **not** automatically installed by npm install

**Solution**:

```bash
# 1. Check required CLI version from package.json
grep '@angular/cli' package.json
# Example output: "@angular/cli": "^16.2.12"

# 2. Install global CLI matching the project version
npm install -g @angular/cli@16.2.12

# 3. Verify installation
ng version
# Should show Angular CLI version 16.2.12

# 4. Now ng commands work directly
ng serve
ng build
ng generate component my-component
```

**Prevention**:

Both migration scripts (`migration-helper.js` and `migrate-custom-branch.sh`) now check for global CLI availability and offer to install it automatically. If you're migrating manually:

```bash
# After npm install, always verify and install global CLI
which ng || npm install -g @angular/cli@$(node -p "require('./package.json').devDependencies['@angular/cli']")
```

**Why Two CLIs?**
- **Local CLI** (`node_modules/.bin/ng`): Used by npm scripts, ensures consistent version per project
- **Global CLI** (`ng` command): Convenient for direct terminal commands, shared across projects

**Best Practice**: Keep global CLI version matched to your active project's version.

## 0. Angular Version Mismatch

**Problem**: Attempting migration with mismatched Angular versions causes massive compilation errors (100+ errors) and wastes troubleshooting time.

**Symptoms**:

```bash
# After merge, npm install shows warnings
npm WARN EBADENGINE Unsupported engine
# Or after npm run build:
ERROR in node_modules/@angular/core/... is not compatible with TypeScript version
ERROR in ... Type 'Observable<unknown>' is not assignable to type 'Observable<T>'
# Hundreds of similar errors cascade
```

**Root Cause**: Target PWA branch requires Angular 16, but your customization branch still uses Angular 14/15.

**Solution**:

**Option A: Pre-Migration Update (Recommended)**:

```bash
# BEFORE starting migration, in your customization branch:
# 1. Check target Angular version
git checkout feature/migration-4.0-to-9.1
grep '\"@angular/core\"' package.json
git checkout your-custom-branch

# 2. Update Angular in customization branch
npx @angular/cli@16 update @angular/core@16 @angular/cli@16

# 3. Update related packages
npx @angular/cli@16 update @ngrx/store@16

# 4. Test and commit
npm install
npm run build
git add .
git commit -m "chore: update Angular to v16 for PWA 9.1 compatibility"

# 5. NOW start migration
./scripts/migrate-custom-branch.sh
```

**Option B: Post-Migration Update**:

```bash
# After merge, if you encounter Angular version errors:
# 1. Accept target branch's package.json during merge
# (Use theirs for dependencies)

# 2. Install dependencies
npm install

# 3. Continue with build cycle
npm run build
```

**Prevention**:

- Always check Angular compatibility BEFORE starting migration (see migration-checklist.instructions.md)
- Update Angular as separate commit before merging PWA versions
- Check PWA release notes for Angular version requirements

**Quick Angular Version Check**:

```bash
# One-liner to compare Angular versions
echo "Current: $(grep '\"@angular/core\"' package.json | cut -d'"' -f4)"
git show feature/migration-4.0-to-9.1:package.json | grep '\"@angular/core\"' | \
  awk '{print "Target:  " $2}' | tr -d '\",'
```

## 1. SCSS Variable Gaps in Custom Themes

**Problem**: Standard themes (b2b, b2c) get new SCSS variables in major PWA updates, but custom themes don't inherit these automatically.

**Solution**: After merge, systematically compare custom theme variables with b2b theme:

```bash
# Compare variable files
diff src/styles/themes/b2b/variables.scss src/styles/themes/[custom]/variables.scss
```

**Critical Variables to Check** (PWA 9.1):

```scss
// Import Sass modules for PWA 9.1+
@use 'sass:color';
@use 'sass:map'; // Required if using map.get(), map.merge(), etc.

// Corporate color variations
$CORPORATE-LIGHT: color.adjust($CORPORATE-PRIMARY, $lightness: 10%);
$CORPORATE-DARK: color.adjust($CORPORATE-PRIMARY, $lightness: -20%);

// General colors
$color-quaternary: #d5d5d5;

// PWA 9.1 special colors (for status indicators)
$color-special-error: #c00;
$color-special-warning: #f39c12;
$color-special-info: #006f6f;
$color-special-success: #3c7d3c;

// Product label colors (renamed in 9.1)
$color-special-sale: #ea1919;
$color-special-topseller: #cf00a5;
$color-special-new: #06f;

// Backgrounds
$bg-color-corporate: $CORPORATE-PRIMARY;

// Tables
$table-cell-padding: 0.75rem;
$table-bg: transparent;

// Filter swatches
$swatch-image-border-radius: 50%;
```

**Pattern**: Always add these in the same order as in b2b/variables.scss to maintain consistency.

## 2. Environment Feature Registration

**Problem**: Custom features used in `environment.*.ts` must be registered in the Union type in `environment.model.ts` first.

**Solution**: When adding custom features, always update `environment.model.ts` first:

```typescript
// 1. First: Add to environment.model.ts features union
features: (
  | 'compare'
  | 'yourCustomFeature'  // ← Your custom feature name
  | 'messageToMerchant'  // ← May be missing in older PWA versions
  // ... other features
)[]

// 2. Then: Use in environment.[your-config].ts
features: [
  ...ENVIRONMENT_DEFAULTS.features,
  'yourCustomFeature',
  'messageToMerchant',
]
```

**Common Missing Features** (PWA 9.1):

- `messageToMerchant` (B2B)
- Custom extension features (examples: `inventory`, `tacton`, `yourFeature`)

## 3. Localization File Conflicts

**Problem**: Localization files (en_US.json, de_DE.json, fr_FR.json) are modified in both branches. Using simple `--ours` or `--theirs` loses translations from one side.

**Why This Happens**:

- **New PWA version** adds translations for new features (e.g., new buttons, messages)
- **Your customization** adds translations for custom features (e.g., warehouse selector, custom reports)
- Git marks these files as conflicted during merge

**Symptoms**:

```bash
# After merge
git status
# both modified:   src/assets/i18n/en_US.json
# both modified:   src/assets/i18n/de_DE.json
```

**Wrong Approach** (Loses Data):

```bash
# ❌ DON'T: Accept only one side
git checkout --ours src/assets/i18n/en_US.json   # Loses new PWA translations
git checkout --theirs src/assets/i18n/en_US.json # Loses your custom translations
```

**Correct Approach** (Merge Both):

**Option A: Automated Merge** (Recommended):

See migration-git.instructions.md section "Localization File Merge Strategy" for complete merge script.

**Option B: Manual Merge** (Quick):

```bash
# 1. Accept new PWA version first
git checkout --theirs src/assets/i18n/en_US.json

# 2. Check what custom translations you had
git show :3:src/assets/i18n/en_US.json > custom-translations.json

# 3. Identify your custom keys (keys not in base PWA)
# Manually copy custom translation keys back into en_US.json
# Look for patterns like:
# - "warehouse.*"
# - "inventory.*"  
# - "custom.feature.*"
# - Your specific feature keys

# 4. Sort and format
npm run sort-i18n

# 5. Commit
git add src/assets/i18n/en_US.json
```

**Option C: Side-by-Side Review**:

```bash
# Extract versions for comparison
git show :2:src/assets/i18n/en_US.json > pwa-new.json     # New PWA
git show :3:src/assets/i18n/en_US.json > custom.json      # Your customization
git show :1:src/assets/i18n/en_US.json > base.json        # Common ancestor

# Use jq or VS Code to compare and merge
code --diff pwa-new.json custom.json

# Merge manually, then
mv merged.json src/assets/i18n/en_US.json
npm run sort-i18n
git add src/assets/i18n/en_US.json
```

**Common Patterns to Identify Custom Translations**:

```json
{
  // Custom feature translations (always keep these)
  "warehouse.selector.label": "Select Warehouse",
  "warehouse.inventory.heading": "Warehouse Inventory",
  "inventory.low_stock.warning": "Low Stock Alert",
  
  // Custom modifications to existing keys (review carefully)
  "product.add_to_cart.link": "Add to Warehouse Cart",  // Modified for warehouse context
  
  // Standard PWA translations (from new version)
  "copilot.chat.heading": "AI Assistant",  // New in PWA 9.1
  "account.costcenter.budget.label": "Budget"  // New in PWA 9.1
}
```

**Verification After Merge**:

```bash
# 1. Check JSON syntax
npx jsonlint src/assets/i18n/*.json

# 2. Sort keys (PWA standard)
npm run sort-i18n

# 3. Check for missing keys compared to base PWA
# (Your custom keys are expected to be extra)
node -e "
  const pwa = require('./src/assets/i18n/en_US.json');
  const base = require('./pwa-new.json');
  const missing = Object.keys(base).filter(k => !pwa[k]);
  if (missing.length) {
    console.log('Missing PWA keys:', missing);
  } else {
    console.log('✓ All PWA keys present');
  }
"

# 4. Test application with each locale
npm run build
# Test UI in all languages
```

**Prevention for Future Migrations**:

```bash
# Document custom translation keys
cat > docs/custom-translations.md << 'EOF'
# Custom Translations

Keys added for custom features:
- warehouse.* - Warehouse management feature
- inventory.* - Inventory tracking feature  
- custom.feature.* - Custom feature X
EOF
```

## 4. B2B Template Variants

**Problem**: B2B configurations use separate `.b2b.html` templates that must be updated independently.

**Solution**: When removing/updating components, check for both templates:

- `component.html` (B2C/default)
- `component.b2b.html` (B2B variant)

**Example**: Removing incomplete component references:

```bash
# Check both templates (replace [extension-name] with your extension)
grep -r "ish-lazy-[extension-name]" src/app/pages/product/product-detail/
# → product-detail.component.html (not found)
# → product-detail.component.b2b.html (found, needs removal)
```

## 5. Module Integration Conflicts

**Problem**: Custom modules and PWA extensions may both add imports/exports to shared modules.

**Solution**: Intelligently merge conflicting arrays in module files:

```typescript
// ❌ Bad: Using --ours or --theirs loses changes
// ✅ Good: Manually merge both sides

// app.module.ts
imports: [
  // PWA 9.1 additions
  CopilotExportsModule,
  // Custom additions
  InventoryRoutingModule,
];

// shared.module.ts
const imports = [
  ...importExportModules,
  ...standaloneComponents, // PWA 9.1
  InventoryExportsModule, // Custom
];
```

## 6. Incomplete Extension Cleanup

**Problem**: Partially implemented extensions (e.g., tacton) cause build errors.

**Solution**:

1. Check for lazy-loaded component references: `grep -r "ish-lazy-[extension-name]"`
2. Remove from templates if not fully implemented
3. Document in MIGRATION_CONFLICTS_REPORT.md for future completion

## 7. Template Syntax Inconsistency

**Problem**: After migration, templates may use inconsistent syntax - some with modern self-closing tags (`<component />`), others with old paired tags (`<component></component>`).

**Why This Happens**:

- Target PWA branch uses modern Angular template syntax
- Your customization branch uses older syntax
- Git merges templates but doesn't normalize syntax

**Symptoms**:

```bash
# Mixed syntax in same file
<ish-product-brand />          <!-- New syntax from PWA -->
<ish-custom-component></ish-custom-component>  <!-- Old syntax from customization -->
```

**Detection**:

```bash
# Count old-style empty paired tags
grep -r "<ish-[a-z-]*></ish-[a-z-]*>" src/app --include="*.html" | wc -l

# Show files with old syntax
grep -r "<ish-[a-z-]*></ish-[a-z-]*>" src/app --include="*.html" | cut -d: -f1 | sort -u
```

**Solution**:

See migration-workflow.instructions.md section "Angular Template Syntax Modernization" for:
- Automated detection script
- Automated fix script  
- Manual review checklist
- Integration with migration workflow

**Quick Fix**:

```bash
# Check templates
./scripts/check-template-syntax.sh

# Auto-fix
./scripts/check-template-syntax.sh --fix

# Verify
npm run build
git diff

# Commit
git add .
git commit -m "refactor: modernize template syntax to self-closing tags"
```

**Important Notes**:

- Only convert truly empty tags (no content between open/close)
- Don't convert tags with ng-content or projected content
- Always verify build succeeds after changes
- This is a **style improvement**, not a breaking change
- Can be done after migration is complete

**Benefits of Modernization**:

- ✅ Consistent with Angular best practices (15+)
- ✅ Cleaner, more readable templates
- ✅ Smaller file sizes
- ✅ Matches official PWA style
- ✅ Prevents linter warnings in future versions

## 8. Linting Errors After Migration

**Problem**: After successful build, `npm run lint` reports numerous warnings/errors due to deprecated patterns or style inconsistencies between old and new PWA versions.

**Common Linting Issues**:

### 1. SCSS Deprecated Functions

```bash
# Symptom
npm run lint
# Error: scss/no-global-function-names
# Use 'sass:color' instead of global 'darken'
```

**Solution**: Migrate to Sass module system

```scss
// Before (deprecated)
@use 'sass:color';

$darker: darken($primary, 10%);
$lighter: lighten($primary, 10%);

// After (correct)
@use 'sass:color';

$darker: color.adjust($primary, $lightness: -10%);
$lighter: color.adjust($primary, $lightness: 10%);
```

### 2. TypeScript Strict Mode Issues

```bash
# Symptom
# Error: @typescript-eslint/no-explicit-any
# Error: @typescript-eslint/strict-boolean-expressions
```

**Solution**: Fix type issues

```typescript
// Before
function process(data: any) {
  if (data) { ... }
}

// After
function process(data: MyDataType | undefined) {
  if (data !== undefined) { ... }
}
```

### 3. Angular Template Syntax

```bash
# Symptom
# Warning: @angular-eslint/template/...
```

**Solution**: Follow Angular best practices from linter suggestions

### Systematic Linting Workflow

```bash
# 1. Run lint and capture output
npm run lint 2>&1 | tee lint-report.log

# 2. Count errors by type
grep -oP '@[a-z-]+/[a-z-]+' lint-report.log | sort | uniq -c | sort -rn

# 3. Fix auto-fixable issues first
npm run lint -- --fix

# 4. Review remaining issues
npm run lint 2>&1 | grep -E 'error|warning' | wc -l

# 5. Decide: fix now or document for later
# Create lint exceptions if needed (not recommended for new code)
```

### Decision Framework: When to Fix Linting Issues

**✅ Fix Immediately** (High Priority):
- Security issues (no-unsafe-*, security/*)
- Type safety issues (@typescript-eslint/no-explicit-any)
- Breaking changes in newer Angular versions
- SCSS deprecated functions (will break in future Sass versions)

**⚠️ Fix Before Deployment** (Medium Priority):
- Code quality issues (complexity, unused variables)
- Accessibility issues (a11y/*)
- Performance issues (trackBy, OnPush)

**📝 Document and Fix Later** (Low Priority):
- Style inconsistencies (prefer-const, naming conventions)
- Non-critical best practices
- Issues in stable, working custom code

### Creating Lint Exception Rules

**Only when necessary** for stable customizations:

```json
// .eslintrc.json - add overrides
{
  "overrides": [
    {
      "files": ["src/app/extensions/my-custom/**/*.ts"],
      "rules": {
        "@typescript-eslint/no-explicit-any": "warn",  // Downgrade to warning
        "complexity": "off"  // Disable for complex custom logic
      }
    }
  ]
}
```

**Important**: Document WHY exceptions are needed

```typescript
// In code - explain why lint rule is disabled
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Legacy API requires any type
function legacyIntegration(data: any) {
  // ...
}
```

### Verification Script

Create `scripts/check-lint-issues.sh`:

```bash
#!/bin/bash
echo "📋 Analyzing linting issues..."

npm run lint 2>&1 | tee /tmp/lint-output.log

ERRORS=$(grep -c "error" /tmp/lint-output.log || true)
WARNINGS=$(grep -c "warning" /tmp/lint-output.log || true)

echo ""
echo "📊 Summary:"
echo "   Errors: $ERRORS"
echo "   Warnings: $WARNINGS"
echo ""

if [ $ERRORS -gt 0 ]; then
  echo "❌ Linting errors must be fixed before deployment"
  exit 1
else
  echo "✅ No linting errors"
  if [ $WARNINGS -gt 0 ]; then
    echo "⚠️  $WARNINGS warnings - review recommended"
  fi
fi
```

## 9. Standalone Components Migration Strategy

**Problem**: Features that existed in old PWA version but were removed in new version still have artifacts in customization branch.

**Example**: Custom extension was in old PWA version but removed in new version.

**Detection Strategy**:

```bash
# Replace [extension-name] and [your-custom-branch] with your actual names

# 1. Check if feature exists in new PWA (develop)
git checkout develop
ls src/app/extensions/[extension-name]  # Does it exist?

# 2. Check if feature exists in custom branch
git checkout [your-custom-branch]
ls src/app/extensions/[extension-name]  # Does it exist?

# 3. If exists in custom but NOT in develop → Feature was removed
```

**Complete Cleanup Required**:

```bash
# Replace [extension-name] with your extension name
# Don't just remove template references!
# Remove ALL artifacts:

# 1. Extension directory
rm -rf src/app/extensions/[extension-name]/

# 2. Template references (all variants!)
grep -r "ish-lazy-[extension-name]" src/app/pages/
grep -r "[extension-name]" src/app/**/*.html

# 3. Module imports/exports
grep -r "[ExtensionName]ExportsModule\|[ExtensionName]RoutingModule" src/app/

# 4. Environment feature toggles
grep -r "'[extension-name]'" src/environments/

# 5. Lazy component registrations
grep -r "lazy-[extension-name]" src/app/
```

**Pattern for Migration Script**:

```bash
# Add to migration-helper.js or migrate-custom-branch.sh
# After merge, detect removed features:

REMOVED_FEATURES=$(comm -13 \
  <(ls src/app/extensions/ | sort) \
  <(git show origin/develop:src/app/extensions | sort))

if [ -n "$REMOVED_FEATURES" ]; then
  echo "⚠️ WARNING: Following features were removed in new PWA:"
  echo "$REMOVED_FEATURES"
  echo "Manual cleanup required!"
fi
```

**Proper Solution Sequence**:

1. **Detect**: Compare extensions between old and new PWA
2. **Ask Developer**: "Feature X was removed from PWA. Your customization uses it. Options:"
   - **A) Keep & Maintain**: Feature is important, you'll maintain it independently
   - **B) Remove Completely**: Feature not needed, clean all references
   - **C) Replace**: Feature has alternative in new PWA, migrate to it
3. **Execute**: Based on developer decision:
   - Keep: Document as custom feature, ensure it still works
   - Remove: Clean ALL references systematically
   - Replace: Implement migration to alternative
4. **Verify**: Search entire codebase for feature name
5. **Document**: Note decision and action in migration report

**Interactive Migration Helper Pattern**:

```javascript
// In migration-helper.js
async function handleRemovedFeatures(removedFeatures) {
  if (removedFeatures.length === 0) return;

  console.log('\n⚠️  WARNING: Following features were removed from new PWA:');

  for (const feature of removedFeatures) {
    console.log(`\n📦 Feature: ${feature}`);
    console.log(`   Path: src/app/extensions/${feature}/`);

    const choice = await ask(
      'How should this feature be handled?\n' +
        '  A) Keep and maintain independently\n' +
        '  B) Remove completely from customization\n' +
        '  C) Check if alternative exists in new PWA\n' +
        'Your choice (A/B/C): '
    );

    switch (choice.toUpperCase()) {
      case 'A':
        console.log(`✓ Keeping ${feature} as custom feature`);
        console.log('  → Verify all dependencies still work');
        console.log('  → Document as custom-maintained extension');
        break;
      case 'B':
        console.log(`✓ Scheduling ${feature} for complete removal`);
        await removeFeatureCompletely(feature);
        break;
      case 'C':
        console.log(`ℹ️  Check PWA documentation for ${feature} alternatives`);
        console.log('  → Manual migration may be required');
        break;
    }
  }
}
```

## Version-Specific Breaking Changes

### PWA 9.1 Breaking Changes

**SCSS - Sass Module System Migration:**

- `darken()` → `color.adjust($color, $lightness: -X%)`
- `lighten()` → `color.adjust($color, $lightness: +X%)`
- `map-get()` → `map.get()` (requires `@use 'sass:map';`)
- `map-merge()` → `map.merge()` (requires `@use 'sass:map';`)
- `str-length()` → `string.length()` (requires `@use 'sass:string';`)
- Required: Add `@use 'sass:color';`, `@use 'sass:map';` at top of custom theme files

**TypeScript:**

- Stricter environment.model.ts feature typing

**Components:**

- Some lazy-loading patterns changed

### PWA 4.0 → 9.1 Custom Theme Requirements

Minimum 11 new SCSS variables required (see Critical Variables above)

## Lessons from Real Migrations

**Context**: These lessons come from a real migration project with custom 'training' theme and removed 'tacton' extension.

**Unexpected Findings**:

1. Custom themes don't inherit new variables → Requires systematic diff check
2. Environment features need both model and config updates → Two-step process
3. SCSS errors appear iteratively → Multiple build cycles needed
4. B2B templates are independent → Must check both .html and .b2b.html
5. Incomplete extensions cause build failures → Need cleanup or completion
6. **Features removed from new PWA still have artifacts in custom branch → Complete cleanup required, not just error fixes**

**Critical Oversight in Example Migration**:

- ❌ Only removed failing template line for removed extension
- ✅ Should have: Detected extension removal, cleaned entire directory, removed all references
- **Lesson**: Always compare `src/app/extensions/` between PWA versions BEFORE fixing build errors
