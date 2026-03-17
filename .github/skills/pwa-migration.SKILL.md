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
- Running a single script (just run it: `./scripts/migrate-custom-branch.sh`)
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

### Phase 1: Discovery & Planning
```
1. Interview user about current/target versions
2. Run complexity analysis (analyze-migration-complexity.sh)
3. Recommend tier approach (1: simple merge, 2: pattern detection, 3: comprehensive)
4. Check prerequisites (Angular version, remotes, themes)
5. Create migration plan with specific scripts/steps
```

### Phase 2: Preparation
```
1. Verify git remotes setup
2. Run pattern detection (if Tier 2/3)
3. Validate theme completeness (validate-theme-completeness.sh)
4. Check template syntax (check-template-syntax.sh)
5. Analyze standalone components (check-standalone-components.sh)
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
```

### Phase 4: Validation
```
1. Run build and collect errors
2. Check GitHub issues for known bugs (check-github-issues.sh)
3. Run tests and update snapshots (update-snapshots.sh)
4. Suppress template linting temporarily (fix-template-linting.js)
5. Generate migration report (generate-migration-report.sh)
6. Verify all checklist items
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

## Common Issue Resolution

### Issue: SCSS Variables Missing in Custom Theme
**Detection:** Build fails with "Undefined variable: $variable-name"

**Script:** `./scripts/validate-theme-completeness.sh`

**Resolution:**
1. Sync missing variables: `./scripts/sync-custom-theme-variables.sh`
2. Review auto-added variables in `src/styles/themes/custom/style.scss`
3. Adjust values for your brand
4. Re-validate: `./scripts/validate-theme-completeness.sh`

### Issue: Template Syntax Outdated
**Detection:** Empty paired tags like `<component></component>`

**Script:** `./scripts/check-template-syntax.sh`

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

**Script:** `./scripts/check-github-issues.sh --version 9.1.0 --search "error keywords"`

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
- `migrate-custom-branch.sh` - Automated full migration
- `migration-helper.js` - Interactive step-by-step guide
- `analyze-migration-complexity.sh` - Tier recommendation
- `generate-migration-report.sh` - Documentation generation

### Detection & Analysis
- `detect-pattern-changes.js` - Pattern detection (Tier 2/3)
- `check-github-issues.sh` - Known bug verification
- `check-template-syntax.sh` - Template modernization check
- `check-standalone-components.sh` - Architecture analysis
- `check-lint-issues.sh` - Lint error categorization

### Merge & Fix Tools
- `merge-i18n-files.js` - Localization merge
- `merge-docker-compose.sh` - Docker config merge
- `sync-custom-theme-variables.sh` - SCSS variable sync
- `compare-scss-files.js` - Comprehensive SCSS comparison
- `fix-template-syntax.js` - Auto-fix templates
- `fix-template-linting.js` - Suppress linting issues
- `update-snapshots.sh` - Jest snapshot manager

### Validation
- `validate-theme-completeness.sh` - Proactive SCSS check

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
[runs: ./scripts/analyze-migration-complexity.sh 4.0.0 9.1.0]

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
- **migration-issues.instructions.md** → Lookup for specific problems
- **migration-workflow.instructions.md** → Build cycle patterns
- **migration-git.instructions.md** → Git operation details
- **migration-examples.instructions.md** → Code examples
- **migration-checklist.instructions.md** → Validation checklist
- **migration-pattern-detection.instructions.md** → Detection system guide

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

**Last Updated:** March 2026
**Version:** 1.0
**Maintainer:** Intershop PWA Training Team
