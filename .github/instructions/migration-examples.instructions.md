---
applyTo: '**/migration*.{js,ts}'
---

# PWA Migration - Code Examples and Patterns

This guide provides concrete code examples for common migration tasks and patterns.

## Example 1: Adding Custom Feature to Environment

```typescript
// Example: Adding a custom 'inventory' feature

// STEP 1: environment.model.ts
export interface Environment {
  features: (
    | 'compare'
    | 'inventory'  // ← Add your custom feature here first
    // ... other features
  )[];
}

// STEP 2: environment.[your-config].ts (e.g., environment.production.ts)
features: [
  ...ENVIRONMENT_DEFAULTS.features,
  'inventory',  // ← Then use it here
],
```

**Why This Order Matters:**

- TypeScript union type must be defined before usage
- Prevents "Type 'string' is not assignable to type..." errors
- Ensures type safety across all environment configurations

## Example 2: SCSS Variable Addition Pattern

```scss
// In src/styles/themes/[your-theme-name]/variables.scss
// Always add in same section and order as b2b theme

// Import Sass color module for PWA 9.1+
@use 'sass:color';
@use 'sass:map'; // If using map functions

// === Corporate design colors section ===
$CORPORATE-PRIMARY: #688dc3; // Your brand color
$CORPORATE-SECONDARY: color.adjust($CORPORATE-PRIMARY, $lightness: -10%);
$CORPORATE-LIGHT: color.adjust($CORPORATE-PRIMARY, $lightness: 10%); // ← Add after SECONDARY
$CORPORATE-DARK: color.adjust($CORPORATE-PRIMARY, $lightness: -20%); // ← Add after LIGHT

// === General colors section ===
$color-primary: #222;
$color-secondary: #2c2d2e;
$color-tertiary: #eee;
$color-quaternary: #d5d5d5; // ← Add in sequence

// === Special colors section ===
$color-special-primary: #e74c3c;
$color-special-secondary: #f39c12;

// PWA 9.1 special colors (comment for clarity)
$color-special-error: #c00; // ← Group new variables
$color-special-warning: #f39c12;
$color-special-info: #006f6f;
$color-special-success: #3c7d3c;

// === Product label colors ===
$color-special-sale: #ea1919;
$color-special-topseller: #cf00a5;
$color-special-new: #06f;
```

**Best Practices:**

- Group related variables together
- Add comments for clarity
- Follow same order as b2b theme
- Use Sass modules (not global functions)

## Example 3: Migrating Old Sass Functions to Sass Modules

```scss
// ❌ Old way (deprecated in Sass/PWA 9.1+)
$dark-color: darken($CORPORATE-PRIMARY, 20%);
$light-color: lighten($CORPORATE-PRIMARY, 10%);
$map-value: map-get($theme-colors, 'primary');

// ✅ New way (Sass modules)
@use 'sass:color';
@use 'sass:map';

$dark-color: color.adjust($CORPORATE-PRIMARY, $lightness: -20%);
$light-color: color.adjust($CORPORATE-PRIMARY, $lightness: 10%);
$map-value: map.get($theme-colors, 'primary');
```

**Migration Checklist:**

- [ ] Add `@use 'sass:color';` at top of file
- [ ] Add `@use 'sass:map';` if using map functions
- [ ] Replace `darken()` with `color.adjust($color, $lightness: -X%)`
- [ ] Replace `lighten()` with `color.adjust($color, $lightness: +X%)`
- [ ] Replace `map-get()` with `map.get()`
- [ ] Replace `map-merge()` with `map.merge()`

## Example 4: Module Import/Export Merge

```typescript
// Scenario: Both PWA and custom branch add to shared.module.ts

// === PWA 9.1 added ===
const imports = [
  ...importExportModules,
  ...standaloneComponents, // ← New in PWA 9.1
];

// === Your custom branch added ===
const imports = [
  ...importExportModules,
  InventoryExportsModule, // ← Your custom module
  WarehouseExportsModule, // ← Your custom module
];

// ✅ Correct merge: Combine both
const imports = [
  ...importExportModules,
  ...standaloneComponents, // Keep PWA additions
  InventoryExportsModule, // Keep custom additions
  WarehouseExportsModule,
];
```

## Example 5: Template Component Restoration

```typescript
// Scenario: Template uses observable but component is missing it after migration

// === Template (.html) ===
<a *ngIf="isUserAuthorized$ | async" routerLink="/warehouse">
  Warehouse
</a>

// === Component (BEFORE migration - custom 4.0) ===
export class HeaderNavigationComponent implements OnInit {
  isUserAuthorized$: Observable<boolean>;

  constructor(
    private shoppingFacade: ShoppingFacade,
    private accountFacade: AccountFacade // ← Had this
  ) {}

  ngOnInit() {
    this.categories$ = this.shoppingFacade.navigationCategories$();
    this.isUserAuthorized$ = this.accountFacade.isLoggedIn$; // ← Had this
  }
}

// === Component (AFTER migration - lost implementation) ===
export class HeaderNavigationComponent implements OnInit {
  // ❌ Missing: isUserAuthorized$
  // ❌ Missing: AccountFacade injection

  constructor(
    private shoppingFacade: ShoppingFacade
    // ❌ Missing: AccountFacade
  ) {}

  ngOnInit() {
    this.categories$ = this.shoppingFacade.navigationCategories$();
    // ❌ Missing: isUserAuthorized$ initialization
  }
}

// ✅ Correct restoration: Add back custom implementation
export class HeaderNavigationComponent implements OnInit {
  categories$: Observable<NavigationCategory[]>;
  isUserAuthorized$: Observable<boolean>; // ← Restored

  constructor(
    private shoppingFacade: ShoppingFacade,
    private accountFacade: AccountFacade // ← Restored
  ) {}

  ngOnInit() {
    this.categories$ = this.shoppingFacade.navigationCategories$();
    this.isUserAuthorized$ = this.accountFacade.isLoggedIn$; // ← Restored
  }
}
```

