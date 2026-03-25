# PWA Customization Best Practices

**Source:** [Official Intershop PWA Customization Guide](https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/customizations.md)

This guide provides best practices for customizing the Intershop PWA in a way that minimizes merge conflicts during future migrations.

---

## 🎯 Core Principle

> **Keep modifications on existing files as minimal as possible!**

The easier it is to merge incoming changes, the faster and safer your migrations will be.

---

## 📋 Decision Matrix: When to Copy vs. Override

### Use Theme Override (Preferred)

**When:**
- Modifying templates (<20% changes)
- Changing component styling
- Small tweaks to behavior

**How:**
```
Original:     product-detail.component.html
Override:     product-detail.component.mytheme.html
```

**Benefits:**
- ✅ Original file remains untouched
- ✅ Incoming changes automatically apply
- ✅ Zero merge conflicts on standard files

**Example:**
```bash
# Use the override schematic
ng g override --theme=mytheme src/app/product/product-detail/product-detail.component.html
```

### Copy Component (When Heavily Customizing)

**When:**
- >20% of component needs changes
- Completely different UX flow
- Adding significant new functionality
- Replacing header/product detail page

**Steps:**
1. Copy component to new location
2. Rename with custom prefix
3. Update all references
4. Add to custom module

**Example:**
```bash
# 1. Copy component
cp -r src/app/shared/components/product/product-tile/ \
      src/app/custom/components/product/custom-product-tile/

# 2. Rename files and classes
# Change: ProductTileComponent -> CustomProductTileComponent

# 3. Update selectors
# From: <ish-product-tile>
# To:   <custom-product-tile>

# 4. Update imports everywhere this component is used
```

**Track the copy:**
```typescript
// custom-product-tile.component.ts

/**
 * CUSTOMIZATION: Complete product tile redesign for client XYZ
 * 
 * Original: src/app/shared/components/product/product-tile/
 * Copied: 2026-03-25
 * Last PWA sync: 9.1.0
 * 
 * Changes:
 * - Custom layout for brand showcase
 * - Additional product metadata display
 * - Custom hover animations
 * 
 * Migration note: Review original component for bug fixes and security patches
 */
export class CustomProductTileComponent { ... }
```

---

## 🏷️ Marking Customizations

### Always Use CUSTOMIZATION Markers

When modifying standard Intershop files inline:

#### Single Line Changes

```typescript
// CUSTOMIZATION: Added custom validation for user registration
if (user.email && this.isValidCorporateEmail(user.email)) {
  // ...
}
```

```html
<!-- CUSTOMIZATION: Added custom branding logo -->
<img src="assets/custom/brand-logo.svg" alt="Brand" />
```

```scss
// CUSTOMIZATION: Override button color for brand compliance
$button-primary-bg: #FF6B35;
```

#### Block Changes

```typescript
// CUSTOMIZATION START: Custom analytics tracking
trackCustomEvent(event: CustomEvent) {
  this.analytics.track(event.type, {
    userId: this.user.id,
    timestamp: Date.now(),
    customData: event.payload
  });
}

sendToDataLayer(data: any) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(data);
}
// CUSTOMIZATION END
```

**Benefits:**
- ✅ Easy to find during migrations
- ✅ Clear ownership
- ✅ Facilitates code reviews
- ✅ Helps future developers understand intent

---

## 📁 Project Structure Best Practices

### Use Custom Folder

Create a dedicated custom folder for your customizations:

```
src/
  app/
    custom/                    # Your custom code
      components/
        brand-showcase/
        custom-checkout/
      services/
        analytics.service.ts
        custom-auth.service.ts
      models/
        custom-user.model.ts
    extensions/                # PWA extensions (keep separate)
      custom-feature/
    
  styles/
    themes/
      mytheme/                 # Your theme
        variables.scss
        custom-components.scss
        
  assets/
    custom/                    # Your custom assets
      images/
      fonts/
```

### Name Your Components with Custom Prefix

```typescript
// ✅ GOOD: Clear custom component
@Component({
  selector: 'custom-product-filter',
  ...
})
export class CustomProductFilterComponent { }

// ❌ BAD: Could conflict with future PWA components
@Component({
  selector: 'ish-product-filter-advanced',
  ...
})
export class IshProductFilterAdvancedComponent { }
```

---

## 🎨 Styling Best Practices

### Theme-Specific Folder Structure

**Option A: Minimal Overrides (Recommended)**

