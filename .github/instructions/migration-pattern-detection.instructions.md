---
applyTo: '**/migration*.{js,ts}'
---

# PWA Migration - Pattern Detection System

This guide covers the tiered pattern detection system for identifying breaking changes and deprecated patterns during PWA migrations.

## Overview

The pattern detection system helps identify code that needs updating when migrating between PWA versions. It operates in three tiers, chosen based on migration complexity.

## Detection Tiers

### 🔍 Tier 1: Manual CHANGELOG Review (Lightweight)

**When to use:**
- Light customization (< 20% custom code)
- 1-2 versions behind
- Primarily using standard PWA features
- Fast migration needed (1-2 hours)

**Process:**
1. Fetch Intershop PWA repository
2. Read CHANGELOG.md between versions
3. Identify relevant breaking changes
4. Manually check your code

**Commands:**
```bash
# Add Intershop PWA remote
git remote add intershop-pwa https://github.com/intershop/intershop-pwa.git
git fetch intershop-pwa --tags

# View CHANGELOG between versions
git show intershop-pwa/9.1.0:CHANGELOG.md | less

# Manual grep for specific patterns
grep -r "darken(" src/styles/
grep -r "map-get(" src/styles/
```

**Pros:**
- ✅ No additional tools needed
- ✅ Quick for simple migrations
- ✅ Full control

**Cons:**
- ❌ Manual effort required
- ❌ Easy to miss patterns
- ❌ No systematic tracking

---

### 🤖 Tier 2: Automated Pattern Detection (Recommended Default)

**When to use:**
- Moderate customization (20-50% custom code)
- 2-4 versions behind
- Custom themes, extensions, or features
- Want to catch issues before building

**What it provides:**
- Fetches CHANGELOG.md automatically from GitHub
- Parses breaking changes between versions
- Scans your codebase for affected patterns
- Generates AI-parseable report

**Commands:**
```bash
# Run pattern detection
./scripts/detect-pattern-changes.js 4.0.0 9.1.0

# Output includes:
# - Breaking changes by version
# - Pattern matches in your code
# - Files affected
# - JSON report for AI processing
```

**Example Output:**
```
╔════════════════════════════════════════════════════════════════╗
║       Pattern Change Detection (Tier 2)                       ║
╚════════════════════════════════════════════════════════════════╝

Mode: Standard (Tier 2)
Source: 4.0.0 → Target: 9.1.0

📥 Fetching CHANGELOG.md from Intershop PWA...
✓ Fetched CHANGELOG from develop
🔍 Parsing breaking changes between 4.0.0 and 9.1.0...
✓ Found 3 version(s) with breaking changes
🔎 Scanning codebase for pattern matches...

⚠  Found 15 occurrence(s) of: SCSS: darken() → color.adjust()
⚠  Found 8 occurrence(s) of: SCSS: map-get() → map.get()

==================================================================
Detected Patterns Requiring Updates:

1. SCSS: darken() → color.adjust() with negative lightness
   Version: 9.0
   Type: scss
   Occurrences: 15
   Required import: @use 'sass:color';
   Files affected:
     - src/styles/themes/training/variables.scss
     - src/styles/components/product-item.scss
     ... and 3 more

2. SCSS: map-get() → map.get()
   Version: 9.0
   Type: scss
   Occurrences: 8
   Required import: @use 'sass:map';
   Files affected:
     - src/styles/themes/training/mixins.scss
     ... and 2 more

==================================================================
Summary:
  Total pattern types detected: 2
  Total occurrences: 23
  Files affected: 6
==================================================================

📊 Detailed report saved to: pattern-detection-report.json
⚠  Patterns detected - please review and update
```

**Pros:**
- ✅ Automated scanning
- ✅ Catches most common patterns
- ✅ AI-parseable output
- ✅ Saves 2-3 hours

**Cons:**
- ❌ Requires Node.js 18+
- ❌ Limited to known pattern types
- ❌ May have false positives

---

### 📚 Tier 3: Comprehensive Pattern Database (Heavy Migrations)

**When to use:**
- Heavy customization (> 50% custom code)
- 5+ versions behind (e.g., PWA 4.0 → 9.1)
- Multiple custom extensions
- Need detailed migration planning

**What it provides:**
- Everything from Tier 2, plus:
- Comprehensive pattern library (pattern-migrations.json)
- Multi-version breaking change tracking
- Severity levels and priority
- Automated transformation suggestions
- Migration impact analysis

**Commands:**
```bash
# Run comprehensive detection
./scripts/detect-pattern-changes.js --comprehensive 4.0.0 9.1.0

# Includes:
# - All Tier 2 features
# - Pattern database rules
# - Severity classification
# - Transformation examples
# - Manual review flags
```

