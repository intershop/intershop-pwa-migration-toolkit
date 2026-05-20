---
applyTo: '**/migration*.{js,sh,ts}'
---

# PWA 11.0 Migration - Specific Guide

This guide covers **PWA 11.0.0-specific** breaking changes and automated migration tools.

## Overview: PWA 11.0 Major Changes

| Change | Impact | Automation | Manual Review |
|--------|--------|------------|---------------|
| Angular 18 Upgrade | **Critical** | ✅ Angular CLI `ng update` | Medium - Deprecated API usages |
| Formly 7 (`templateOptions` → `props`) | **Critical** | ✅ Formly schematic | Low - Generated changes |
| ESLint 9 Flat Config | **High** | ❌ Manual | High - Config rewrite |
| Jest 30 Config Format | **High** | ❌ Manual | Medium - Config rewrite |
| Prettier 3 + Stylelint 17 | Medium | ✅ `npm run format` + lint fix | Low |
| CSpell via ESLint Plugin | Low | ❌ Manual | Low - Add words to intershop.txt |
| CMS resourceSetId | Low | ❌ Manual | Low - Only if non-default |

## 🔄 Migration Workflow for PWA 11.0

### Phase 1: Detection (Before Merge)

```bash
# Step 1: Detect Formly templateOptions usage
echo "=== Formly Detection ==="
grep -r "templateOptions" src/ --include="*.ts" --include="*.html" | wc -l
grep -r "templateOptions" src/ --include="*.ts" --include="*.html" -l

# Step 2: Detect legacy ESLint config
echo "=== ESLint Config Detection ==="
if [ -f ".eslintrc.json" ]; then
  echo "FOUND legacy .eslintrc.json - needs migration to eslint.config.mjs"
else
  echo "Already using flat config (eslint.config.mjs)"
fi
find . -name ".eslintrc.json" -not -path "*/node_modules/*"

# Step 3: Detect legacy Jest config
echo "=== Jest Config Detection ==="
if [ -f "jest.config.js" ]; then
  echo "FOUND jest.config.js - needs migration to jest.config.ts"
fi
grep -r "jest-preset-angular/jest-preset" jest.config.* 2>/dev/null && echo "FOUND old preset string - needs createCjsPreset()"

# Step 4: Detect Angular 18 deprecated APIs
echo "=== Angular Deprecated APIs ==="
grep -r "getCurrencySymbol" src/ --include="*.ts" | wc -l
grep -r "from '@angular/common'" src/ --include="*.ts" | grep "getCurrencySymbol"

# Step 5: Detect old ESLint plugin names
echo "=== ESLint Plugin Names ==="
grep -r "eslint-plugin-rxjs\b" . --include="*.json" --include="*.js" --include="*.mjs" --include="*.cjs" | grep -v node_modules
grep -r "eslint-plugin-rxjs-angular\b" . --include="*.json" --include="*.js" --include="*.mjs" | grep -v node_modules
```

**Output:** Detection reports showing what needs migration after merge.

### Phase 2: Merge PWA 11.0

```bash
# Add upstream remote if not already present
git remote add intershop-pwa https://github.com/intershop/intershop-pwa.git
git fetch intershop-pwa --tags

# Merge target version
git merge 11.0.0

# Resolve conflicts
# ... merge conflict resolution ...

# Install dependencies (includes Angular 18, Formly 7, ESLint 9, Jest 30)
npm install
```

**At this point:** Your codebase has Angular 18 but still uses old Formly/ESLint/Jest syntax.

### Phase 3: Automated Migrations (After Merge)

#### 3A: Angular 18 Update

```bash
# Apply Angular 18 migrations
ng update @angular/core@18 @angular/cli@18 --allow-dirty --force

# Verify no deprecated API usages remain
grep -r "getCurrencySymbol" src/ --include="*.ts"
```

**Key Angular 18 change:** `getCurrencySymbol` from `@angular/common` is deprecated.
Replace with the native `Intl` API:

```typescript
// OLD
import { getCurrencySymbol } from '@angular/common';
const symbol = getCurrencySymbol('USD', 'narrow');

// NEW
const symbol = new Intl.NumberFormat('en', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' })
  .formatToParts(0)
  .find(p => p.type === 'currency')?.value ?? 'USD';
```

