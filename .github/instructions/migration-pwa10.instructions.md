---
applyTo: '**/migration*.{js,sh,ts}'
---

# PWA 10.0 Migration - Specific Guide

This guide covers **PWA 10.0.0-specific** breaking changes and automated migration tools.

## Overview: PWA 10.0 Major Changes

| Change | Impact | Automation | Manual Review |
|--------|--------|------------|---------------|
| Angular 17 Control Flow | **Critical** | ✅ Angular CLI schematic | Medium - Complex cases |
| Font Awesome → Bootstrap Icons | **High** | ⚠️ Partial (common icons) | High - Custom icons |
| New SSR Architecture | High | ❌ Manual | High - Custom SSR code |
| Node.js 22 | Medium | ❌ Manual | Low - Config updates |
| Logging Format (ECS) | Medium | ❌ Manual | Medium - Custom loggers |
| Inventory REST API | Low | ❌ Manual | Low - If customized |

## 🔄 Migration Workflow for PWA 10.0

### Phase 1: Detection (Before Merge)

```bash
# Step 1: Detect old Angular control flow
echo "=== Control Flow Detection ==="
grep -r "\*ngIf=" src/ --include="*.html" | wc -l
grep -r "\*ngFor=" src/ --include="*.html" | wc -l
grep -r "\*ngSwitch" src/ --include="*.html" | wc -l

# Step 2: Detect Font Awesome icons
echo "=== Font Awesome Detection ==="
node scripts/migrate-bootstrap-icons.js --report fa-icons-before.md

# Step 3: Detect SSR architecture
echo "=== SSR Architecture Check ==="
grep -r "@nguniversal\|express-engine" src/ || echo "Using standard SSR"

# Step 4: Check Node.js version
echo "=== Node.js Version ==="
cat .nvmrc || grep "engines" package.json
```

**Output:** Detection reports showing what needs migration after merge.

### Phase 2: Merge PWA 10.0

```bash
# Standard migration merge
git merge intershop-pwa/10.0.0

# Resolve conflicts
# ... merge conflict resolution ...

# Install dependencies (includes Angular 17)
npm install
```

**At this point:** Your codebase has Angular 17 but still uses old syntax.

### Phase 3: Automated Migrations (After Merge)

#### 3A: Angular Control Flow Migration

```bash
# Run Angular CLI migration schematic
./scripts/migrate-control-flow.sh
```

**What it does:**
1. ✅ Detects all `*ngIf`, `*ngFor`, `*ngSwitch` usage in src/ and projects/
2. ✅ Creates backup branch automatically
3. ✅ Runs `ng generate @angular/core:control-flow`
4. ✅ Transforms registered Angular components to `@if`, `@for`, `@switch` syntax
5. ✅ Lists unmigrated files requiring manual review (custom themes, extensions)
6. ✅ Reports reasons why some files weren't migrated

**Coverage:** 70-95% automated (varies based on custom template locations)

**Example transformation:**

```html
<!-- BEFORE -->
<div *ngIf="product$ | async as product">
  <h1>{{ product.name }}</h1>
  <div *ngFor="let variant of product.variants">
    {{ variant.sku }}
  </div>
</div>

<!-- AFTER (automated) -->
@if (product$ | async; as product) {
  <div>
    <h1>{{ product.name }}</h1>
    @for (variant of product.variants; track variant.sku) {
      <div>{{ variant.sku }}</div>
    }
  </div>
}
```

**Complex cases requiring manual review:**
- Nested directives with multiple pipes
- Dynamic template references
- Structural directives with multiple inputs

#### 3B: Bootstrap Icons Migration

```bash
# Step 1: Detect and analyze
node scripts/migrate-bootstrap-icons.js --report icons-migration.md

# Step 2: Review the report
cat icons-migration.md

# Step 3: Auto-replace common icons
node scripts/migrate-bootstrap-icons.js --auto-replace

# Step 4: Manually review unmapped icons
# Open icons-migration.md → "Unmapped Icons" section
```

**What it does:**

1. **Detection:**
   - Scans all `.html`, `.ts`, `.scss` files
   - Finds `fa-*`, `fas`, `far`, `fab` classes
   - Reports occurrences by file and line

2. **Automatic Replacement:**
   - Replaces ~60 common Font Awesome icons with Bootstrap Icons equivalents
   - Example: `fa-search` → `bi-search`, `fa-times` → `bi-x`
   - Updates style classes: `fas` → `bi`

3. **Manual Review Report:**
   - Lists unmapped icons with file locations
   - Provides link to Bootstrap Icons search
   - Groups by icon for easy review

**Icon mapping examples:**

