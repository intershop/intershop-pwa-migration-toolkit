# Missing Elements Analysis & Implementation Proposal

**Date:** March 25, 2026  
**Analysis:** Comparison of official Intershop PWA documentation vs. PWA Migration Toolkit

## Executive Summary

The Intershop PWA Migration Toolkit provides excellent automation but is missing several critical elements from the official documentation. This document identifies gaps and proposes concrete implementations.

---

## 🔍 Missing Elements Identified

### Category 1: Version-Specific Technical Details ⭐⭐⭐⭐⭐
**Impact:** Critical | **Complexity:** Medium-High

#### What's Missing

The official `migrations.md` contains **100+ specific technical changes** across all PWA versions that aren't captured in the toolkit:

1. **SCSS Variable Renames** (PWA 10.0)
   - `$color-corporate` → `$bg-color-corporate`
   - `$color-special-primary` → `$color-special-error`
   - `$button-primary-bg` → `$CORPORATE-PRIMARY`
   - 30+ more variables renamed or removed

2. **API Method Changes**
   - `ApiService.options()` removed (use `.get()` instead)
   - `logoutUserSuccess` → `resetUserData` for non-API logouts
   - `getOrders()` parameter changes for pagination
   - `TokenService` introduced, splitting from `UserService`

3. **Formly Migrations** (PWA 4.0)
   - `templateOptions` → `props` (deprecated in v5, removed in v8)
   - `expressionProperties` → new format
   - Wrapper changes: `textarea-description` → `maxlength-description`

4. **TypeScript Breaking Changes**
   - `TestBed.get` → `TestBed.inject` (Angular 14+)
   - Form classes: `FormGroup` → `UntypedFormGroup` (Angular 14+)
   - `async` test helper → native `async/await`
   - `destroy$: Subject` → `takeUntilDestroyed()` operator

5. **NgRx Migration Patterns**
   - Action classes → `createAction()`
   - `@Effect()` decorator → `createEffect()`
   - Reducer switch statements → `createReducer()`
   - `ofRoute` → `@ngrx/router-store` selectors

6. **Angular CLI Configuration Changes**
   - `defaultProject` removed from `angular.json`
   - `relativeLinkResolution` changed from `legacy` to `corrected`
   - Service worker configuration moved

#### Proposed Implementation

**Option A: Enhance pattern-migrations.json (Recommended)**

Extend the existing JSON structure with detailed breaking changes:

