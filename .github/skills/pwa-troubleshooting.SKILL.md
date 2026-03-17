---
name: pwa-troubleshooting
description: |
  Specialized troubleshooting guide for PWA migration issues. Diagnoses build errors, 
  SCSS problems, template issues, Git conflicts, and Angular compatibility problems. 
  Use for: debugging specific errors, resolving conflicts, fixing broken builds, 
  investigating unknown issues. DO NOT use for: initial migration planning (use 
  pwa-migration skill), general development, feature implementation.
---

# PWA Migration Troubleshooting Skill

## When to Invoke This Skill

**Use this skill for:**
- 🐛 Diagnosing specific build errors
- 🔧 Resolving Git merge conflicts
- 💥 Fixing broken builds after migration
- 🎨 SCSS/theme compilation issues
- 📝 Template syntax or linting errors
- 🔍 Investigating unknown error patterns
- 🚨 Critical blockers during migration

**Don't use for:**
- Planning a new migration (use `pwa-migration` skill)
- General Angular development questions
- Feature implementation
- Simple script execution

## Diagnostic Approach

### 1. Error Classification

When a user reports an error, classify it:

**Category A: Build Errors**
- TypeScript compilation failures
- Module not found errors
- Angular compiler errors
- Environment configuration issues

**Category B: SCSS/Styling Errors**
- Undefined variable: $variable-name
- Invalid CSS/SCSS syntax
- Theme compilation failures
- Mixin not found

**Category C: Template Errors**
- Component not found in template
- Unknown directive/pipe
- Template syntax errors
- Linting errors

**Category D: Git Conflicts**
- Merge conflict markers
- Conflicting package.json versions
- Theme variable conflicts
- Feature file conflicts

**Category E: Runtime Errors**
- Application crashes on load
- Feature not working after migration
- API integration failures
- Navigation issues

**Category F: Test Failures**
- Jest snapshot mismatches
- Unit test failures
- E2E test failures

### 2. Diagnostic Scripts

For each category, run appropriate diagnostic:

```bash
# Category A: Build Errors
npm run build 2>&1 | tee build-errors.log
./scripts/check-lint-issues.sh

# Category B: SCSS Errors
./scripts/validate-theme-completeness.sh
node scripts/compare-scss-files.js

# Category C: Template Errors
./scripts/check-template-syntax.sh
node scripts/fix-template-linting.js --check

# Category D: Git Conflicts
git status
git diff --name-only --diff-filter=U

# Category E: Runtime - Check GitHub first
./scripts/check-github-issues.sh --version <version> --search "<error keywords>"

# Category F: Test Failures
npm test -- --listTests | grep <failing-test>
./scripts/update-snapshots.sh --check
```

### 3. Pattern Matching

Check against known issues:
1. Search `migration-issues.instructions.md` for similar patterns
2. Query pattern database for breaking changes
3. Check GitHub issues for known bugs
4. Analyze CHANGELOG for relevant changes

## Common Issue Playbooks

### Playbook 1: "Undefined variable: $theme-variable"

**Diagnosis:**
```bash
# Identify missing variables
./scripts/validate-theme-completeness.sh
```

**Root Cause:** Custom theme missing variables added in new PWA version

**Solution Steps:**
1. Auto-sync variables: `./scripts/sync-custom-theme-variables.sh`
2. Review synced variables in `src/styles/themes/custom/style.scss`
3. Adjust default values for your brand colors/spacing
4. Re-validate: `./scripts/validate-theme-completeness.sh`
5. Build: `npm run build`

**Prevention:** Run validation BEFORE first build in future migrations

---

### Playbook 2: "Module not found" or "Cannot find module"

**Diagnosis:**
```bash
# Check if it's an environment feature
grep -r "ish-" src/environments/
grep -r "<missing-module>" node_modules/
```

**Root Causes:**
1. Environment feature not registered
2. Extension module removed in new version
3. Import path changed
4. Package not installed

**Solution Steps:**

**If environment feature:**
```typescript
// src/environments/environment.ts
export const environment = {
  features: [
    'missing-feature', // Add this
  ],
};
```

**If extension removed:**
1. Check CHANGELOG for removal notice
2. Find replacement in new version
3. Migrate to new implementation
4. Document in migration report

**If import path changed:**
1. Search pattern database for rename/move patterns
2. Update all imports
3. Use global find/replace if many files affected

**If package missing:**
```bash
npm install
# or if specific package
npm install <package-name>
```

---

### Playbook 3: Git Merge Conflicts

**Diagnosis:**
```bash
git status
git diff --name-only --diff-filter=U
```

