---
applyTo: '**/migration*.{js,ts}'
---

# PWA Migration - Regression Testing of Customized Projects

Human-readable guide: `docs/guides/regression-testing-guide.md`. Guided execution: `.github/skills/pwa-regression-testing.SKILL.md`.

## When This Applies

As soon as the PWA is a **customer or partner project** (not the standard PWA), every custom feature and every
overridden page must work exactly as before the migration. This is proven by testing the project **before**
the migration (baseline), testing it again **after** the migration under identical conditions, and explaining
every difference.

## Non-Negotiable Rules

1. **No migration without a baseline.** Do not start the first migration step (merge, cherry-pick, `migrate-custom-branch.js`) before Phase 0 is complete. If the user wants to skip it, explain the risk and ask for explicit confirmation.
2. **Same conditions before and after:** same ICM, same test data, same channel/locale, same build mode, same viewports, same products, same selection.
3. **The configuration is locked after the baseline.** Never change viewports, environment, order types, My Account, user account mode, masks or test data afterwards. If a change is unavoidable, a new baseline is required.
4. **Compare only within the same viewport, and always against the baseline** – never against the previous after run.
5. **Never submit an order without explicit confirmation** by the user, given right before the submission (default: No).
6. **Production systems are read-only:** never submit an order and never create a user – under no circumstances, not even if asked during a run.
7. **Never store, log or echo credentials** the user enters during the tests.
8. **Not done while unintended differences are open** (see Exit Criteria).

## Process

```
Phase 0  Baseline – on the UNCHANGED project state, before any migration change
         0.1 Ask the test selection (environment, viewports, order types, My Account, user account)
         0.2 Run all Jest tests → store results
         0.3 Inventory: custom + overridden pages/features → test plan → review with the team
         0.4 Browser tests + screenshots "before"
Phase 1  Migration (regular toolkit workflow)
Phase 2  Same browser tests + Jest "after" (new round, never overwrite)
Phase 3  Compare with the baseline → list of differences
Phase 4  Triage every difference: intended | unintended (bug) → fix | won't fix
Phase 5  Fix ALL unintended differences decided as "fix"
Phase 6  New after round + compare against the baseline → back to Phase 4 until the exit criteria are met
```

Track the phases with `migration-progress.js` (step IDs `regression-*`, see `migration-progress.instructions.md`).

If the toolkit provides `regression:*` npm scripts, use them. Otherwise perform the phases directly with
Playwright (optional toolkit dependency, browser: `npx playwright install chromium`) following the rules below.

## Phase 0.1 – Test Selection (ask the user)

Ask **one question at a time** and wait for the answer. Store the answers in `migration-qa/regression.config.json`.

| # | Question | Options | Ask when |
|---|---|---|---|
| 1 | Against which environment do the tests run? | test / UAT system · production system (read-only) | always |
| 2 | Which viewports? (multiple) | mobile · tablet · desktop – at least one | always |
| 3 | Which order types? (multiple) | order as guest · order as registered user – none is allowed | always |
| 4 | Test My Account? | yes · no | always |
| 5 | User account? | create a new user · I enter my credentials during the tests | only if "order as registered user" or "My Account" is selected – on production only the second option exists, do not offer the first |

Also ask for the **URL of the PWA** for the baseline. Recommend a test/UAT system; production is allowed read-only.

Configuration example:

```json
{
  "baseUrl": "https://shop-uat.example.com",
  "environment": "test",
  "viewports": ["mobile", "desktop"],
  "orders": ["guest", "user"],
  "myAccount": true,
  "account": "new",
  "headed": false,
  "settings": { "deviceScaleFactor": 1, "locale": "en-US", "timezoneId": "Europe/Berlin", "reducedMotion": "reduce" },
  "mask": [],
  "testData": { "guest": { "email": "regression-test@example.com", "firstName": "Test", "lastName": "Regression", "addressLine1": "Teststreet 1", "postalCode": "12345", "city": "Testcity", "countryCode": "DE" } },
  "baseline": { "run": "2026-11-10-before" }
}
```

