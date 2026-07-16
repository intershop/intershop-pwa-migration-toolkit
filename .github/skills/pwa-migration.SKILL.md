---
name: pwa-migration
description: |
  Expert guide for Intershop PWA migrations between major versions. Provides planning, 
  tier assessment, execution workflows, and troubleshooting. Invokes migration scripts, 
  analyzes complexity, detects patterns, and guides through Git operations. Use for: 
  migration planning, complexity analysis, step-by-step execution, conflict resolution, 
  post-migration validation. DO NOT use for: simple script execution (run directly), 
  general Angular questions, non-migration PWA development.
---

# Intershop PWA Migration Expert Skill

## When to Invoke This Skill

**Use this skill for:**
- 🎯 Planning a migration from one PWA version to another
- 📊 Assessing migration complexity and recommending tier approach
- 🔄 Step-by-step guided migration execution
- 🐛 Troubleshooting migration errors and conflicts
- ✅ Post-migration validation and verification
- 🤔 Decision support (which scripts to run, what order, how to handle conflicts)

**Don't use for:**
- Running a single script (just run it: `node scripts/migrate-custom-branch.js`)
- General Angular development questions
- Non-migration PWA feature development
- Simple file edits

## Capabilities

This skill can:
1. **Analyze** your current PWA version and target version
2. **Assess** migration complexity (Tier 1/2/3)
3. **Recommend** which scripts to run and in what order
4. **Guide** through Git operations (remotes, branches, conflicts)
5. **Invoke** migration scripts with appropriate parameters
6. **Troubleshoot** common issues using pattern database
7. **Validate** post-migration completeness
8. **Generate** comprehensive migration reports

## Migration Process Overview

**CRITICAL FIRST STEP: Version Identification**

Before any migration work, explicitly identify:
1. **Source PWA version** (current)
2. **Target PWA version** (desired)
3. **Angular versions** (both source and target)
4. **Node.js requirements** for target
5. **Version gap** (how many major/minor versions)

**Version detection commands:**
```bash
# Current version
git describe --tags --abbrev=0  # OR grep '"version"' package.json

# Target version (temporarily checkout target branch)
git show <target-branch>:package.json | grep '"version"'

# Angular versions
grep '"@angular/core"' package.json  # Current
git show <target-branch>:package.json | grep '"@angular/core"'  # Target
```

**All migration scripts require version parameters:**
```bash
node scripts/analyze-migration.js <source-version> <target-version>
./scripts/detect-pattern-changes.js <source-version> <target-version>
```

### Phase 1: Discovery & Planning
```
1. **IDENTIFY VERSIONS** - Source and target (MANDATORY FIRST STEP)
2. Interview user about customization scope
3. Review customization best practices (docs/guides/customization-best-practices.md)
4. Run analysis (analyze-migration.js with versions) - complexity + strategy recommendation
5. Recommend tier approach (1: simple merge, 2: pattern detection, 3: comprehensive)
6. Check prerequisites (Angular version, remotes, themes)
7. Create migration plan with version-specific patterns
```

### Phase 2: Preparation
```
1. Verify git remotes setup
2. Run pattern detection (if Tier 2/3)
3. Validate theme completeness (validate-theme-completeness.js)
4. Check template syntax (check-template-syntax.js)
5. Review existing CUSTOMIZATION markers in core files
6. Document baseline state
```

### Phase 3: Execution
```
1. Create migration branch
2. Execute merge/migration (automated or guided)
3. Resolve conflicts with context-aware guidance
4. Sync missing theme variables if needed
5. Fix template syntax issues
6. Handle TypeScript/module errors
7. Add CUSTOMIZATION markers to new modifications (// CUSTOMIZATION: reason)
```

### Phase 4: Validation
```
1. Run build and collect errors
2. Run tests and update snapshots (update-snapshots.js)
3. Suppress template linting temporarily (fix-template-linting.js)
4. Run pre-commit customization checks (pre-commit-customization-check.js)
5. Review customization health checklist (14 items in best-practices guide)
6. Generate migration report (generate-migration-report.js)
7. Verify all checklist items
```

