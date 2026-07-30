---
applyTo: '**/migration*.{js,ts}'
---

# PWA 12.0 Migration - Specific Guide

This guide covers **PWA 12.0.0-specific** breaking changes and automated migration tools.

## Overview: PWA 12.0 Major Changes

| Change | Impact | Automation | Manual Review |
|--------|--------|------------|---------------|
| Angular 19 (standalone default) | **Critical** | ✅ `ng update` schematic | Low - Custom components |
| ngx-translate 17+18 | **Critical** | ✅ `migrate-ngx-translate.js` | Medium - Custom usage |
| Swiper 8 → 12 | **High** | ❌ Manual | High - Custom carousel code |
| ALLOWED_HOSTS for SSR | **Critical** | ❌ Manual (config) | Low - One env var |
| ESLint Perfectionist | Medium | ✅ `ng lint --fix` | Low |
| ProductRatingStarComponent removed | Medium | ❌ Manual | Low - Skip or migrate |
| FilterNavigationBadges renamed | Medium | ✅ Search/replace | Low |
| Design View rework | Medium | ❌ Manual | Low - If customized |

## 🔄 Migration Workflow for PWA 12.0

### Phase 1: Detection (Before Merge)

```bash
# Step 1: Detect ngx-translate usage patterns
echo "=== ngx-translate Detection ==="
grep -r "TranslateModule" src/ --include="*.ts" -l
grep -r "\.currentLang" src/ --include="*.ts" -l
grep -rP '<[a-z]+[^>]*\stranslate\s*>' src/ --include="*.html" -l

# Step 2: Detect Swiper Angular components
echo "=== Swiper Detection ==="
grep -r "SwiperModule\|SwiperComponent\|swiper/angular" src/ --include="*.ts" -l
grep -r "<swiper" src/ --include="*.html" -l

# Step 3: Detect removed/renamed components
echo "=== Removed Components ==="
grep -r "ProductRatingStarComponent\|ish-product-rating-star" src/ --include="*.ts" --include="*.html" -l
grep -r "ish-filter-navigation-badges\|FilterNavigationBadgesComponent" src/ --include="*.ts" --include="*.html" -l

# Step 4: Detect Design View customizations
echo "=== Design View ==="
grep -r "DESIGNVIEW\|PreviewContextID" src/ --include="*.ts" -l

# Step 5: Detect custom modal SCSS
echo "=== Modal SCSS ==="
grep -r "\.modal-fullscreen\|\.modal-dialog-scrollable" src/ --include="*.scss" -l

# Step 6: Check SSR configuration
echo "=== SSR ALLOWED_HOSTS ==="
grep -r "ALLOWED_HOSTS" . --include="*.yml" --include="*.yaml" --include="*.ts" --include="Dockerfile" | grep -v node_modules
```

### Phase 2: Merge PWA 12.0

```bash
# Add upstream remote if not already present
git remote add intershop-pwa https://github.com/intershop/intershop-pwa.git
git fetch intershop-pwa --tags

# Create migration branch
git checkout -b migration/to-12.0.0

# Merge target version
git merge 12.0.0

# Resolve conflicts, then install
npm install
```

### Phase 3: Automated Migrations (After Merge)

#### 3A: Angular 19 Update (standalone: false)

```bash
# The ng update schematic adds standalone: false to all non-standalone declarations
ng update @angular/core@19 @angular/cli@19 --allow-dirty --force
```

Angular 19 makes `standalone: true` the default. The PWA still uses NgModule-based declarations,
so `standalone: false` must be added to all components, directives, and pipes that are not standalone.

**For custom components:** Verify all your custom `@Component`, `@Directive`, and `@Pipe` declarations
have `standalone: false` if they are declared in an NgModule:

```bash
# Find components missing standalone: false (after ng update)
grep -rn "@Component(" src/ --include="*.ts" | grep -v "standalone"
```

#### 3B: ngx-translate Migration