**Pattern Database Structure:**
```json
{
  "migrations": [
    {
      "fromVersion": "8.0",
      "toVersion": "9.0",
      "patterns": [
        {
          "type": "scss",
          "description": "darken() deprecated",
          "severity": "high",
          "autoFixable": false,
          "requiresImport": "@use 'sass:color';",
          "example": {
            "before": "$dark: darken($color, 20%);",
            "after": "$dark: color.adjust($color, $lightness: -20%);"
          }
        }
      ]
    }
  ]
}
```

**Pros:**
- ✅ Most comprehensive
- ✅ Covers multiple version ranges
- ✅ Includes examples
- ✅ Severity prioritization
- ✅ Best for complex migrations

**Cons:**
- ❌ More verbose output
- ❌ Requires pattern database maintenance
- ❌ Longer execution time

---

## Decision Tree: Which Tier Should You Use?

```
START: Analyze Your Migration
│
├─ How many versions behind?
│  ├─ 1-2 versions → Check customization level
│  │  ├─ Light (< 20%) → Tier 1 (Manual)
│  │  └─ Moderate → Tier 2 (Automated)
│  │
│  ├─ 2-4 versions → Check customization level
│  │  ├─ Light → Tier 2 (Automated)
│  │  ├─ Moderate → Tier 2 (Automated)
│  │  └─ Heavy (> 50%) → Tier 3 (Comprehensive)
│  │
│  └─ 5+ versions → Tier 3 (Comprehensive)
│
END: Use recommended tier
```

**Use the complexity analyzer to get automatic recommendation:**
```bash
node scripts/analyze-migration.js 4.0.0 9.1.0

# Output includes tier recommendation:
# "Recommended approach: TIER 2 (Pattern Detection Script)"
```

---

## AI Assistant Guidance

### For AI Coding Assistants

**When helping with PWA migrations, follow this pattern detection workflow:**

#### Step 1: Determine Appropriate Tier

```bash
# Run complexity analyzer
node scripts/analyze-migration.js [source] [target]
```

Based on output, recommend appropriate tier to user.

#### Step 2: Execute Pattern Detection

**For Tier 1 (Manual):**
- Fetch CHANGELOG manually
- Present breaking changes to user
- Ask which patterns to check

**For Tier 2 (Automated):**
```bash
# Run pattern detection
./scripts/detect-pattern-changes.js [source] [target]
```

**For Tier 3 (Comprehensive):**
```bash
# Run comprehensive detection
./scripts/detect-pattern-changes.js --comprehensive [source] [target]
```

#### Step 3: Parse and Present Results

Parse `pattern-detection-report.json`:

```javascript
const report = JSON.parse(fs.readFileSync('pattern-detection-report.json'));

// Present to user:
console.log(`Found ${report.results.length} pattern types requiring updates`);
console.log(`Total occurrences: ${report.results.reduce((s, r) => s + r.matchCount, 0)}`);

// For each pattern:
report.results.forEach(result => {
  console.log(`\n⚠️  ${result.pattern.description}`);
  console.log(`   Severity: ${result.pattern.severity || 'medium'}`);
  console.log(`   Affected files: ${result.matchCount}`);
  
  if (result.pattern.requiresImport) {
    console.log(`   Required: ${result.pattern.requiresImport}`);
  }
  
  if (result.pattern.example) {
    console.log(`   Before: ${result.pattern.example.before}`);
    console.log(`   After:  ${result.pattern.example.after}`);
  }
});
```

#### Step 4: Provide Actionable Recommendations

**DO:**
- ✅ Categorize by severity (high → medium → low)
- ✅ Show concrete examples with before/after
- ✅ Indicate which changes are auto-fixable
- ✅ Flag patterns requiring manual review
- ✅ Suggest import statements needed

**DON'T:**
- ❌ Automatically modify code without confirmation
- ❌ Skip patterns marked as "manual: true"
- ❌ Ignore severity levels
- ❌ Make assumptions about custom implementations

#### Step 5: Offer Assistance

For each detected pattern, ask:
```
Pattern: SCSS darken() function (15 occurrences)
Required change: darken($color, X%) → color.adjust($color, $lightness: -X%)
Also need: @use 'sass:color'; at top of file

Would you like me to:
1. Show affected files
2. Fix automatically (with preview)
3. Fix one file at a time
4. Skip (you'll fix manually)
```

---

## Pattern Database Maintenance

### Adding New Patterns

Edit `data/pattern-migrations.json`:

```json
{
  "migrations": [
    {
      "fromVersion": "X.0",
      "toVersion": "Y.0",
      "patterns": [
        {
          "type": "typescript|scss|html",
          "description": "Clear description of the change",
          "oldPattern": "regex-to-find-old-pattern",
          "newPattern": "replacement-pattern",
          "searchRegex": "grep-compatible-regex",
          "files": "**/*.{ts,scss,html}",
          "severity": "high|medium|low",
          "autoFixable": true|false,
          "manual": false|true,
          "requiresImport": "@use 'module';",
          "example": {
            "before": "old code",
            "after": "new code"
          },
          "note": "Additional context or warnings"
        }
      ]
    }
  ]
}
```