`headed` is `true` when the user enters credentials manually (the browser must be visible). Use the same
headed/headless mode for all runs – it influences rendering.

## Viewports

**The viewport is decisive.** Use exactly these sizes (CSS px), deliberately away from the Bootstrap breakpoints:

| Viewport | Size | Additional settings |
|---|---|---|
| mobile | 390 × 844 | `isMobile`, `hasTouch`, mobile user agent (so SSR renders the mobile layout) |
| tablet | 820 × 1180 | `isMobile`, `hasTouch` |
| desktop | 1920 × 1080 | – |

Fixed for all viewports: device scale factor 1, locale, time zone, reduced motion. Every selected viewport runs
the **complete** test sequence in its own browser context.

## Phase 0.2 – Jest

Run all unit tests once on the unchanged project and store the JSON result with the run:

```bash
npx jest --ci --silent --json --outputFile=migration-qa/runs/<run>/jest-results.json
```

Tests that already fail before the migration are documented, not fixed in this phase.

## Phase 0.3 – Inventory and Test Plan

Determine what the project created or overrode compared to the standard PWA of the **source** version:

```bash
# files changed by the project compared to the upstream tag of the source version
git diff --name-status <source-tag> HEAD -- src projects
# overview by category (custom, customized standard, overrides)
node scripts/analyze-customizations.js --target-tag <target-tag> --themes <theme-list> --json
```

- **Custom files**: files that do not exist in the upstream tag.
- **Customized standard files**: modified standard files.
- **Theme overrides**: `*.<theme>.html|ts|scss` next to a standard file.

Map the files to pages: page components and routing modules (`src/app/pages/**`, `*-routing.module.ts`,
extension routing), and components to the pages that use their selector. Global styles and shell components
(header, footer) are covered by the happy path.

Write the test plan:

- `migration-qa/test-plan.json` – entries `{ id, title, route, url, requiresLogin, coveredBy, enabled, reasons: [files] }`
- `migration-qa/test-plan.md` – readable list for the team

Mark entries already covered by a happy path step with `coveredBy` (e.g. `"03-product-1"`). Routes with
parameters need a concrete URL from the user. **Review the test plan with the user before the baseline run**
and let them add pages the analysis cannot find (CMS-only pages, special customer flows).

## Phase 0.4 / 2 – Test Sequence

```
for each selected viewport:
  01  Homepage
  02  Category / navigation   → remember product 1 AND product 2 from the product list
  03  Open product 1          → product detail page
  04  Add product 1 to basket
  05  Header search           → type the name of product 2: suggestions → search result page
  06  Open product 2          → from the search result
  07  Add product 2 to basket → basket (2 products)
  08a [order as guest]        guest checkout: address → shipping → payment → review → (confirmation)
  08b [order as reg. user]    login → basket → address → shipping → payment → review → (confirmation)
  09  [My Account]            login (if needed) → overview and every page of the account navigation
  10  pages from the test plan (enabled, with URL, not covered by the happy path)
```

- **Products** come from the product list of the category – no configured SKUs or search terms. Prefer simple orderable products (enabled add-to-cart button, no product set or bundle – they add several basket lines). Product 2 is a different product than product 1; if the category has only one, take product 2 from another category; if none exists, skip steps 05–07 and record the reason.
- **Search**: capture the suggestion layer and the search result page; check that product 2 is in the result. A missing product is a difference, not only a screenshot detail. A search that redirects directly to the product page is recorded as a note.
- **Same path in every run**: the baseline records the category path (link texts + URLs), both products (SKU, name, URL) and the visited account and test plan pages in `run-log.json`. All after runs follow exactly this path.
- No order type selected → the happy path ends at the basket.
- If guest checkout is not available in the shop (feature `guestCheckout` disabled), record the step as skipped with the reason.
- Prefer real clicks (header link, product tile, search result link, mini basket). If an element cannot be clicked, navigate by URL and record `via: "url"` – a click that worked before and fails after the migration is a difference.

### User account

