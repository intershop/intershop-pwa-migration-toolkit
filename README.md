# Intershop PWA Migration Toolkit

**Lean toolkit for migrating custom Intershop PWA projects between major versions.**

## 📦 What's Included (12 Files Total)

### Migration Instructions (6 files in `.github/instructions/`)
- `migration-checklist.instructions.md` - Pre/post-migration checklists
- `migration-issues.instructions.md` - 11 common issues and solutions
- `migration-workflow.instructions.md` - Step-by-step workflow patterns
- `migration-git.instructions.md` - Git operations and conflict resolution
- `migration-patterns.instructions.md` - Comprehensive patterns reference
- `migration-examples.instructions.md` - Concrete code examples

### Migration Scripts (6 files in `scripts/`)
- `migrate-custom-branch.sh` - Automated migration (CI/CD ready)
- `migration-helper.js` - Interactive migration assistant
- `check-template-syntax.sh` - Detect old template syntax
- `fix-template-syntax.js` - Auto-fix template syntax
- `check-standalone-components.sh` - Architecture analysis
- `check-lint-issues.sh` - Categorize lint errors

**Total:** 12 files (6 instructions + 6 scripts)

---

## 🚀 Usage Workflow

### STEP 1: Pull Toolkit into Custom PWA

```bash
# In your custom PWA project
cd /path/to/your-custom-pwa

# Clone toolkit temporarily
git clone git@gitlab.intershop.de:IntershopTraining/trainings/pwa-migration-toolkit.git /tpm/toolkit

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

# Check your current setup
./scripts/check-template-syntax.sh
./scripts/check-standalone-components.sh
./scripts/check-lint-issues.sh

# Set up git remotes (reference latest standard PWA)
git remote add intershop-pwa git@github.com:intershop/intershop-pwa.git
git fetch intershop-pwa

# Identify target version
git branch -r | grep intershop-pwa
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

### STEP 4: Post-Migration Validation

```bash
# Check for remaining issues
./scripts/check-template-syntax.sh
./scripts/check-lint-issues.sh

# Build and test
npm install
npm run build
npm test
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
