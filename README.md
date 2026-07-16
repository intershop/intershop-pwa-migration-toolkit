# Intershop PWA Migration Toolkit

**Give GitHub Copilot the knowledge to guide you through an Intershop PWA migration.**

You don't need to read or understand all the files in this toolkit — just open the workspace and ask Copilot to help you migrate. The instructions, scripts, and patterns are here so the AI knows what to do on your behalf.

## 🚀 Setup (2 minutes)

```bash
# 1. Clone this toolkit
git clone git@gitlab.intershop.de:IntershopTraining/trainings/pwa-migration-toolkit.git
cd pwa-migration-toolkit

# 2. Run setup — point it at your custom PWA project
node setup.js /path/to/your/custom-pwa

# 3. Open the workspace
code pwa-migration.code-workspace
```

**That's it.** Now ask Copilot:

> "Migrate my custom PWA from 10.0 to the latest version"

Copilot will guide you through the entire process — assessing complexity, creating branches, resolving conflicts, and verifying the build.

---

## How It Works

This toolkit doesn't require you to learn 25 scripts. It works like this:

1. **You open VS Code** with both your PWA and this toolkit as workspace roots
2. **You ask Copilot** what you want to do (migrate, fix errors, resolve conflicts)
3. **Copilot reads the instruction files** in `.github/instructions/` to understand PWA migration patterns
4. **Copilot runs scripts** from `scripts/` when automation helps (SCSS sync, template fixes, etc.)
5. **You review and approve** the changes

The scripts can also be run manually if you prefer — see [QUICK-START.md](QUICK-START.md) for details.

---

## 🆕 Recent Updates (March 2026)

- ✅ **PWA 10.0.0 support** - Migration patterns for latest release (Angular 17, Bootstrap Icons, Control Flow)
- ✅ **Version-agnostic approach** - Works with ANY PWA version (not hardcoded to specific versions)
- ✅ **Dynamic pattern detection** - Scripts accept source/target version parameters
- ✅ **Comprehensive breaking changes** - Pattern database updated with PWA 9.1 → 10.0 changes

