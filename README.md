# Intershop PWA Migration Toolkit

**Lean toolkit for migrating custom Intershop PWA projects between major versions.**

## 📦 What's Included (24 Files Total)

### Migration Instructions (7 files in `.github/instructions/`)
- `migration-checklist.instructions.md` - Pre/post-migration checklists with tier guidance
- `migration-issues.instructions.md` - 13 common issues and solutions (expanded with new issues)
- `migration-workflow.instructions.md` - Step-by-step workflow patterns
- `migration-git.instructions.md` - Git operations, conflict resolution, AI merge guidance
- `migration-patterns.instructions.md` - Comprehensive patterns reference
- `migration-examples.instructions.md` - Concrete code examples
- `migration-pattern-detection.instructions.md` - Pattern detection system guide

### Migration Scripts (16 files in `scripts/`)

#### Core Migration
- `migrate-custom-branch.sh` - Automated migration (CI/CD ready)
- `migration-helper.js` - Interactive migration assistant
- `analyze-migration-complexity.sh` - Complexity analyzer with tier recommendation
- `generate-migration-report.sh` - Comprehensive migration documentation generator

#### Detection & Analysis
- `detect-pattern-changes.js` - Tier 2/3 pattern detection and CHANGELOG analysis
- `check-github-issues.sh` - **NEW:** Verify if errors are known bugs fixed in GitHub (saves 30-60 min)
- `check-template-syntax.sh` - Detect old template syntax
- `check-standalone-components.sh` - Architecture analysis
- `check-lint-issues.sh` - Categorize lint errors

#### Intelligent Merge Tools
- `merge-i18n-files.js` - Enhanced localization merge with conflict detection
- `merge-docker-compose.sh` - **NEW:** Smart docker-compose.yml merge (saves 15-30 min)

#### SCSS/Styling
- `validate-theme-completeness.sh` - Proactive SCSS variable validation (saves 15-30 min)
- `sync-custom-theme-variables.sh` - Auto-sync missing theme variables from b2b
- `compare-scss-files.js` - **NEW:** Comprehensive SCSS comparison: variables, mixins, imports (saves 30-60 min)

#### Automated Fixes
- `fix-template-syntax.js` - Auto-fix template syntax
- `fix-template-linting.js` - **NEW:** Auto-suppress template linting issues (saves 1-2 hours)
- `update-snapshots.sh` - **NEW:** Intelligent Jest snapshot update manager (saves 20-40 min)

### Pattern Database (1 file in `data/`)
- `pattern-migrations.json` - Comprehensive breaking change patterns across PWA versions

### Migration Skills (3 files in `.github/skills/`) ⭐ NEW
- `pwa-migration.SKILL.md` - Expert migration planning and execution workflow
- `pwa-troubleshooting.SKILL.md` - Specialized debugging and conflict resolution
- `README.md` - Skills usage guide and architecture

**Total:** 27 files (7 instructions + 16 scripts + 1 database + 3 skills)

**Time Savings:** New scripts save 2-4 hours per migration by automating tedious tasks.

---

## 🤖 AI-Powered Migration Assistance

### GitHub Copilot Skills (NEW)

For complex migrations, this toolkit includes specialized **skills** that provide interactive, step-by-step guidance:

#### 🎯 PWA Migration Skill
**Invoke for:** Planning, complexity assessment, guided execution

```
User: "I need to migrate from PWA 4.0 to 9.1"
Copilot: [Invokes pwa-migration skill for comprehensive guidance]
```

**What it does:**
- Assesses migration complexity (Tier 1/2/3)
- Recommends which scripts to run and when
- Guides through Git operations
- Provides context-aware troubleshooting
- Generates comprehensive migration reports

#### 🐛 PWA Troubleshooting Skill
**Invoke for:** Debugging errors, resolving conflicts, fixing broken builds

```
User: "Build fails with 'Undefined variable $theme-color'"
Copilot: [Invokes pwa-troubleshooting skill for diagnosis]
```

**What it does:**
- Diagnoses build/SCSS/template errors
- Provides step-by-step resolution playbooks
- Resolves Git merge conflicts
- Emergency recovery procedures
- Investigates unknown error patterns

#### Skills vs Instructions

- **Instructions** (`.instructions.md`): Auto-loaded when editing migration scripts - passive reference
- **Skills** (`.SKILL.md`): Explicitly invoked for complex workflows - active orchestration

See [`.github/skills/README.md`](.github/skills/README.md) for detailed usage guide.

---

## � Platform Requirements

### Linux / macOS
All scripts work natively. No additional setup required.

### Windows

**Option A: WSL2 (Recommended)**

Most modern Windows development environments use WSL2 for Node.js, Docker, and Git workflows. All toolkit scripts work perfectly in WSL2:

```powershell
# Install WSL2 (Windows 10/11)
wsl --install Ubuntu

# After installation, open Ubuntu and clone your project
cd ~
git clone <your-pwa-repo>
cd <your-pwa-repo>

# Use all scripts exactly as documented
./scripts/migrate-custom-branch.sh
```