- **Create a new user** (test systems only): register once during the baseline via the regular PWA registration with a unique e-mail (timestamp); store the credentials in `migration-qa/.credentials.json` (git-ignored) and reuse the same user in all after runs.
- **Credentials entered during the tests**: visible browser, pause on the login page, tell the user to log in, wait until the URL leaves `/login`. Reuse the session (storage state, in memory only) for all viewports of the run. Never store or log the credentials.
- Leftover items in the user's basket (from earlier runs) make screenshots incomparable: remove them automatically for a created test user on a test system, otherwise ask the user first.

### Order submission

Every checkout stops on the **review page**. Capture it, then – on test systems only – ask:

```
⚠ ATTENTION: This will submit a REAL order!
  ICM:         <ICM host>
  Order type:  guest | registered user <email>
  Viewport:    <viewport> (<size>)
  Basket:      <n> items, total <total>
  Payment:     <payment method>

Submit the order now? (y/N)
```

Default is **No**. Only on "yes": accept the terms and conditions checkbox, submit, capture the confirmation
page. Record per checkout whether the order was submitted. The confirmation page is only compared if it exists
in both runs; otherwise report a note, not a difference.

### Production mode

- The checkout ends on the review page; the submit button is never clicked and the question is not asked.
- No user is created; "create a new user" is rejected.
- Additionally block at network level (Playwright `context.route`) every `POST` to the ICM REST API whose path ends with `/orders` (order creation) or `/customers` / `/privatecustomers` (registration). On a blocked request: abort it, stop the run, record the attempt.
- Show at the start of every run: `🔒 PRODUCTION MODE (read-only): no orders are submitted, no users are created.`

## Selectors (standard PWA)

Use stable `data-testing-id` attributes and component tags – never translated button texts.

| Purpose | Selector |
|---|---|
| Cookie banner – accept (same in every run) | `[data-testing-id="acceptAllButton"]` |
| Home page | `ish-home-page` (height 0 – wait for *attached*, not visible) |
| Top level categories | `a.main-navigation-link` (`[data-testing-id="<categoryId>-link"]`); mobile: open `.navbar-toggler` first |
| Sub categories | `ish-category-page a[href*="ctg"]`, `ish-category-categories a[href*="ctg"]` |
| Product tiles | `ish-product-item` → `[data-testing-sku]`, `a.product-title` |
| Product detail | `ish-product-detail`, add to cart `[data-testing-id="addToCartButton"]` (wait for `POST …/baskets/*/items`) |
| Search input | `input.searchTerm` (mobile: `.search-toggler` first) |
| Search suggestions | `.search-suggest-container`, `.search-suggest-results`, `.search-suggest-terms` |
| Basket | `ish-shopping-basket`, `[data-testing-id="cart-page"]`, line items `ish-line-item-list-element` |
| Start checkout | `[data-testing-id="cart-page"] button.btn-lg.btn-primary:not([disabled])` |
| Guest checkout | `button[data-testing-id="guest-checkout-button"]`, form `[data-testing-id="create-address-form"]` |
| Address fields | `[data-testing-id="countryCode|firstName|lastName|addressLine1|postalCode|city|email"]` – country first; `countryCode` can be `<select>` or `<ng-select>` (first option is the placeholder) |
| Continue checkout | last visible `button.btn-primary` in `ish-checkout-(address|shipping|payment)-page`; newer versions continue directly from the guest address to shipping |
| Payment | `#paymentOption_ISH_INVOICE` etc., otherwise the first radio in `ish-checkout-payment-page` |
| Review / submit | `ish-checkout-review-page`, `input[data-testing-id="termsAndConditions"]`, `button.btn-primary[type="submit"]` |
| Login | `input[data-testing-id="login"]`, `input[data-testing-id="password"]`, `button[name="login"]` |
| Registration | `[data-testing-id="account-create-full-page"]` |
| Account navigation | `ish-account-navigation a[href^="/account"]` (mobile: `option[value^="/account"]`) |
| Loading overlay | `.loading` |

Customer projects can change markup: if a selector does not match, check the project templates and record the
project-specific selector in `regression.config.json` before the baseline.

## Screenshots

