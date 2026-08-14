# PWA Migration Toolkit

This workspace helps migrate Intershop PWA customizations between versions.
In the multi-root workspace, "Custom PWA" is the target project and "Migration Toolkit" provides the tools.
The env var `PWA_PROJECT_DIR` points to the custom project. Most scripts accept `--project-dir` to override it.

## Workflow

1. Detect source/target versions from `package.json` in the custom project
2. Run detection scripts to assess scope
3. Use automated migration scripts for known patterns
4. Build, verify, fix remaining issues manually
5. **Always prefer toolkit scripts over manual fixes**

## Available Scripts

### Migration (run via `npm run <name>` or `node scripts/<file>`)

| npm script | Purpose |
|---|---|
| `migrate` | Git-based branch migration (merge upstream into custom). Shows ours/theirs banner, auto-resolves infrastructure files, extracts/re-injects custom feature toggles, verifies non-custom files against upstream |
| `migrate:standalone` | Add `standalone: false` to NgModule-declared artifacts + sync overrides. Also scans TestBed declarations in spec files and detects external components not covered by NgModule scan |
| `migrate:translate` | Migrate ngx-translate breaking changes (v16→v18). Supports `--custom-only` and `--upstream-tag=<tag>` to skip already-migrated upstream files. Deduplicates imports automatically |
| `migrate:controlflow` | Migrate Angular control flow syntax (`*ngIf` → `@if`) |
| `migrate:icons` | Migrate Bootstrap icon classes |

### Analysis & Detection

| npm script | Purpose |
|---|---|
| `analyze` | Analyze migration complexity and recommend approach |
| `detect` | Detect breaking-change patterns between source/target versions |
| `progress` | Track migration progress (errors remaining, files touched) |
| `report` | Generate a comprehensive migration report |

### Checks & Validation

| npm script | Purpose |
|---|---|
| `check:node` | Verify Node.js version compatibility |
| `check:template` | Check Angular template syntax for issues |
| `check:icm` | Check ICM compatibility |
| `check:imports` | Detect broken relative imports (moved/deleted files) |
| `validate:theme` | Validate SCSS theme variable completeness |

### Fix & Sync

| npm script | Purpose |
|---|---|
| `sync:theme` | Sync missing SCSS theme variables from upstream |
| `merge:i18n` | Merge i18n translation files |
| `merge:docker` | Merge docker-compose files |
| `update:snapshots` | Update test snapshots after migration |

### Additional scripts (run via `node scripts/<file>`)

| Script | Purpose |
|---|---|
| `analyze-customizations.js` | List custom vs. standard files overview |
| `detect-override-impacts.js` | Detect impacts on override files (.multi/.performance/.modern) |
| `fix-template-syntax.js` | Auto-fix common template syntax issues |
| `fix-template-linting.js` | Auto-fix template linting errors |
| `pre-commit-customization-check.js` | Git hook: warn if upstream files are modified |

## Deep Knowledge

For detailed guidance, read these files when relevant:

- **Migration workflow & checklist**: `.github/instructions/migration-workflow.instructions.md`, `migration-checklist.instructions.md`
- **Version-specific guides**: `.github/instructions/migration-pwa10.instructions.md`, `migration-pwa11.instructions.md`, `migration-pwa12.instructions.md`
- **Pattern detection**: `.github/instructions/migration-pattern-detection.instructions.md`, `migration-patterns.instructions.md`
- **Git operations**: `.github/instructions/migration-git.instructions.md`
- **Troubleshooting**: `.github/skills/pwa-troubleshooting.SKILL.md`
- **Full migration planning**: `.github/skills/pwa-migration.SKILL.md`