```
src/styles/themes/mytheme/
  variables.scss              # Only your variable overrides
  custom-components.scss      # Only your custom styling
  
# Other files inherited from b2b/b2c theme
```

**Benefits:**
- ✅ Automatic updates from standard themes
- ✅ Minimal merge conflicts
- ✅ Easy to see what you've changed

**Option B: Full Copy**

```
src/styles/themes/mytheme/
  # Copy entire b2b or b2c theme
  variables.scss
  global-styles.scss
  components/
    ...all SCSS files...
```

**Drawbacks:**
- ⚠️ Must manually merge all SCSS updates
- ⚠️ More merge conflicts
- ⚠️ Bug fixes don't auto-apply

**When to use:** Only if you need complete style control

### Don't Modify Global Styles

```scss
// ❌ BAD: Modifying src/styles/global-styles.scss
.container {
  max-width: 1400px; // CUSTOMIZATION
}

// ✅ GOOD: Override in your theme
// src/styles/themes/mytheme/custom-overrides.scss
.container {
  max-width: 1400px;
}
```

---

## 🧪 Testing Best Practices

### Update Snapshots, Don't Rewrite Tests

When tests fail after modifications:

```bash
# ✅ GOOD: Update snapshots
npm run test -- -u

# ❌ BAD: Delete and rewrite tests
```

**Why:** During migrations, snapshot conflicts are easy to resolve (just re-update). Rewritten tests are hard to merge.

### Keep Original Test Files

If you copy a component:

```typescript
// custom-product-tile.component.spec.ts

// CUSTOMIZATION: Based on original product-tile.component.spec.ts
// Keep test structure similar for easier comparison during merges

describe('CustomProductTileComponent', () => {
  // ... test structure similar to original ...
});
```

---

## 📦 Dependencies Best Practices

### Always Accept Intershop's package-lock.json

During migrations:

```bash
# ✅ GOOD: Accept Intershop changes, then reinstall
git checkout intershop-pwa/10.0.0 -- package-lock.json
npm install

# ❌ BAD: Try to manually merge package-lock.json
# (Nearly impossible to do correctly)
```

### Document Custom Dependencies

```json
// package.json
{
  "dependencies": {
    // CUSTOMIZATION START: Analytics integration
    "@analytics/google-analytics": "^1.0.0",
    "segment-analytics": "^2.0.0"
    // CUSTOMIZATION END
  }
}
```

**Create README:**

```markdown
# Custom Dependencies

## Analytics Integration
- `@analytics/google-analytics`: Google Analytics 4 integration
- Required by: CustomAnalyticsService
- Can be removed if analytics not needed
```

---

## 🔧 Configuration Best Practices

### Use Theme-Specific Environment Files

```typescript
// environment.mytheme.ts
export const environment = {
  ...baseEnvironment,
  
  // CUSTOMIZATION: Custom API endpoints
  customApiUrl: 'https://api.custom.com',
  analyticsKey: 'UA-XXXXX-Y',
  
  features: [
    'customAnalytics',
    'customCheckout',
    // ... standard features ...
  ]
};
```

### Feature Toggles for Custom Features

```typescript
// environment.model.ts
export interface Environment {
  // ... standard properties ...
  
  features?: (
    | 'compare'
    | 'recently'
    | 'customAnalytics'     // CUSTOMIZATION
    | 'customCheckout'      // CUSTOMIZATION
  )[];
}
```

---

## 🚫 Anti-Patterns to Avoid

### ❌ Don't Delete Standard Code

```typescript
// ❌ BAD: Deleting code
export class ProductService {
  // Commented out because we don't need it
  // getProductRecommendations() { ... }
}

// ✅ GOOD: Comment it out with marker
export class ProductService {
  // CUSTOMIZATION: Disabled recommendations (not needed for B2B)
  // getProductRecommendations() { ... }
}
```

**Why:** Git can still merge changes to commented code. Deleted code creates conflicts.

### ❌ Don't Rename Standard Files Without Copying

```bash
# ❌ BAD
mv product-tile.component.ts custom-product-tile.component.ts

# ✅ GOOD
cp product-tile.component.ts custom-product-tile.component.ts
# (Keep original, use custom version)
```

### ❌ Don't Mix Custom and Standard Selectors

```html
<!-- ❌ BAD: Custom component with ish- prefix -->
<ish-custom-feature></ish-custom-feature>

<!-- ✅ GOOD: Clear custom prefix -->
<custom-feature></custom-feature>
```

