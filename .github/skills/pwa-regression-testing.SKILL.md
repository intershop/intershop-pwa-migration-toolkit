---
name: pwa-regression-testing
description: |
  Guided regression testing for migrations of customized Intershop PWA projects (customer or partner
  projects). Captures a baseline before the migration (Jest, inventory of custom and overridden pages,
  browser tests with screenshots in fixed viewports), repeats the tests after the migration, compares
  the screenshots, triages every difference (intended / unintended), tracks the fixes and re-compares
  until no unintended difference is open. Use for: "test the PWA before the migration", "create a
  baseline", "compare before/after", "regression test after migration", "check custom features still
  work". DO NOT use for: the standard PWA without customizations, unit test debugging only, writing
  new e2e tests for features.
---

# PWA Regression Testing Skill

Rules and technical details: `.github/instructions/migration-regression-testing.instructions.md`.
Human-readable guide: `docs/guides/regression-testing-guide.md`.

## Terminal and Path Rules

Use relative paths such as `../custom-pwa`. Prefer `node scripts/<script>.js` / `npx …`, which work in
PowerShell, CMD, Git Bash and VS Code terminals. Do not propose Bash-only commands to Windows users.

## When to Invoke This Skill

**Use this skill when:**
- 🧪 A migration of a **customized** PWA is planned → create the baseline **before** the first migration step
- 🔁 A migration step is done → run the after tests and compare
- 🐞 Differences need to be analyzed, documented and fixed
- ✅ Deciding whether a migration is done (exit criteria)

**The `pwa-migration` skill hands over to this skill** in Phase 2 (Preparation → baseline) and Phase 4
(Validation → after tests, comparison, triage).

## Conversation Rules

- Ask **one question at a time**; wait for the answer.
- Show **before, after and diff image** for every difference you report.
- After a fix round, compare yourself; only report differences that remain.
- Never submit an order without the explicit "yes" right before the submission. On production: never.
- Never ask for credentials in the chat – the user types them into the browser.

## Interactive Workflow

### Step 0 – Check the state

1. Read `.migration-progress.json` (if present) and `migration-qa/regression.config.json`.
2. If a baseline exists (`baseline.run`): continue with Phase 2 or the triage – never re-ask the selection.
3. If the migration already started without a baseline: tell the user that the "before" state is no longer
   testable locally. Offer: capture the baseline from the running production/UAT shop (still on the old
   version) or from a checkout of the pre-migration commit.

### Step 1 – Test selection (Phase 0.1)

Ask, one after another:

```
1. Against which environment do the tests run?
   ① Test / UAT system (recommended)   ② Production system (read-only: no orders, no new users)
2. URL of the PWA for the baseline?
3. Which viewports should be tested? (multiple)
   ☐ mobile (390×844)   ☐ tablet (820×1180)   ☐ desktop (1920×1080)
4. Which order types should be tested? (multiple, none allowed)
   ☐ Order as guest   ☐ Order as registered user
5. Test My Account?   ① yes   ② no
6. [only if registered user order or My Account]
   User account?
   ① Create a new user (registered during the baseline, reused afterwards)   ← not offered on production
   ② I enter my credentials during the tests (visible browser, nothing is stored)
```

Then ask whether dynamic areas should be masked (sliders, dates, random recommendations) – everything is
locked after the baseline. Write `migration-qa/regression.config.json` and the `.gitignore` entries,
summarize the selection and update progress: `node scripts/migration-progress.js update regression-setup completed`.

### Step 2 – Jest baseline (Phase 0.2)

Run all Jest tests on the **unchanged** project state and store the JSON result in the baseline run folder.
Report: total / passed / failed / skipped. Failing tests are documented, not fixed now.

### Step 3 – Inventory and test plan (Phase 0.3)

1. Determine custom files, customized standard files and theme overrides compared to the upstream tag of
   the **source** version (`git diff --name-status <source-tag> HEAD -- src projects`,
   `node scripts/analyze-customizations.js --json`).
2. Map them to pages / routes; mark pages covered by the happy path.
3. Write `migration-qa/test-plan.json` and `test-plan.md`.
4. Present the list grouped (new pages · overridden pages · overridden components → pages · non-visual
   changes) and ask the user to review it: add missing pages (with URL), disable irrelevant ones.

### Step 4 – Baseline capture (Phase 0.4)

1. Production mode: show `🔒 PRODUCTION MODE (read-only): no orders are submitted, no users are created.`
2. Discover the category path and two simple orderable products (desktop context), record them.
3. "Create a new user" (test systems): register the test user once, store `.credentials.json` (git-ignored).
4. Run the test sequence for every selected viewport (see instructions). At the review page, ask the
   order question (test systems only) – default No.
5. Report per viewport: steps ok / failed / skipped with notes. Failed steps in the baseline are not
   migration bugs – note them and ask whether the path/selection should be adjusted **before** the baseline
   is accepted.
6. Ask the user to commit `regression.config.json` and the test plan. Update progress:
   `node scripts/migration-progress.js update regression-baseline completed "<run>, <n> steps, <m> failed"`.

Only now hand back to the migration.

### Step 5 – After tests and comparison (Phases 2 + 3)

1. Check that the configuration still matches the baseline (locked fields). If not: stop and explain.
2. Ask for the URL of the migrated PWA (e.g. local docker / `serve:ssr` against the same ICM).
3. Run Jest and the same test sequence → new round `after`, `after-2`, ….
4. Compare against the baseline: visual, functional, console errors / failed requests, Jest.
5. Summarize: number of identical steps, differences per type, new Jest failures.

### Step 6 – Triage (Phase 4)

For **each** difference, one at a time:

```
F-004 · 03-product-1 · mobile · visual (2.3 % pixels, page +8 px)
[before image] [after image] [diff image]

Proposal: unintended – upstream SCSS (styles/components/swiper.scss) overwrites the custom
pagination bullet size. Fix in the theme override.

Is this difference ① intended  ② unintended (bug)?
```

- Intended → ask for/confirm the justification (upstream changelog reference) → status *accepted*.
- Unintended → propose the cause; ask: fix now or won't fix (reason + who decided)?
- Record everything in `migration-qa/findings.md`.

### Step 7 – Fix and re-compare (Phases 5 + 6)

1. Fix **all** unintended differences decided as "fix" (prefer theme overrides and CUSTOMIZATION markers –
   see `docs/guides/customization-best-practices.md`), then rebuild.
2. New after round → compare against the **baseline** → update `findings.md` (verified / open again / new).
3. Repeat until the exit criteria are met. Report only what remains.

### Step 8 – Done

Check the exit criteria (instructions). Summarize: rounds, findings by classification and status, Jest
comparison. Update progress: `node scripts/migration-progress.js update regression-recheck completed`.
Add the findings table to the migration report.

## Example Invocation

User: "We migrate our customer PWA from 9.0 to 12.1 – what do we test?"

```
Before we change anything, I'll capture a baseline of the current shop so we can prove afterwards
that all custom features and pages still work.

First question: against which environment should the tests run?
① Test / UAT system (recommended)
② Production system (read-only – no orders, no new users)
```

## Integration with Other Resources

- **pwa-migration.SKILL.md** → overall migration; calls this skill before the first migration step and for validation
- **migration-regression-testing.instructions.md** → rules, selectors, screenshot and comparison details
- **migration-progress.instructions.md** → step IDs `regression-*`
- **migration-checklist.instructions.md** → baseline as critical pre-migration item, exit criteria as success criteria
- **docs/guides/customization-best-practices.md** → how to fix differences migration-friendly

---

**Last Updated:** November 2026
**Version:** 1.0
