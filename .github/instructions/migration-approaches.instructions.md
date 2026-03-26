---
applyTo: '**/migration*.{js,sh,ts}'
---

# PWA Migration - Three Proven Approaches

**Source:** [Intershop PWA Customization Guide](https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/customizations.md)

This guide documents the three proven approaches for importing changes from new PWA releases, with their trade-offs and when to use each.

## Overview: Choose Your Approach

| Approach | Conflict Resolution | History | Best For | Complexity |
|----------|-------------------|---------|----------|------------|
| **Cherry-Pick** | Per-commit context | Clean | Complex migrations | Medium |
| **Rebase** | Per-commit context | Linear | Smaller changes | Medium |
| **Merge** | All at once | Branched | Simple migrations | Low |

## Prerequisites (All Approaches)

### 1. Read the Official Migration Documentation

**CRITICAL:** Before choosing an approach, read:

- **[migrations.md](https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/migrations.md)** - Breaking changes for your version
- **Changelog** - What's new and changed
- **Your project customizations** - What have you modified?

### 2. Setup Intershop Remote

```bash
# Check if already configured
git remote -v

# If not present, add Intershop PWA as remote
git remote add intershop https://github.com/intershop/intershop-pwa.git

# Fetch all tags and branches
git fetch intershop --tags
```

### 3. Identify Versions

```bash
# Your current PWA version
SOURCE_VERSION=$(git describe --tags --abbrev=0)
echo "Current version: $SOURCE_VERSION"

# Available target versions
git tag -l | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -10

# Choose target version
TARGET_VERSION="10.0.0"  # Example
```

### 4. Optional: Disable Pre-Commit Hooks

During migration, you may want to skip pre-commit hooks to speed up conflict resolution:

```bash
export HUSKY=0
```

Re-enable after migration is complete.

---

## Approach 1: Cherry-Pick (Recommended for Most Cases)

### When to Use

✅ **Best for:**
- Complex migrations with many breaking changes
- When you need commit-by-commit context during conflict resolution
- Projects with heavy customizations
- First-time migration to new major version
- Teams that want to understand each change

❌ **Avoid if:**
- You have a very simple project with minimal customizations
- You're comfortable resolving all conflicts at once

### Advantages

✅ Each commit has **full context** from original commit message and diff  
✅ Can **skip problematic commits** and apply them later  
✅ Easier to **track progress** (commit X of Y)  
✅ Can **pause and resume** at any point  
✅ Better for **code review** (each commit is a logical unit)

### Disadvantages

⚠️ More time-consuming (resolve conflicts for each commit)  
⚠️ May result in many merge commits  
⚠️ Requires discipline to not skip important commits

### Step-by-Step Process

#### 1. Create Migration Branch

```bash
# Create branch from your current main development branch
git checkout develop  # or your main branch
git checkout -b migration/to-$TARGET_VERSION
```

#### 2. Determine Commit Range

```bash
# Find the commit range from last version to target version
# Using tags (recommended):
git log --oneline $SOURCE_VERSION..$TARGET_VERSION

# Count commits to cherry-pick
COMMIT_COUNT=$(git rev-list --count $SOURCE_VERSION..$TARGET_VERSION^2)
echo "Will cherry-pick $COMMIT_COUNT commits"
```

> **Note:** The `^2` suffix on the target tag skips the merge commit at the end, which would cause an error.

#### 3. Start Cherry-Picking

```bash
# Cherry-pick the entire range
git cherry-pick $SOURCE_VERSION..$TARGET_VERSION^2

# Alternative: If using commit SHAs instead of tags
# git cherry-pick <start-commit-sha>..<end-commit-sha>
```

#### 4. Resolve Conflicts (When They Occur)

When you encounter a conflict:

```bash
# Step 1: See which files have conflicts
git status

# Step 2: View the original Intershop commit for context
# (Open GitHub: https://github.com/intershop/intershop-pwa/commit/<commit-sha>)

# Step 3: Edit conflicted files
# - Accept Intershop changes for standard files
# - Merge carefully for customized files
# - Keep your customizations where appropriate

# Step 4: Mark conflicts as resolved
git add <resolved-file>

# Step 5: Continue cherry-pick
git cherry-pick --continue

# Alternative: Skip this commit if it's problematic
# git cherry-pick --skip

# Alternative: Abort and restart
# git cherry-pick --abort
```

#### 5. Post-Cherry-Pick Verification

After each batch of commits (or after completion):

```bash
# Install updated dependencies
npm install

# Run basic checks
npm run build
npm run lint
npm test

# If something breaks, you can:
# - Revert the last commit: git reset --hard HEAD~1
# - Fix and amend: git add . && git commit --amend
```