| Font Awesome | Bootstrap Icons | Auto-Replace |
|--------------|-----------------|--------------|
| `fa-search` | `bi-search` | ✅ Yes |
| `fa-shopping-cart` | `bi-cart` | ✅ Yes |
| `fa-times` / `fa-close` | `bi-x` | ✅ Yes |
| `fa-cog` / `fa-settings` | `bi-gear` | ✅ Yes |
| `fa-user` | `bi-person` | ✅ Yes |
| `fa-home` | `bi-house` | ✅ Yes |
| `fa-custom-icon` | *(search needed)* | ❌ Manual |

**After auto-replace, install Bootstrap Icons:**

```bash
# Install package
npm install bootstrap-icons

# Import in styles (add to src/styles.scss or theme file)
echo '@import "bootstrap-icons/font/bootstrap-icons.css";' >> src/styles.scss

# Remove Font Awesome (if no longer needed)
npm uninstall @fortawesome/fontawesome-free
```

### Phase 4: Manual Migrations

#### 4A: SSR Architecture (if customized)

**Check for @nguniversal usage:**

```bash
grep -r "@nguniversal" src/
```

**Angular 17 SSR changes:**

```typescript
// OLD (Angular Universal)
import { ngExpressEngine } from '@nguniversal/express-engine';

app.engine('html', ngExpressEngine({
  bootstrap: AppServerModule,
}));

// NEW (Angular 17 SSR)
import { AngularNodeAppEngine } from '@angular/ssr';

const angularAppEngine = new AngularNodeAppEngine();
app.use('*', (req, res, next) => {
  angularAppEngine
    .render(req, res, next)
    .catch(next);
});
```