```bash
# Run the automated migration script
node path/to/migration-toolkit/scripts/migrate-ngx-translate.js --project-dir .

# Or with specific phases:
node path/to/migration-toolkit/scripts/migrate-ngx-translate.js --project-dir . --phase detect
node path/to/migration-toolkit/scripts/migrate-ngx-translate.js --project-dir . --phase fix
```

**What the script handles:**
1. `TranslateService.currentLang` → `getCurrentLang()` (ngx-translate 17)
2. `TranslateModule.forRoot()` → `provideTranslateService()` (ngx-translate 18)
3. `TranslateModule.forChild()` / `TranslateModule` → remove, add `TranslatePipe` to imports
4. Element-text-as-key `<span translate>key</span>` → `{{ 'key' | translate }}`

**Manual check after script:**
- `getCurrentLang()` can return `undefined` in v18 — add null-coalescing where needed
- Ensure `TranslatePipe` is imported in every module/component that uses `| translate`

#### 3C: ESLint Perfectionist

```bash
# Install plugin (should be in package.json after merge)
npm install

# Auto-fix sorting
ng lint --fix
```

### Phase 4: Manual Migrations

#### 4A: Swiper 8 → 12

This is the most labor-intensive change if you use Swiper. The Angular-specific
components were removed; use the JavaScript API directly.

**Detection:**
```bash
grep -r "SwiperModule\|SwiperComponent" src/ --include="*.ts" -l
grep -r "<swiper" src/ --include="*.html" -l
```

**Migration steps:**
1. Remove `SwiperModule` from NgModule imports
2. Replace `<swiper>` elements with container `<div>` + JS initialization
3. Use the new `DeferredItemComponent` with `ishLazyLoadingContent` for lazy slides
4. See official guides: [v9](https://swiperjs.com/migration-guide-v9), [v10](https://swiperjs.com/migration-guide-v10), [v11](https://swiperjs.com/migration-guide-v11)

#### 4B: ALLOWED_HOSTS Configuration

**Required for SSR production deployments.**

```yaml
# docker-compose.yml or Helm values
environment:
  ALLOWED_HOSTS: "shop.example.com,*.example.com"
```

Without this, Angular 19 SSR rejects all requests except `localhost`:
`URL with hostname "abc.xyz.com" is not allowed.`

#### 4C: FilterNavigationBadges → FilterNavigationActions

```bash
# Simple rename
find src -name "*.html" -exec sed -i 's/ish-filter-navigation-badges/ish-filter-navigation-actions/g' {} +
find src -name "*.ts" -exec sed -i 's/FilterNavigationBadgesComponent/FilterNavigationActionsComponent/g' {} +
```

#### 4D: ProductRatingStarComponent → NgbRating

If you customized `ProductRatingStarComponent`, choose one of:
1. **Skip the removal commit** during merge and keep your custom implementation
2. **Migrate to NgbRating:**

```html
<!-- Before -->
<ish-product-rating-star [rating]="product.roundedAverageRating" />

<!-- After -->
<ngb-rating [rate]="product.roundedAverageRating" [readonly]="true" />
```

#### 4E: Design View Changes

Only relevant if you customized Design View integration:
- Old: `PreviewContextID=DESIGNVIEW` activated the Design View
- New: `?DesignView` query parameter activates Design View
- `PreviewContextID` is now exclusively for preview context data

### Phase 5: Verification

```bash
# Build
npm run build

# Lint
ng lint

# Test
npm test

# Format check
npm run format -- --check
```

## Version Path: 11.0 → 12.0

If migrating from 11.0.0 (not 11.2.0), you also need:

### 11.0 → 11.1 Changes
- `StoreLocatorFooterComponent` removed from PWA footer (now CMS-managed)
- Withdrawal feature added (requires ICM 14.3.0, no action if you didn't customize footer)

### 11.1 → 11.2 Changes
- Withdrawal display on Order Detail Page (requires ICM 14.4.0)
- No breaking changes for custom code

Then apply all 11.2 → 12.0 changes above.
