# Intershop PWA Migration Toolkit

**Lean toolkit for migrating custom Intershop PWA projects between major versions.**

## 📦 What's Included (19 Files Total)

### Migration Instructions (7 files in `.github/instructions/`)
- `migration-checklist.instructions.md` - Pre/post-migration checklists with tier guidance
- `migration-issues.instructions.md` - 11 common issues and solutions
- `migration-workflow.instructions.md` - Step-by-step workflow patterns
- `migration-git.instructions.md` - Git operations, conflict resolution, AI merge guidance
- `migration-patterns.instructions.md` - Comprehensive patterns reference
- `migration-examples.instructions.md` - Concrete code examples
- `migration-pattern-detection.instructions.md` - **NEW:** Pattern detection system guide

### Migration Scripts (11 files in `scripts/`)
- `migrate-custom-branch.sh` - Automated migration (CI/CD ready)
- `migration-helper.js` - Interactive migration assistant
- `analyze-migration-complexity.sh` - **NEW:** Complexity analyzer with tier recommendation
- `detect-pattern-changes.js` - **NEW:** Tier 2/3 pattern detection and CHANGELOG analysis
- `merge-i18n-files.js` - **NEW:** Enhanced localization merge with conflict detection
- `generate-migration-report.sh` - **NEW:** Comprehensive migration documentation generator
- `validate-theme-completeness.sh` - **NEW:** Proactive SCSS variable validation (saves 15-30 min)
- `sync-custom-theme-variables.sh` - **NEW:** Auto-sync missing theme variables from b2b
- `check-template-syntax.sh` - Detect old template syntax
- `fix-template-syntax.js` - Auto-fix template syntax
- `check-standalone-components.sh` - Architecture analysis
- `check-lint-issues.sh` - Categorize lint errors

### Pattern Database (1 file in `data/`)
- `pattern-migrations.json` - **NEW:** Comprehensive breaking change patterns across PWA versions

**Total:** 19 files (7 instructions + 11 scripts + 1 database)

---

## 🚀 Usage Workflow

### STEP 1: Pull Toolkit into Custom PWA

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
# NEW: Validate custom theme variables (BEFORE first build)
# This prevents 15-30 minutes of build-fix-rebuild cycles
./scripts/validate-theme-completeness.sh

# If missing variables found, sync them
./scripts/sync-custom-theme-variables.sh
# Review and adjust the auto-added variables for your brand

# Check for remaining issues
./scripts/check-template-syntax.sh
./scripts/check-lint-issues.sh

# Build and test
npm install
npm run build
npm test

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

## 📝 Version

**v1.0** - Supports PWA 4.x → 9.x migrations
- 11 documented common issues
- Angular version compatibility checks
- Localization merge strategies
- Template syntax modernization
- Standalone components guidance

---

**Maintained by:** [Intershop Communications AG - Training Department]  
**Repo:** git@gitlab.intershop.de:IntershopTraining/trainings/pwa-migration-toolkit.git
