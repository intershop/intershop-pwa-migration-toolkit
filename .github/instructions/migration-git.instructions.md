---
applyTo: '**/migration*.{js,sh,ts}'
---

# PWA Migration - Git Operations and Strategies

This guide covers Git remote setup, conflict resolution strategies, and rollback procedures for PWA migrations.

## Git Remote Strategy

### IMPORTANT: Two-Remote Setup

**First, identify your remotes:**

```bash
# Check your actual remote configuration
git remote -v

# Example output (your names may differ):
# upstream  git@github.com:intershop/intershop-pwa.git (fetch)
# upstream  git@github.com:intershop/intershop-pwa.git (push)  ← Intershop PWA (READ-ONLY)
# origin    git@gitlab.your-company.com:your-project.git (fetch)
# origin    git@gitlab.your-company.com:your-project.git (push) ← Your project (READ-WRITE)
```

**Identify which remote is which:**
- **Intershop PWA remote** (READ-ONLY): Points to `github.com/intershop/intershop-pwa`
- **Your project remote** (READ-WRITE): Points to your company's Git server

**Convention used in this documentation:**
- `<intershop-remote>`: The Intershop PWA GitHub repository (commonly named `origin` or `upstream`)
- `<project-remote>`: Your custom PWA project repository (commonly named `gitlab`, `origin`, or your project name)

**⚠️ CRITICAL: Do NOT rename your remotes to match this documentation!**  
Use your actual remote names and replace `<intershop-remote>` and `<project-remote>` accordingly.

**Example workflows:**

```bash
# Pull PWA updates from Intershop (replace <intershop-remote> with your actual name)
git fetch <intershop-remote>
git pull <intershop-remote> develop

# Push your work to your project repository (replace <project-remote> with your actual name)
git push -u <project-remote> migration/training-to-9.1
git push <project-remote> feature/migration-tooling

# NEVER push to Intershop remote - it's read-only and managed by Intershop
```

**Key Points:**

- Identify which remote points to Intershop PWA GitHub (READ-ONLY)
- Identify which remote points to your project repository (READ-WRITE)
- **CRITICAL**: Never push to the Intershop remote
- Always push to your project remote

## Git Conflict Resolution Strategy

### Smart Conflict Resolution Order

1. **--ours**: Custom configurations (docker-compose.yml, environment files, custom templates)
2. **Manual merge (preferred)**: Localization files (en_US.json, de_DE.json, fr_FR.json) - merge both sides
3. **--theirs**: Standard PWA core code (PWA features, libraries)
4. **Manual merge**: Module integrations (app.module.ts, shared.module.ts)

### Example: Module Merge Conflict Resolution

```typescript
// Conflict in shared.module.ts or app.module.ts
<<<<<<< HEAD (PWA 9.1)
const imports = [
  ...importExportModules,
  ...standaloneComponents,
];
=======
const imports = [
  ...importExportModules,
  YourCustomExportsModule,  // Your custom module
];
>>>>>>> your-custom-branch

// ✅ Correct resolution: Keep both
const imports = [
  ...importExportModules,
  ...standaloneComponents,  // Keep PWA 9.1 additions
  YourCustomExportsModule,  // Keep your custom additions
];
```

### Conflict Resolution Guidelines

**Use `--ours` for:**

- Custom configuration files (docker-compose.yml)
- Custom environment files
- Custom templates that don't exist in base PWA
- Project-specific documentation

**Manual merge (merge both) for localization files:**

