---
applyTo: '**/migration*.{js,sh,ts}'
---

# PWA Migration - Pre/Post Checklist & Success Criteria

This guide covers the essential checklists to follow before and after migrating the Intershop PWA.

## Pre-Migration Checklist

### 1. Verify Git Remotes Setup

- Identify your **Intershop PWA remote** (READ-ONLY) - for pulling updates (commonly `origin` or `upstream`)
- Identify your **project remote** (READ-WRITE) - for pushing changes (commonly `gitlab`, `origin`, or project name)
- Verify with: `git remote -v`
- **CRITICAL**: Never push to the Intershop PWA remote, always push to your project remote
- **DO NOT** rename remotes to match documentation examples

### 2. Check Angular Version Compatibility

**Problem**: Newer PWA versions often require newer Angular versions. Running migration without the correct Angular version will cause build failures.

**Verification Steps**:

1. **Check target PWA branch Angular version**:

   ```bash
   # Switch to target branch temporarily
   git checkout feature/migration-4.0-to-9.1
   
   # Check required Angular version
   grep '"@angular/core"' package.json
   # Example output: "@angular/core": "^16.2.12"
   
   # Switch back to your branch
   git checkout your-migration-branch
   ```

2. **Check your current Angular version**:

   ```bash
   # In your customization branch
   grep '"@angular/core"' package.json
   # Compare with target version
   ```

3. **If Angular version is outdated**, update BEFORE merging:

   ```bash
   # Update Angular to required version
   # Example: Updating to Angular 16
   npx @angular/cli@16 update @angular/core@16 @angular/cli@16
   
   # Update other Angular packages
   npx @angular/cli@16 update @angular/material@16  # if used
   npx @angular/cli@16 update @ngrx/store@16        # if used
   
   # Verify update succeeded
   npm install
   npm run build
   
   # Commit the Angular update separately
   git add .
   git commit -m "chore: update Angular to version 16 for PWA 9.1 compatibility"
   ```

4. **Alternative: Let migration handle dependencies**:

   If you prefer, you can let the migration merge update all dependencies:

   ```bash
   # After merge conflicts are resolved
   npm install
   # This will install Angular versions from target branch
   ```

**When to Update Angular**:

- **Before migration (recommended)**: Ensures your customizations work with new Angular first
- **After migration**: Simpler but may cause confusion between migration issues and Angular update issues

### 3. Analyze Migration Complexity & Choose Pattern Detection Tier

**NEW: Automated complexity analysis with tier recommendation**

```bash
# Run migration complexity analyzer
./scripts/analyze-migration-complexity.sh [source-version] [target-version]
./scripts/analyze-migration-complexity.sh 4.0.0 9.1.0
```

**Output includes:**
- Version gap analysis
- Customization level (light/moderate/heavy)
- Custom extensions detected
- Custom themes identified
- Modified core files percentage
- **Recommended pattern detection tier**

**Three Pattern Detection Tiers:**

#### Tier 1: Manual CHANGELOG Review
- **For:** Light customization (< 20%), 1-2 versions behind
- **Time:** Fastest for simple migrations
- **Tools:** Git remote, manual diff checking
- **Effort:** Low, but easy to miss patterns

#### Tier 2: Automated Pattern Detection (Recommended)
- **For:** Moderate customization (20-50%), 2-4 versions behind
- **Time:** Saves 2-3 hours of troubleshooting
- **Tools:** `detect-pattern-changes.js`
- **Effort:** Medium, comprehensive scanning

```bash
# Run Tier 2 pattern detection
./scripts/detect-pattern-changes.js 4.0.0 9.1.0

# Generates:
# - Breaking changes list
# - Pattern matches in your code
# - Files affected
# - pattern-detection-report.json (AI-parseable)
```

#### Tier 3: Comprehensive Pattern Database
- **For:** Heavy customization (> 50%), 5+ versions behind
- **Time:** Most thorough, best for complex migrations
- **Tools:** `detect-pattern-changes.js --comprehensive`
- **Effort:** High, but catches everything

```bash
# Run Tier 3 comprehensive detection
./scripts/detect-pattern-changes.js --comprehensive 4.0.0 9.1.0

# Uses data/pattern-migrations.json database
# Includes examples and severity levels
```

**Decision Tree:**
```
Versions behind? Customization?  → Recommended Tier
1-2 versions     Light (< 20%)   → Tier 1 (Manual)
1-2 versions     Moderate        → Tier 2 (Automated)
2-4 versions     Any level       → Tier 2 (Automated)
5+ versions      Heavy (> 50%)   → Tier 3 (Comprehensive)
```

