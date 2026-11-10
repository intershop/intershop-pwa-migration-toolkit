# PWA Migration Regression Testing Guide

> **For AI agents:** the binding rules are in `.github/instructions/migration-regression-testing.instructions.md`,
> the guided workflow in `.github/skills/pwa-regression-testing.SKILL.md`.

This guide describes how to make sure that a **customized PWA** (customer or partner project) behaves
exactly as before after a migration to a new Intershop PWA version.

**Quick start** (run in the toolkit, `--project-dir` points to the customer project):

```bash
npm install                                   # once – includes the optional Playwright dependencies
npx playwright install chromium               # once – browser for the tests
node scripts/regression-init.js --project-dir ../custom-pwa
node scripts/regression-inventory.js --project-dir ../custom-pwa
node scripts/regression-capture.js --project-dir ../custom-pwa --label before
# … migration …
node scripts/regression-capture.js --project-dir ../custom-pwa --label after --base-url http://localhost:4200
node scripts/regression-compare.js --project-dir ../custom-pwa
node scripts/regression-findings.js --project-dir ../custom-pwa
node scripts/regression-findings.js --project-dir ../custom-pwa --triage
node scripts/regression-findings.js --project-dir ../custom-pwa --check
```

The same scripts are available as `npm run regression:<name>`. Options after `--` are forwarded
(`npm run regression:capture -- --label before`); in Windows PowerShell 5.1 the `--` must be quoted
(`'--'`), otherwise npm swallows the options – `node scripts/…` works everywhere.

---

## 🎯 Core Principle

> **No migration without a baseline. No migration is done while unintended differences are open.**

As soon as a PWA is no longer the standard PWA, every custom feature and every overridden page has to
work exactly as before the migration. The only reliable way to prove this is to test the project
**before** the migration, test it again **after** the migration under identical conditions, and
explain every difference.

---

## 🔁 Process Overview

```
Phase 0  Baseline (before ANY migration change, on the unchanged project state)
         ├─ regression:init        → select environment, viewports, order types, My Account, user account mode
         ├─ regression:inventory   → list of custom/overridden pages and features → test plan
         └─ regression:capture --label before → all Jest tests + browser tests + screenshots
Phase 1  Migration (regular toolkit workflow)
Phase 2  regression:capture --label after   → same tests, same viewports, same environment
Phase 3  regression:compare                 → list of differences (screenshots + Jest + console errors)
Phase 4  regression:findings [--triage]     → document + triage each difference: intended | unintended (bug)
Phase 5  Fix ALL unintended differences     → regression:findings --set <ID> --status fixed
Phase 6  Capture + compare again (always against the baseline) → back to Phase 4
         until regression:findings --check passes
```

| Phase | npm script | Result |
|---|---|---|
| 0 | `regression:init` | `migration-qa/regression.config.json` |
| 0 | `regression:inventory` | `migration-qa/test-plan.json` + `test-plan.md` |
| 0 | `regression:capture --label before` | `migration-qa/runs/<date>-before/` (screenshots, `run-log.json`, `jest-results.json`) |
| 2, 6 | `regression:capture --label after` | `migration-qa/runs/<date>-after[-n]/` |
| 3, 6 | `regression:compare` | `migration-qa/reports/<before>-vs-<after>/index.html` + `compare.json` |
| 4–6 | `regression:findings` (`--triage`, `--set`, `--check`) | `migration-qa/findings.md` |

All scripts accept `--project-dir` (or use `PWA_PROJECT_DIR`) like every other toolkit script and show
their options with `--help`. `regression:capture --skip-jest` skips the Jest run.

---

## ✅ Prerequisites