- Before every screenshot: wait for `networkidle`, no `.loading`, `document.fonts.ready`; scroll through the page to trigger lazy loading, scroll back to the top, short pause.
- Full-page screenshots; overlays (search suggestions, add-to-basket feedback) as viewport screenshots without scrolling.
- `animations: 'disabled'`, `caret: 'hide'`; mask dynamic areas (sliders, dates, random recommendations) via `mask` selectors – decided before the baseline.
- Per step also record console errors (`console` type error, `pageerror`) and failed requests (status ≥ 400, request failures).
- Naming: `migration-qa/runs/<YYYY-MM-DD>-before|after[-n]/<viewport>/<step-id>.png`, step IDs as in the sequence (e.g. `02-category-1`, `05-search-suggestions`, `08a-6-review`, `09-account-orders`, `10-P-003-store-finder`).
- Runs never overwrite each other. `run-log.json` per run: base URL, environment, git branch/HEAD, PWA version, ICM host, path, steps (status ok/failed/skipped, via, note, URL, screenshot, console errors, failed requests), orders (submitted yes/no + reason), blocked requests, Jest summary.

## Phase 3 – Compare

Compare an after run with the **baseline**, per viewport and step:

- **Visual**: pixel diff (e.g. pixelmatch, threshold ~0.1); report the share of differing pixels and changed page heights; ignore anti-aliasing noise below a small ratio. Produce before | after | diff images side by side (HTML report in `migration-qa/reports/<before>-vs-<after>/`).
- **Functional**: step status changes (ok → failed/skipped), `via` changes (click → url), missing product in the search result, different basket line count.
- **Console errors / failed requests**: new entries compared to the baseline (normalize IDs and query strings).
- **Jest**: new failures, fixed tests, added/removed tests.

## Phase 4 – Triage and Documentation

Every difference becomes an entry in `migration-qa/findings.md` (committed, extended every round, never overwritten):

| ID | Step | Viewport | Type | Description | Classification | Cause | Decision | Status | Reference | Found | Last seen |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F-001 | 03-product-1 | mobile | visual | page 8 px higher, pagination bullets larger | unintended | upstream SCSS overwrote custom bullet styles | fix | open | – | after | after |

- **Type**: visual · functional · console · request · jest
- **Classification**: intended (needs a justification, ideally an upstream changelog/migration note reference) · unintended (bug)
- **Decision**: fix · won't fix (reason + who decided – agree with project lead / customer)
- **Status**: open → fixed → verified · accepted (intended or won't fix)

Present each difference to the user with the **before, after and diff image** and propose a classification
and cause – ask **one question at a time**. Typical causes to check first: upstream changes in global styles,
theme override files that did not receive an upstream fix (`*.<theme>.*` siblings), changed DOM structure or CSS
classes in upstream templates that custom SCSS relies on, lost null guards or feature toggles.

## Phase 5 / 6 – Fix and Compare Again

1. Fix **all** unintended differences decided as "fix" first – do not re-test after every single fix.
2. Run a new after round (`after-2`, `after-3`, …) under the same conditions.
3. Compare against the **baseline**; update `findings.md`: fixed differences that disappeared → verified; still present → open again; new differences → triage (Phase 4).
4. Repeat until the exit criteria are met. Only report differences that remain; if none remain, say so and continue.

## Exit Criteria

- No finding with classification *unintended* and status *open* or *fixed* (not yet verified)
- Every *intended* and *won't fix* entry has a justification
- No new Jest failures compared to the baseline
- No new console errors or failed requests compared to the baseline (or documented as findings)

## Files

```
migration-qa/
├── regression.config.json   # selection, locked after the baseline   (commit)
├── test-plan.json / .md     # reviewed test plan                     (commit)
├── findings.md              # triage log                             (commit)
├── .credentials.json        # only "create a new user"               (git-ignore)
├── runs/                    # screenshots, run-log.json, Jest        (git-ignore)
└── reports/                 # comparison reports                     (git-ignore)
```

Add to the project's `.gitignore`: `migration-qa/.credentials.json`, `migration-qa/runs/`, `migration-qa/reports/`.
