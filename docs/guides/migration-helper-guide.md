# Migration Helper - User Guide

## Table of Contents
- [Overview](#overview)
- [Quick Start](#quick-start-tldr)
- [Key Features](#key-features)
- [How to Use](#how-to-use)
- [Understanding the Prompts](#understanding-the-prompts)
- [What the Tool Does](#what-the-tool-does)
- [Tips for Success](#tips-for-success)
- [Troubleshooting](#troubleshooting)
- [Example Session](#example-session)
- [Related Documentation](#related-documentation)

## Overview

The **Migration Helper** (`scripts/migration-helper.js`) is an interactive tool that guides you through migrating your customized Intershop PWA from one version to another (e.g., PWA 4.0 → 9.1).

## Quick Start (TL;DR)

For experienced users who want to jump right in:

```bash
node scripts/migration-helper.js
```

1. Press Enter to accept defaults for branch names
2. Answer 'y' to confirmations
3. Let the tool handle conflicts
4. Review the generated report

**First time?** Read the full guide below.

## Key Features

The Migration Helper provides:

- ✓ **Clear explanations** of each branch type and step
- ✓ **Visual indicators** showing recommended choices
- ✓ **Smart defaults** based on common branch naming patterns
- ✓ **Flexible version matching** (major version compatibility check)
- ✓ **Automatic remote branch detection** (tries `origin/` prefix)
- ✓ **Better error messages** with helpful suggestions
- ✓ **Color-coded interface** with clear visual sections
- ✓ **Introduction text** explaining the entire process
- ✓ **Interactive conflict resolution** with guided choices

## How to Use

### Starting the Migration Helper

```bash
cd /path/to/intershop-pwa
node scripts/migration-helper.js
```

### Understanding the Prompts

The tool will ask for 3 branch names:

#### 1. **SOURCE Branch** (Your Customizations)
```
SOURCE branch (your customizations) [training_4.0.0]:
```

**What it means:** This is your current branch with all your customizations.

**Example:** `training_4.0.0`, `custom_4.0`, `develop`

**How to choose:**
- This should be the branch you're currently on
- Contains your custom code, themes, and configurations
- Usually the branch you've been working on

**Tip:** Just press Enter to use the default if it's correct!

---

#### 2. **TARGET Branch** (PWA 9.1 to Merge From)
```
TARGET branch (PWA 9.1 to merge from) [migration/training-to-9.1]:
```

**What it means:** This is the branch with the new PWA version you want to upgrade to.

**Example:** `migration/training-to-9.1`, `origin/9.1.0`, `develop`

**How to choose:**
- This branch contains the official PWA 9.1 code
- May be a remote branch (with `origin/` prefix)
- Should be a pre-prepared migration branch or official release branch

**Tip:** The helper will automatically try `origin/` prefix if local branch doesn't exist!

---

#### 3. **NEW MIGRATION Branch** (Will Be Created)
```
NEW MIGRATION branch (will be created) [migration/4.0-to-9.1]:
```

**What it means:** This is the NEW branch that will be created to hold your migration work.

**Example:** `migration/4.0-to-9.1`, `upgrade-to-9.1`, `feat/pwa-9.1-migration`

**How to choose:**
- Pick a descriptive name that indicates the migration
- This branch doesn't exist yet - it will be created
- Good pattern: `migration/{from}-to-{to}` or `migration/{to}`

**Tip:** Use a clear name so you can identify this migration later!

---

### Visual Guide Example

```
════════════════════════════════════════════════════════════
  Branch Selection Guide                                  
════════════════════════════════════════════════════════════

What each branch means:
  → SOURCE branch: Your current customization branch (e.g., training_4.0.0)
  → TARGET branch: The PWA 9.1 branch to merge FROM (e.g., migration/training-to-9.1)
  → MIGRATION branch: New branch name to CREATE (e.g., migration/4.0-to-9.1)

Local branches:
  1. training_4.0.0 ⚠ (likely your source)
  2. develop

Available migration/target branches:
  1. origin/migration/training-to-9.1 ⚠ (likely your target)
  2. origin/9.0.0

SOURCE branch (your customizations) [training_4.0.0]: █
```

## What the Tool Does

Once you provide the branch names, the tool will:

1. **Validate Environment**
   - Check Node.js and npm versions
   - Compare with target branch requirements
   - Warn if versions don't match (but let you continue)

2. **Analyze Customizations**
   - Count modified, added, and deleted files
   - Show you what's been customized
   - Help you understand the scope

3. **Ask for Confirmation**
   - Show you the migration plan
   - Let you review before proceeding
   - Safe to cancel at any point

4. **Create Migration Branch**
   - Check out the target branch
   - Create your new migration branch
   - Safe operation - doesn't modify existing branches

5. **Merge Customizations**
   - Merge your customizations into the new branch
   - Auto-resolve simple conflicts
   - Ask you about complex conflicts

6. **Handle Removed Features**
   - Detect features removed in new PWA
   - Ask what to do with each one
   - Help you clean up outdated code

7. **Run Automated Fixes**
   - ESLint auto-fix (optional)
   - Prettier formatting (optional)
   - Test build (optional)

8. **Generate Report**
   - Create migration summary
   - List all changes
   - Document decisions made

## Tips for Success

### ✓ DO:
- Read the intro text - it explains the process
- Use the default values when they look correct
- Review the migration plan before confirming
- Let the tool handle remote branches automatically
- Continue even if versions don't exactly match (usually fine)
- Take time to understand each prompt
- Review the generated migration report

### ✗ DON'T:
- Don't rush through the prompts
- Don't ignore version warnings without understanding them
- Don't skip the "review changes" step
- Don't forget to commit the final result
- Don't assume failed checks mean you can't proceed

## Troubleshooting

### "Branch doesn't exist" Error

**Problem:** You entered a branch name that can't be found.

**Solution:**
1. Check available branches: `git branch -a`
2. Make sure to include `origin/` for remote branches
3. Run `git fetch origin` to get latest remote branches
4. The tool will suggest available branches in the error message

### "Node.js version mismatch" Warning

**Problem:** Your Node.js version doesn't match the target PWA.

**Solution:**
1. **Recommended:** Update Node.js before migrating:
   ```bash
   nvm install 22.17.1
   nvm use 22.17.1
   ```
2. **Alternative:** Continue anyway (usually works, may have build issues)

### Tool Seems Stuck

**Problem:** After entering a value, nothing happens.

**Solution:**
1. Press **Enter** after typing your answer
2. If still stuck, press **Ctrl+C** to exit
3. Make sure you're in the correct directory
4. Try running with `node` directly: `node scripts/migration-helper.js`

### Uncommitted Changes Warning

**Problem:** Tool warns about uncommitted changes.

**Solution:**
1. **Recommended:** Commit or stash changes first:
   ```bash
   git add .
   git commit -m "Save work before migration"
   # or
   git stash
   ```
2. **Alternative:** Tool will now let you continue anyway (with confirmation)

### How to Start Over

If you need to restart:

```bash
# Cancel current migration
Ctrl+C

# Switch back to your original branch
git checkout training_4.0.0

# Delete the migration branch if created
git branch -D migration/4.0-to-9.1

# Start fresh
node scripts/migration-helper.js
```

## Manual Alternative

If the interactive helper doesn't work for you, you can follow the manual process:

```bash
# 1. Create migration branch
git checkout -b migration/4.0-to-9.1

# 2. Merge target branch
git merge origin/migration/training-to-9.1

# 3. Resolve conflicts manually
# (see migration-git.instructions.md)

# 4. Install dependencies
npm install

# 5. Build and test
npm run build
npm test
```

## Example Session

Here's what a successful migration looks like:

```
════════════════════════════════════════════════════════════
     Intershop PWA - Interactive Migration Helper         
          Migrate from PWA 4.x to PWA 9.1.0                
════════════════════════════════════════════════════════════

This tool will guide you through:
  1. ✓ Validating your environment (Node.js, npm)
  2. ✓ Selecting source and target branches
  3. ✓ Creating a new migration branch
  4. ✓ Merging changes and resolving conflicts
  5. ✓ Running automated fixes
  6. ✓ Generating a migration report

Tip: Press Enter to accept default values shown in [brackets]
Tip: You can safely exit with Ctrl+C and restart anytime

Step 1: Validate Environment

Current environment:
  Node.js: 22.17.1
  npm:     10.9.2

Step 2: Configure Migration
[INFO] Found 93 branches

Local branches:
  1. training_4.0.0 ⚠ (likely your source)
  2. develop

Available migration/target branches:
  1. origin/migration/training-to-9.1 ⚠ (likely your target)

SOURCE branch (your customizations) [training_4.0.0]: [Enter]
TARGET branch (PWA 9.1 to merge from) [migration/training-to-9.1]: [Enter]
NEW MIGRATION branch (will be created) [migration/4.0-to-9.1]: [Enter]

Migration plan:
  1. Start from: training_4.0.0
  2. Merge from: migration/training-to-9.1
  3. Create new: migration/4.0-to-9.1

Checking target branch requirements...
  ✓ Node.js: 22.17.1 (compatible with 22.22.0)
  ✓ npm: 10.9.2 (compatible with 10.9.4)

Step 3: Analyze Customizations
[INFO] Analyzing customizations...
[INFO] Found 157 modified files
[INFO] Found 23 new files
[INFO] Found 8 deleted files

Proceed with migration? (y/n): y

Step 4: Create Migration Branch
[SUCCESS] Created branch: migration/4.0-to-9.1

Step 5: Merge Changes
[INFO] Merging migration/training-to-9.1 into migration/4.0-to-9.1...
[SUCCESS] Merge completed successfully

Step 6: Handle Removed Features
[INFO] Checking for removed features...
[INFO] No removed features detected

Step 7: Run Automated Fixes
Run ESLint auto-fix? (y/n): y
[SUCCESS] ESLint fixes applied

Step 8: Generate Report
[SUCCESS] Migration report created: MIGRATION_SUCCESS_REPORT.md

════════════════════════════════════════════════════════════
            Migration Process Complete! ✓                  
════════════════════════════════════════════════════════════

[INFO] Migration branch: migration/4.0-to-9.1
[INFO] Next steps:
  1. Review MIGRATION_SUCCESS_REPORT.md
  2. Test the application: npm run build && npm start
  3. Check for any remaining issues
  4. Commit your changes: git commit -m "Complete migration to 9.1"
```

## Related Documentation

For more detailed information, see:

- **[Migration Workflow](../../.github/instructions/migration-workflow.instructions.md)** - Overall migration process and strategies
- **[Migration Checklist](../../.github/instructions/migration-checklist.instructions.md)** - Complete list of tasks
- **[Git Strategies](../../.github/instructions/migration-git.instructions.md)** - Conflict resolution techniques
- **[Pattern Detection](../../.github/instructions/migration-pattern-detection.instructions.md)** - Understanding pattern changes
- **[Common Issues](../../.github/instructions/migration-issues.instructions.md)** - Known problems and solutions

## Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Review the related documentation links
3. Check the generated migration report (if created)
4. Search for error messages in the instruction files
5. Ask your team or check internal documentation

## Summary

The Migration Helper transforms a complex multi-step process into an interactive, guided experience. It:

- **Reduces errors** by validating inputs and providing clear guidance
- **Saves time** by automating repetitive tasks and fixes
- **Improves confidence** with visual feedback and helpful suggestions
- **Documents decisions** by generating a comprehensive report

You should now be ready to successfully migrate your PWA customizations!