- **Localization files** (src/assets/i18n/*.json) - IMPORTANT: Merge both customized and original translations
- See detailed strategy in "Localization File Merge Strategy" section below

**Use `--theirs` for:**

- PWA core feature implementations
- Standard library updates  
- New PWA features that don't conflict with your customizations
- Package dependencies (package.json, package-lock.json)

**Manual merge for:**

- Module imports/exports (app.module.ts, shared.module.ts)
- Routing configurations
- Shared components that have both PWA updates and custom modifications
- Any file where both sides have meaningful changes

## Localization File Merge Strategy

### Problem: Why Localization Files Need Special Attention

Localization files (en_US.json, de_DE.json, fr_FR.json) are **ALWAYS** modified in both branches:

- **New PWA version** adds translations for new features
- **Your customization** adds translations for custom features
- Simple `--ours` or `--theirs` strategy **loses data**

### Preferred Strategy: Merge Both Sides

**Goal**: Combine translations from both branches, keeping all keys.

#### Step 1: Identify Conflicts

```bash
# After merge, check for localization conflicts
git status | grep 'i18n/.*\.json'
# Output example:
#   both modified:   src/assets/i18n/en_US.json
#   both modified:   src/assets/i18n/de_DE.json
```

#### Step 2: Merge Strategy (Three-Way Merge)

**For each conflicted localization file:**

```bash
# Example for en_US.json

# Extract versions
git show :1:src/assets/i18n/en_US.json > en_US.base.json    # common ancestor
git show :2:src/assets/i18n/en_US.json > en_US.theirs.json # new PWA
git show :3:src/assets/i18n/en_US.json > en_US.ours.json   # your customization

# Use Node.js to merge (see script below)
node scripts/merge-i18n-files.js
```

#### Step 3: Automated Merge Script

Create `scripts/merge-i18n-files.js`:

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * Merges localization JSON files during PWA migration.
 * Strategy: Keep all keys from both sides, prefer customization values for duplicates.
 */

function mergeI18nFiles(basePath, theirsPath, oursPath, outputPath) {
  const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  const theirs = JSON.parse(fs.readFileSync(theirsPath, 'utf8'));
  const ours = JSON.parse(fs.readFileSync(oursPath, 'utf8'));

  // Start with new PWA translations (theirs)
  const merged = { ...theirs };

  // Merge keys from base that existed before (for context)
  // Identify which keys were in base
  const baseKeys = new Set(Object.keys(base));

  // Add custom translations (ours)
  for (const [key, value] of Object.entries(ours)) {
    if (baseKeys.has(key) && theirs[key] && theirs[key] !== base[key]) {
      // Key existed in base, both sides modified it
      console.log(`⚠️  CONFLICT: "${key}"`);
      console.log(`   Base:   "${base[key]}"`);
      console.log(`   Theirs: "${theirs[key]}"`);
      console.log(`   Ours:   "${value}"`);
      console.log(`   → Using customized version (ours)\n`);
      merged[key] = value; // Prefer customization
    } else if (!theirs[key]) {
      // Key only in customization (custom feature)
      merged[key] = value;
    } else if (theirs[key] === value) {
      // Same value, no conflict
      merged[key] = value;
    }
  }

  // Sort keys alphabetically for consistency
  const sorted = Object.keys(merged)
    .sort()
    .reduce((acc, key) => {
      acc[key] = merged[key];
      return acc;
    }, {});

  // Write merged result
  fs.writeFileSync(outputPath, JSON.stringify(sorted, null, 2) + '\n');

  console.log(`✓ Merged to: ${outputPath}`);
  console.log(`  Total keys: ${Object.keys(sorted).length}`);
  console.log(`  From theirs: ${Object.keys(theirs).length}`);
  console.log(`  From ours: ${Object.keys(ours).length}`);
}

// Process all i18n files
const i18nDir = 'src/assets/i18n';
const locales = ['en_US', 'de_DE', 'fr_FR'];

locales.forEach(locale => {
  const basePath = `${locale}.base.json`;
  const theirsPath = `${locale}.theirs.json`;
  const oursPath = `${locale}.ours.json`;
  const outputPath = path.join(i18nDir, `${locale}.json`);

  if (fs.existsSync(basePath) && fs.existsSync(theirsPath) && fs.existsSync(oursPath)) {
    console.log(`\n📝 Merging ${locale}.json...`);
    mergeI18nFiles(basePath, theirsPath, oursPath, outputPath);

    // Clean up temporary files
    fs.unlinkSync(basePath);
    fs.unlinkSync(theirsPath);
    fs.unlinkSync(oursPath);
  }
});

console.log('\n✅ All localization files merged successfully');
```

#### Step 4: Manual Review for Conflicts

Script will output conflicts where both sides modified same key:

```bash
⚠️  CONFLICT: "product.add_to_cart.link"
   Base:   "Add to Cart"
   Theirs: "Add to Basket"  # PWA updated terminology
   Ours:   "In Warenkorb"   # Your German customization
   → Using customized version (ours)
```

**Developer Decision Required:**

Review script output and decide for each conflict:

- **Keep customization** (default): Your translation is intentional and should be kept
- **Use PWA version**: PWA improved the translation, adopt it
- **Create new hybrid**: Combine aspects of both

#### Step 5: Mark Conflicts as Resolved

```bash
# After merge script runs and you've reviewed conflicts
git add src/assets/i18n/*.json
git commit -m "merge: combine localization files from both branches"
```

### Verification After Merge

```bash
# 1. Check that all expected keys are present
node scripts/check-i18n-completeness.js

# 2. Verify JSON syntax
npx jsonlint src/assets/i18n/*.json

# 3. Check for duplicate keys (should be none)
npx jsonlint --quiet --compact src/assets/i18n/*.json | grep -i duplicate

# 4. Sort and format (PWA has scripts for this)
npm run sort-i18n
```

### Alternative: Simple Merge (When Time is Limited)

If automated merge isn't feasible:

```bash
# 1. Accept one side first
git checkout --theirs src/assets/i18n/en_US.json

# 2. Manually add missing custom keys
# Open editor side-by-side:
# - Left: git show :3:src/assets/i18n/en_US.json (your customization)
# - Right: src/assets/i18n/en_US.json (current merged file)
# - Copy custom keys that are missing

# 3. Verify and commit
npm run sort-i18n
git add src/assets/i18n/en_US.json
```

### Common Localization Patterns

**Custom feature translations** (should always be kept):

```json
{
  "warehouse.selector.label": "Select Warehouse",
  "warehouse.inventory.heading": "Warehouse Inventory",
  "custom.feature.xyz.button": "Your Custom Button"
}
```

**PWA improvements** (evaluate case-by-case):

```json
{
  // PWA 9.1 improved wording
  "product.add_to_cart.link": "Add to Basket",  // was: "Add to Cart"
  
  // PWA added accessibility improvement
  "product.add_to_cart.aria.label": "Add {{productName}} to basket"
}
```

**Deprecated keys** (can be removed):

```json
{
  // If feature was removed from PWA
  "old.feature.that.no.longer.exists": "Old Translation"
}
```

### Integration with Migration Script

Add to `scripts/migrate-custom-branch.sh` or `scripts/migration-helper.js`:

```bash
# After merge conflicts are resolved
if git status | grep -q 'i18n/.*\.json'; then
  echo "📝 Localization files have conflicts"
  echo "Running automated merge..."
  
  # Extract versions
  for locale in en_US de_DE fr_FR; do
    git show :1:src/assets/i18n/${locale}.json > ${locale}.base.json 2>/dev/null || echo "{}"
    git show :2:src/assets/i18n/${locale}.json > ${locale}.theirs.json
    git show :3:src/assets/i18n/${locale}.json > ${locale}.ours.json
  done
  
  # Run merge script
  node scripts/merge-i18n-files.js
  
  echo "\n⚠️  Please review conflicts above and verify merged translations"
  echo "Press Enter to continue after review..."
  read
  
  git add src/assets/i18n/*.json
fi
```

### Best Practices

✅ **DO:**

- Merge both sides to preserve all translations
- Review conflicts manually - automation can't determine intent
- Use `npm run sort-i18n` after merge for consistency
- Test application in all supported locales after merge
- Document significant translation changes in migration report

❌ **DON'T:**

- Use `--ours` or `--theirs` blindly - you'll lose translations
- Ignore conflicts - review each one
- Forget to test non-English locales
- Assume all PWA translations are better - evaluate each conflict

## Rollback Strategy

If migration fails:

```bash
# Keep original branch safe
git branch backup-training_4.0.0 training_4.0.0

# Failed migration can be abandoned
git branch -D migration/failed-attempt

# Restart from clean slate
git checkout develop
git checkout -b migration/training-to-9.1-retry
git merge --no-commit training_4.0.0

# Always push to project remote, not Intershop remote
git push -u <project-remote> migration/training-to-9.1-retry
```

### When to Consider Rollback

- More than 50% of files have unresolvable conflicts
- Core functionality is broken after multiple fix attempts
- Migration is taking significantly longer than estimated (>2x)
- Critical custom features are incompatible with new PWA version
- Team consensus that restarting with a different strategy is better

### Rollback Best Practices

1. **Always create backup branches** before starting migration
2. **Document what went wrong** before rolling back
3. **Keep failed attempt branch** for learning (don't delete immediately)
4. **Analyze root causes** before retrying
5. **Update migration strategy** based on lessons learned

## Branch Naming Conventions

Recommended branch naming for migrations:

```bash
# Format: migration/[from]-to-[to]-[attempt]
migration/4.0-to-9.1
migration/4.0-to-9.1-retry
migration/4.0-to-9.1-final

# Or with dates for tracking
migration/4.0-to-9.1-2024-03
migration/4.0-to-9.1-2024-04-retry

# Feature branches during migration
feature/migration-theme-updates
feature/migration-extension-cleanup
fix/migration-scss-variables
```

## Commit Message Guidelines During Migration

Use clear, descriptive commit messages that indicate migration progress:

```bash
# Initial merge
git commit -m "chore: merge PWA 9.1 into custom 4.0 branch"

# Conflict resolutions
git commit -m "fix: resolve module import conflicts in app.module.ts"
git commit -m "fix: merge custom and PWA navigation implementations"

# Feature-specific fixes
git commit -m "fix(scss): add missing PWA 9.1 variables to custom theme"
git commit -m "fix(env): register custom features in environment.model.ts"

# Extension cleanup
git commit -m "chore: remove deprecated tacton extension"

# Testing and verification
git commit -m "test: verify custom features after migration"
git commit -m "docs: update migration notes and success report"
```

## Git Safety Checklist

Before starting migration:

- [ ] All current work is committed and pushed to gitlab
- [ ] Created backup branch of current state
- [ ] Verified git remotes are correctly configured
- [ ] Confirmed team is aware of migration in progress
- [ ] Have rollback plan documented

During migration:

- [ ] Committing frequently (after each major fix category)
- [ ] Not force-pushing to shared branches
- [ ] Pushing to project remote, never to Intershop remote
- [ ] Keeping commit messages descriptive

After migration:

- [ ] Final commits pushed to gitlab
- [ ] Pull request created for team review
- [ ] Migration documentation updated
- [ ] Backup branches retained for reference period
