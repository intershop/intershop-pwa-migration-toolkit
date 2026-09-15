# PWA Migration Toolkit - Quick Start

> **Portable terminal rule:** Keep the toolkit and PWA in sibling folders and use relative paths such as `../custom-pwa`. Windows support is additional to Linux, macOS, WSL, and Git Bash. `node scripts/<script>.js` works in PowerShell, `cmd.exe`, Git Bash, and the VS Code terminal.

## Choose Your Deployment Mode

| Mode | Best For | Separation | Updates |
|------|----------|-----------|---------|
| **Multi-Root Workspace** (recommended) | Ongoing use, team setups | Full (two repos) | `git pull` in toolkit |
| **Copy & Hide** (legacy) | One-off migrations | Via `.gitignore` | Re-clone and re-copy |

---

## Mode A: Multi-Root Workspace (Recommended)

The toolkit stays in its own repository. VS Code opens both projects as workspace roots.
Copilot instructions and skills apply automatically across both roots.

### Step 1: Clone the Toolkit Alongside Your PWA

```bash
# Example layout (adapt the relative path to your setup):
#   workspace/
#     custom-pwa/                 ← your custom PWA
#     pwa-migration-toolkit/      ← this toolkit

# Clone the toolkit alongside the custom PWA (keep it permanently)
cd workspace
git clone git@gitlab.intershop.de:IntershopTraining/trainings/pwa-migration-toolkit.git

# Install dependencies (one-time)
cd pwa-migration-toolkit
npm install
```

### Step 2: Create the Workspace File

Copy the template and adjust paths:

```bash
cd pwa-migration-toolkit
cp pwa-migration.code-workspace.template pwa-migration.code-workspace
```

Edit `pwa-migration.code-workspace` to match your layout:

```jsonc
{
  "folders": [
    {
      "name": "Custom PWA",
      "path": "../pwa/developer-pwa"      // ← adjust to YOUR custom PWA path
    },
    {
      "name": "Migration Toolkit",
      "path": "."
    }
  ],
  "settings": {
    // Auto-set PWA_PROJECT_DIR in integrated terminals (all platforms)
    "terminal.integrated.env.linux": {
      "PWA_PROJECT_DIR": "${workspaceFolder:Custom PWA}"
    },
    "terminal.integrated.env.osx": {
      "PWA_PROJECT_DIR": "${workspaceFolder:Custom PWA}"
    },
    "terminal.integrated.env.windows": {
      "PWA_PROJECT_DIR": "${workspaceFolder:Custom PWA}"
    }
  }
}
```

> **Windows users:** Use forward slashes (`../pwa/developer-pwa`) or escaped backslashes.
> VS Code handles path conversion on all platforms.

### Step 3: Open the Workspace

```bash
code pwa-migration.code-workspace
```

Or: File → Open Workspace from File → select `pwa-migration.code-workspace`

### Step 4: Run Scripts Against Your PWA

Scripts automatically detect the PWA project via one of these (checked in order):

1. `--project-dir <relative-path-to-your-pwa>` argument
2. `PWA_PROJECT_DIR` environment variable
3. Current working directory (if you `cd` into the PWA first)

```bash
# Option A: Pass the project dir explicitly (relative to the toolkit folder)
node scripts/analyze-migration.js --project-dir ../custom-pwa 4.0.0 10.0.0

# Option B: Let the workspace file set PWA_PROJECT_DIR automatically
node scripts/validate-theme-completeness.js

# Option C: Run a script from the PWA with a relative toolkit path
cd ../custom-pwa
node ../pwa-migration-toolkit/scripts/check-template-syntax.js
```

### That's It!

- Toolkit has its own git history — update with `git pull`
- Custom PWA stays clean — no toolkit files in its repo
- Copilot uses the `.github/instructions/` from both roots automatically
- No `.gitignore` tricks needed

---

## Mode B: Copy & Hide (Legacy)

For one-off migrations where you don't need to keep the toolkit updated.

### Step 1: Copy Toolkit Files to Your Custom PWA

```bash
# Navigate to YOUR custom PWA project from its parent directory
cd custom-pwa

# Clone this toolkit temporarily
git clone git@gitlab.intershop.de:IntershopTraining/trainings/pwa-migration-toolkit.git .toolkit-tmp

# Copy all toolkit files to your project
mkdir -p .github/instructions .github/skills scripts data docs/guides
cp .toolkit-tmp/.github/instructions/* .github/instructions/
cp .toolkit-tmp/.github/skills/* .github/skills/
cp .toolkit-tmp/scripts/* scripts/
cp .toolkit-tmp/data/* data/
cp .toolkit-tmp/docs/guides/* docs/guides/
# Scripts are cross-platform Node.js - no chmod needed

# Copy the gitignore template
cp .toolkit-tmp/.gitignore-toolkit-template .

# Cleanup
rm -rf .toolkit-tmp
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
# Should show: scripts/migrate-*.js (ignored)

# Verify your app files are still tracked
git status
# Should NOT show any toolkit files, only your app changes
```

---

## ✅ Done! Now Use the Toolkit

**Not sure which approach to take?**

```bash
# Get personalized recommendation (5 minutes)
node scripts/analyze-migration.js 4.0.0 10.0.0

# Analyzes your project and recommends:
# - Big Bang (direct jump)
# - Hybrid (strategic stepping stones)
# - Incremental (version-by-version)
# Use --quick to skip interactive questions
```

**Start your migration:**

```bash
node scripts/migrate-custom-branch.js \
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
git rm --cached scripts/migrate-*.js
git rm --cached scripts/check-*.js
git rm --cached scripts/analyze-*.js
git rm --cached scripts/generate-*.js
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
scripts/migrate-*.js                               ← Ignored ❌
data/pattern-migrations.json                       ← Ignored ❌
```

**Your app files (tracked):**
```
.github/workflows/ci.yml                           ← Tracked ✅
.github/CODEOWNERS                                 ← Tracked ✅
scripts/deploy.js                                  ← Tracked ✅
src/app/                                           ← Tracked ✅
```

The wildcard patterns (`*`) only match toolkit files, not your app files!

---

## 🔄 Updating the Toolkit

When you want the latest toolkit version:

```bash
# Pull latest toolkit
git clone git@gitlab.intershop.de:IntershopTraining/trainings/pwa-migration-toolkit.git .toolkit-tmp

# Copy updated files (overwrites old toolkit files)
cp .toolkit-tmp/.github/instructions/* .github/instructions/
cp .toolkit-tmp/.github/skills/* .github/skills/
cp .toolkit-tmp/scripts/* scripts/
cp .toolkit-tmp/data/* data/
cp .toolkit-tmp/docs/guides/* docs/guides/
# Scripts are cross-platform Node.js - no chmod needed

# Cleanup
rm -rf .toolkit-tmp

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