## Tier Assessment Logic

### Tier 1: Simple Merge (1-2 hours)
**Conditions:**
- Version jump: 1-2 minor versions (e.g., 9.0 → 9.2)
- Customization scope: < 20 custom components
- No theme customizations OR theme is up-to-date
- No extension modules

**Approach:** Direct merge, minimal manual intervention

### Tier 2: Pattern Detection (4-8 hours)
**Conditions:**
- Version jump: 2-4 minor or 1 major version (e.g., 4.0 → 6.0)
- Customization scope: 20-100 custom components
- Custom theme with < 50 overrides
- 1-3 extension modules

**Approach:** Use pattern detection, targeted fixes

### Tier 3: Comprehensive Analysis (8-20 hours)
**Conditions:**
- Version jump: 2+ major versions (e.g., 4.0 → 9.1)
- Customization scope: > 100 custom components
- Extensive theme customizations (> 50 variables)
- 4+ extension modules
- B2B customizations or quote management

**Approach:** Full pattern database analysis, systematic migration

## Version-Specific Migration Guidance

### Migrating to PWA 10.0.0 (Latest)

**Key Changes (PWA 9.1 → 10.0):**
- **Angular 17** upgrade (from Angular 16)
- **Control flow syntax** migration: `*ngIf` → `@if`, `*ngFor` → `@for`, `*ngSwitch` → `@switch`
- **Font Awesome → Bootstrap Icons** (breaking icon system change)
- **New SSR architecture** (Angular 17 SSR)
- **Node.js 22** LTS required
- **Logging format** changed to ECS-compatible JSON
- **Inventory REST calls** now separate from product calls

**Critical Actions:**
1. **Update Node.js to 22.x** before migration
2. **Prepare for control flow migration** - All templates need updating
3. **Audit Font Awesome usage** - Every `fa-*` class needs Bootstrap Icons equivalent
4. **Review SSR configuration** - Check for `@nguniversal` references
5. **Update logging setup** - NGINX and SSR logging configs changed

**Pattern Detection:**
```bash
# Detect Angular 17 control flow patterns
./scripts/detect-pattern-changes.js 9.1.0 10.0.0

# Check for Font Awesome usage
grep -r "fa-\|fas \|far \|fab " src/
grep -r "font-awesome" src/

# Check for old control flow syntax
grep -r "\*ngIf=\|\*ngFor=\|\*ngSwitch=" src/
```

**Recommended Approach:**
- **Tier 3 migration** recommended for ANY version to 10.0
- Plan 8-16 hours for control flow syntax migration
- Manual template review required (control flow not auto-fixable)
- Consider incremental: migrate to 9.1 first, then 10.0

### Migrating to PWA 9.1.x

**Key Changes (9.0 → 9.1):**
- Stricter TypeScript typing in environment.model.ts
- Self-closing tag syntax preferred
- Standalone components expanded

**Pattern Detection:**
```bash
./scripts/detect-pattern-changes.js 9.0.0 9.1.0
```

### Migrating to PWA 9.0.x

**Key Changes (8.x → 9.0):**
- Sass module system migration (`darken()` → `color.adjust()`)
- `@use 'sass:color'` imports required
- Map functions modernization

**Pattern Detection:**
```bash
./scripts/detect-pattern-changes.js 8.0.0 9.0.0
```

### Major Version Jumps (4.0 → 10.0, etc.)

**Crossing multiple major versions requires cumulative pattern application:**

Example: 4.0 → 10.0 applies patterns from:
- PWA 4.0 → 9.0, 9.0 → 9.1, 9.1 → 10.0
- Angular 14 → 15, 15 → 16, 16 → 17

**Recommended Strategy:**
1. Use comprehensive mode: `./scripts/detect-pattern-changes.js --comprehensive 4.0.0 10.0.0`
2. Consider intermediate migration: 4.0 → 9.1, then 9.1 → 10.0
3. Plan 16-24 hours for multi-major version jumps
4. Expect Tier 3 complexity

## Common Issue Resolution

### Issue: SCSS Variables Missing in Custom Theme
**Detection:** Build fails with "Undefined variable: $variable-name"