### Keeping Database Current

1. **After each PWA release:**
   - Review CHANGELOG.md
   - Extract breaking changes
   - Add patterns to database

2. **After each migration:**
   - Document patterns you encountered
   - Add to database for future use
   - Note any false positives

3. **Community contributions:**
   - Share patterns with team
   - Submit to central repository
   - Learn from other migrations

---

## Integration with Migration Workflow

### Pre-Migration: Pattern Detection

```bash
# 1. Analyze complexity
node scripts/analyze-migration.js 4.0.0 9.1.0
# Output: "Recommended: Tier 2"

# 2. Run pattern detection
./scripts/detect-pattern-changes.js 4.0.0 9.1.0
# Output: pattern-detection-report.json

# 3. Review report before starting migration
cat pattern-detection-report.json | jq '.results[] | .pattern.description'
```

### During Migration: Reference Detected Patterns

When build errors occur, check if they match detected patterns:

```bash
# Build fails with SCSS error about darken()
# Check report:
grep "darken" pattern-detection-report.json

# Shows you already knew about this, with fix instructions
```

### Post-Migration: Verify Patterns Resolved

```bash
# Run detection again after migration
./scripts/detect-pattern-changes.js 9.1.0 9.1.0

# Should show: "✅ All clear - no deprecated patterns found"
```

---

## Common Pattern Categories

### 1. SCSS Patterns

**Deprecated Sass Functions (PWA 9.0+):**
- `darken()` → `color.adjust($color, $lightness: -X%)`
- `lighten()` → `color.adjust($color, $lightness: X%)`
- `map-get()` → `map.get()`
- `map-merge()` → `map.merge()`

**New Variables Required:**
- Custom themes need variables added
- Compare with b2b/b2c theme

### 2. TypeScript Patterns

**Environment Features:**
- Registration in environment.model.ts
- Configuration in environment files

**Module Changes:**
- Import statement updates
- Module to standalone migrations

### 3. Template Patterns

**Angular Syntax:**
- Empty paired tags → self-closing
- *ngIf → @if (Angular 17+)
- *ngFor → @for (Angular 17+)

**Component Changes:**
- Removed selectors
- Renamed components
- Changed inputs/outputs

---

## Troubleshooting Pattern Detection

### Issue: Script fails to fetch CHANGELOG

**Cause:** Network issues or GitHub rate limiting

**Solution:**
```bash
# Fallback to local pattern database
./scripts/detect-pattern-changes.js --comprehensive 4.0.0 9.1.0
# Uses data/pattern-migrations.json only
```

### Issue: False positives detected

**Cause:** Pattern regex too broad

**Solution:**
- Review matches in pattern-detection-report.json
- Filter out false positives manually
- Update pattern database with more specific regex

### Issue: Node.js version too old

**Cause:** Script requires Node.js 18+ for native fetch

**Solution:**
```bash
# Check Node version
node --version

# Update Node.js
nvm install 22
nvm use 22

# Or use Tier 3 only (doesn't need fetch)
./scripts/detect-pattern-changes.js --comprehensive 4.0.0 9.1.0
```

---

## Best Practices

### ✅ DO:

1. **Run detection before starting migration**
   - Understand scope of changes
   - Plan time accordingly
   - Identify high-risk areas

2. **Review all high-severity patterns first**
   - Fix breaking changes early
   - Avoid cascading errors
   - Test incrementally

3. **Update pattern database after migration**
   - Document new patterns found
   - Share with team
   - Improve for next time

4. **Use appropriate tier for complexity**
   - Don't over-engineer simple migrations
   - Don't under-prepare complex ones
   - Follow analyzer recommendation

### ❌ DON'T:

1. **Skip pattern detection**
   - Wastes time troubleshooting
   - Miss systematic issues
   - Higher risk of errors

2. **Blindly apply all suggested changes**
   - Some patterns need manual review
   - Custom implementations may differ
   - Verify before committing

3. **Ignore manual review flags**
   - Marked patterns need human judgment
   - AI can't determine intent
   - Risk breaking functionality

4. **Forget to re-run after migration**
   - Verify patterns resolved
   - Catch any missed updates
   - Ensure clean state

---

## Summary

The pattern detection system provides three tiers of support:

- **Tier 1**: Manual review for simple migrations
- **Tier 2**: Automated detection for typical migrations
- **Tier 3**: Comprehensive analysis for complex migrations

Choose based on your migration complexity, follow AI guidance for presenting results, and maintain the pattern database for continuous improvement.

**Next Steps:**
1. Run complexity analyzer: `node scripts/analyze-migration.js`
2. Follow tier recommendation
3. Execute pattern detection
4. Review and address findings
5. Proceed with migration