```json
{
  "version": "10.0.0",
  "releaseDate": "2026-03-13",
  "angularVersion": "17",
  "nodeVersion": "22.22.0",
  "npmVersion": "10.9.4",
  "icmMinVersion": "11.0.0",
  
  "scssChanges": {
    "variableRenames": [
      {
        "old": "$color-corporate",
        "new": "$bg-color-corporate",
        "usage": "Corporate color for backgrounds",
        "category": "color",
        "severity": "breaking"
      },
      {
        "old": "$color-special-primary",
        "new": "$color-special-error",
        "usage": "Error state color",
        "category": "color",
        "severity": "breaking"
      }
    ],
    "variablesRemoved": [
      {
        "name": "$input-accent-color",
        "replacement": "$CORPORATE-DARK",
        "reasoning": "Consolidated color system"
      },
      {
        "name": "$button-primary-bg",
        "replacement": "$CORPORATE-PRIMARY",
        "reasoning": "Simplified button theming"
      }
    ],
    "functionsDeprecated": [
      {
        "old": "darken($color, 20%)",
        "new": "color.adjust($color, $lightness: -20%)",
        "requires": "@use 'sass:color'",
        "version": "Sass module system"
      }
    ]
  },
  
  "apiChanges": [
    {
      "type": "removed",
      "class": "ApiService",
      "method": "options()",
      "replacement": {
        "method": "get()",
        "description": "Use get() method with REST calls of latest REST interface"
      },
      "severity": "breaking",
      "migration": "Search for `.options(` and replace with `.get(`"
    },
    {
      "type": "changed",
      "class": "UserService / Identity Providers",
      "action": "logoutUserSuccess",
      "changes": "Now API-specific, dispatch after token revocation only",
      "replacement": {
        "action": "resetUserData",
        "use": "For resetting user state without API calls (forced logout, session cleanup)"
      },
      "severity": "breaking"
    }
  ],
  
  "componentChanges": [
    {
      "component": "LanguageSwitchComponent",
      "change": "Moved from mobile menu to main header navigation",
      "removals": ["language switch accordion view", "component input variable"],
      "impact": "If customized mobile menu, remove language switch from there"
    }
  ],
  
  "dependencyChanges": [
    {
      "package": "@angular/core",
      "oldVersion": "16.x",
      "newVersion": "17.x",
      "breaking": true,
      "migrationSchematic": "@angular/core:control-flow"
    },
    {
      "package": "font-awesome",
      "action": "removed",
      "replacement": "bootstrap-icons",
      "migration": "Replace <fa-icon> with <i class=\"bi bi-*\">"
    }
  ],
  
  "configurationChanges": [
    {
      "variable": "CACHE_CLEARER",
      "change": "Opt-in → Opt-out",
      "default": "enabled",
      "migration": "Set to 'off' to disable"
    },
    {
      "variable": "LOGLEVEL / LOGFORMAT",
      "change": "New structured JSON logging (ECS format)",
      "removed": ["LOGGING", "LOG_ALL"],
      "default": "JSON format to stdout"
    }
  ],
  
  "templateChanges": [
    {
      "old": "*ngIf",
      "new": "@if",
      "schematic": "ng generate @angular/core:control-flow",
      "examples": [
        {
          "before": "<div *ngIf=\"condition\">content</div>",
          "after": "@if (condition) { <div>content</div> }"
        }
      ]
    },
    {
      "old": "*ngFor",
      "new": "@for",
      "required": "track expression",
      "examples": [
        {
          "before": "<div *ngFor=\"let item of items\">{{ item }}</div>",
          "after": "@for (item of items; track item.id) { <div>{{ item }}</div> }"
        }
      ]
    }
  ],
  
  "testingChanges": [
    {
      "old": "TestBed.get(ServiceName)",
      "new": "TestBed.inject(ServiceName)",
      "version": "Angular 14+",
      "autofix": true
    },
    {
      "old": "RouterTestingModule",
      "new": "provideRouter()",
      "version": "Angular 17+",
      "example": "providers: [provideRouter(routes)]"
    }
  ]
}
```

**Create extraction script: `scripts/extract-migration-details.js`**

```javascript
#!/usr/bin/env node
/**
 * Extracts detailed breaking changes from official migrations.md
 * and enhances pattern-migrations.json
 */

const https = require('https');
const fs = require('fs');

const MIGRATIONS_URL = 'https://raw.githubusercontent.com/intershop/intershop-pwa/develop/docs/guides/migrations.md';

async function fetchMigrationsDoc() {
  return new Promise((resolve, reject) => {
    https.get(MIGRATIONS_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseScssVariableRenames(markdown) {
  // Extract SCSS variable rename tables
  const tableRegex = /\| Renamed variable.*?\n\|.*?\n((?:\|.*?\n)+)/g;
  // Parse and structure...
}

function parseApiChanges(markdown) {
  // Extract API method changes
  // Look for "removed", "deprecated", "changed" keywords
}

// ... more parsers

async function main() {
  const markdown = await fetchMigrationsDoc();
  
  const enhancements = {
    scssChanges: parseScssVariableRenames(markdown),
    apiChanges: parseApiChanges(markdown),
    // ...
  };
  
  // Merge with existing pattern-migrations.json
  const existingPatterns = JSON.parse(
    fs.readFileSync('./data/pattern-migrations.json', 'utf8')
  );
  
  // Enhance and write back
  fs.writeFileSync(
    './data/pattern-migrations-enhanced.json',
    JSON.stringify(enhancedPatterns, null, 2)
  );
}

main();
```

**Time estimate:** 6-8 hours initial implementation, 2-4 hours per version update

---

### Category 2: Dependency Update Workflow ⭐⭐⭐⭐
**Impact:** High | **Complexity:** Low-Medium

#### What's Missing

The official `updating-pwa.md` provides an **8-step structured workflow** for dependency updates that's not captured in the toolkit:

1. Check Angular updates (`ng update`)
2. Update Angular dependencies
3. Update third-party project dependencies (`npm outdated`)
4. Cleanup dead dependencies
5. Update formatting utilities
6. Apply refactoring and deprecations
7. Restructure commits for customer consumption
8. Regenerate `package-lock.json`

#### Proposed Implementation

**Create: `scripts/update-dependencies.js`**

```bash
#!/bin/bash
# PWA Dependency Update Workflow
# Based on: https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/updating-pwa.md

set -e

echo "🔄 PWA Dependency Update Workflow"
echo "=================================="
echo ""

# Step 0: Check compatibility
echo "Step 0: Checking Angular compatibility..."
CURRENT_ANGULAR=$(grep '"@angular/core"' package.json | sed 's/.*: "\\^\\?\\([0-9]*\\).*/\\1/')
echo "Current Angular version: $CURRENT_ANGULAR"
echo ""

# Step 1: Check available updates
echo "Step 1: Checking for Angular updates..."
ng update
echo ""
read -p "Press Enter to continue to Angular updates..."

# Step 2: Update Angular
echo "Step 2: Updating Angular dependencies..."
echo "Running: ng update @angular/cli @angular/core"
ng update @angular/cli @angular/core -C
echo ""

# Step 3: Check third-party packages
echo "Step 3: Checking third-party dependencies..."
echo "Outdated packages:"
npm outdated --long || true
echo ""
read -p "Review the list above. Press Enter to continue..."

# Step 4: Update third-party (interactive)
echo "Step 4: Update third-party packages?"
echo "Recommended: Update one category at a time"
echo "  - ng update <package-name>"
echo "  - npm install <package-name>@latest"
echo ""
read -p "Press Enter when done with third-party updates..."

# Step 5: Check for unused dependencies
echo "Step 5: Checking for unused dependencies..."
echo "Use 'npm ls <package>' to check if still needed"
npm ls --depth=0 | grep -v "^[└├]" || true
echo ""

# Step 6: Update formatting tools
echo "Step 6: Update formatting tools (prettier, eslint)..."
read -p "Update prettier/eslint? (y/N): " UPDATE_FORMAT
if [[ "$UPDATE_FORMAT" =~ ^[Yy]$ ]]; then
  ng update prettier eslint
  echo "Run 'npm run format' to apply new formatting"
fi
echo ""

# Step 7: Clean install
echo "Step 7: Regenerating package-lock.json..."
read -p "Perform clean reinstall? (recommended) (y/N): " CLEAN_INSTALL
if [[ "$UPDATE_FORMAT" =~ ^[Yy]$ ]]; then
  rm -rf node_modules package-lock.json
  npm install
fi
echo ""

# Step 8: Verification
echo "Step 8: Running verification..."
npm run build
npm run lint
npm test

echo ""
echo "✅ Dependency update complete!"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff"
echo "2. Test application: npm start"
echo "3. Commit changes with descriptive message"
echo "4. Document migration notes"
```

**Create: `docs/guides/dependency-management.md`**

Document the workflow with examples, common issues, and version-specific considerations.

**Time estimate:** 2-3 hours

---

### Category 3: ICM Version Requirements Matrix ⭐⭐⭐⭐
**Impact:** High | **Complexity:** Low

#### What's Missing

The official docs specify **ICM version requirements** for each PWA release. This is CRITICAL because:
- Some PWA features require specific ICM endpoints
- REST API versions have breaking changes
- Compatibility issues cause runtime errors

Examples from migrations.md:
- PWA 9.1.0 → Requires ICM 14.1.0 + Recurring Order Extension 2.3.0
- PWA 8.0.0 → Order history paging requires ICM 13.1.0+
- PWA 8.0.0 → Cost center paging requires ICM 13.1.0+
- PWA 5.3.0 → Budget type configuration requires ICM 12.3.0+

#### Proposed Implementation

**Add to pattern-migrations.json:**

```json
{
  "version": "10.0.0",
  "icmRequirements": {
    "minimum": "11.0.0",
    "recommended": "14.1.0",
    "features": [
      {
        "feature": "Product Inventory Separate Fetch",
        "icmMinVersion": "11.0.0",
        "restApi": "inventories REST endpoint",
        "description": "Product inventory now fetched separately"
      },
      {
        "feature": "SPARQUE API v4",
        "sparqueVersion": "4.0",
        "description": "SPARQUE services use API version 4"
      }
    ],
    "extensions": [
      {
        "name": "Recurring Orders",
        "packageId": "icm-as-customization-recurringorders",
        "minVersion": "2.3.0",
        "requiredFor": "Recurring orders with warranties"
      }
    ]
  }
}
```

**Create: `scripts/check-icm-compatibility.js`**

```bash
#!/bin/bash
# Check if connected ICM version is compatible with PWA version

PWA_VERSION=$(grep '"version"' package.json | sed 's/.*: "\\(.*\\)".*/\\1/')
echo "PWA Version: $PWA_VERSION"

# Fetch ICM version from REST API
ICM_BASE_URL=${ICM_BASE_URL:-$(grep 'icmBaseURL' src/environments/environment.ts | sed 's/.*: .\\(.*\\)..*/\\1/')}
echo "ICM URL: $ICM_BASE_URL"

ICM_VERSION=$(curl -s "$ICM_BASE_URL/INTERSHOP/rest/WFS/-;loc=en_US;cur=USD/configurations" | jq -r '.version')
echo "ICM Version: $ICM_VERSION"

# Load requirements from pattern-migrations.json
REQUIRED_ICM=$(jq -r ".[] | select(.version==\"$PWA_VERSION\") | .icmRequirements.minimum" data/pattern-migrations.json)

# Compare versions
if [ "$(printf '%s\n' "$REQUIRED_ICM" "$ICM_VERSION" | sort -V | head -n1)" != "$REQUIRED_ICM" ]; then
  echo "⚠️  WARNING: ICM version $ICM_VERSION is below minimum $REQUIRED_ICM"
  echo "    Some features may not work correctly"
else
  echo "✅ ICM version is compatible"
fi
```

**Time estimate:** 3-4 hours

---

### Category 4: Customization Best Practices ⭐⭐⭐
**Impact:** Medium-High | **Complexity:** Low

#### What's Missing

The `customizations.md` guide provides crucial advice on **HOW to customize** without breaking future migrations:

1. **When to copy vs. override components**
   - Copy if >20% changes needed
   - Override for small tweaks
   - Mark with `// CUSTOMIZATION` comments

2. **Theme-specific overrides**
   - `.theme.html` suffix for templates
   - Multiple theme support
   - Override schematic usage

3. **Styling best practices**
   - Copy only needed SCSS files
   - Don't modify global styles
   - Use theme folder structure

4. **Testing during migration**
   - Update snapshots instead of rewriting tests
   - Keep tests running
   - Use `npm run check` as gate

#### Proposed Implementation

**Create: `docs/guides/customization-best-practices.md`**

Extract and adapt the best practices from official docs with toolkit-specific examples.

**Add pre-commit check: `.husky/pre-commit-customization-check.js`**

```bash
#!/bin/bash
# Checks for customization anti-patterns

# Check for modifications to core Intershop files without CUSTOMIZATION markers
MODIFIED_CORE=$(git diff --cached --name-only | grep -E "src/(app|styles)/" | grep -v ".theme." || true)

if [ -n "$MODIFIED_CORE" ]; then
  echo "⚠️  Modified core Intershop files detected:"
  echo "$MODIFIED_CORE"
  echo ""
  echo "Please ensure you've added // CUSTOMIZATION comments"
  echo "or consider using theme overrides instead (.theme.html suffix)"
  read -p "Continue anyway? (y/N): " CONTINUE
  if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi
```

**Time estimate:** 2-3 hours

---

### Category 5: Video Tutorial Integration ⭐⭐⭐
**Impact:** Medium | **Complexity:** Very Low

#### What's Missing

The toolkit doesn't reference the **Intershop Academy video tutorials** which provide visual walkthroughs:

- [PWA 7.0 → 8.0 Migration](https://public.academy.intershop.com/plus/catalog/courses/452)
- [PWA 8.0 → 9.0 Migration](https://public.academy.intershop.com/plus/catalog/courses/454)

These are invaluable for first-time migrators.

#### Proposed Implementation

**Update `scripts/migration-helper.js`** to show video links:

```javascript
// At the start of migration
if (['7.0.0', '7.1.0'].includes(sourceVersion) && targetVersion.startsWith('8.')) {
  console.log(chalk.blue('\n📺 Video Tutorial Available!'));
  console.log('   Watch: Migrating from PWA 7.0 to 8.0');
  console.log('   URL: https://public.academy.intershop.com/plus/catalog/courses/452');
  console.log('   (Free registration required)\n');
}

if (sourceVersion.startsWith('8.') && targetVersion.startsWith('9.')) {
  console.log(chalk.blue('\n📺 Video Tutorial Available!'));
  console.log('   Watch: Migrating from PWA 8.0 to 9.0');
  console.log('   URL: https://public.academy.intershop.com/plus/catalog/courses/454\n');
}
```

**Time estimate:** 30 minutes

---

## Implementation Priority Matrix

| Element | Priority | Impact | Complexity | Time | Status |
|---------|----------|--------|------------|------|--------|
| **1. Official Doc References** | P0 | Critical | Very Low | 1h | ✅ DONE |
| **2. Migration Approaches Guide** | P0 | Critical | Low | 2h | ✅ DONE |
| **3. Enhanced Pattern Database** | P1 | High | High | 8h | ✅ DONE |
| **4. ICM Compatibility Check** | P1 | High | Low | 3h | ✅ DONE |
| **5. Video Tutorial Links** | P2 | Medium | Very Low | 0.5h | ⏳ TODO |
| **6. Dependency Update Script** | P2 | High | Medium | 3h | ✅ DONE |
| **7. Customization Best Practices** | P2 | Medium | Low | 2h | ⏳ TODO |
| **8. Pre-commit Checks** | P3 | Low | Low | 2h | ⏳ TODO |

### Recommended Implementation Order

**Phase 1 (Immediate - 3 hours):** ✅ COMPLETED
1. ✅ Official doc references
2. ✅ Migration approaches guide
3. ⏳ Video tutorial links (next)

**Phase 2 (Next Sprint - 12 hours):** ✅ COMPLETED
4. ✅ Enhanced pattern database with SCSS/API changes
5. ✅ ICM compatibility check
6. ✅ Dependency update script

**Phase 3 (Future - 4 hours):**
7. Customization best practices doc
8. Pre-commit customization checks

---

## Validation Plan

### How to Verify Improvements

1. **User Testing**
   - Have developers run through migration with new docs
   - Measure time to completion
   - Track number of "I didn't know about X" moments

2. **Coverage Metrics**
   - % of breaking changes from migrations.md captured in toolkit
   - % of common migration questions answered by docs
   - % of migration approaches documented

3. **Quality Indicators**
   - Reduction in support tickets
   - Decrease in failed migrations
   - Faster migration completion times

---

## Long-term Maintenance Plan

### Keeping Toolkit Synchronized

1. **Monitor Official Docs**
   - Watch for changes to migrations.md, customizations.md, updating-pwa.md
   - Set up GitHub watch on Intershop PWA repo

2. **Update Pattern Database**
   - When new PWA version released, extract breaking changes
   - Run `extract-migration-details.js` script
   - Review and commit updated patterns

3. **Test Automation**
   - Create test suite that validates pattern database
   - Ensure ICM version checks are current
   - Verify script compatibility with new PWA versions

---

## Conclusion

The PWA Migration Toolkit provides excellent automation that the official docs lack. However, it's currently missing crucial **knowledge** that exists in the official documentation.

**Key insight:** The toolkit should **complement** the official docs, not replace them. Scripts handle automation, official docs provide understanding.

**Next steps:**
1. ✅ Implement P0 items (docs references, approaches) - DONE
2. Gather feedback on new guides
3. Proceed with P1 items (pattern database, ICM checks)
4. Iterate based on user feedback