**See:** [migration-pattern-detection.instructions.md](./migration-pattern-detection.instructions.md) for complete guidance

### 4. Run Pattern Detection (Based on Recommended Tier)

After analyzing complexity, run the recommended pattern detection:

**For Tier 1 (Manual):**
```bash
# Fetch CHANGELOG manually
git fetch intershop-pwa
git show intershop-pwa/9.1.0:CHANGELOG.md | less

# Search for relevant patterns
grep -r "darken(" src/styles/
```

**For Tier 2 or 3 (Automated):**
```bash
# Tier 2: Standard detection
./scripts/detect-pattern-changes.js 4.0.0 9.1.0

# Tier 3: Comprehensive with database
./scripts/detect-pattern-changes.js --comprehensive 4.0.0 9.1.0

# Review report
cat pattern-detection-report.json | jq .
```

**Review detected patterns BEFORE starting migration:**
- High-severity patterns should be addressed first
- Plan time for manual review items
- Understand scope of changes needed
- Identify potential blocking issues

### 5. Document Custom Features

Before migrating, document your customizations:

```bash
# List custom extensions
ls -la src/app/extensions/

# List custom themes  
ls -la src/styles/themes/

# Document custom environment features
grep -r "feature" src/environments/
```

**Create a checklist:**
- [ ] Custom theme: `src/styles/themes/[name]/`
- [ ] Custom extensions: List names
- [ ] Custom components: List critical ones
- [ ] Modified core files: List with justification
- [ ] Environment features: List custom ones

### 6. Create Backup Branch

```bash
# Create safety backup
git branch backup-$(date +%Y%m%d)-before-migration
git push <project-remote> backup-$(date +%Y%m%d)-before-migration
```

**Common Angular Version Requirements**:

| PWA Version | Angular Version | Notes                                  |
| ----------- | --------------- | -------------------------------------- |
| PWA 4.x     | Angular 14.x    | TypeScript 4.8                         |
| PWA 5.x-7.x | Angular 15.x    | Standalone components support          |
| PWA 8.x-9.x | Angular 16.x    | Signals, improved SSR, required inputs |
| PWA 10.x+   | Angular 17.x+   | New control flow syntax, SSR hydration |

**Benefits of Pre-Migration Angular Update**:

- ✅ Isolates Angular compatibility issues from migration issues
- ✅ Allows testing custom code with new Angular before adding merge complexity
- ✅ Cleaner git history with separate Angular update commit
- ✅ Easier rollback if Angular update causes issues

### 3. Identify Custom Themes

- Check `src/styles/themes/` for custom theme folders
- Custom themes require manual SCSS variable synchronization
- Standard themes (b2b, b2c) are updated automatically

### 4. Check Template Syntax Compatibility

**Problem**: Newer Angular/PWA versions prefer self-closing tags (`<my-component />`) over paired tags (`<my-component></my-component>`) for components without content.

**Quick Check**:

```bash
# Find templates using old paired-tag syntax (empty tags)
grep -r "<ish-[a-z-]*></ish-[a-z-]*>" src/app --include="*.html" | wc -l
# If count > 0, templates need modernization

# Check target PWA branch syntax
git show feature/migration-4.0-to-9.1:src/app/shell/header/header-default/header-default.component.html | grep -c "/>"
# If count > 0, target uses self-closing syntax
```

**When to Update**:

- **After merge** (recommended): Update template syntax as part of post-migration cleanup
- **Before merge**: Update if you want cleaner merge conflicts

**See**: Section "Angular Template Syntax Modernization" in migration-workflow.instructions.md

### 5. Identify Custom Extensions

- Check `src/app/extensions/` for custom extensions
- Check `projects/` for custom feature modules
- Document all custom routing, exports, and module integrations

### 6. Pattern Adoption Philosophy

**Critical**: New PWA versions may use new Angular patterns (standalone components, new control flow, signals, etc.). **Do not automatically adopt new patterns for existing customizations.**

**Decision Framework**:

```bash
# Check if new PWA uses new patterns
git show feature/migration-4.0-to-9.1:src/app | grep -r "standalone: true" | wc -l

# Your customizations can:
# Option A: Keep existing patterns (recommended for stable code)
# Option B: Gradually adopt new patterns (for new features)
# Option C: Full migration (if capacity allows)
```

