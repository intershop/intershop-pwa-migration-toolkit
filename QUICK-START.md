# PWA Migration Toolkit - Quick Start

## 🚀 3-Step Setup (5 minutes)

### Step 1: Copy Toolkit Files to Your Custom PWA

```bash
# Navigate to YOUR custom PWA project
cd /path/to/your-custom-pwa-project

# Clone this toolkit temporarily
git clone git@gitlab.intershop.de:IntershopTraining/trainings/pwa-migration-toolkit.git /tmp/toolkit

# Copy all toolkit files to your project
mkdir -p .github/instructions .github/skills scripts data docs/guides
cp /tmp/toolkit/.github/instructions/* .github/instructions/
cp /tmp/toolkit/.github/skills/* .github/skills/
cp /tmp/toolkit/scripts/* scripts/
cp /tmp/toolkit/data/* data/
cp /tmp/toolkit/docs/guides/* docs/guides/
chmod +x scripts/*.sh

# Copy the gitignore template
cp /tmp/toolkit/.gitignore-toolkit-template .

# Cleanup
rm -rf /tmp/toolkit
```

### Step 2: Exclude Toolkit Files from Git

**This is the critical step!** Add toolkit patterns to your `.gitignore`:

```bash
# Append toolkit patterns to your .gitignore
cat .gitignore-toolkit-template >> .gitignore

# Clean up the template file (you don't need it anymore)
rm .gitignore-toolkit-template
```

**What this does:**
- ✅ Toolkit files stay on your local machine (you can use them)
- ✅ Toolkit files won't be committed to your custom PWA repository
- ✅ Toolkit files won't show up in `git status` or pull requests
- ✅ Your custom app code is unaffected

### Step 3: Verify Everything Works

```bash
# Check that toolkit files are ignored
git status --ignored | grep "scripts/migrate"
# Should show: scripts/migrate-*.sh (ignored)

# Run the verification script
./scripts/verify-gitignore-coverage.sh
# Should show: ✅ Success! All toolkit files are properly ignored.

# Verify your app files are still tracked
git status
# Should NOT show any toolkit files, only your app changes
```

---

## ✅ Done! Now Use the Toolkit

**Not sure which approach to take?**

```bash
# Get personalized recommendation (5 minutes)
./scripts/recommend-migration-strategy.sh 4.0.0 10.0.0 --interactive

# Analyzes your project and recommends:
# - Big Bang (direct jump)
# - Hybrid (strategic stepping stones)
# - Incremental (version-by-version)
```

**Start your migration:**

```bash
# Interactive mode (recommended)
node scripts/migration-helper.js

# Or automated
./scripts/migrate-custom-branch.sh \
  --source-branch training_9.1.0 \
  --target-branch intershop-pwa/10.0.0 \
  --migration-branch training_10.0.0
```

**Key point:** Toolkit files live in your workspace but are **invisible to Git** - exactly what you want!

---

## 🤔 What If I Already Committed Toolkit Files?

Remove them from Git (keeps local files):

```bash
# Remove patterns from Git tracking
git rm --cached .github/instructions/migration-*.instructions.md
git rm --cached .github/skills/pwa-*.SKILL.md
git rm --cached .github/skills/README.md
git rm --cached scripts/migrate-*.sh
git rm --cached scripts/check-*.sh
git rm --cached scripts/analyze-*.sh
git rm --cached scripts/generate-*.sh
git rm --cached scripts/migration-helper.js
git rm --cached data/pattern-migrations.json
git rm --cached docs/guides/migration-*.md
git rm --cached docs/guides/customization-*.md

# Commit the removal
git commit -m "chore: remove migration toolkit files from repository"

# Files are now untracked but still usable locally
```

---

## 📁 Understanding What Gets Ignored

**Toolkit files (ignored):**
```
.github/instructions/migration-*.instructions.md  ← Ignored ❌
.github/skills/pwa-*.SKILL.md                     ← Ignored ❌
scripts/migrate-*.sh                               ← Ignored ❌
data/pattern-migrations.json                       ← Ignored ❌
```

**Your app files (tracked):**
```
.github/workflows/ci.yml                           ← Tracked ✅
.github/CODEOWNERS                                 ← Tracked ✅
scripts/deploy.sh                                  ← Tracked ✅
src/app/                                           ← Tracked ✅
```

The wildcard patterns (`*`) only match toolkit files, not your app files!

---

## 🔄 Updating the Toolkit

When you want the latest toolkit version:

```bash
# Pull latest toolkit
git clone git@gitlab.intershop.de:IntershopTraining/trainings/pwa-migration-toolkit.git /tmp/toolkit

# Copy updated files (overwrites old toolkit files)
cp /tmp/toolkit/.github/instructions/* .github/instructions/
cp /tmp/toolkit/.github/skills/* .github/skills/
cp /tmp/toolkit/scripts/* scripts/
cp /tmp/toolkit/data/* data/
cp /tmp/toolkit/docs/guides/* docs/guides/
chmod +x scripts/*.sh

# Cleanup
rm -rf /tmp/toolkit

# Files are still ignored - no git changes needed!
```

---

## 💡 Why This Approach?

| Approach | Toolkit Updates | Repo Clean | Team Clarity |
|----------|----------------|------------|--------------|
| **Copy + .gitignore** (this) | ✅ Easy | ✅ Yes | ✅ Clear |
| Git submodule | ⚠️ Complex | ✅ Yes | ⚠️ Learning curve |
| Commit toolkit | ✅ Easy | ❌ No | ❌ Confusing PRs |

**Best practice:** Keep migration tools separate from application code.

---

## 📖 Next Steps

- Read: [README.md](README.md) for full toolkit documentation
- Start: [.github/instructions/migration-checklist.instructions.md](.github/instructions/migration-checklist.instructions.md)
- Help: [.github/skills/README.md](.github/skills/README.md) for AI-powered assistance