---

## 📝 Migration Workflow Integration

### Before Migration

```bash
# 1. Document what you've customized
./scripts/analyze-migration-complexity.sh

# 2. Create branch from current state
git checkout -b pre-migration-snapshot

# 3. List all CUSTOMIZATION markers
git grep -n "CUSTOMIZATION" src/
```

### During Migration

```bash
# 1. Use recommended approach (cherry-pick/rebase/merge)
# See: .github/instructions/migration-approaches.instructions.md

# 2. When conflicts occur on custom code:
#    - Accept your changes for truly custom code
#    - Accept Intershop changes for standard code with markers
#    - Manually merge when both modified same section

# 3. Search for broken CUSTOMIZATION markers
git grep "<<<<<<< HEAD" src/ # Unresolved conflicts
```

### After Migration

```bash
# 1. Verify all customizations still work
npm run build
npm run test

# 2. Update CUSTOMIZATION comments with new PWA version
# Example: "Last synced with PWA 10.0.0"

# 3. Review copied components for security patches
# Check original component history for critical fixes
```

---

## 📊 Customization Health Checklist

Use this checklist to assess your customization quality:

### File Organization
- [ ] Custom components in dedicated `custom/` folder
- [ ] Custom prefix used (not `ish-`)
- [ ] Theme overrides in theme folder (not inline)

### Documentation
- [ ] CUSTOMIZATION markers on all inline changes
- [ ] Copied components documented with intent
- [ ] Custom dependencies explained in README
- [ ] Migration notes in copied components

### Maintenance
- [ ] Less than 20% of standard files modified inline
- [ ] No standard files deleted (only commented if needed)
- [ ] No modifications to global styling
- [ ] Custom test suites maintain similar structure

### Migration Readiness
- [ ] Can identify all customizations quickly
- [ ] Know which components are safe to update
- [ ] Documented last PWA version synced
- [ ] Have rollback plan for custom features

**Score:**
- ✅ 12-14: Excellent (migrations will be smooth)
- ⚠️ 8-11: Good (some cleanup recommended)
- ❌ 0-7: Needs improvement (difficult migrations ahead)

---

## 🎓 Examples

### Example 1: Adding Custom Product Badge

**❌ Bad Approach:**
```typescript
// Modified: product-tile.component.ts (Intershop file)
export class ProductTileComponent {
  // Added custom badge logic
  showCustomBadge() { return this.product.custom.isFeatured; }
}
```

**✅ Good Approach:**
```typescript
// New file: custom/components/product-badge/custom-badge.component.ts
@Component({
  selector: 'custom-product-badge',
  template: '<span *ngIf="show" class="badge">Featured</span>'
})
export class CustomProductBadgeComponent {
  @Input() product: Product;
  get show() { return this.product.custom?.isFeatured; }
}

// Use in template override: product-tile.component.mytheme.html
<div class="product-tile">
  <ish-product-image [product]="product"></ish-product-image>
  <custom-product-badge [product]="product"></custom-product-badge>  <!-- CUSTOMIZATION -->
  <ish-product-name [product]="product"></ish-product-name>
</div>
```

### Example 2: Custom Checkout Flow

**❌ Bad Approach:**
```typescript
// Modified 10 checkout components inline with custom logic
```

**✅ Good Approach:**
```
src/app/custom/checkout/
  custom-checkout-page.component.ts      # New complete flow
  custom-payment-selection.component.ts  # New component
  custom-order-review.component.ts       # New component
  
# Route to custom checkout
# app-routing.module.ts
{
  path: 'checkout',
  loadChildren: () => import('./custom/checkout/custom-checkout.module')  // CUSTOMIZATION
}
```

---

## 🔗 Related Resources

- [Official Customization Guide](https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/customizations.md)
- [Migration Approaches](./.github/instructions/migration-approaches.instructions.md)
- [Theme Override System](https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/themes.md)
- [Intershop PWA Migrations Guide](https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/migrations.md)

---

## 💡 Key Takeaways

1. **Minimize inline modifications** - Use overrides and new components instead
2. **Mark everything** - CUSTOMIZATION comments are your migration lifeline
3. **Structure matters** - Dedicated custom folders make everything clearer
4. **Test similarity** - Keep test structure similar to originals
5. **Document intent** - Future you (and others) will thank you
6. **Plan for migrations** - Every customization should consider upgrade path

**Remember:** The goal is not to avoid customizations—it's to make them **migration-friendly**.