**If you have custom SSR:** Review [Angular 17 SSR migration guide](https://angular.io/guide/ssr).

#### 4B: Node.js 22 Upgrade

```bash
# Update .nvmrc
echo "22" > .nvmrc

# Update Dockerfiles
find . -name "Dockerfile*" -exec sed -i 's/FROM node:[0-9]\+/FROM node:22/' {} \;

# Update CI/CD configs
# GitLab CI (.gitlab-ci.yml):
sed -i 's/image: node:[0-9]\+/image: node:22/' .gitlab-ci.yml

# GitHub Actions (.github/workflows/*.yml):
find .github/workflows -name "*.yml" -exec sed -i 's/node-version: [0-9]\+/node-version: 22/' {} \;

# Switch locally
nvm install 22
nvm use 22

# Verify
node --version  # Should show v22.x.x
npm --version   # Should show v10.x.x
```

#### 4C: Logging Format (ECS-compatible)

**If you have custom loggers:**

```bash
# Find custom logging code
grep -r "console.log\|logger\|winston\|pino" src/ssr/
```

PWA 10.0 uses **ECS (Elastic Common Schema)** JSON logging format:

```typescript
// OLD
console.log('User action', { userId: 123, action: 'purchase' });

// NEW (ECS format)
logger.info({
  '@timestamp': new Date().toISOString(),
  message: 'User action',
  user: { id: 123 },
  event: { action: 'purchase' },
  service: { name: 'pwa', version: '10.0.0' }
});
```

**Review:** PWA 10.0 NGINX and SSR logging configs in `nginx/` and `src/ssr/server-scripts/`.

### Phase 5: Validation

```bash
# 1. Build check
npm run build

# 2. Lint check
npm run lint

# 3. Test check
npm test

# 4. Verify control flow migration
grep -r "\*ngIf=\|\*ngFor=\|\*ngSwitch" src/ --include="*.html" | wc -l
# Should be 0 or close to 0 (only complex cases remaining)

# 5. Verify icon migration
grep -r "fa-\|fas \|far \|fab " src/ | wc -l
# Should be 0 or only remaining custom icons

# 6. Runtime check
npm start
# Manually test critical features
```

## 🎯 Detection vs. Migration Matrix

### How Pattern Detection Works

**`detect-pattern-changes.js` (Tier 2/3):**

```bash
# Detects patterns based on version parameters
./scripts/detect-pattern-changes.js 9.1.0 10.0.0
```

**What it does:**
1. Fetches CHANGELOG.md for version 10.0.0
2. Parses breaking changes
3. Applies pattern database rules for 9.1 → 10.0
4. Scans codebase with grep for each pattern's regex
5. Generates JSON report: `pattern-detection-report.json`

**Output example:**

```json
{
  "version": "1.0",
  "sourceVersion": "9.1.0",
  "targetVersion": "10.0.0",
  "detectedPatterns": [
    {
      "description": "Angular 17: Control flow - *ngIf to @if migration",
      "type": "html",
      "severity": "critical",
      "matchCount": 243,
      "files": ["src/app/shell/header/header.component.html", "..."],
      "autoFixable": false,
      "manual": true
    },
    {
      "description": "Icons: Font Awesome replaced with Bootstrap Icons",
      "type": "scss",
      "severity": "high",
      "matchCount": 87,
      "files": ["src/app/shared/components/product/product-image/..."],
      "autoFixable": "partial",
      "manual": true
    }
  ]
}
```

**This tells you WHAT needs changing, but doesn't change it.**

### Migration Tools Apply the Changes

| Pattern | Detection Tool | Migration Tool | Automation Level |
|---------|---------------|----------------|------------------|
| `*ngIf` → `@if` | `detect-pattern-changes.js` | `migrate-control-flow.sh` | **95% automated** (Angular CLI) |
| `fa-*` → `bi-*` | `migrate-bootstrap-icons.js` | `migrate-bootstrap-icons.js --auto-replace` | **60% automated** (common icons) |
| SSR architecture | `grep @nguniversal` | *(manual)* | **Manual only** |
| Node.js version | `cat .nvmrc` | `echo "22" > .nvmrc` | **Trivial** |
| Logging format | `grep logger` | *(manual)* | **Manual only** |

### Complete Workflow Example

```bash
# === DETECTION PHASE ===
# Run before merge to see what's coming
./scripts/detect-pattern-changes.js 9.1.0 10.0.0
node scripts/migrate-bootstrap-icons.js --report pre-merge-icons.md

# === MERGE PHASE ===
git merge intershop-pwa/10.0.0
# ... resolve conflicts ...
npm install

# === MIGRATION PHASE ===
# Apply automated transformations
./scripts/migrate-control-flow.sh
node scripts/migrate-bootstrap-icons.js --auto-replace

# === VALIDATION PHASE ===
npm run build
npm test
git diff  # Review all changes

# === FINALIZATION ===
git add .
git commit -m "feat: migrate to PWA 10.0.0 with Angular 17 control flow and Bootstrap Icons"
```

## 📚 Key Takeaways

### ✅ What's Automated

1. **Control flow syntax** (95%):
   - `*ngIf` → `@if`
   - `*ngFor` → `@for`
   - `*ngSwitch` → `@switch`
   - Via: `./scripts/migrate-control-flow.sh`

2. **Common icons** (60%):
   - 60+ Font Awesome → Bootstrap Icons mappings
   - Style class updates (`fas` → `bi`)
   - Via: `node scripts/migrate-bootstrap-icons.js --auto-replace`

3. **Detection** (100%):
   - All breaking changes detected
   - Files and line numbers reported
   - Via: `./scripts/detect-pattern-changes.js`

### ⚠️ What's Manual

1. **Complex control flow** (5-30%, varies by project):
   - Custom theme templates in non-standard locations
   - Extension components not registered in angular.json
   - Nested directives with multiple pipes
   - Custom structural directives
   - Template references with multiple inputs
   - **Script will list specific files requiring manual review**

2. **Custom/Brand icons** (40%):
   - Icons not in common mapping
   - Brand-specific icon fonts
   - Custom SVG icons

3. **SSR architecture** (100%):
   - Custom server code
   - Express middleware
   - Rendering strategies

4. **Logging format** (100%):
   - Custom loggers
   - Log aggregation pipelines
   - Monitoring integrations

## 🆘 Troubleshooting

### Control Flow Migration Issues

**Problem:** Angular CLI schematic fails

```bash
# Ensure Angular 17 is installed
grep "@angular/core" package.json  # Should show "^17.x"

# Clear cache and retry
rm -rf node_modules package-lock.json
npm install
./scripts/migrate-control-flow.sh
```

**Problem:** Some `*ngIf` remain after migration

**Solution:** The Angular CLI schematic only processes components registered in `angular.json`. Custom templates may be skipped:

```bash
# Script will list unmigrated files automatically
./scripts/migrate-control-flow.sh

# Common locations that may need manual migration:
# - Custom theme templates (e.g., src/styles/themes/custom/*)
# - Extension components not in standard paths
# - Shared templates without component decorators
# - Templates in projects/* subdirectories

# Find remaining occurrences
find src/ projects/ -name "*.html" -exec grep -l "\*ngIf=\|\*ngFor=" {} \;

# Manually convert using these patterns:
# *ngIf="condition" → @if (condition) { content }
# *ngFor="let x of items" → @for (x of items; track x) { content }
```

**Why some files weren't migrated:**
- Custom components not in angular.json project definitions
- Templates with complex nested expressions
- Theme-specific template overrides
- Extension templates in non-standard directories

### Bootstrap Icons Issues

**Problem:** Icons don't appear after replacement

**Solution:** Ensure Bootstrap Icons CSS is imported:

```scss
// In src/styles.scss or theme file
@import 'bootstrap-icons/font/bootstrap-icons.css';
```

**Problem:** Some icons look different

**Solution:** Bootstrap Icons ≠ 1:1 visual match. Review:

```bash
# Generate report to see all changes
node scripts/migrate-bootstrap-icons.js --report icons-review.md
```

## See Also

- [Migration Checklist](./migration-checklist.instructions.md) - Pre/post migration steps
- [Migration Workflow](./migration-workflow.instructions.md) - General workflow patterns
- [Angular 17 Control Flow Guide](https://angular.io/guide/control-flow)
- [Bootstrap Icons](https://icons.getbootstrap.com/)