#### 6. Finalize Migration

```bash
# Final verification
npm run check

# Push to your project remote
git push origin migration/to-$TARGET_VERSION

# Create pull/merge request for review
```

### Cherry-Pick Tips

💡 **Keep the terminal output** - It shows which commit is being applied  
💡 **Use `git log --oneline -1`** - See current commit message  
💡 **Create checkpoints** - Push to remote branch after major milestones  
💡 **Take breaks** - Long cherry-picks can be mentally exhausting  
💡 **Document skipped commits** - Note why you skipped any commits

---

## Approach 2: Rebase (For Linear History)

### When to Use

✅ **Best for:**
- Maintaining linear Git history
- Smaller version jumps (e.g., 9.1 → 10.0)
- Teams that prefer clean Git graphs
- When you want to "replay" your customizations on new base

❌ **Avoid if:**
- You have many merge commits in your branch
- You're not comfortable with rebasing
- You have a shared branch (coordinate with team)

### Advantages

✅ **Linear history** - No merge commits  
✅ **Clean Git graph** - Easy to visualize  
✅ **Per-commit context** - Like cherry-pick  
✅ **Simpler history** for future migrations

### Disadvantages

⚠️ **Rewrites history** - Requires force-push  
⚠️ **Can be confusing** if you're not familiar with rebase  
⚠️ **More complex** than merge for beginners

### Step-by-Step Process

#### 1. Create Branch from Target Version

```bash
# Create branch starting from NEW PWA version
git checkout -b migration/to-$TARGET_VERSION tags/$TARGET_VERSION

# Verify you're on the right version
git log --oneline -1
grep '"version"' package.json
```

#### 2. Identify Cut-Off Point

```bash
# This is the version where you started customizing
# Usually the previous Intershop PWA release
CUT_OFF_VERSION=$SOURCE_VERSION  # e.g., "9.1.0"
```

#### 3. Rebase Your Changes

```bash
# Rebase your custom branch onto the target
# Format: git rebase --onto <new-base> <cut-off> <branch-to-move>
git rebase --onto develop $CUT_OFF_VERSION migration/to-$TARGET_VERSION

# This means: "Take all commits after $CUT_OFF_VERSION 
# and replay them onto develop"
```

#### 4. Resolve Conflicts

```bash
# When conflicts occur
git status

# Edit files, then:
git add <resolved-file>
git rebase --continue

# Or skip commit:
# git rebase --skip

# Or abort:
# git rebase --abort
```

#### 5. Finalize

```bash
# Verify
npm install
npm run check

# Push (requires force since history was rewritten)
git push origin migration/to-$TARGET_VERSION --force-with-lease
```

### Rebase Tips

💡 **Use `--force-with-lease`** - Safer than `--force`  
💡 **Coordinate with team** - Don't rebase shared branches without agreement  
💡 **Keep backups** - Create a backup branch before rebasing

---

## Approach 3: Merge (Fastest but Hardest Conflicts)

### When to Use

✅ **Best for:**
- Simple projects with minimal customizations
- Experienced Git users comfortable resolving many conflicts
- Small version jumps (e.g., 9.0 → 9.1)
- When you want to preserve complete history

❌ **Avoid if:**
- Many customizations (conflicts will be overwhelming)
- First-time migration
- You're not comfortable with complex merge conflicts

### Advantages

✅ **Fastest** - One operation  
✅ **Preserves history** - All context remains  
✅ **No commit-by-commit** resolution needed

### Disadvantages

⚠️ **All conflicts at once** - Can be overwhelming  
⚠️ **No commit context** during resolution  
⚠️ **Hard to track progress**  
⚠️ **Easy to make mistakes** in conflict resolution

### Step-by-Step Process

#### 1. Prepare Your Branch

```bash
# Ensure you're on your development branch
git checkout develop  # or your main branch
```

#### 2. Merge Target Version

```bash
# Merge the entire release at once
git merge tags/$TARGET_VERSION

# Alternative: Merge from remote branch
# git merge intershop/develop
```

#### 3. Resolve ALL Conflicts

```bash
# This will likely show MANY conflicts
git status

# Resolve each file systematically
# Priority order:
# 1. package.json / package-lock.json (accept Intershop's version, then npm install)
# 2. Configuration files (environment.ts, angular.json)
# 3. Core files (main.ts, app.module.ts)
# 4. Your customized components/services

# Mark as resolved
git add <resolved-file>

# Complete the merge
git commit
```