For all Angular 18 deprecations, see the [Angular deprecation list](https://github.com/angular/angular/issues/54470).
For the full Angular update guide, see [Angular Update Guide 17→18](https://angular.dev/update-guide?v=17.0-18.0&l=3).

#### 3B: Formly 7 Migration

```bash
# Run the Formly migration schematic
ng generate @ngx-formly/schematics:v7-migration

# Verify - should be 0 remaining
grep -r "templateOptions" src/ --include="*.ts" --include="*.html" | wc -l
```

**What the schematic does:**
- Renames `templateOptions` → `props` in all form field configurations
- Renames `expressionProperties` → `expressions` (if used)
- Updates `FormlyFieldConfig` type usage

**Manual check after schematic:**

```typescript
// BEFORE
{ key: 'email', type: 'input', templateOptions: { label: 'Email', required: true } }

// AFTER (schematic handles this)
{ key: 'email', type: 'input', props: { label: 'Email', required: true } }
```

For full details, see the [Formly 7 migration guide](https://formly.dev/docs/guide/migration).

### Phase 4: Manual Migrations

#### 4A: ESLint 9 Flat Config

ESLint 9 dropped support for `.eslintrc.json`. The new format is `eslint.config.mjs`.

**Check what you have:**

```bash
ls -la .eslintrc.json eslint.config.mjs 2>/dev/null
find e2e/ schematics/ -name ".eslintrc.json" 2>/dev/null
```

**Migration steps:**

1. Replace root `.eslintrc.json` with `eslint.config.mjs` (flat config)
2. Merge `e2e/.eslintrc.json` and `schematics/.eslintrc.json` into the root config as file-specific overrides
3. Update plugin package names:

| Old package | New package |
|-------------|-------------|
| `eslint-plugin-rxjs` | `@smarttools/eslint-plugin-rxjs` |
| `eslint-plugin-rxjs-angular` | `eslint-plugin-rxjs-angular-x` |

4. Update renamed rules:

| Old rule | New rule |
|----------|----------|
| `@typescript-eslint/ban-types` | `@typescript-eslint/no-restricted-types` |
| `@typescript-eslint/no-var-requires` | `@typescript-eslint/no-require-imports` |
| `@typescript-eslint/no-throw-literal` | `no-throw-literal` |
| `etc/no-deprecated` | `@typescript-eslint/no-deprecated` |

5. New rules that may require code changes:

| Rule | Severity | Note |
|------|----------|------|
| `@typescript-eslint/no-shadow` | warn | Variables shadowing outer scope |
| `guard-for-in` | error | Use `hasOwnProperty` in `for...in` |
| `max-classes-per-file` | error | Split files with multiple classes |
| `max-lines` (500) | warn | Split large files |
| `no-eval` / `no-implied-eval` | error | Remove `eval()` usage |
| `@angular-eslint/template/eqeqeq` | error | Replace `==` with `===` in templates |

6. Run to apply automatic fixes:

```bash
npm install
ng lint --fix
```

**CSpell integration:** Spell checking is now via `@cspell/eslint-plugin` during linting.
Add any custom words to `intershop.txt`:

```bash
# Check spelling errors after linting
npm run lint 2>&1 | grep "cspell"

# Add custom words to intershop.txt
echo "yourCustomWord" >> intershop.txt
```

#### 4B: Jest 30 Config Migration

**Detection:**

```bash
ls jest.config.js jest.config.ts 2>/dev/null
```

**Migration:**

```typescript
// OLD: jest.config.js
module.exports = {
  preset: 'jest-preset-angular',
  // ...
};

// NEW: jest.config.ts
import { createCjsPreset } from 'jest-preset-angular';

export default {
  ...createCjsPreset(),
  testRunner: 'jest-jasmine2',   // maintains backward compat (Jest 30 defaults to jest-circus)
  // ...
};
```

**Key breaking changes:**
- Config file must be `.ts` (TypeScript) — `.js` format no longer supported without additional config
- Replace `preset: 'jest-preset-angular'` with spread of `createCjsPreset()` result
- Explicitly set `testRunner: 'jest-jasmine2'` to preserve jasmine-style test behavior
- **JSDOM v26**: `window.location` mocking is no longer possible. Affected tests must be refactored:

```typescript
// OLD (no longer works in JSDOM v26)
delete (window as any).location;
window.location = { href: 'https://example.com' } as any;

// NEW: Use Angular Router or spy on navigation
// Or use the `jsdom` option to configure a custom URL
```

For full details, see the [Jest 30 upgrade guide](https://jestjs.io/docs/upgrading-to-jest30).

#### 4C: Prettier 3 + Stylelint 17

After dependency update, apply formatting:

```bash
# Format all files with Prettier 3
npm run format

# Apply Stylelint 17 auto-fixes
ng lint --fix
```

**What changes:**
- Prettier 3 has new default formatting rules (quote handling, trailing commas)
- Stylelint 17 enforces modern CSS color function notation: `rgba(0, 0, 0, 0.5)` → `rgb(0 0 0 / 0.5)`
- Run `npm run format` on the entire codebase before committing

#### 4D: PayPal Component Rename

The `ish-payment-paypal-messages` component was renamed to `ish-payment-paypal` in PWA 11.0.0.
The server setting key path also changed.

**Detection:**

```bash
grep -r "ish-payment-paypal-messages" src/ --include="*.html" -l
```

**Migration:**

```html
<!-- BEFORE -->
@if ('preferences.PayPalCheckoutPreferences.PayLaterMessagingProductDetailsEnabled' | ishServerSetting) {
  <ish-payment-paypal-messages [pageType]="'product-details'" />
}

<!-- AFTER -->
@if ('payment.paypal.payLaterPreferences.PayLaterMessagingProductDetailsEnabled' | ishServerSetting) {
  <ish-payment-paypal pageType="product-details" />
}
```

**Note:** The `pageType` input changed from property binding `[pageType]="'...'"` to attribute binding `pageType="..."` (static string).

#### 4E: CMS View Context Resource Set ID (if applicable)

The CMS View Context REST requests now append a `resourceSetId` for performance.
The default value `app_sf_base_cm` is defined in `CMSService`.

**Action required only if:**
- Your custom view contexts use a different cartridge name than `app_sf_base_cm`
- You need per-component override of the resource set ID

```html
<!-- Add resourceSetId only if the default is not correct for this view context -->
<ish-content-viewcontext
  resourceSetId="custom_cartridge_name"
  viewContextId="viewcontext.include.product.base.top"
  [callParameters]="{ Product: product.sku }"
/>
```

**Global override:** Change `defaultResourceSetId` in `CMSService` to avoid per-component updates.

**Note:** Requires ICM 12.1.0 or later.

### Phase 5: Validation

```bash
# 1. Build check (browser + SSR)
npm run build

# 2. Lint check
npm run lint

# 3. Test check
npm test

# 4. Verify Formly migration complete
grep -r "templateOptions" src/ --include="*.ts" --include="*.html" | wc -l
# Should be 0

# 5. Verify ESLint config migrated
ls .eslintrc.json 2>/dev/null && echo "WARNING: legacy .eslintrc.json still exists"
ls eslint.config.mjs && echo "OK: flat config present"

# 6. Verify Jest config migrated
ls jest.config.ts && echo "OK: jest.config.ts present"

# 7. Runtime check
npm start
# Manually test: forms (Formly fields), CMS components, checkout
```

## 🎯 Detection vs. Migration Matrix

| Pattern | Detection | Migration Tool | Automation Level |
|---------|-----------|----------------|------------------|
| `templateOptions` → `props` | `grep templateOptions` | Formly schematic | **~100% automated** |
| `.eslintrc.json` → flat config | `ls .eslintrc.json` | *(manual)* | **Manual only** |
| `jest.config.js` → `.ts` | `ls jest.config.js` | *(manual)* | **Manual only** |
| Angular deprecated APIs | `grep getCurrencySymbol` | `ng update` schematic | **Partial** |
| Prettier 3 formatting | *(build/lint warnings)* | `npm run format` | **Fully automated** |
| Stylelint 17 | *(lint warnings)* | `ng lint --fix` | **Fully automated** |
| ESLint rule violations | *(lint output)* | `ng lint --fix` | **Partial** |

## 🔗 Reference Links

- [PWA 11.0.0 Migrations Guide](../../docs/guides/migrations.md#from-1010-to-1100)
- [Angular Update Guide 17→18](https://angular.dev/update-guide?v=17.0-18.0&l=3)
- [Angular 18 Deprecation List](https://github.com/angular/angular/issues/54470)
- [Formly 7 Migration Guide](https://formly.dev/docs/guide/migration)
- [ESLint 9 Migration Guide](https://eslint.org/docs/latest/use/migrate-to-9.0.0)
- [Jest 30 Upgrade Guide](https://jestjs.io/docs/upgrading-to-jest30)
- [Bootstrap Icons](https://icons.getbootstrap.com/) (introduced in PWA 10.0)