## Example 6: Detecting and Cleaning Removed Extensions

```bash
#!/bin/bash
# Script to detect features removed in new PWA

# Compare extensions directories
echo "=== Checking for removed extensions ==="

# Get extensions from develop (new PWA)
git checkout develop
PWA_EXTENSIONS=$(ls src/app/extensions/ 2>/dev/null | sort)

# Get extensions from custom branch
git checkout custom-4.0
CUSTOM_EXTENSIONS=$(ls src/app/extensions/ 2>/dev/null | sort)

# Find extensions in custom but not in PWA (removed features)
REMOVED=$(comm -23 <(echo "$CUSTOM_EXTENSIONS") <(echo "$PWA_EXTENSIONS"))

if [ -n "$REMOVED" ]; then
  echo "⚠️  WARNING: Following extensions were removed from PWA:"
  echo "$REMOVED"
  echo ""
  echo "For each extension, you need to decide:"
  echo "  A) Keep as custom extension"
  echo "  B) Remove completely"
  echo "  C) Migrate to PWA alternative"
  echo ""
  echo "Run cleanup for removed extensions:"
  for ext in $REMOVED; do
    echo "  ./cleanup-extension.sh $ext"
  done
else
  echo "✓ No removed extensions detected"
fi
```

## Example 7: Interactive Cleanup Script

```javascript
// cleanup-extension.js
const readline = require('readline');
const { execSync } = require('child_process');
const fs = require('fs');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function cleanupExtension(extensionName) {
  console.log(`\n📦 Cleaning up extension: ${extensionName}`);

  const choice = await ask(
    'How should this extension be handled?\n' +
      '  A) Keep as custom extension\n' +
      '  B) Remove completely\n' +
      '  C) Skip for now\n' +
      'Your choice (A/B/C): '
  );

  switch (choice.toUpperCase()) {
    case 'A':
      console.log(`✓ Keeping ${extensionName} as custom extension`);
      console.log('  Remember to:');
      console.log('  - Verify all dependencies');
      console.log('  - Update documentation');
      console.log('  - Add to CUSTOM_FEATURES.md');
      break;

    case 'B':
      console.log(`⚠️  Removing ${extensionName}...`);

      // Remove extension directory
      execSync(`rm -rf src/app/extensions/${extensionName}/`);
      console.log('  ✓ Removed extension directory');

      // Find template references
      try {
        const templateRefs = execSync(`grep -r "ish-lazy-${extensionName}" src/app/ --include="*.html" -l`)
          .toString()
          .trim()
          .split('\n')
          .filter(Boolean);

        if (templateRefs.length > 0) {
          console.log(`  ⚠️  Found ${templateRefs.length} template references:`);
          templateRefs.forEach(file => console.log(`    - ${file}`));
          console.log('  → Manual cleanup required for templates');
        }
      } catch (e) {
        console.log('  ✓ No template references found');
      }

      console.log(`  ✓ ${extensionName} cleanup complete`);
      break;

    case 'C':
      console.log(`⏭️  Skipping ${extensionName}`);
      break;

    default:
      console.log('Invalid choice, skipping...');
  }

  rl.close();
}

// Usage
const extensionName = process.argv[2];
if (!extensionName) {
  console.error('Usage: node cleanup-extension.js <extension-name>');
  process.exit(1);
}

cleanupExtension(extensionName);
```

## Example 8: Verifying Custom Features After Migration

```bash
#!/bin/bash
# verify-custom-features.sh

echo "=== Verifying Custom Features After Migration ==="

# 1. Check custom themes
echo -e "\n1. Custom Themes:"
for theme in src/styles/themes/*/; do
  theme_name=$(basename "$theme")
  if [[ "$theme_name" != "b2b" && "$theme_name" != "b2c" ]]; then
    echo "  - $theme_name"

    # Check for required variables
    missing_vars=$(diff <(grep '^\$' src/styles/themes/b2b/variables.scss | cut -d: -f1 | sort) \
                        <(grep '^\$' "$theme/variables.scss" | cut -d: -f1 | sort) | \
                   grep '<' | wc -l)

    if [ "$missing_vars" -gt 0 ]; then
      echo "    ⚠️  Missing $missing_vars variables compared to b2b"
    else
      echo "    ✓ All variables present"
    fi
  fi
done

# 2. Check custom extensions
echo -e "\n2. Custom Extensions:"
for ext in src/app/extensions/*/; do
  ext_name=$(basename "$ext")
  echo "  - $ext_name"

  # Check if extension is registered in environment
  if grep -q "'$ext_name'" src/environments/environment.model.ts; then
    echo "    ✓ Registered in environment.model.ts"
  else
    echo "    ⚠️  Not registered in environment.model.ts"
  fi
done

# 3. Check custom features in environment
echo -e "\n3. Custom Environment Features:"
grep "features:" src/environments/environment.production.ts -A 20 | \
  grep "'" | grep -v "ENVIRONMENT_DEFAULTS" | \
  while read -r line; do
    feature=$(echo "$line" | sed "s/.*'\(.*\)'.*/\1/")
    echo "  - $feature"

    # Check if feature is in type union
    if grep -q "'$feature'" src/environments/environment.model.ts; then
      echo "    ✓ Defined in type union"
    else
      echo "    ⚠️  NOT defined in type union"
    fi
  done

echo -e "\n=== Verification Complete ==="
```

These examples provide practical, copy-paste ready code for common migration scenarios.