#### 4. Post-Merge Fixes

```bash
# Replace package-lock.json with Intershop's version
git checkout tags/$TARGET_VERSION -- package-lock.json

# Reinstall
rm -rf node_modules
npm install

# Verify
npm run check
```

### Merge Tips

💡 **Accept Intershop changes for `package-lock.json`** - Always  
💡 **Systematically resolve** - Don't rush, take breaks  
💡 **Test frequently** - After resolving each category  
💡 **Have a rollback plan** - Keep a backup branch

---

## Decision Matrix: Which Approach to Choose?

### Scenario-Based Recommendations

| Your Situation | Recommended Approach | Reason |
|----------------|---------------------|--------|
| First major migration (e.g., 4.0→10.0) | **Cherry-Pick** | Per-commit context critical |
| Minor version update (e.g., 9.0→9.1) | **Merge** | Fewer breaking changes |
| Heavy customizations (100+ modified files) | **Cherry-Pick** | Need careful conflict resolution |
| Clean Git history is priority | **Rebase** | Linear history |
| Time-constrained but experienced | **Merge** | Fastest if you can handle conflicts |
| Learning migration process | **Cherry-Pick** | Educational, shows each change |
| Following official Intershop docs | **Cherry-Pick** | Default recommendation |

### Quick Decision Tree

```
Do you have heavy customizations?
├─ Yes → Cherry-Pick
└─ No 
   └─ Is clean Git history important?
      ├─ Yes → Rebase
      └─ No → Merge
```

---

## Common Issues Across All Approaches

### Issue 1: Angular Version Mismatch

**Symptom:** Hundreds of errors after merge/cherry-pick/rebase

**Cause:** Angular version incompatibility between branches

**Solution:**
```bash
# Update Angular first
ng update @angular/cli @angular/core

# Then continue with migration
```

### Issue 2: package-lock.json Conflicts

**Symptom:** Complex merge conflicts in package-lock.json

**Solution:**
```bash
# Accept target version
git checkout tags/$TARGET_VERSION -- package-lock.json
git add package-lock.json

# Reinstall
npm install

# Your custom dependencies will be added back
```

### Issue 3: Lost Track During Cherry-Pick

**Symptom:** Don't know which commit you're on

**Solution:**
```bash
# See current commit being applied
git log --oneline -1

# See remaining commits
git log --oneline CHERRY_PICK_HEAD..$TARGET_VERSION^2

# See progress
git rev-list --count HEAD..$TARGET_VERSION^2
```

---

## After Migration: Verification Checklist

Regardless of approach used:

```bash
# 1. Clean install
rm -rf node_modules package-lock.json
npm install

# 2. Full build
npm run build

# 3. Linting
npm run lint -- --fix

# 4. Tests
npm test

# 5. Type check
npm run check

# 6. Start application
npm start

# 7. Verify key features work
# - Login
# - Search
# - Add to cart
# - Checkout (if applicable)
```

---

## Integration with Migration Toolkit Scripts

### Before Starting Any Approach

```bash
# Analyze complexity (helps choose approach)
./scripts/analyze-migration-complexity.sh $SOURCE_VERSION $TARGET_VERSION

# Detect patterns (preview changes)
./scripts/detect-pattern-changes.js $SOURCE_VERSION $TARGET_VERSION
```

### During Migration (Any Approach)

```bash
# Check for known GitHub issues
./scripts/check-github-issues.sh

# Validate theme completeness
./scripts/validate-theme-completeness.sh

# Compare SCSS changes
./scripts/compare-scss-files.js src/styles/themes/b2b src/styles/themes/custom
```

### After Migration

```bash
# Generate comprehensive report
./scripts/generate-migration-report.sh

# Auto-fix template linting
./scripts/fix-template-linting.js

# Update snapshots
./scripts/update-snapshots.sh --review
```

---

## References

- **[Official Customization Guide](https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/customizations.md)** - Source of these approaches
- **[Migration Guide](https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/migrations.md)** - Version-specific changes
- **[Git Cherry-Pick Documentation](https://git-scm.com/docs/git-cherry-pick)**
- **[Git Rebase Documentation](https://git-scm.com/docs/git-rebase)**
- **[Git Merge Documentation](https://git-scm.com/docs/git-merge)**

---

## Next Steps

After choosing your approach:

1. 📖 Read the version-specific migration notes in [migrations.md](https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/migrations.md)
2. 🔍 Run toolkit detection scripts
3. 🚀 Execute chosen migration approach
4. ✅ Follow post-migration verification checklist
5. 📝 Document lessons learned for next migration