**Key Principle**: ⚠️ **Customizations using old patterns + PWA using new patterns = Both work together**

**Examples**:
- **Standalone Components**: NgModule-based customizations coexist with standalone PWA components
- **Control Flow**: `*ngIf` in customizations works alongside `@if` in PWA
- **Signals**: RxJS Observables in customizations work with Signals in PWA

**When to Adopt New Patterns**:
- ✅ New custom features being developed
- ✅ Components being heavily modified anyway
- ✅ Team trained on new patterns
- ✅ Testing capacity available

**When to Keep Old Patterns**:
- ✅ Stable, working customizations
- ✅ Large interconnected custom modules
- ✅ Limited testing resources
- ✅ Pattern migration not providing clear business value

**Documentation**: Always document architectural decisions for customizations

### 7. Document Custom Features

### 6. Pattern Adoption Philosophy

**Critical**: New PWA versions may use new Angular patterns (standalone components, new control flow, signals, etc.). **Do not automatically adopt new patterns for existing customizations.**

**Decision Framework**:

```bash
# Check if new PWA uses new patterns
git show feature/migration-4.0-to-9.1:src/app | grep -r "standalone: true" | wc -l

# Your customizations can:
# Option A: Keep existing patterns (recommended for stable code)
# Option B: Gradually adopt new patterns (for new features)
# Option C: Full migration (if capacity allows)
```

**Key Principle**: ⚠️ **Customizations using old patterns + PWA using new patterns = Both work together**

**Examples**:
- **Standalone Components**: NgModule-based customizations coexist with standalone PWA components
- **Control Flow**: `*ngIf` in customizations works alongside `@if` in PWA
- **Signals**: RxJS Observables in customizations work with Signals in PWA

**When to Adopt New Patterns**:
- ✅ New custom features being developed
- ✅ Components being heavily modified anyway
- ✅ Team trained on new patterns
- ✅ Testing capacity available

**When to Keep Old Patterns**:
- ✅ Stable, working customizations
- ✅ Large interconnected custom modules
- ✅ Limited testing resources
- ✅ Pattern migration not providing clear business value

**Documentation**: Always document architectural decisions for customizations

### 7. Document Custom Features

- List all custom features in environment configurations
- Check `src/environments/environment.*.ts` files
- Ensure features are registered in `environment.model.ts`

## Post-Migration Verification Steps

### Critical: Template-Component Consistency Check

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

## Success Criteria

✅ Migration is complete when:

- [ ] All TypeScript compilation errors resolved
- [ ] All SCSS compilation errors resolved
- [ ] Both Browser and Server (SSR) builds succeed
- [ ] All custom features present in bundle (check lazy chunks)
- [ ] **Localization files properly merged** (custom translations preserved, new PWA translations added)
- [ ] Application tested in all supported locales
- [ ] **Template syntax modernized** (empty paired tags converted to self-closing where appropriate)
- [ ] Unit tests pass (or failures documented)
- [ ] Manual smoke test of custom features succeeds
- [ ] Documentation updated
- [ ] **Migration report generated** (`./scripts/generate-migration-report.sh`)
- [ ] Migration branch pushed to project remote (NOT Intershop remote)
- [ ] Pull request created for review

## Generate Migration Report

**After completing migration, generate comprehensive documentation:**

```bash
# Generate migration report
./scripts/generate-migration-report.sh

# Creates: migration-report-YYYY-MM-DD.md
```

**Report includes:**
- ✅ Executive summary with status indicators
- ✅ Version information (Angular, PWA, Node)
- ✅ Customization summary (extensions, themes, components)
- ✅ Pattern detection results (if run)
- ✅ Localization merge details (if applicable)
- ✅ Build, test, and lint status
- ✅ Files changed statistics
- ✅ Next steps and recommendations

**Use the report for:**
- Documentation of migration work
- Pull request description
- Team handoff documentation
- Future migration reference
- Audit trail

## Documentation Requirements

**Update After Migration**:

1. **Migration Report** - `migration-report-YYYY-MM-DD.md` (auto-generated)
2. `CHANGELOG.md` - Add migration notes
3. Extension READMEs - Update compatibility versions
4. `environment.model.ts` - Add JSDoc for new features

## Common Pitfalls to Avoid

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
- **Always push to your project remote, never to Intershop remote**
- Pull PWA updates from Intershop remote, push your work to project remote
- Use your actual remote names, don't rename them to match examples