**Latest PWA Release:** 10.0.0 (March 13, 2026)
- Angular 17 with new control flow syntax (`@if`, `@for`, `@switch`)
- Font Awesome replaced with Bootstrap Icons
- New Angular 17 SSR architecture
- Node.js 22 LTS support
- [See full release notes](https://github.com/intershop/intershop-pwa/releases/tag/10.0.0)

## 📦 What's Included (36 Files Total)

### Migration Instructions (9 files in `.github/instructions/`)
- `migration-patterns.instructions.md` - Comprehensive patterns reference (index)
- `migration-checklist.instructions.md` - Pre/post-migration checklists with tier guidance
- `migration-approaches.instructions.md` - **NEW:** Three proven migration strategies (cherry-pick/rebase/merge) from official docs
- `migration-pwa10.instructions.md` - **NEW:** PWA 10.0-specific guide (Angular 17, Bootstrap Icons)
- `migration-issues.instructions.md` - 13 common issues and solutions (expanded with new issues)
- `migration-workflow.instructions.md` - Step-by-step workflow patterns
- `migration-git.instructions.md` - Git operations, conflict resolution, AI merge guidance
- `migration-examples.instructions.md` - Concrete code examples
- `migration-pattern-detection.instructions.md` - Pattern detection system guide

### Migration Scripts (25 files in `scripts/`)

#### Core Migration
- `migrate-custom-branch.js` - Automated migration (CI/CD ready) with **Node.js version validation** ⭐ ENHANCED
- `analyze-migration.js` - Complexity analyzer + strategy advisor (Big Bang / Hybrid / Incremental) ⭐
- `generate-migration-report.js` - Comprehensive migration documentation generator
- `pre-commit-customization-check.js` - **NEW:** Pre-commit hook to catch customization anti-patterns early

#### Detection & Analysis
- `detect-pattern-changes.js` - Tier 2/3 pattern detection and CHANGELOG analysis
- `check-nodejs-version.js` - Enforces Node.js/npm version requirements for target PWA version
- `check-icm-compatibility.js` - ICM version compatibility checker with requirements from pattern database
- `check-template-syntax.js` - Detect old template syntax

#### Intelligent Merge Tools
- `merge-i18n-files.js` - Enhanced localization merge with conflict detection
- `merge-docker-compose.js` - **NEW:** Smart docker-compose.yml merge (saves 15-30 min)

#### SCSS/Styling
- `validate-theme-completeness.js` - Proactive SCSS variable validation (saves 15-30 min)
- `sync-custom-theme-variables.js` - Auto-sync missing theme variables from b2b

#### Automated Fixes
- `fix-template-syntax.js` - Auto-fix template syntax
- `fix-template-linting.js` - **NEW:** Auto-suppress template linting issues (saves 1-2 hours)
- `update-snapshots.js` - **NEW:** Intelligent Jest snapshot update manager (saves 20-40 min)

#### PWA 10.0 Migration Tools
- `migrate-control-flow.js` - **NEW:** Angular 17 control flow migration (*ngIf → @if, *ngFor → @for)
  - ✅ Scans ALL templates including themed variants (.b2c.html, .b2b.html, etc.)
  - ✅ Reports themed templates separately for easy review
- `migrate-bootstrap-icons.js` - **NEW:** Font Awesome → Bootstrap Icons detection and migration

> **Note:** All template migration scripts explicitly check themed template variants (e.g., `component.b2c.html`, `component.b2b.html`). See [Themed Templates Guide](docs/guides/customization-best-practices.md#-themed-templates-and-migration) for details.

### Pattern Database (1 file in `data/`)
- `pattern-migrations.json` - **Enhanced:** Comprehensive breaking change patterns with SCSS variable renames, API changes, ICM requirements

### Documentation Guides (1 file in `docs/guides/`)
- `customization-best-practices.md` - Comprehensive guide for migration-friendly customizations (copy vs override, markers, anti-patterns)

### Migration Skills (3 files in `.github/skills/`)
- `pwa-migration.SKILL.md` - Expert migration planning and execution workflow
- `pwa-troubleshooting.SKILL.md` - Specialized debugging and conflict resolution
- `README.md` - Skills usage guide and architecture

### Configuration Templates (1 file)
- `.gitignore-toolkit-template` - **NEW:** Pre-made .gitignore patterns to keep toolkit files out of your repo

### Workspace Setup (1 file)
- `pwa-migration.code-workspace.template` - VS Code multi-root workspace template for separated toolkit usage

**Total:** 18 scripts + 1 database + 2 guides + 3 skills + 1 template + 1 quick-start

**Time Savings:** Scripts save 2-4 hours per migration, with PWA 10.0 tools saving additional 4-8 hours on control flow migration.

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

### Knowledge Base MCP Server (Optional)

For teams that maintain a shared knowledge base, the toolkit supports connecting Copilot to a **Knowledge Base MCP Server**. This gives Copilot access to your team's accumulated migration knowledge — resolved issues, proven workarounds, project-specific patterns, and lessons learned.

#### Installation

Add the MCP server to your VS Code configuration:

**Option A: User-level** (applies to all workspaces) — add to `~/.config/Code/User/mcp.json` (Linux/macOS) or `%APPDATA%\Code\User\mcp.json` (Windows):

```json
{
  "servers": {
    "kb-in-azure": {
      "url": "https://<YOUR_KB_ENDPOINT>/api/v1/mcp",
      "type": "http"
    }
  }
}
```

**Option B: Workspace-level** — already included in the workspace template (`pwa-migration.code-workspace.template`). Update the URL to your KB endpoint.

#### What It Provides

| Tool | Purpose |
|------|---------|
| `searchKnowledge` | Semantic search across team knowledge (e.g., "SCSS variable migration issues") |
| `getKnowledge` | Retrieve a specific knowledge entry by ID |
| `createKnowledge` | Store new findings (resolved issues, workarounds, patterns) |
| `replaceKnowledge` | Update existing entries when solutions evolve |
| `deleteKnowledge` | Remove outdated entries |

#### Usage with Copilot

Once configured, Copilot will automatically search the KB when relevant. You can also ask explicitly:

```
User: "Search the KB for bootstrap icon migration issues"
User: "Save this workaround to the knowledge base"
User: "What does the KB say about SCSS variable renames in PWA 10?"
```

#### When to Use

- **Before starting a migration** — check if your team already solved similar issues
- **After resolving a tricky problem** — store the solution for future migrations
- **During troubleshooting** — search for known workarounds before debugging from scratch

> **Note:** The KB server is optional. The toolkit works fully without it. The KB adds team memory across projects and sessions.

---
## 📚 Official Intershop PWA Documentation

**IMPORTANT:** This toolkit complements the official Intershop PWA documentation. Always consult these resources alongside the automation scripts:

### Essential Migration Guides

#### 🔄 [Migration Guide (migrations.md)](https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/migrations.md)
**The definitive reference for version-specific breaking changes**

- **Version-by-version migration notes** (10.0→9.1, 9.1→9.0, 9.0→8.0, etc.)
- **SCSS variable renames** (e.g., `$color-corporate` → `$bg-color-corporate`)
- **API method changes** (deprecated methods, signature changes)
- **Dependency updates** (Angular, Node.js, npm version requirements)
- **Feature changes** (inventory handling, authentication, SSR architecture)
- **ICM version requirements** for each PWA release
- **Historical context** going back to PWA 0.16

**Use this for:** Understanding what changed and why in each version.

#### 🎨 [Customization Guide (customizations.md)](https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/customizations.md)
**Best practices for maintainable customizations and migration strategies**

- **Three migration approaches:**
  - **Cherry-pick:** Apply commits one-by-one (best for conflict resolution)
  - **Rebase:** Linear history, clean Git graph
  - **Merge:** Fast but all conflicts at once
- **Theme override system** (when to copy vs. override)
- **Component customization** strategies
- **Minimizing merge conflicts** in future migrations
- **Testing during migration**

**Use this for:** Choosing migration approach, understanding how to customize without breaking updates.

#### 📦 [Updating Dependencies (updating-pwa.md)](https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/updating-pwa.md)
**Structured workflow for dependency management**

- **8-step update process** (Angular, third-party libs, utilities)
- **Using `ng update` effectively**
- **Handling `package-lock.json`** correctly
- **Security vulnerability management**
- **When to update vs. skip dependencies**

**Use this for:** Managing npm dependencies during and after migration.

### Video Tutorials

#### 🎓 [Intershop Academy](https://public.academy.intershop.com/plus/catalog) (Free Registration Required)

- **[Migrating from PWA 9.0 to 10.0](https://public.academy.intershop.com/plus/catalog/courses/482)**
- **[Migrating from PWA 8.0 to 9.0](https://public.academy.intershop.com/plus/catalog/courses/454)**
- **[Migrating from PWA 7.0 to 8.0](https://public.academy.intershop.com/plus/catalog/courses/452)**

**Use these for:** Visual walkthroughs of complex migrations with commentary.

### How This Toolkit Complements Official Docs

| Official Docs | This Toolkit |
|---------------|--------------|
| ✅ Conceptual understanding | ✅ Automation scripts |
| ✅ Breaking changes explained | ✅ Detection & validation |
| ✅ Manual procedures | ✅ Automated execution |
| ✅ Decision guidance | ✅ Proactive error prevention |
| ✅ Historical context | ✅ Version-agnostic patterns |

**Recommended workflow:**
1. 📖 Read official migration guide for your target version
2. 🔍 Run toolkit scripts to detect issues
3. 🛠️ Use toolkit automation for repetitive tasks
4. 🎯 Apply manual steps from official docs for complex changes
5. ✅ Validate with toolkit verification scripts

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
node scripts/migrate-custom-branch.js
```

**Benefits:** 100% compatibility, native Linux environment, integrates with VS Code

**Option B: Git Bash (Simple Fallback)**

If you prefer not to use WSL2, Git Bash provides good compatibility:

```bash
# Install Git for Windows (includes Git Bash)
# Download from: https://git-scm.com/download/win

# Run shell scripts through Git Bash terminal
node scripts/migrate-custom-branch.js
node scripts/check-template-syntax.js

# JavaScript scripts work directly via Node.js
node scripts/migrate-custom-branch.js
node scripts/detect-pattern-changes.js
```

**Benefits:** Zero setup if Git is already installed, good compatibility for standard bash scripts

**Compatibility Notes:**
- ✅ All 6 JavaScript scripts (`.js`) work on all platforms via Node.js
- ✅ All 11 shell scripts (`.js`) work on Linux/macOS/WSL2 natively
- ⚠️ Shell scripts work in Git Bash with minor limitations on advanced features

---

## 🎯 Version-Aware Migration Approach

**IMPORTANT:** This toolkit supports migrations between **any PWA versions**, not just specific hardcoded versions.

### How It Works

All migration scripts accept **version parameters** to dynamically:
- Fetch the correct CHANGELOG for your target version
- Apply relevant breaking change patterns from the database
- Calculate cumulative changes across your version gap
- Recommend appropriate migration tier (1/2/3)

### Version Support

| PWA Version | Angular | Node.js | Status | Key Changes |
|-------------|---------|---------|--------|-------------|
| **10.0.x** | **17** | **22** | **Latest** | **Control flow (@if/@for), Bootstrap Icons, New SSR** |
| 9.1.x | 16 | 18 | Stable | Stricter typing, self-closing tags |
| 9.0.x | 15/16 | 18 | Stable | Sass modules, standalone components |
| 4.0-8.x | 14 | 16 | Legacy | Various legacy architectures |

### Quick Version Check

```bash
# Your current PWA version
grep '"version"' package.json
# OR
git describe --tags --abbrev=0

# Your current Angular version
grep '"@angular/core"' package.json

# List available PWA target versions
git ls-remote --tags https://github.com/intershop/intershop-pwa.git | \
  grep -E 'refs/tags/[0-9]+\.[0-9]+\.[0-9]+$' | \
  sed 's|.*/||' | sort -V | tail -20
```

### General Migration Pattern

```bash
# Step 1: Identify versions
SOURCE_VERSION="X.Y.Z"  # Your current version (e.g., "9.1.0")
TARGET_VERSION="A.B.C"  # Desired version (e.g., "10.0.0")

# Step 2: Analyze complexity & get strategy recommendation
node scripts/analyze-migration.js $SOURCE_VERSION $TARGET_VERSION

# Step 3: Detect patterns
./scripts/detect-pattern-changes.js $SOURCE_VERSION $TARGET_VERSION

# Step 4: Execute migration
node scripts/migrate-custom-branch.js
```

**The toolkit adapts to your specific version gap**, whether it's 1 minor version or 5 major versions.

---

## � How Detection & Migration Work

### Two-Phase Approach: Detection → Migration

The toolkit separates **detection** (what needs changing) from **migration** (applying the changes).

#### Phase 1: Detection (Pattern Recognition)

**Tools:** `detect-pattern-changes.js`, `migrate-bootstrap-icons.js` (detection mode)

```bash
# Detect patterns for YOUR specific version gap
./scripts/detect-pattern-changes.js 9.1.0 10.0.0

# Detect Font Awesome usage
node scripts/migrate-bootstrap-icons.js --report icons-report.md
```

**What detection does:**
1. ✅ Fetches CHANGELOG for target version (10.0.0)
2. ✅ Applies pattern database rules for 9.1 → 10.0
3. ✅ Scans codebase with regex patterns
4. ✅ Reports files, line numbers, and occurrences
5. ✅ Categorizes by severity (critical/high/medium/low)

**Example output:**

```
Pattern Detection Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Angular 17: Control flow - *ngIf to @if migration
   Type: html
   Severity: critical
   Occurrences: 243
   Files affected:
     - src/app/shell/header/header.component.html
     - src/app/pages/product/product-detail/product-detail.component.html
     ... and 45 more

2. Icons: Font Awesome replaced with Bootstrap Icons
   Type: scss
   Severity: high
   Occurrences: 87
   Files affected: ...
```

**This tells you WHAT needs changing but doesn't change anything yet.**

#### Phase 2: Migration (Automated Transformation)

**Tools:** `migrate-control-flow.js`, `migrate-bootstrap-icons.js --auto-replace`

```bash
# After merge: Apply automated transformations
node scripts/migrate-control-flow.js
node scripts/migrate-bootstrap-icons.js --auto-replace
```

**What migration does:**
1. ✅ Creates automatic backup branch
2. ✅ Runs Angular CLI schematics (for control flow)
3. ✅ Transforms templates: `*ngIf` → `@if`, `*ngFor` → `@for`
4. ✅ Replaces icon classes: `fa-search` → `bi-search`
5. ✅ Reports what was changed and what remains manual

**Automation levels:**

| Pattern | Detection | Auto-Migration | Manual Review |
|---------|-----------|----------------|---------------|
| **Control Flow** (`*ngIf` → `@if`) | 100% detected | **70-95% automated** | Custom/theme templates |
| **Bootstrap Icons** (common) | 100% detected | **60% automated** | 40% custom icons |
| **Bootstrap Icons** (custom) | 100% detected | ❌ Manual | 100% manual |
| **SSR Architecture** | 100% detected | ❌ Manual | 100% manual |
| **Node.js version** | 100% detected | Trivial (`echo "22" > .nvmrc`) | Config updates |

**Note:** Control flow automation varies based on:
- ✅ **70-80%** if you have custom theme templates or extensions
- ✅ **90-95%** if using standard PWA structure only
- The Angular CLI schematic only processes components registered in `angular.json`

### Example: PWA 10.0 Migration Workflow

```bash
# === BEFORE MERGE: Detection Phase ===
# See what's coming
./scripts/detect-pattern-changes.js 9.1.0 10.0.0
node scripts/migrate-bootstrap-icons.js --report pre-merge.md

# Output: "243 *ngIf occurrences, 87 Font Awesome icons found"
# Action: None yet - just awareness

# === MERGE PWA 10.0 ===
git merge intershop-pwa/10.0.0
npm install  # Gets Angular 17

# === AFTER MERGE: Migration Phase ===

# 1. Angular Control Flow (95% automated)
node scripts/migrate-control-flow.js
# ✅ Scans src/ and projects/ directories for old syntax
# ✅ Transforms standard Angular components automatically
# ⚠️  Lists unmigrated files requiring manual review
# ⚠️  Common reasons for unmigrated files:
#     • Custom theme templates outside component folders
#     • Components not registered in angular.json
#     • Complex expressions the schematic can't parse
#     • Extension templates in non-standard locations

# 2. Bootstrap Icons (60% automated)
node scripts/migrate-bootstrap-icons.js --auto-replace
# ✅ Replaces fa-search, fa-cart, fa-user, etc. (52/87 icons)
# ⚠️  Reports 35 custom icons needing manual mapping

# 3. Manual review remaining cases
# The script will list specific files needing manual migration:
node scripts/migrate-control-flow.js  # Shows unmigrated files list
# Then manually fix those files using the conversion patterns:
#   *ngIf="expr" → @if (expr) { content }
#   *ngFor="let x of items" → @for (x of items; track x) { content }

cat icons-migration.md  # See unmapped icons

# === VALIDATION ===
npm run build
npm test
```

### Why Separate Detection & Migration?

1. **Awareness before action** - Know scope before committing to migrate
2. **Informed decisions** - Choose to migrate incrementally or all at once
3. **Risk mitigation** - Review what will be automated vs. manual
4. **Staging flexibility** - Detect before merge, migrate after merge

### PWA 10.0-Specific Tools

| Tool | Purpose | When to Run |
|------|---------|-------------|
| `detect-pattern-changes.js` | Find all breaking patterns | **Before merge** |
| `migrate-bootstrap-icons.js` | Detect Font Awesome usage | **Before merge** |
| `migrate-control-flow.js` | Transform Angular templates | **After merge** (needs Angular 17) |
| `migrate-bootstrap-icons.js --auto-replace` | Replace common icons | **After merge** |

**Complete PWA 10.0 guide:** See [`.github/instructions/migration-pwa10.instructions.md`](.github/instructions/migration-pwa10.instructions.md)

---

## �🚀 Usage Workflow

### STEP 1: Pull Toolkit into Custom PWA

**Linux / macOS / WSL2 / Git Bash:**

```bash
# In your custom PWA project
cd /path/to/your-custom-pwa

# Clone toolkit temporarily
git clone git@gitlab.intershop.de:IntershopTraining/trainings/pwa-migration-toolkit.git /tmp/toolkit

# Copy all toolkit files
mkdir -p .github/instructions .github/skills scripts data docs/guides
cp /tmp/toolkit/.github/instructions/* .github/instructions/
cp /tmp/toolkit/.github/skills/* .github/skills/
cp /tmp/toolkit/scripts/* scripts/
cp /tmp/toolkit/data/* data/
cp /tmp/toolkit/docs/guides/* docs/guides/
# No chmod needed - use: node scripts/<name>.js

# IMPORTANT: Add toolkit files to .gitignore to keep them out of your repo
cat >> .gitignore << 'EOF'

# PWA Migration Toolkit (temporary helper files)
.github/instructions/migration-*.instructions.md
.github/skills/pwa-*.SKILL.md
.github/skills/README.md
scripts/migrate-*.js
scripts/check-*.js
scripts/analyze-*.js
scripts/detect-*.js
scripts/generate-*.js
scripts/merge-*.js
scripts/fix-*.js
scripts/sync-*.js
scripts/update-*.js
scripts/validate-*.js
scripts/pre-commit-*.js
data/pattern-migrations.json
docs/guides/migration-*.md
docs/guides/customization-*.md
EOF

# OR use the pre-made template:
# cat /tmp/toolkit/.gitignore-toolkit-template >> .gitignore

# Verify toolkit files won't be committed
git status --ignored | grep -E "(scripts|\.github|data/pattern)"

# Cleanup
rm -rf /tmp/toolkit
```

**Windows PowerShell (alternative):**

```powershell
# In your custom PWA project
cd C:\path\to\your-custom-pwa

# Clone toolkit temporarily
git clone git@gitlab.intershop.de:IntershopTraining/trainings/pwa-migration-toolkit.git $env:TEMP\toolkit

# Copy all toolkit files
New-Item -ItemType Directory -Force -Path .github\instructions, .github\skills, scripts, data, docs\guides
Copy-Item -Path "$env:TEMP\toolkit\.github\instructions\*" -Destination .github\instructions\ -Recurse
Copy-Item -Path "$env:TEMP\toolkit\.github\skills\*" -Destination .github\skills\ -Recurse
Copy-Item -Path "$env:TEMP\toolkit\scripts\*" -Destination scripts\ -Recurse
Copy-Item -Path "$env:TEMP\toolkit\data\*" -Destination data\ -Recurse
Copy-Item -Path "$env:TEMP\toolkit\docs\guides\*" -Destination docs\guides\ -Recurse

# IMPORTANT: Add toolkit files to .gitignore
@"

# PWA Migration Toolkit (temporary helper files)
.github/instructions/migration-*.instructions.md
.github/skills/pwa-*.SKILL.md
.github/skills/README.md
scripts/migrate-*.js
scripts/check-*.js
scripts/analyze-*.js
scripts/detect-*.js
scripts/generate-*.js
scripts/merge-*.js
scripts/fix-*.js
scripts/sync-*.js
scripts/update-*.js
scripts/validate-*.js
scripts/pre-commit-*.js
data/pattern-migrations.json
docs/guides/migration-*.md
docs/guides/customization-*.md
"@ | Add-Content .gitignore

# OR use the pre-made template:
# Get-Content "$env:TEMP\toolkit\.gitignore-toolkit-template" | Add-Content .gitignore

# Cleanup
Remove-Item -Recurse -Force "$env:TEMP\toolkit"

# Note: All scripts are cross-platform Node.js - no WSL or Bash required
```

---

### 📌 Important: Keeping Toolkit Files Out of Your Repository

**Why add toolkit files to .gitignore?**

The migration toolkit files are **temporary helpers** for your migration work. They should NOT be committed to your custom PWA repository because:

- ✅ **Keeps repo clean** - Migration scripts aren't part of your application
- ✅ **Prevents conflicts** - Toolkit updates won't conflict with your code
- ✅ **Reduces noise** - Pull requests won't include unrelated toolkit files
- ✅ **Team clarity** - Clear separation between app code and migration tools

**What if `.github/` already exists in my project?**

No problem! The `.gitignore` patterns use wildcards to only ignore toolkit-specific files:

```bash
# These patterns ONLY ignore toolkit files:
.github/instructions/migration-*.instructions.md  # ← Only migration instructions
.github/skills/pwa-*.SKILL.md                     # ← Only PWA skills

# Your existing .github files are NOT ignored:
.github/workflows/                                 # ✅ Your CI/CD workflows
.github/CODEOWNERS                                 # ✅ Your code owners
.github/instructions/custom-app.instructions.md   # ✅ Your custom instructions
```

**Verify toolkit files are ignored:**

```bash
# Check ignored files
git status --ignored | grep -E "(scripts/migrate|\.github/instructions/migration)"

# Verify your app files are still tracked
git status

# Comprehensive verification: check each toolkit directory
echo "Checking .github/instructions..."
git check-ignore .github/instructions/migration-*.instructions.md
# Should show: .gitignore:XX:migration-*.instructions.md

echo "Checking .github/skills..."
git check-ignore .github/skills/pwa-*.SKILL.md
git check-ignore .github/skills/README.md

echo "Checking scripts..."
git check-ignore scripts/migrate-*.js scripts/check-*.js scripts/analyze-*.js

echo "Checking data..."
git check-ignore data/pattern-migrations.json

echo "Checking docs/guides..."
git check-ignore docs/guides/migration-*.md docs/guides/customization-*.md
```

**All 41 toolkit files are covered:**
- ✅ 9 instruction files (.github/instructions/)
- ✅ 3 skill files (.github/skills/)
- ✅ 25 script files (scripts/)
- ✅ 1 pattern database (data/)
- ✅ 2 guide files (docs/guides/)

**Quick verification:**

```bash
# Verify toolkit files are ignored
git status --ignored | grep -E "(scripts|\.github|data/pattern)"
```

**What if I already committed toolkit files?**

Remove them from Git tracking (keeps local files):

```bash
# Remove from Git but keep local files
git rm --cached .github/instructions/migration-*.instructions.md
git rm --cached .github/skills/pwa-*.SKILL.md
git rm --cached scripts/migrate-*.js
git rm --cached scripts/check-*.js
# ... etc for other patterns

# Commit the removal
git commit -m "chore: remove migration toolkit files from repository"
```

---

### STEP 2: Identify Versions & Evaluate

```bash
# === CRITICAL FIRST STEP: Identify Versions ===

# 1. Your CURRENT (source) version
grep '"version"' package.json
# Example output: "version": "9.1.0"

# 2. Your CURRENT Angular version
grep '"@angular/core"' package.json
# Example: "@angular/core": "^16.2.12"

# 3. List available TARGET versions
git ls-remote --tags https://github.com/intershop/intershop-pwa.git | \
  grep -E 'refs/tags/[0-9]+\.[0-9]+\.[0-9]+$' | \
  sed 's|.*/||' | sort -V | tail -20

# 4. Check TARGET version requirements (e.g., PWA 10.0.0)
# Fetch and view target package.json
curl -s "https://raw.githubusercontent.com/intershop/intershop-pwa/10.0.0/package.json" | \
  grep -E '"version"|"@angular/core"'

# 5. Export versions for scripts
export SOURCE_VERSION="9.1.0"   # ← Your current version
export TARGET_VERSION="10.0.0"  # ← Your desired version

# === Analyze Migration Complexity ===

# Analyze complexity + get personalized strategy recommendation
node scripts/analyze-migration.js $SOURCE_VERSION $TARGET_VERSION
# Analyzes: customization depth, version gap, breaking changes
# Recommends: Big Bang, Hybrid, or Incremental approach
# Output: Recommended tier (1/2/3), estimated time, prerequisites
# Time: 5 minutes (answers 5 questions about your team/project)
# Use --quick to skip interactive questions

# NEW: Run pattern detection for YOUR version gap
# Tier 2: Standard detection
./scripts/detect-pattern-changes.js $SOURCE_VERSION $TARGET_VERSION

# Tier 3: Comprehensive with database
./scripts/detect-pattern-changes.js --comprehensive $SOURCE_VERSION $TARGET_VERSION

# === Check Current Codebase ===

# Read pre-migration checklist
cat .github/instructions/migration-checklist.instructions.md

# Check your current setup
node scripts/check-template-syntax.js

# === Check Node.js/npm Requirements ===

# NEW: Verify Node.js version meets target PWA requirements
node scripts/check-nodejs-version.js $TARGET_VERSION

# If version mismatch, update automatically:
node scripts/check-nodejs-version.js $TARGET_VERSION --auto-update

# This checks & ensures:
# - PWA 10.0 requires Node.js 22 + npm 10
# - PWA 9.x requires Node.js 18 + npm 9
# - PWA 8.x requires Node.js 16 + npm 8
# Script will block migration if versions don't match

# === Set Up Git Remotes ===

# Set up git remotes (reference latest standard PWA)
git remote add intershop-pwa https://github.com/intershop/intershop-pwa.git
git fetch intershop-pwa --tags

# Verify target version exists
git ls-remote --tags intershop-pwa | grep "$TARGET_VERSION"

# Checkout the target version as a local branch
git checkout -b feature/migration-to-$TARGET_VERSION tags/$TARGET_VERSION
# OR for develop/branch:
# git checkout -b feature/migration-to-$TARGET_VERSION intershop-pwa/develop
```

---

### 🎯 Understanding Migration Parameters

**IMPORTANT:** The migration script parameters can be confusing. Here's what they actually mean:

#### Parameter Breakdown

```bash
node scripts/migrate-custom-branch.js \
  --source-branch training_4.0.0 \           # ← Your OLD custom branch
  --target-branch intershop-pwa/10.0.0 \     # ← Upstream PWA version (NOT your final branch!)
  --migration-branch training_10.0.0         # ← Your NEW custom branch name
```

**The workflow is:**
1. ✅ Checkout **upstream PWA** (intershop-pwa/10.0.0) 
2. ✅ Create **your new branch** (training_10.0.0) from it
3. ✅ Merge **your old customizations** (training_4.0.0) into it

**Common Confusion:**
- ❌ `--target-branch` ≠ "your final custom branch"
- ✅ `--target-branch` = "upstream PWA reference" (tag/branch to base on)
- ✅ `--migration-branch` = "your final custom branch name"

#### Parameter Naming Guide

| Parameter | Purpose | Example | What It Is |
|-----------|---------|---------|------------|
| `--source-branch` | Your old custom work | `training_4.0.0` | Branch with your customizations |
| `--target-branch` | Upstream PWA version | `intershop-pwa/10.0.0` | The PWA version to migrate TO |
| `--migration-branch` | Your new custom branch | `training_10.0.0` | Name for your migrated branch |

#### Real-World Example

**Scenario:** Migrate from your custom PWA 4.0 to custom PWA 10.0

<function_calls>bash
# You have: training_4.0.0 (based on PWA 4.0.0)
# You want: training_10.0.0 (based on PWA 10.0.0)

# Correct command:
node scripts/migrate-custom-branch.js \
  --source-branch training_4.0.0 \           # Your OLD custom branch
  --target-branch intershop-pwa/10.0.0 \     # Upstream PWA 10.0.0 tag
  --migration-branch training_10.0.0         # Your NEW custom branch

# NOT this (common mistake):
# --source-branch training_4.0.0 \
# --target-branch training_10.0.0 \          # ← This doesn't exist yet!
# --migration-branch migration/temp
```

**Result:** Creates `training_10.0.0` branch with:
- ✅ Full PWA 10.0.0 codebase as foundation
- ✅ Your customizations from training_4.0.0 merged in
- ✅ Conflicts marked for manual resolution

---

### STEP 3: Execute Migration

```bash
# Option A: Automated
node scripts/migrate-custom-branch.js \
  --source-branch your-custom-branch \
  --target-branch intershop-pwa/develop \
  --migration-branch migration/custom-to-latest
```

### STEP 4: Post-Migration Validation & Documentation

```bash
# Validate custom theme variables (BEFORE first build)
node scripts/validate-theme-completeness.js

# If missing variables found, sync them
node scripts/sync-custom-theme-variables.js
# Review and adjust the auto-added variables for your brand

# Check for remaining issues
node scripts/check-template-syntax.js

# NEW: Suppress template linting issues temporarily (saves 1-2 hours)
# Focus on critical issues first, fix linting later
node scripts/fix-template-linting.js

# Build and test
npm install
npm run build
npm test

# NEW: Smart snapshot update handling (saves 20-40 minutes)
# If tests fail due to snapshots:
node scripts/update-snapshots.js --interactive

# Generate comprehensive migration report
node scripts/generate-migration-report.js
# Creates: migration-report-YYYY-MM-DD.md
```

---

## 📋 Common Migration Scenarios

### Scenario 1: PWA 4.x → PWA 9.x

**Goal:** Migrate `training_4.0.0` → `training_9.1.0` (both are YOUR custom branches)

```bash
node scripts/migrate-custom-branch.js \
  --source-branch training_4.0.0 \           # Your old custom branch
  --target-branch intershop-pwa/9.1.0 \      # Upstream PWA 9.1.0 (reference)
  --migration-branch training_9.1.0          # Your new custom branch name
```

**What happens:**
1. Creates `training_9.1.0` based on upstream PWA 9.1.0
2. Merges your customizations from `training_4.0.0`
3. Marks conflicts for resolution

### Scenario 2: Custom Theme + Extensions

**Goal:** Complex migration with theme overrides and extensions

```bash
# Run analysis first
node scripts/analyze-migration.js
# Then migrate with auto-resolve for simple conflicts
node scripts/migrate-custom-branch.js --auto-resolve
```

### Scenario 3: B2B Customizations
```bash
# Check B2B patterns first
cat .github/instructions/migration-issues.instructions.md | grep -A 20 "B2B"
# Then migrate
node scripts/migrate-custom-branch.js --auto-resolve
```

---

## 🔄 Integrating the Toolkit in your custom project

```bash
# In your custom PWA (pull latest toolkit)
git clone git@gitlab.your-company.com:pwa/pwa-migration-toolkit.git /tmp/toolkit

# Copy all toolkit files
mkdir -p .github/instructions .github/skills scripts data docs/guides
cp /tmp/toolkit/.github/instructions/* .github/instructions/
cp /tmp/toolkit/.github/skills/* .github/skills/
cp /tmp/toolkit/scripts/* scripts/
cp /tmp/toolkit/data/* data/
cp /tmp/toolkit/docs/guides/* docs/guides/
# No chmod needed - use: node scripts/<name>.js

# IMPORTANT: Add toolkit files to .gitignore (if not already added)
cat >> .gitignore << 'EOF'

# PWA Migration Toolkit (temporary helper files)
.github/instructions/migration-*.instructions.md
.github/skills/pwa-*.SKILL.md
.github/skills/README.md
scripts/migrate-*.js
scripts/check-*.js
scripts/analyze-*.js
scripts/detect-*.js
scripts/generate-*.js
scripts/merge-*.js
scripts/fix-*.js
scripts/sync-*.js
scripts/update-*.js
scripts/validate-*.js
scripts/pre-commit-*.js
data/pattern-migrations.json
docs/guides/migration-*.md
docs/guides/customization-*.md
EOF

# OR use the pre-made template:
# cat /tmp/toolkit/.gitignore-toolkit-template >> .gitignore

# Cleanup
rm -rf /tmp/toolkit
```

---

## 📖 Key Documentation

**Start here:** `.github/instructions/migration-checklist.instructions.md`

**Common issues:** `.github/instructions/migration-issues.instructions.md`

**Git strategies:** `.github/instructions/migration-git.instructions.md`

---

## 🎯 What's New in This Version

### Key Capabilities

1. **Migration Analyzer** (`analyze-migration.js`)
   - Combines complexity analysis + strategy recommendation
   - Recommends detection tier (1/2/3) and migration strategy (Big Bang / Hybrid / Incremental)
   - Interactive team questionnaire for personalized advice
   - Usage: `node scripts/analyze-migration.js 4.0.0 10.0.0`

2. **Docker Compose Merge Tool** (`merge-docker-compose.js`)
   - Intelligently merges docker-compose.yml from both branches
   - Preserves custom services and environment variables
   - Saves: 15-30 minutes of manual YAML editing
   - Usage: `node scripts/merge-docker-compose.js`

3. **Template Linting Suppressor** (`fix-template-linting.js`)
   - Auto-adds eslint-disable comments for migration-related issues
   - Focus on critical issues first, fix linting later
   - Saves: 1-2 hours during migration
   - Usage: `node scripts/fix-template-linting.js`

4. **Snapshot Update Manager** (`update-snapshots.js`)
   - Intelligently handles Jest snapshot mismatches
   - Distinguishes real failures from expected changes
   - Saves: 20-40 minutes of manual snapshot review
   - Usage: `node scripts/update-snapshots.js --interactive`

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
