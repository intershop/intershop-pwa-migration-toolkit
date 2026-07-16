---
applyTo: '**/migration*.{js,ts}'
---

# PWA Migration - Progress Persistence and Session Recovery

## CRITICAL: Check for In-Progress Migration

**At the start of ANY migration-related conversation, ALWAYS check:**

```bash
# Check if a migration is already in progress
if [ -f .migration-progress.json ]; then
  cat .migration-progress.json
fi
```

If `.migration-progress.json` exists in the project root:
1. **Read it first** to understand the current migration state
2. **Report the status** to the user (what's done, what's next)
3. **Resume from the current step** — do NOT restart the migration
4. **Update the file** as you complete steps

## Progress Tracking Workflow

### Starting a New Migration

When beginning a fresh migration, initialize progress tracking:

```bash
node scripts/migration-progress.js init <source_version> <target_version>
```

This creates `.migration-progress.json` with all migration steps tracked.

### During Migration

Update progress after completing each significant step:

```bash
# Mark a step as in-progress
node scripts/migration-progress.js update <step_id> in-progress

# Mark a step as completed (with optional notes)
node scripts/migration-progress.js update <step_id> completed "Fixed 3 TS errors in environment.model.ts"

# Skip a step that doesn't apply
node scripts/migration-progress.js update control-flow-migration skipped "Not applicable - target is PWA 9.1"

# Add a free-form note (useful for context that helps resume later)
node scripts/migration-progress.js note "Custom theme uses 4 non-standard variables, synced manually"
```

### Available Step IDs

| Step ID | Description |
|---------|-------------|
| `version-identification` | Document source and target versions |
| `angular-version-check` | Check Angular version compatibility |
| `node-version-check` | Verify Node.js version requirements |
| `git-remote-setup` | Configure git remotes |
| `branch-creation` | Create migration branch |
| `theme-validation` | Validate custom theme completeness |
| `theme-sync` | Sync missing theme variables |
| `first-build` | First build attempt and error capture |
| `typescript-fixes` | Fix TypeScript compilation errors |
| `scss-fixes` | Fix SCSS compilation errors |
| `template-fixes` | Fix template errors |
| `removed-features` | Handle removed features/extensions |
| `i18n-merge` | Merge localization files |
| `control-flow-migration` | Migrate Angular control flow (PWA 10+) |
| `icon-migration` | Migrate icons (PWA 10+) |
| `clean-build` | Achieve clean build (browser + SSR) |
| `lint-check` | Run and fix lint issues |
| `test-run` | Run unit tests |
| `smoke-test` | Manual smoke test of custom features |
| `documentation` | Update documentation and changelog |
| `commit-and-push` | Final commit and push to project remote |

### Resuming After VM Shutdown

When a user returns after a VM restart or new Copilot session:

1. Check for `.migration-progress.json`
2. Read the file and present a brief status summary
3. Ask: "Would you like to continue from [current step]?"
4. Resume the migration workflow from that point

The user can also run:
```bash
node scripts/migration-progress.js summary
```

This outputs a Copilot-friendly summary they can paste into a new chat window.

### End of Session

Before ending a session (or if the user mentions stopping):

```bash
# Add a note about where things stand
node scripts/migration-progress.js note "Stopped mid-step: fixing 2 remaining TS errors in shared.module.ts"

# Show the summary for easy resumption
node scripts/migration-progress.js summary
```

## File Location

- **Progress file**: `<project-root>/.migration-progress.json`
- **Should be .gitignored**: It's session state, not project code
- **Survives VM restarts**: It's a regular file on disk
- **Machine-readable**: Copilot can parse JSON to understand state precisely