**Benefits:** 100% compatibility, native Linux environment, integrates with VS Code

**Option B: Git Bash (Simple Fallback)**

If you prefer not to use WSL2, Git Bash provides good compatibility:

```bash
# Install Git for Windows (includes Git Bash)
# Download from: https://git-scm.com/download/win

# Run shell scripts through Git Bash terminal
bash ./scripts/migrate-custom-branch.sh
bash ./scripts/check-template-syntax.sh

# JavaScript scripts work directly via Node.js
node scripts/migration-helper.js
node scripts/detect-pattern-changes.js
```

**Benefits:** Zero setup if Git is already installed, good compatibility for standard bash scripts

**Compatibility Notes:**
- ✅ All 6 JavaScript scripts (`.js`) work on all platforms via Node.js
- ✅ All 11 shell scripts (`.sh`) work on Linux/macOS/WSL2 natively
- ⚠️ Shell scripts work in Git Bash with minor limitations on advanced features

---

## �🚀 Usage Workflow

### STEP 1: Pull Toolkit into Custom PWA

**Linux / macOS / WSL2 / Git Bash:**

```bash
# In your custom PWA project
cd /path/to/your-custom-pwa

# Clone toolkit temporarily
git clone git@gitlab.intershop.de:IntershopTraining/trainings/pwa-migration-toolkit.git /tmp/toolkit

# Copy files
mkdir -p .github/instructions scripts
cp /tmp/toolkit/.github/instructions/* .github/instructions/
cp /tmp/toolkit/scripts/* scripts/
chmod +x scripts/*.sh

# Cleanup
rm -rf /tmp/toolkit
```

**Windows PowerShell (alternative):**

```powershell
# In your custom PWA project
cd C:\path\to\your-custom-pwa

# Clone toolkit temporarily
git clone git@gitlab.intershop.de:IntershopTraining/trainings/pwa-migration-toolkit.git $env:TEMP\toolkit

# Copy files
New-Item -ItemType Directory -Force -Path .github\instructions, scripts
Copy-Item -Path "$env:TEMP\toolkit\.github\instructions\*" -Destination .github\instructions\ -Recurse
Copy-Item -Path "$env:TEMP\toolkit\scripts\*" -Destination scripts\ -Recurse

# Cleanup
Remove-Item -Recurse -Force "$env:TEMP\toolkit"

# Note: Use WSL2 or Git Bash for running .sh scripts
```

### STEP 2: Prepare & Evaluate

```bash
# Read pre-migration checklist
cat .github/instructions/migration-checklist.instructions.md

# NEW: Analyze migration complexity and get tier recommendation
./scripts/analyze-migration-complexity.sh 4.0.0 9.1.0

# NEW: Run pattern detection (based on recommended tier)
# Tier 2: Standard detection
./scripts/detect-pattern-changes.js 4.0.0 9.1.0

# Tier 3: Comprehensive with database
./scripts/detect-pattern-changes.js --comprehensive 4.0.0 9.1.0

# Check your current setup
./scripts/check-template-syntax.sh
./scripts/check-standalone-components.sh
./scripts/check-lint-issues.sh

# Set up git remotes (reference latest standard PWA)
git remote add intershop-pwa git@github.com:intershop/intershop-pwa.git
git fetch intershop-pwa --tags

# IMPORTANT: Identify and select the correct target version
# List available tags (recommended for stable versions)
git tag -l | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -10

# Or list branches
git branch -r | grep intershop-pwa

# Example: If migrating to 9.1.0, verify tag exists
git ls-remote --tags intershop-pwa | grep '9.1.0'

# Checkout the target version as a local branch
git checkout -b feature/migration-to-9.1 intershop-pwa/9.1.0
# OR use a tag:
# git checkout -b feature/migration-to-9.1 tags/9.1.0
```

### STEP 3: Execute Migration

```bash
# Option A: Automated
./scripts/migrate-custom-branch.sh \
  --source-branch your-custom-branch \
  --target-branch intershop-pwa/develop \
  --migration-branch migration/custom-to-latest

# Option B: Interactive (recommended for first migration)
node scripts/migration-helper.js
```

### STEP 4: Post-Migration Validation & Documentation

```bash
# NEW: Check if issues are known bugs already fixed in GitHub (FIRST!)
# This can save 30-60 minutes debugging known issues
./scripts/check-github-issues.sh --version 9.1.0 --search "your error keywords"

# NEW: Validate custom theme variables (BEFORE first build)
# This prevents 15-30 minutes of build-fix-rebuild cycles
./scripts/validate-theme-completeness.sh

# If missing variables found, sync them
./scripts/sync-custom-theme-variables.sh
# Review and adjust the auto-added variables for your brand

# NEW: Comprehensive SCSS comparison (variables + mixins + imports)
# Catches issues beyond just variables
node scripts/compare-scss-files.js
# Auto-fix if needed:
node scripts/compare-scss-files.js --auto-fix

# Check for remaining issues
./scripts/check-template-syntax.sh
./scripts/check-lint-issues.sh

# NEW: Suppress template linting issues temporarily (saves 1-2 hours)
# Focus on critical issues first, fix linting later
node scripts/fix-template-linting.js

# Build and test
npm install
npm run build
npm test

# NEW: Smart snapshot update handling (saves 20-40 minutes)
# If tests fail due to snapshots:
./scripts/update-snapshots.sh --interactive

# Generate comprehensive migration report
./scripts/generate-migration-report.sh
# Creates: migration-report-YYYY-MM-DD.md
```