**Script:** `node scripts/validate-theme-completeness.js`

**Resolution:**
1. Sync missing variables: `node scripts/sync-custom-theme-variables.js`
2. Review auto-added variables in `src/styles/themes/custom/style.scss`
3. Adjust values for your brand
4. Re-validate: `node scripts/validate-theme-completeness.js`

### Issue: Template Syntax Outdated
**Detection:** Empty paired tags like `<component></component>`

**Script:** `node scripts/check-template-syntax.js`

**Resolution:**
1. Auto-fix: `node scripts/fix-template-syntax.js`
2. Manual review for complex cases

### Issue: Git Remote Confusion
**Detection:** Push fails or pushes to wrong remote

**Prevention:** Never rename remotes! Use `git remote -v` to identify:
- `<intershop-remote>`: Points to github.com/intershop/intershop-pwa (READ-ONLY)
- `<project-remote>`: Points to your GitLab/project repo (READ-WRITE)

### Issue: Angular Version Mismatch
**Detection:** 100+ build errors, Angular module issues

**Resolution:**
1. Check target PWA Angular version: `grep '@angular/core' package.json`
2. Update Angular BEFORE merging: `ng update @angular/core@16 @angular/cli@16`
3. Then proceed with migration

### Issue: Known Bug in Target Version
**Detection:** Error that seems like integration issue

**Action:** Check GitHub issues page: https://github.com/intershop/intershop-pwa/issues

**Resolution:** If found on GitHub and fixed, wait for next release or apply local patch

## Interactive Workflow

When invoked, this skill should:

1. **Ask discovery questions:**
   ```
   - What is your current PWA version?
   - What is your target PWA version?
   - How many custom components do you have?
   - Do you have custom themes?
   - Do you use B2B features?
   - What git remotes are configured? (run: git remote -v)
   ```

2. **Analyze and recommend:**
   ```
   Based on your answers:
   - Estimated complexity: Tier X
   - Estimated time: X-Y hours
   - Recommended scripts: [list]
   - Critical prerequisites: [list]
   ```

3. **Execute step-by-step:**
   ```
   Step 1: Validate prerequisites
   [Run commands/scripts]
   
   Step 2: Prepare migration
   [Run pattern detection if Tier 2/3]
   
   Step 3: Execute merge
   [Guide through process]
   
   Step 4: Resolve conflicts
   [Context-aware guidance]
   
   Step 5: Validate
   [Run tests, generate report]
   ```

4. **Provide context-aware help:**
   - Reference specific instruction files for details
   - Show relevant examples from migration-examples.instructions.md
   - Suggest specific pattern matches from pattern-migrations.json
   - Guide git operations from migration-git.instructions.md

## Script Reference

### Core Migration Scripts
- `migrate-custom-branch.js` - Automated full migration
- `analyze-migration.js` - Complexity analysis + strategy recommendation (tier + approach)
- `generate-migration-report.js` - Documentation generation
- `pre-commit-customization-check.js` - Catch customization anti-patterns early

### Detection & Analysis
- `detect-pattern-changes.js` - Pattern detection (Tier 2/3)
- `check-template-syntax.js` - Template modernization check
- `check-nodejs-version.js` - Node.js/npm version validation
- `check-icm-compatibility.js` - ICM version compatibility

### Merge & Fix Tools
- `merge-i18n-files.js` - Localization merge
- `merge-docker-compose.js` - Docker config merge
- `sync-custom-theme-variables.js` - SCSS variable sync
- `validate-theme-completeness.js` - SCSS variable validation
- `fix-template-syntax.js` - Auto-fix templates
- `fix-template-linting.js` - Suppress linting issues
- `update-snapshots.js` - Jest snapshot manager

### PWA 10.0 Specific
- `migrate-control-flow.js` - Angular 17 control flow syntax (*ngIf → @if)
- `migrate-bootstrap-icons.js` - Font Awesome → Bootstrap Icons detection

### Validation
- `validate-theme-completeness.js` - Proactive SCSS check
- `check-icm-compatibility.js` - ICM version compatibility verification