**Strategy by File Type:**

**package.json conflicts:**
```bash
# Use new PWA version as base, add back custom packages
# Prefer higher versions when conflicts
# Keep custom scripts

# Check script carefully:
./scripts/merge-docker-compose.sh  # Similar logic applies
```

**SCSS conflicts (theme files):**
```bash
# Keep custom color values
# Accept new PWA structure/mixins
# Use compare tool:
node scripts/compare-scss-files.js
```

**Template conflicts:**
```bash
# If custom component: keep custom version
# If standard component override: review both, merge carefully
# Use newest directive syntax from new PWA
```

**TypeScript conflicts:**
```bash
# Check for API changes in pattern database
# Prioritize new PWA implementation
# Port custom logic to new structure
```

**Resolution Process:**
1. Backup conflict files: `git diff > conflicts.patch`
2. Resolve one file at a time
3. Test after each resolution
4. Mark resolved: `git add <file>`
5. Continue: `git merge --continue` or `git rebase --continue`

---

### Playbook 4: "100+ TypeScript errors after merge"

**Diagnosis:** Check Angular version compatibility FIRST

```bash
# In your branch
grep '@angular/core' package.json

# In target branch
git show <target-branch>:package.json | grep '@angular/core'
```

**Root Cause:** Angular version mismatch (most common for 100+ errors)

**Solution:**
```bash
# Update Angular BEFORE merging
ng update @angular/core@16 @angular/cli@16

# Then re-attempt migration
git merge <target-branch>
```

**Prevention:** Always check Angular compatibility in pre-migration checklist

---

### Playbook 5: "Component selector not found in template"

**Diagnosis:**
```bash
# Find component definition
grep -r "selector: 'component-name'" src/

# Check standalone component status
./scripts/check-standalone-components.sh

# Check imports
grep -r "component-name" src/**/*.module.ts
```

**Root Causes:**
1. Component moved to standalone (new architecture)
2. Module not imported
3. Component removed/renamed in new PWA

**Solution:**

**If standalone component:**
```typescript
// In your component/template parent:
import { ComponentName } from './path/to/component';

@Component({
  standalone: true,
  imports: [ComponentName],  // Add here
})
```

**If module needs import:**
```typescript
// In your feature.module.ts
import { ComponentModule } from 'ish-core/path';

@NgModule({
  imports: [
    ComponentModule,  // Add here
  ],
})
```

**If removed/renamed:**
1. Check pattern database for migration path
2. Find replacement component
3. Update all usages

---

### Playbook 6: "Tests pass but app crashes at runtime"

**Diagnosis:**
```bash
# Check browser console for errors
# Check network tab for failed API calls
# Review lazy-loaded module errors

# Common culprits:
grep -r "loadChildren" src/app/**/*.routing.*
grep -r "providedIn" src/
```

**Root Causes:**
1. Circular dependency introduced
2. Service not provided in correct scope
3. Lazy module configuration broken
4. API integration changed

**Solution Steps:**

1. **Check circular dependencies:**
   ```bash
   npm run build:analyze
   # Look for warning messages
   ```

2. **Fix service providers:**
   ```typescript
   // Wrong:
   @Injectable()
   
   // Correct:
   @Injectable({ providedIn: 'root' })
   ```

3. **Verify lazy loading:**
   ```typescript
   // Check routing config
   const routes: Routes = [
     {
       path: 'feature',
       loadChildren: () => import('./feature/feature.module').then(m => m.FeatureModule),
     },
   ];
   ```

4. **Check API contracts:**
   - Review API changes in CHANGELOG
   - Verify environment URLs
   - Check authentication headers

---

### Playbook 7: Known Bug in Target Version

**Diagnosis:**
```bash
./scripts/check-github-issues.sh --version 9.1.0 --search "ComponentName"
./scripts/check-github-issues.sh --version 9.1.0 --search "error message keywords"
```

**If Found on GitHub:**

**Option A: Wait for fix**
- Check if fixed in newer version
- Upgrade to version with fix
- Document workaround for current version

**Option B: Local patch**
```bash
# Apply community patch if available
# Or implement local workaround
# Document in migration notes
```

**Option C: Report if not found**
- Create GitHub issue with reproduction
- Link in migration report
- Implement temporary workaround

**Time Saved:** 30-60 minutes by not debugging a known issue

---

## Systematic Debugging Process

### Phase 1: Gather Information (5 minutes)

1. **What exactly is the error?**
   - Copy full error message
   - Note which file/line
   - Screenshot if helpful

2. **When does it occur?**
   - During build?
   - During tests?
   - At runtime?
   - After specific action?