---

## 📋 Common Migration Scenarios

### Scenario 1: PWA 4.x → PWA 9.x
```bash
./scripts/migrate-custom-branch.sh \
  --source-branch training_4.0.0 \
  --target-branch intershop-pwa/9.1.0 \
  --migration-branch migration/4-to-9
```

### Scenario 2: Custom Theme + Extensions
```bash
# Interactive mode handles complex customizations better
node scripts/migration-helper.js
# Follow prompts to handle theme conflicts
```

### Scenario 3: B2B Customizations
```bash
# Check B2B patterns first
cat .github/instructions/migration-issues.instructions.md | grep -A 20 "B2B"
# Then migrate
./scripts/migrate-custom-branch.sh --auto-resolve
```

---

## 🔄 Updating Toolkit

```bash
# In your custom PWA (pull latest toolkit)
git clone git@gitlab.your-company.com:pwa/pwa-migration-toolkit.git /tmp/toolkit
cp /tmp/toolkit/.github/instructions/* .github/instructions/
cp /tmp/toolkit/scripts/* scripts/
rm -rf /tmp/toolkit
```

---

## 📖 Key Documentation

**Start here:** `.github/instructions/migration-checklist.instructions.md`

**Tool guides:**
- `docs/guides/migration-helper-guide.md` - Complete guide for the interactive migration helper

**Common issues:** `.github/instructions/migration-issues.instructions.md`

**Git strategies:** `.github/instructions/migration-git.instructions.md`

---

## 🎯 What's New in This Version

### New Capabilities (5 Scripts Added)

1. **GitHub Issue Checker** (`check-github-issues.sh`)
   - Prevents debugging known bugs already fixed in later versions
   - Saves: 30-60 minutes per unknown issue
   - Usage: `./scripts/check-github-issues.sh --version 9.1.0 --search "keywords"`

2. **Docker Compose Merge Tool** (`merge-docker-compose.sh`)
   - Intelligently merges docker-compose.yml from both branches
   - Preserves custom services and environment variables
   - Saves: 15-30 minutes of manual YAML editing
   - Usage: `./scripts/merge-docker-compose.sh`

3. **Template Linting Suppressor** (`fix-template-linting.js`)
   - Auto-adds eslint-disable comments for migration-related issues
   - Focus on critical issues first, fix linting later
   - Saves: 1-2 hours during migration
   - Usage: `node scripts/fix-template-linting.js`

4. **Snapshot Update Manager** (`update-snapshots.sh`)
   - Intelligently handles Jest snapshot mismatches
   - Distinguishes real failures from expected changes
   - Saves: 20-40 minutes of manual snapshot review
   - Usage: `./scripts/update-snapshots.sh --interactive`

5. **SCSS File Comparator** (`compare-scss-files.js`)
   - Comprehensive comparison: variables, mixins, imports, classes
   - Auto-fix mode with backup
   - Saves: 30-60 minutes of manual diff comparison
   - Usage: `node scripts/compare-scss-files.js --auto-fix`

### Enhanced Issues Documentation

Added 5 new issues to `migration-issues.instructions.md`:

- **Issue #9:** Unknown Bugs vs Known Fixed Issues
- **Issue #10:** docker-compose.yml Merge Conflicts
- **Issue #11:** Template Linting Issues
- **Issue #12:** Jest Snapshot Mismatches
- **Issue #13:** Incomplete SCSS Property Migration

Total issues documented: **13** (was 8)

### Total Time Savings

**Per migration:** 2-4 hours saved through automation
- GitHub bug checking: 30-60 min
- docker-compose merge: 15-30 min
- Template linting: 1-2 hours
- Snapshot updates: 20-40 min
- SCSS comparison: 30-60 min

---

## 📝 Version

**v2.0** - Enhanced automation and comprehensive issue coverage
- 24 total files (7 instructions + 16 scripts + 1 database)
- 13 documented common issues (was 8)
- 5 new automation scripts
- 2-4 hours saved per migration
- Supports PWA 4.x → 9.x migrations

**v1.0** - Initial release
- 19 total files
- 8 documented common issues
- Angular version compatibility checks
- Localization merge strategies
- Template syntax modernization
- Standalone components guidance

---

**Maintained by:** [Intershop Communications AG - Training Department]  
**Repo:** git@gitlab.intershop.de:IntershopTraining/trainings/pwa-migration-toolkit.git