## Example Invocation

User: "I need to migrate from PWA 4.0.0 to 9.1.0"

Skill Response:
```
Let me help you plan this migration. First, some questions:

1. How many custom components/modules do you have?
2. Do you have custom SCSS themes?
3. Are you using B2B features?
4. Do you have extension modules?

Meanwhile, let me check your git setup...
[runs: git remote -v]

Based on the version jump (4.0 → 9.1 = 5 major versions), this will likely be 
a Tier 3 migration. Let me run complexity analysis...
[runs: node scripts/analyze-migration.js 4.0.0 9.1.0]

Analysis complete. Recommended approach:
- Tier: 3 (Comprehensive)
- Estimated time: 12-16 hours
- Key concern: Major Angular version jump (11 → 16)

Step 1: Update Angular first...
[guides through ng update]

Step 2: Run pattern detection...
[runs comprehensive pattern analysis]

[Continues with step-by-step guidance...]
```

## Integration with Existing Instructions

This skill **supplements** rather than replaces the existing instruction files:

- **migration-patterns.instructions.md** → Reference for pattern details
- **migration-approaches.instructions.md** → Cherry-pick/rebase/merge strategies
- **migration-issues.instructions.md** → Lookup for specific problems
- **migration-workflow.instructions.md** → Build cycle patterns
- **migration-git.instructions.md** → Git operation details
- **migration-examples.instructions.md** → Code examples
- **migration-checklist.instructions.md** → Validation checklist
- **migration-pattern-detection.instructions.md** → Detection system guide
- **docs/guides/customization-best-practices.md** → Writing migration-friendly code

The skill orchestrates these resources, deciding which to reference based on context.

## Success Criteria

A successful migration guided by this skill should:
- ✅ Build without errors
- ✅ All tests pass (or known failures documented)
- ✅ Theme renders correctly
- ✅ Custom components work as expected
- ✅ Git history preserved and clean
- ✅ Migration report generated
- ✅ Team can understand what was changed and why

## Tool Usage Patterns

### When to invoke subagents:
- Complex codebase exploration (finding pattern usage)
- Analyzing large CHANGELOG files
- Investigating unfamiliar error patterns

### When to run scripts directly:
- Well-defined tasks (validate theme, check syntax)
- Automated fixes (sync variables, fix templates)
- Report generation

### When to ask questions:
- Ambiguous requirements (tier selection edge cases)
- User preference decisions (auto-resolve conflicts?)
- Risk assessment (safe to proceed?)

## Continuous Learning

After each migration, this skill should:
1. Note patterns that worked well
2. Identify gaps in existing instructions
3. Suggest improvements to scripts
4. Update complexity assessment heuristics

---

## Customization Best Practices Integration

### CUSTOMIZATION Markers

When modifying core Intershop files, always add markers:

**Single-line format:**
```typescript
// CUSTOMIZATION: Added B2B-specific discount calculation
const finalPrice = this.applyB2BDiscount(basePrice);
```

**Block format:**
```typescript
// CUSTOMIZATION START: Custom validation for enterprise users
if (this.isEnterpriseUser()) {
  return this.customValidationService.validate(data);
}
// CUSTOMIZATION END
```

### Customization Health Checklist

Refer users to 14-item health checklist in `docs/guides/customization-best-practices.md`:
- All custom components use 'custom-' prefix
- CUSTOMIZATION markers on core file modifications
- No deleted standard files
- Theme overrides used instead of inline changes
- No global style modifications
- Package-lock.json changes match package.json
- And 8 more items...

**Scoring:** 12-14 = Excellent | 8-11 = Good | 0-7 = Needs Improvement

### Video Tutorials

The `migrate-custom-branch.js` automatically shows Intershop Academy video tutorials:
- PWA 7.0→8.0: Course 452 (45 min)
- PWA 8.0→9.0: Course 454 (45 min)
- PWA 9.0→10.0: When available

Encourage users to watch before starting complex migrations.

---

**Last Updated:** March 2026
**Version:** 1.1
**Maintainer:** Intershop PWA Training Team
