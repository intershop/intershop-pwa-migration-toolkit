---
applyTo: '**/migration*.{js,sh,ts}'
---

# PWA Migration - Index and Overview

**NOTE:** This guide has been split into focused, manageable sections for better readability and AI processing.

## 📚 Essential Reading

**Before starting any migration, consult these official Intershop PWA guides:**

- **[Migration Guide (migrations.md)](https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/migrations.md)** - Version-specific breaking changes, SCSS renames, API changes
- **[Customization Guide (customizations.md)](https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/customizations.md)** - Three migration approaches (cherry-pick/rebase/merge), best practices
- **[Updating Dependencies (updating-pwa.md)](https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/updating-pwa.md)** - Dependency management workflow
- **[Intershop Academy Videos](https://public.academy.intershop.com/plus/catalog)** - Video tutorials for complex migrations (7.0→8.0, 8.0→9.0)

**This toolkit provides:**
- ✅ Automation scripts for repetitive tasks
- ✅ Proactive validation and detection
- ✅ Version-agnostic pattern database
- ✅ AI-friendly structured instructions

**Official docs provide:**
- ✅ Conceptual understanding and "why"
- ✅ Detailed breaking changes per version
- ✅ Migration strategy guidance
- ✅ Historical context and evolution

## Version-Aware Migration Approach

**CRITICAL:** All migrations must track source and target versions explicitly. The migration process, patterns, and breaking changes vary significantly between PWA versions.

### Version Information to Capture

**Always document:**
1. **Source PWA version** - Current version you're migrating FROM (e.g., `4.0.0`, `9.1.0`)
2. **Target PWA version** - Desired version you're migrating TO (e.g., `9.1.0`, `10.0.0`)
3. **Angular version** - Both source and target (critical for compatibility)
4. **Node.js version** - Required for target PWA
5. **ICM version** - Backend compatibility requirements

### Why Version Tracking Matters

- **Breaking changes** are version-specific and cumulative
- **Pattern detection** needs to analyze ALL versions between source and target
- **Intermediate versions** may introduce obstacles that need addressing
- **Migration complexity** scales with version gap (1 minor vs 2 major versions)
- **Automation scripts** use version parameters to fetch correct CHANGELOGs and patterns

### Version Detection Commands

```bash
# Check current PWA version
git describe --tags --abbrev=0
# OR
grep '"version"' package.json

# Check Angular version
grep '"@angular/core"' package.json

# Check Node.js version requirement
cat .nvmrc
# OR
grep "node" package.json | grep "engines"

# List available PWA tags (for target selection)
git ls-remote --tags https://github.com/intershop/intershop-pwa.git | grep -v '\^{}' | sort -V | tail -20
```

### General Migration Pattern (Any Version)

```bash
# 1. Identify versions
SOURCE_VERSION="X.Y.Z"  # Your current version
TARGET_VERSION="A.B.C"  # Desired version

# 2. Analyze complexity and get tier recommendation
./scripts/analyze-migration-complexity.sh $SOURCE_VERSION $TARGET_VERSION

# 3. Detect breaking changes between versions
./scripts/detect-pattern-changes.js $SOURCE_VERSION $TARGET_VERSION

# 4. Execute migration with version parameters
./scripts/migrate-custom-branch.sh --from $SOURCE_VERSION --to $TARGET_VERSION
```

### Major Version Milestones (Reference)

| PWA Version | Angular | Node.js | Key Changes |
|-------------|---------|---------|-------------|
| 4.0.x | 14 | 16 | Baseline legacy architecture |
| 9.0.x | 15/16 | 18 | Sass module system, standalone components |
| 9.1.x | 16 | 18 | Stricter typing, self-closing tags |
| **10.0.x** | **17** | **22** | **Control flow syntax (@if/@for), Bootstrap Icons, New SSR** |

**Note:** This table is a reference guide. Always check actual requirements in target version's documentation.

### Dynamic Pattern Detection

The toolkit uses version parameters to:
- Fetch correct CHANGELOG.md for target version
- Apply relevant patterns from `data/pattern-migrations.json`
- Calculate cumulative breaking changes across version gap
- Recommend appropriate migration tier (1/2/3)

**Example:** Migrating 4.0.0 → 10.0.0 applies patterns from:
- 4.0 → 9.0, 9.0 → 9.1, 9.1 → 10.0 (PWA-specific)
- 14 → 15, 15 → 16, 16 → 17 (Angular-specific)

## Migration Documentation Structure

The migration documentation is organized into the following files:

### 📋 [migration-checklist.instructions.md](./migration-checklist.instructions.md)

**Pre/Post Migration Checklists and Success Criteria**

- Pre-migration checklist (git remotes, themes, extensions)
- Version identification (CRITICAL first step)
- Post-migration verification steps

### 🔀 [migration-approaches.instructions.md](./migration-approaches.instructions.md) ⭐ NEW

**Three Proven Migration Strategies (from Official Docs)**

- **Cherry-Pick Approach:** Apply commits one-by-one with context (recommended)
- **Rebase Approach:** Linear Git history, clean commits
- **Merge Approach:** Fast but all conflicts at once
- **Decision matrix:** Which approach to use when
- **Integration with toolkit scripts**

Based on [Official Customization Guide](https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/customizations.md)

### 🔧 [migration-workflow.instructions.md](./migration-workflow.instructions.md)
- Template-component consistency checks
- Success criteria and documentation requirements
- PWA 10.0-specific preparation steps

### 🔟 [migration-pwa10.instructions.md](./migration-pwa10.instructions.md) **[NEW]**

**PWA 10.0-Specific Migration Guide**

- Angular 17 control flow migration workflow
- Font Awesome → Bootstrap Icons migration
- Detection vs. migration tool matrix
- Automated transformation tools
- Manual migration requirements
- Troubleshooting PWA 10.0 issues

### 🔧 [migration-issues.instructions.md](./migration-issues.instructions.md)

**Common Issues and Solutions**

- SCSS variable gaps in custom themes
- Environment feature registration
- B2B template variants
- Module integration conflicts
- Feature removal detection
- Version-specific breaking changes

### ⚙️ [migration-workflow.instructions.md](./migration-workflow.instructions.md)

**Workflow Patterns and Automation**

- Iterative build cycle
- Testing strategies
- Lint-driven migration approach
- Automation opportunities
- Time estimates and efficiency gains

### 🌿 [migration-git.instructions.md](./migration-git.instructions.md)

**Git Operations and Strategies**

- Git remote setup (origin vs gitlab)
- Conflict resolution strategies
- Rollback procedures
- Branch naming conventions
- Commit message guidelines

### 💻 [migration-examples.instructions.md](./migration-examples.instructions.md)

**Code Examples and Patterns**

- Environment feature configuration examples
- SCSS variable migration patterns
- Module merge examples
- Template restoration examples
- Extension cleanup scripts

## Quick Reference

### For First-Time Migrations

1. Start with [migration-checklist.instructions.md](./migration-checklist.instructions.md) - Pre-migration checklist
2. Review [migration-git.instructions.md](./migration-git.instructions.md) - Git setup
3. Follow [migration-workflow.instructions.md](./migration-workflow.instructions.md) - Step-by-step process

### When You Encounter Issues

- Check [migration-issues.instructions.md](./migration-issues.instructions.md) for common problems and solutions
- Refer to [migration-examples.instructions.md](./migration-examples.instructions.md) for code examples

### Time Planning

- **Major version (4.0 → 9.1)**: 3-6 hours
- **Minor version (9.1 → 9.2)**: 1-2 hours
- **First-time migration**: 8-12 hours

## Overview

This guide documents lessons learned from PWA 4.0 → 9.1 migration to ensure smooth future migrations.

---

**The detailed content has been moved to dedicated files. Please refer to the links above for specific migration topics.**

**Legacy content below this line has been preserved for reference but should be migrated to the appropriate files above.**

---

1. **Verify Git Remotes Setup**

   - Identify **Intershop PWA remote** (READ-ONLY) - for pulling updates
   - Identify **project remote** (READ-WRITE) - for pushing changes  
   - Verify with: `git remote -v`
   - **CRITICAL**: Never push to Intershop PWA remote, always push to project remote
   - **DO NOT** rename remotes to match documentation - use your actual remote names

2. **Identify Custom Themes**

   - Check `src/styles/themes/` for custom theme folders
   - Custom themes require manual SCSS variable synchronization
   - Standard themes (b2b, b2c) are updated automatically

3. **Identify Custom Extensions**

   - Check `src/app/extensions/` for custom extensions
   - Check `projects/` for custom feature modules
   - Document all custom routing, exports, and module integrations

4. **Document Custom Features**
   - List all custom features in environment configurations
   - Check `src/environments/environment.*.ts` files
   - Ensure features are registered in `environment.model.ts`

### Post-Migration Verification Steps

#### Critical: Template-Component Consistency Check

**Problem**: During migrations, custom component implementations from the customization branch can be lost while templates remain unchanged, causing runtime errors.

**Verification Workflow**:

1. **Scan all templates for async pipe usage**:

   ```bash
   # Find all observable usages in templates
   grep -r "\$.*|.*async" src/app/ --include="*.html"
   ```

2. **For each component with templates using observables**:

   - Verify the observable is declared in the TypeScript class
   - If missing, check if it's a custom implementation issue

3. **Check customization branch for missing implementations**:

   ```bash
   # Compare current component with customization branch
   git show training_4.0.0:src/app/[path]/component.ts

   # Or use diff to see differences
   git diff training_4.0.0 HEAD -- src/app/[path]/component.ts
   ```

4. **If customization branch has additional implementation**:

   - **DO NOT automatically restore** - this might have been intentionally changed
   - **ASK USER**: "The customization branch has [describe implementation]. Should this be restored in the current version?"
   - Wait for user decision before making changes

5. **Document findings**:
   - List all components where custom implementations were found
   - Note which implementations were restored and which were skipped

**Common Migration Issues**:

- Missing facade injections from customization (e.g., `AccountFacade` for `isUserAuthorized$`)
- Lost observable initializations in `ngOnInit()` from custom code
- Custom logic that needs to be merged with new PWA version

**Example Case: Header Navigation**:

- Template uses `*ngIf="isUserAuthorized$ | async"` for custom warehouse link
- Current version missing `AccountFacade` injection and `isUserAuthorized$` observable
- Check: `git show training_4.0.0:src/app/shell/header/header-navigation/header-navigation.component.ts`
- Found: Customization has `AccountFacade` injection and `isUserAuthorized$` initialization
- Action: **Ask user if warehouse link feature should be kept and implementation restored**

### Common Migration Issues and Solutions

#### 1. SCSS Variable Gaps in Custom Themes

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

#### 2. Environment Feature Registration

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

#### 3. B2B Template Variants

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

#### 4. Module Integration Conflicts

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

#### 5. Incomplete Extension Cleanup

**Problem**: Partially implemented extensions (e.g., tacton) cause build errors.

**Solution**:

1. Check for lazy-loaded component references: `grep -r "ish-lazy-[extension-name]"`
2. Remove from templates if not fully implemented
3. Document in MIGRATION_CONFLICTS_REPORT.md for future completion

#### 6. Feature Removal Detection (CRITICAL)

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

### Migration Workflow Pattern

**Recommended Iterative Build Cycle**:

```bash
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

1. **TypeScript** (2-5 errors): Environment features, module imports, type mismatches
2. **SCSS** (5-15 errors): Missing theme variables, deprecated functions
3. **Templates** (0-3 errors): Unknown component selectors, removed directives
4. **Removed Features** (0-3): Extensions that existed in old PWA but removed in new version

### Automation Opportunities

**Create Theme Variable Sync Script**:

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

### Testing Strategy After Migration

**Comprehensive Test Checklist**:

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

### Lint-Driven Migration Strategy

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

### Post-Migration Instructions Coherence Check

**Critical**: After migration, verify that your customization follows current best practices.

**Workflow:**

1. **Review Project Instructions**:

   ```bash
   # Check all instruction files
   ls .github/instructions/*.instructions.md
   ```

2. **Compare Code Against Instructions**:

   - Check if your custom code uses deprecated patterns
   - Verify your code follows documented best practices
   - Look for inconsistencies between instructions and implementation

3. **Common Inconsistencies to Check**:

   | Instruction Topic  | What to Verify             | How to Check                                     |
   | ------------------ | -------------------------- | ------------------------------------------------ |
   | SCSS Syntax        | Using new Sass modules     | `grep -r "darken\|lighten\|map-get" src/styles/` |
   | Component Patterns | OnPush, async pipe usage   | Review custom components                         |
   | Service Patterns   | Error handling, validation | Review custom services                           |
   | State Management   | NgRx patterns              | Review effects/reducers                          |

4. **Fix Inconsistencies**:

   ```bash
   # Example: Found old SCSS syntax in custom theme
   # 1. Update theme to use new syntax
   # 2. Verify with lint: npm run lint
   # 3. Test: npm run build
   ```

5. **Document Findings**:
   - Note any deviations from instructions
   - Update custom documentation if needed
   - Consider updating instructions if patterns changed

**Why This Matters:**

- Migration can introduce inconsistencies
- Old customizations may use deprecated patterns
- Instructions evolve with PWA versions
- Ensures long-term maintainability

### Documentation Requirements

**Update After Migration**:

1. `MIGRATION_SUCCESS_REPORT.md` - Document all fixes
2. `CHANGELOG.md` - Add migration notes
3. Extension READMEs - Update compatibility versions
4. `environment.model.ts` - Add JSDoc for new features

### Version-Specific Notes

#### PWA 9.1 Breaking Changes

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

#### PWA 4.0 → 9.1 Custom Theme Requirements

Minimum 11 new SCSS variables required (see Critical Variables above)

### Git Conflict Resolution Strategy

**Smart Conflict Resolution Order**:

1. **--ours**: Custom configurations (docker-compose.yml, environment files, custom templates)
2. **Manual merge (preferred)**: Localization files (*.json in src/assets/i18n/) - merge both sides
3. **--theirs**: Standard PWA core code (PWA features, libraries)
4. **Manual merge**: Module integrations (app.module.ts, shared.module.ts)

**IMPORTANT**: See migration-git.instructions.md section "Localization File Merge Strategy" for detailed merge strategy.

### Template Syntax Modernization

**Post-Migration Task**: Modernize template syntax from paired tags to self-closing tags.

**Quick Check**:
```bash
# Detect old syntax
grep -r "<ish-[a-z-]*></ish-[a-z-]*>" src/app --include="*.html" | wc -l

# Auto-fix
./scripts/check-template-syntax.sh --fix
```

**See**: migration-workflow.instructions.md section "Angular Template Syntax Modernization" for:
- Complete detection and fix scripts
- Manual review guidelines
- Integration with migration workflow

**When**: After successful migration build, as separate commit for clean history.

### Performance Considerations

**Build Performance**:

- First build after migration: ~3-5 minutes
- Incremental builds: ~1-2 minutes
- Expected bundle size: 1.5 MB → 350 KB (gzipped)

**Test Performance**:

- Unit tests should complete in < 2 minutes
- E2E test suite: ~5-10 minutes

### Git Remote Strategy

**IMPORTANT: Two-Remote Setup**

```bash
# Check your actual remote configuration (names may vary)
git remote -v
# Example output:
# upstream  git@github.com:intershop/intershop-pwa.git (fetch)  ← Intershop (READ-ONLY)
# upstream  git@github.com:intershop/intershop-pwa.git (push)
# origin    git@gitlab.your-company.com:your-project.git (fetch)  ← Your project (READ-WRITE)
# origin    git@gitlab.your-company.com:your-project.git (push)

# Pull PWA updates from Intershop remote (replace <intershop-remote> with actual name)
git fetch <intershop-remote>
git pull <intershop-remote> develop

# Push your work to project remote (replace <project-remote> with actual name)
git push -u <project-remote> migration/training-to-9.1
git push <project-remote> feature/migration-tooling

# NEVER push to Intershop remote - it's read-only and managed by Intershop
```

### Rollback Strategy

If migration fails:

```bash
# Keep original branch safe
git branch backup-training_4.0.0 training_4.0.0

# Failed migration can be abandoned
git branch -D migration/failed-attempt

# Restart from clean slate
git checkout develop
git checkout -b migration/training-to-9.1-retry
git merge --no-commit training_4.0.0

# Always push to gitlab, not origin
git push -u gitlab migration/training-to-9.1-retry
```

### Success Criteria

✅ Migration is complete when:

- [ ] All TypeScript compilation errors resolved
- [ ] All SCSS compilation errors resolved
- [ ] Both Browser and Server (SSR) builds succeed
- [ ] All custom features present in bundle (check lazy chunks)
- [ ] Unit tests pass (or failures documented)
- [ ] Manual smoke test of custom features succeeds
- [ ] Documentation updated
- [ ] Migration branch pushed to project remote (NOT Intershop remote)
- [ ] Pull request created for review

### Common Pitfalls to Avoid

❌ **Don't**:

- Skip comparing theme variables (causes runtime SCSS errors)
- Forget B2B template variants
- Use --theirs for custom configurations
- Push without build verification
- Ignore lint errors (they indicate issues)
- **Push to origin (GitHub) - it's read-only**

✅ **Do**:

- Build iteratively after each fix category
- Document all manual changes
- Test both B2B and B2C configurations
- Keep migration commits atomic and descriptive
- Create backup branches before major merges
- **Always push to project remote, never to Intershop remote**
- Pull PWA updates from origin, push your work to gitlab

## Examples

### Example: Adding Custom Feature to Environment

```typescript
// Example: Adding a custom 'inventory' feature

// 1. environment.model.ts
export interface Environment {
  features: (
    | 'compare'
    | 'inventory'  // ← Add your custom feature here first
    // ...
  )[];
}

// 2. environment.[your-config].ts (e.g., environment.production.ts)
features: [
  ...ENVIRONMENT_DEFAULTS.features,
  'inventory',  // ← Then use it here
],
```

### Example: SCSS Variable Addition Pattern

```scss
// In src/styles/themes/[your-theme-name]/variables.scss
// Always add in same section and order as b2b theme

// Import Sass color module for PWA 9.1+
@use 'sass:color';

// Corporate design colors section
$CORPORATE-PRIMARY: #688dc3; // Your brand color
$CORPORATE-SECONDARY: color.adjust($CORPORATE-PRIMARY, $lightness: -10%);
$CORPORATE-LIGHT: color.adjust($CORPORATE-PRIMARY, $lightness: 10%); // ← Add after SECONDARY
$CORPORATE-DARK: color.adjust($CORPORATE-PRIMARY, $lightness: -20%); // ← Add after LIGHT

// General colors section
$color-primary: #222;
$color-secondary: #2c2d2e;
$color-tertiary: #eee;
$color-quaternary: #d5d5d5; // ← Add in sequence

// Special colors section
$color-special-primary: #e74c3c;
$color-special-secondary: #f39c12;
// PWA 9.1 special colors (comment for clarity)
$color-special-error: #c00; // ← Group new variables
$color-special-warning: #f39c12;
$color-special-info: #006f6f;
$color-special-success: #3c7d3c;
```

### Example: Module Merge Conflict Resolution

```typescript
// Conflict in shared.module.ts or app.module.ts
<<<<<<< HEAD (PWA 9.1)
const imports = [
  ...importExportModules,
  ...standaloneComponents,
];
=======
const imports = [
  ...importExportModules,
  YourCustomExportsModule,  // Your custom module
];
>>>>>>> your-custom-branch

// ✅ Correct resolution: Keep both
const imports = [
  ...importExportModules,
  ...standaloneComponents,  // Keep PWA 9.1 additions
  YourCustomExportsModule,  // Keep your custom additions
];
```

## Lessons from PWA 4.0 → 9.1 Migration (Example Project)

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

**Time Investment (Conservative Estimates)**:

**Major Version Migration** (e.g., 4.0 → 9.1 with custom themes and extensions):

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

**Minor Version Migration** (e.g., 9.1 → 9.2):

- **Total**: ~1-2 hours

**First-Time Migration** (includes learning the process):

- **Total**: ~8-12 hours

**Factors that increase time**:

- Number of custom themes
- Number of custom extensions
- Extent of B2B customizations
- Breaking changes in new PWA version
- Team unfamiliarity with migration process
- Incomplete documentation of custom features

**Efficiency Gains**:

- Use migration helper scripts: Saves ~30-45 minutes
- Pre-check theme variables: Saves ~15-20 minutes build cycles
- Systematic approach: Reduces debugging time by 40-50%
- Well-documented customizations: Reduces conflict resolution time by 30-40%

## Future Improvements

**Tooling Enhancements**:

1. Create `sync-theme-variables.sh` script
2. Add pre-commit hook to check environment.model.ts consistency
3. Create migration test suite to verify custom features
4. Add SCSS variable diff checker to CI/CD pipeline

**Documentation Enhancements**:

1. Maintain PWA version compatibility matrix
2. Document all custom features and dependencies
3. Create migration runbook for each PWA major version
4. Add architectural decision records (ADRs) for customizations