3. **What was just changed?**
   - Recent merge?
   - File edit?
   - Package update?

4. **What's the environment?**
   - PWA versions (from/to)
   - Node/npm versions
   - OS/platform

### Phase 2: Quick Checks (10 minutes)

```bash
# 1. Is it a known issue?
./scripts/check-github-issues.sh --version <version> --search "<keywords>"

# 2. Are dependencies installed?
npm install

# 3. Is TypeScript happy?
npm run lint

# 4. Clean build?
rm -rf dist node_modules/.cache
npm run build

# 5. Clean test?
npm test -- --clearCache
```

### Phase 3: Pattern Matching (15 minutes)

1. Search existing instructions:
   ```bash
   grep -r "error keywords" .github/instructions/
   ```

2. Check pattern database:
   ```bash
   node scripts/detect-pattern-changes.js --comprehensive
   ```

3. Review CHANGELOG for relevant changes

### Phase 4: Targeted Investigation (30 minutes)

Based on error category, deep dive:

```bash
# For build errors: trace imports
grep -r "failing-component" src/

# For SCSS: trace variables
grep -r "$missing-variable" src/styles/

# For templates: check component registrations
./scripts/check-standalone-components.sh

# For conflicts: understand both sides
git show :1:<file>  # common ancestor
git show :2:<file>  # your version
git show :3:<file>  # their version
```

### Phase 5: Solution Implementation (varies)

1. Make targeted fix
2. Test immediately: `npm run build`
3. If fails, revert and try next approach
4. Document what worked

### Phase 6: Prevention (10 minutes)

1. Add to checklist if systematic issue
2. Note in migration report
3. Consider script improvement
4. Update instructions if novel pattern

## Emergency Procedures

### Emergency: "Everything is broken, can't build"

**Immediate Actions:**
```bash
# 1. Create safety branch
git branch emergency-backup

# 2. Check if you're on right branch
git branch --show-current

# 3. See what changed
git log --oneline -10
git diff HEAD~1

# 4. Option A: Revert last commit
git reset --hard HEAD~1

# 5. Option B: Rollback merge
git merge --abort  # if in middle of merge
git rebase --abort  # if in middle of rebase

# 6. Return to stable state
git checkout <last-working-commit>
git checkout -b recovery-attempt
```

### Emergency: "Accidentally pushed to Intershop remote"

**Immediate Actions:**
```bash
# 1. DON'T PANIC - you likely can't push (READ-ONLY)
# 2. If it somehow pushed, contact Intershop immediately
# 3. Fix your remotes:

git remote -v  # Identify the problem

# Remove wrong remote if needed
git remote remove <wrong-remote>

# Re-add correctly
git remote add <correct-name> <correct-url>
```

### Emergency: "Lost important custom code in merge"

**Recovery:**
```bash
# Find the commit with your code
git reflog  # Shows all recent HEAD positions
git log --all --full-history -- <file-path>

# Recover specific file
git checkout <commit-hash> -- <file-path>

# Or cherry-pick specific changes
git cherry-pick <commit-hash>
```

## Investigation Tools

### Tool: Compare branches
```bash
# See what changed between versions
git diff <source-branch>..<target-branch> -- <path>

# Count changes
git diff --stat <source-branch>..<target-branch>

# File list only
git diff --name-only <source-branch>..<target-branch>
```

### Tool: Find when something changed
```bash
# Find when file was modified
git log --follow -- <file-path>

# Find when string was added/removed
git log -S "search string" -- <path>

# Find when pattern changed
git log -G "regex pattern" -- <path>
```

### Tool: Blame analysis
```bash
# Who changed this line?
git blame <file> -L <start-line>,<end-line>

# When was this changed in new PWA?
git blame <commit>:<file>
```

## Success Criteria

A successful troubleshooting session should:
- ✅ Identify root cause (not just symptom)
- ✅ Implement targeted fix (not workaround)
- ✅ Test fix works
- ✅ Document for future reference
- ✅ No new issues introduced
- ✅ Reproducible solution if issue recurs

## Escalation Path

When to escalate beyond this skill:

1. **To Intershop Support:**
   - Bug in standard PWA confirmed
   - API contract change undocumented
   - Critical security issue

2. **To Team Lead:**
   - Breaking change requires architecture decision
   - Custom feature fundamentally incompatible
   - Timeline impact > 4 hours

3. **To Community:**
   - Novel pattern not documented
   - Potential improvement to migration toolkit
   - Shareable solution to common problem

---

**Last Updated:** March 2026
**Version:** 1.0
**Maintainer:** Intershop PWA Training Team