- **Test system preferred, production allowed read-only.** Prefer a test/UAT system. Testing against
  production (e.g. the live shop as baseline) is allowed, but only in **production mode**: no order is
  ever submitted and no user is ever created (see [Production Systems](#-production-systems)).
- **Same environment for before and after.** Same ICM, same test data (categories, products with
  stock, usable payment and shipping methods), same channel/locale, same PWA configuration.
  Otherwise you compare data instead of code. A production baseline is only comparable if the
  *after* runs use the same ICM data (e.g. the migrated PWA running locally against the production
  ICM – also in production mode).
- **Same build mode for before and after.** Prefer a production-like build (SSR, e.g. docker or
  `serve:ssr`). Do not compare a dev server run with a production build.
- **Playwright, pixelmatch and pngjs** are optional toolkit dependencies (installed with `npm install`
  in the toolkit). Install the browser once:
  ```bash
  npx playwright install chromium
  ```

---

## Phase 0 – Baseline

The baseline is created on the **unchanged project state** (the current production branch of the
project), before the first migration step.

### 0.1 Select what to test: `regression:init`

`regression:init` asks the following questions (multiple choice). The Copilot skill asks the same
questions in chat.

| # | Question | Options | Asked when |
|---|---|---|---|
| 1 | Which environment? | ◯ test / UAT system ◯ production system (read-only) | always |
| 2 | Which viewports? | ☐ mobile ☐ tablet ☐ desktop (at least one) | always |
| 3 | Which order types? | ☐ order as guest ☐ order as registered user | always |
| 4 | Test My Account? | yes / no | always |
| 5 | User account? | ◯ create a new user ◯ I enter my credentials during the tests | only if "order as registered user" or "My Account" is selected; on production only the second option is offered |

The answers are stored in `migration-qa/regression.config.json`. The *after* runs read this file and
do **not** ask again – this guarantees that before and after use the same selection.

### 0.2 Viewports

**The viewport is decisive.** Screenshots are only comparable if they are taken in exactly the same
viewport.

| Viewport | Size (CSS px) |
|---|---|
| mobile | 390 × 844 |
| tablet | 820 × 1180 |
| desktop | 1920 × 1080 |

- The sizes are deliberately away from the Bootstrap breakpoints used by the PWA.
- Device scale factor (1), locale, time zone and reduced motion are fixed as well.
- Every selected viewport runs the **complete** test sequence.
- Screenshots are only ever compared within the same viewport.
- After the baseline the configuration is **locked**: `regression:capture --label after` aborts if
  viewports or any other setting differ from the baseline.

### 0.3 Run all Jest tests

All unit tests of the project are run once and the results are stored with the baseline run
(`jest-results.json`) – `regression:capture` does this at the start of every run. This documents the state before the migration – including tests that already
fail before the migration.

### 0.4 Inventory of custom pages and features: `regression:inventory`

The inventory determines what the project created or overrode compared to the standard PWA of the
**source** version (based on `analyze-customizations.js`):

- files that do not exist in the upstream tag (custom components, pages, services, …),
- standard files that were modified,
- theme overrides (`*.<theme>.html|ts|scss`).

These files are mapped to pages and routes (page components, routing modules, components used on a
page). The result is a test plan:

- `migration-qa/test-plan.json` – machine-readable, used by `regression:capture`
- `migration-qa/test-plan.md` – readable list for the team

**Review the test plan with the team before the baseline run.** Add pages or features the tool could
not detect (e.g. pages only reachable via CMS links, special customer flows) and remove irrelevant
entries. Every entry records *why* it is in the plan (which custom or overridden files).

### 0.5 Test sequence

The test sequence is built from the answers of `regression:init`:

```
for each selected viewport:
  1. Homepage
  2. Category / navigation   → remember product 1 and product 2 from the product list
  3. Open product 1          → product detail page
  4. Add product 1 to basket
  5. Header search           → search for product 2: suggestions → search result page
  6. Open product 2          → from the search result
  7. Add product 2 to basket → basket (2 products)
  8a. [order as guest]       guest checkout: address → shipping → payment → review → (confirmation)
  8b. [order as reg. user]   login → checkout: address → shipping → payment → review → (confirmation)
  9.  [My Account]           login (if needed) → overview, orders, addresses, profile, …
  10. pages and features from the test plan (inventory)
```

If no order type is selected, the happy path ends at the basket.

**Two products:** Both products are taken from the product list of the category, so no product or
search term has to be configured. Product 1 is reached via the navigation, product 2 via the header
search – this way both entry points and a basket with more than one product are tested. If the
category contains only one product, product 2 is taken from another category; if no second product
can be found at all, the search steps (5–7) are skipped and the run log records the reason.

**Header search:** The suggestion layer and the search result page are captured, and the test
checks that product 2 is contained in the search result. A missing product is recorded as a
difference, not only visible in the screenshot.

**Same path in every run:** The baseline run records the category path and both products it used.
All *after* runs follow exactly the same path with the same two products, so the screenshots show
the same content.

Every step produces a full-page screenshot. In addition, console errors and failed requests
(4xx/5xx) are recorded per step.

### 0.6 User account

Only relevant if "order as registered user" or "My Account" is selected.

- **Create a new user** (not available on production systems)
  - The baseline run registers a test user via the regular PWA registration with a unique e-mail
    address (timestamp).
  - The *after* runs reuse the **same** user. Otherwise My Account screenshots differ only because of
    the data (e.g. an empty order history).
  - The credentials are stored locally in `migration-qa/.credentials.json`, which is git-ignored.
    They are never committed.
- **Enter credentials during the tests**
  - The browser runs visibly (headed) and pauses on the login page.
  - The user logs in manually; the test detects the successful login and continues.
  - The credentials are not stored anywhere.

### 0.7 Capture the baseline: `regression:capture --label before`

Runs the test sequence for all selected viewports and stores everything in
`migration-qa/runs/<date>-before/`. Commit the configuration and the test plan before starting the
migration.

---

## 🛒 Order Submission

Every checkout run (guest and registered user, every viewport, before and after) **always stops on
the review page**. After the review page screenshot, the user is asked:

```
⚠ ATTENTION: This will submit a REAL order!
  ICM:         https://<icm-host>/...
  Order type:  guest | registered user <email>
  Viewport:    mobile (390×844)
  Basket:      2 items, total 49.90 €
  Payment:     Invoice

Submit the order now? (y/N)
```

- The default is **No** – pressing Enter never submits an order.
- **Yes:** the order is submitted and the confirmation page is captured.
- **No:** the checkout ends on the review page; the run log records "not submitted".
- The confirmation page is only compared if it exists in both runs. If it is missing in one run, the
  report shows a note, not a difference.
- The Copilot skill asks the same question in chat, with the same warning. It never submits an order
  without explicit confirmation.
- **On production systems this question is never asked** – see [Production Systems](#-production-systems).

---

## 🔒 Production Systems

Testing against production (e.g. to capture the live shop as baseline) is allowed in
**production mode** (question 1 of `regression:init`). Production mode is part of the locked
configuration and applies to **all** runs – before and after.

In production mode, **under no circumstances**:

- **an order is submitted.** The checkout always ends on the review page. The submit button is
  never clicked and the order question is not asked.
- **a user is created.** The option "create a new user" is not offered; registered user checkout
  and My Account only work with credentials the user enters manually during the tests.

In addition to these rules, the test browser blocks the order creation and customer registration
requests to the ICM REST API at network level. If such a request is attempted anyway, it is
aborted, the run stops with an error, and the attempt is recorded in the run log. A configuration
that would require one of these actions (e.g. "create a new user" together with production mode)
is rejected by `regression:init` and `regression:capture`.

At the start of every run in production mode the console shows:

```
🔒 PRODUCTION MODE (read-only): no orders are submitted, no users are created.
```

---

## Phase 1 – Migration

Run the migration with the regular toolkit workflow (see [README](../../README.md) and
[QUICK-START](../../QUICK-START.md)). The regression testing does not change the migration itself.

---

## Phase 2 – Test Again: `regression:capture --label after`

- Same environment, same ICM, same test data, same build mode as the baseline.
- The configuration from Phase 0 is reused and must not be changed. If the migrated PWA runs under a
  different URL (e.g. locally), pass it with `--base-url` – the URL is not part of the locked configuration.
- Jest is run again and stored with the run.
- Results go to `migration-qa/runs/<date>-after/` (subsequent rounds: `-after-2`, `-after-3`, …).
  Runs never overwrite each other.

---

## Phase 3 – Compare: `regression:compare`

Compares an *after* run with the baseline and creates an HTML report:

- **Screenshots** per step and viewport: before | after | diff image (differences highlighted).
  Changed page heights count as differences. A small noise threshold avoids reporting
  anti-aliasing artifacts.
- **Jest:** new failures, fixed tests, added/removed tests compared to the baseline.
- **Console errors and failed requests:** new errors compared to the baseline.

Dynamic areas (sliders, dates, random recommendations, …) can be masked in
`regression.config.json` so they do not produce false differences.

---

## Phase 4 – Analyze and Document: `regression:findings`

Every difference becomes an entry in `migration-qa/findings.md`. The file is extended with every
comparison round, never overwritten, and committed with the migration.

| Field | Values |
|---|---|
| ID | `F-001`, `F-002`, … |
| Page / step, viewport | e.g. `03-product-detail`, `mobile` |
| Description | what is different |
| Classification | **intended** (e.g. documented upstream change) \| **unintended / bug** |
| Cause | e.g. upstream SCSS change, lost override, changed DOM structure |
| Decision | **fix** \| **won't fix** (with reason and who decided) |
| Status | open → fixed → verified \| accepted |
| Reference | commit, issue, upstream changelog entry |
| Found / Last seen | comparison round in which the difference was found / last seen (`gone in after-2`) |

Commands:

```bash
node scripts/regression-findings.js                         # take over the latest comparison
node scripts/regression-findings.js --triage             # classify untriaged findings interactively
node scripts/regression-findings.js --set F-003 --classification intended --reference "changelog 12.0 #1234"
```

The table can also be edited by hand – keep one finding per row.

Rules:

- An **intended** difference needs a justification, ideally a reference to the upstream changelog or
  migration notes.
- A **won't fix** decision needs a reason and has to be agreed with the project lead / customer.
- Typical causes worth checking first: upstream changes in global styles, theme override files that
  did not receive an upstream fix, changed DOM structure or CSS classes in upstream templates that
  custom SCSS relies on.

---

## Phase 5 – Fix

Fix **all** unintended differences decided as *fix* first. Then compare again – do not compare after
every single fix. Mark fixed findings with the commit:

```bash
node scripts/regression-findings.js --set F-003 --status fixed --reference "commit abc1234"
```

---

## Phase 6 – Compare Again

1. `regression:capture --label after` (new round, e.g. `after-2`)
2. `regression:compare` – **always against the baseline**, never against the previous after run
3. `regression:findings`: differences that disappeared become *verified*, differences still present
   are *open* again, new differences are added and triaged (Phase 4)
4. Repeat Phases 4–6 until `regression:findings --check` passes (exit code 0)

### Exit criteria

- No finding with classification *unintended* and status *open* or *fixed* (not yet verified)
- Every *intended* and *won't fix* entry has a justification
- No new Jest failures compared to the baseline
- No new console errors or failed requests compared to the baseline (or documented as findings)

---

## 📁 Files and Folders

```
migration-qa/
├── regression.config.json   # answers from regression:init, locked after the baseline  (commit)
├── test-plan.json           # test plan from regression:inventory, reviewed by the team (commit)
├── test-plan.md             # readable version of the test plan                       (commit)
├── findings.md              # triage log of all differences                           (commit)
├── .credentials.json        # only "create a new user" mode                           (git-ignored)
├── runs/                    #                                                         (git-ignored)
│   ├── <date>-before/
│   │   ├── jest-results.json
│   │   ├── run-log.json     # steps, category path + products used, console errors, failed requests, order submitted yes/no
│   │   └── <viewport>/<step>.png
│   ├── <date>-after/
│   └── <date>-after-2/
└── reports/                 #                                                         (git-ignored)
    └── <before>-vs-<after>/index.html
```

Recommended `.gitignore` entries for the project:

```gitignore
migration-qa/.credentials.json
migration-qa/runs/
migration-qa/reports/
```

---

## 🤖 Rules for AI Agents

- Do not start a migration before the baseline (Phase 0) exists.
- Never change the viewports or the configuration after the baseline.
- Always compare against the baseline and within the same viewport.
- Never submit an order without explicit confirmation by the user.
- On production systems never submit an order and never create a user – under no circumstances,
  not even on request during a run.
- Never store or log credentials entered by the user.
- Report a migration as done only when the exit criteria are met.
