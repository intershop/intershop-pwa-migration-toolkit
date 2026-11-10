#!/usr/bin/env node

/**
 * Regression Capture: Browser tests + screenshots (before / after the migration)
 *
 * Runs the happy path and the pages of the test plan in every configured
 * viewport, takes a screenshot per step and records console errors and
 * failed requests. Also runs all Jest tests of the project.
 *
 *   1. Homepage
 *   2. Category / navigation   → remember product 1 and product 2
 *   3. Open product 1
 *   4. Add product 1 to basket
 *   5. Header search           → search for product 2
 *   6. Open product 2          → from the search result
 *   7. Add product 2 to basket → basket
 *   8a. Guest checkout / 8b. Registered user checkout (stops on the review page)
 *   9. My Account
 *   10. Pages from the test plan
 *
 * The baseline run (--label before) discovers the category path and the two
 * products. All after runs follow exactly the same path.
 *
 * Safety: requests that create orders or customers are blocked at network
 * level. An order is only submitted after explicit confirmation – never in
 * production mode, where also no user is created.
 *
 * See docs/guides/regression-testing-guide.md
 *
 * Usage:
 *   node scripts/regression-capture.js --label <before|after> [OPTIONS]
 *
 * Options:
 *   --label <before|after>   Baseline (before the migration) or after run
 *   --base-url <url>         PWA URL for this run (default: baseUrl from the configuration)
 *   --skip-jest              Do not run the Jest tests
 *   --force-new-baseline     Replace an existing baseline (all after runs become invalid)
 *   --project-dir <dir>      Path to PWA project (default: cwd)
 *   --help                   Show this help message
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { log, askInput, execSilent, chalk } = require('./_utils');
const { projectDir } = require('./_project-dir');
const {
  MOBILE_USER_AGENT,
  ORDER_CREATION,
  CUSTOMER_CREATION,
  qaPaths,
  readJson,
  loadConfig,
  saveConfig,
  assertValidConfig,
  configFingerprint,
  isProduction,
  printProductionBanner,
  today,
  nextAfterRunName,
  readRunLog,
  requireOptional,
} = require('./_regression');

// Parse arguments
const args = process.argv.slice(2);
let label = '';
let baseUrlArg = '';
let skipJest = false;
let forceNewBaseline = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--label': label = args[++i]; break;
    case '--base-url': baseUrlArg = args[++i]; break;
    case '--skip-jest': skipJest = true; break;
    case '--force-new-baseline': forceNewBaseline = true; break;
    case '--project-dir': i++; break; // handled by _project-dir.js
    case '--help':
      console.log(`Usage: node scripts/regression-capture.js --label <before|after> [OPTIONS]

Options:
  --label <before|after>   Baseline (before the migration) or after run
  --base-url <url>         PWA URL for this run (default: baseUrl from the configuration)
  --skip-jest              Do not run the Jest tests
  --force-new-baseline     Replace an existing baseline (all after runs become invalid)
  --project-dir <dir>      Path to PWA project (default: cwd)

Examples:
  # Baseline before the migration
  node scripts/regression-capture.js --label before

  # After the migration, against the locally running migrated PWA
  node scripts/regression-capture.js --label after --base-url http://localhost:4200`);
      process.exit(0);
  }
}

if (!['before', 'after'].includes(label)) {
  log.error('Please specify --label before or --label after');
  process.exit(1);
}

// ─── Setup ──────────────────────────────────────────────────────────────────

const config = loadConfig(projectDir);
if (baseUrlArg) config.baseUrl = baseUrlArg.replace(/\/+$/, '');
assertValidConfig(config);

const paths = qaPaths(projectDir);
const production = isProduction(config);
const isBaseline = label === 'before';
const fingerprint = configFingerprint(config);

let baselinePath = null;
if (isBaseline) {
  if (config.baseline && !forceNewBaseline) {
    log.error(`A baseline already exists: ${config.baseline.run}`);
    log.info('Use --label after for the runs after the migration, or --force-new-baseline to replace the baseline.');
    process.exit(1);
  }
} else {
  if (!config.baseline) {
    log.error('No baseline found. Run --label before first (on the unchanged project state).');
    process.exit(1);
  }
  if (config.baseline.fingerprint !== fingerprint) {
    log.error('The configuration differs from the baseline (viewports, environment, order types, My Account, user account, settings, mask or test data).');
    log.info('Before and after runs must use exactly the same configuration. Restore it or create a new baseline.');
    process.exit(1);
  }
  baselinePath = readRunLog(projectDir, config.baseline.run).path;
}

const runName = isBaseline ? `${today()}-before` : nextAfterRunName(projectDir);
const runDir = path.join(paths.runs, runName);
if (fs.existsSync(runDir)) fs.rmSync(runDir, { recursive: true, force: true });
fs.mkdirSync(runDir, { recursive: true });

const runLog = {
  run: runName,
  label,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  baseUrl: config.baseUrl,
  environment: config.environment,
  fingerprint,
  icmHost: null,
  git: {
    branch: execSilent(`git -C "${projectDir}" rev-parse --abbrev-ref HEAD`),
    head: execSilent(`git -C "${projectDir}" rev-parse --short HEAD`),
    dirty: execSilent(`git -C "${projectDir}" status --porcelain`) !== '',
  },
  pwaVersion: readProjectVersion(),
  path: baselinePath,
  jest: null,
  orders: [],
  steps: [],
  violations: [],
};

function readProjectVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8')).version || null;
  } catch {
    return null;
  }
}

function writeRunLog() {
  fs.writeFileSync(path.join(runDir, 'run-log.json'), `${JSON.stringify(runLog, null, 2)}\n`);
}

// ─── Jest ───────────────────────────────────────────────────────────────────

function runJest() {
  log.section('Jest');
  log.info('Running all Jest tests of the project (this can take several minutes)…');
  const outputFile = path.join(runDir, 'jest-results.json');
  const result = spawnSync('npx', ['jest', '--ci', '--silent', '--json', `--outputFile=${outputFile}`], {
    cwd: projectDir,
    encoding: 'utf-8',
    shell: process.platform === 'win32',
    maxBuffer: 512 * 1024 * 1024,
  });
  fs.writeFileSync(path.join(runDir, 'jest-output.log'), `${result.stdout || ''}${result.stderr || ''}`);

  const summary = { exitCode: result.status, file: null, total: null, passed: null, failed: null, pending: null };
  if (fs.existsSync(outputFile)) {
    const json = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    Object.assign(summary, {
      file: 'jest-results.json',
      total: json.numTotalTests,
      passed: json.numPassedTests,
      failed: json.numFailedTests,
      pending: json.numPendingTests,
    });
    const msg = `Jest: ${summary.passed}/${summary.total} passed, ${summary.failed} failed, ${summary.pending} skipped`;
    if (summary.failed) log.warning(msg);
    else log.success(msg);
  } else {
    log.warning('Jest did not produce results – see jest-output.log in the run folder.');
  }
  return summary;
}

// ─── Browser helpers ────────────────────────────────────────────────────────

const guard = { allowOrder: false, allowCustomer: false };

class FatalError extends Error {}

async function newContext(browser, viewportName, storageState) {
  const vp = config.viewportSizes[viewportName];
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: config.settings.deviceScaleFactor,
    isMobile: vp.isMobile,
    hasTouch: vp.hasTouch,
    userAgent: viewportName === 'mobile' ? MOBILE_USER_AGENT : undefined,
    locale: config.settings.locale,
    timezoneId: config.settings.timezoneId,
    reducedMotion: config.settings.reducedMotion,
    storageState,
  });

  // Network guard: block order and customer creation unless explicitly allowed
  await context.route('**/*', route => {
    const request = route.request();
    if (request.method() === 'POST') {
      const { pathname } = new URL(request.url());
      const isOrder = ORDER_CREATION.pattern.test(pathname);
      const isCustomer = CUSTOMER_CREATION.pattern.test(pathname);
      const allowed = !production && ((isOrder && guard.allowOrder) || (isCustomer && guard.allowCustomer));
      if ((isOrder || isCustomer) && !allowed) {
        runLog.violations.push({
          time: new Date().toISOString(),
          viewport: viewportName,
          type: isOrder ? 'order creation' : 'customer creation',
          url: request.url().split('?')[0],
        });
        writeRunLog();
        return route.abort('blockedbyclient');
      }
    }
    return route.continue();
  });
  return context;
}

/** Collects console errors and failed requests of a page between two take() calls. */
function attachCollector(page) {
  let consoleErrors = [];
  let failedRequests = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 500));
  });
  page.on('pageerror', err => consoleErrors.push(`pageerror: ${String(err.message).slice(0, 500)}`));
  page.on('response', response => {
    const url = response.url();
    if (!runLog.icmHost && url.includes('/INTERSHOP/rest/')) runLog.icmHost = new URL(url).origin;
    if (response.status() >= 400) {
      failedRequests.push(`${response.request().method()} ${response.status()} ${url.split('?')[0]}`);
    }
  });
  page.on('requestfailed', request => {
    const failure = request.failure();
    failedRequests.push(`${request.method()} failed (${failure ? failure.errorText : 'unknown'}) ${request.url().split('?')[0]}`);
  });
  return {
    take() {
      const result = { consoleErrors, failedRequests };
      consoleErrors = [];
      failedRequests = [];
      return result;
    },
  };
}

function abs(href) {
  return new URL(href, `${config.baseUrl}/`).toString();
}

async function waitNoLoading(page) {
  await page.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 20000 }).catch(() => {});
}

/** Wait until the page is settled: network idle, no loading overlay, fonts, lazy content. */
async function stabilize(page, { scroll = true } = {}) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await waitNoLoading(page);
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  if (scroll) {
    // scroll through the page to trigger lazy loading, then back to the top
    await page.evaluate(async () => {
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
      for (let y = 0; y < document.body.scrollHeight && y < 30000; y += window.innerHeight) {
        window.scrollTo(0, y);
        await delay(150);
      }
      window.scrollTo(0, 0);
      await delay(300);
    }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await waitNoLoading(page);
  }
  await page.waitForTimeout(500);
}

async function acceptCookies(page) {
  const button = page.locator('[data-testing-id="acceptAllButton"]').first();
  const visible = await button.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
  if (visible) {
    await button.click();
    await page.waitForTimeout(500);
  }
}

async function goto(page, url) {
  try {
    await page.goto(abs(url), { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (err) {
    // the SPA can interrupt a navigation (net::ERR_ABORTED) – retry once
    if (!/ERR_ABORTED|interrupted/.test(err.message)) throw err;
    await page.waitForTimeout(1000);
    await page.goto(abs(url), { waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
}

/** Click a visible link with the given href; fall back to direct navigation. Returns 'click' or 'url'. */
async function navigate(page, href, scope = 'body') {
  const selector = scope.split(',').map(s => `${s.trim()} a[href="${href}"]`).join(', ');
  const link = page.locator(selector).filter({ visible: true }).first();
  if (await link.count()) {
    await link.click();
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    return 'click';
  }
  await goto(page, href);
  return 'url';
}

async function openMobileNavigation(page) {
  const toggler = page.locator('.navbar-toggler').filter({ visible: true }).first();
  if (await toggler.count()) {
    await toggler.click();
    await page.waitForTimeout(500);
  }
}

async function listProducts(page) {
  return page.$$eval('ish-product-item', items => items.map(item => {
    const skuEl = item.querySelector('[data-testing-sku]');
    const link = item.querySelector('a.product-title') || item.querySelector('a[href*="prd"]');
    return {
      sku: skuEl ? skuEl.getAttribute('data-testing-sku') : null,
      name: link ? link.textContent.trim().replace(/\s+/g, ' ') : null,
      href: link ? link.getAttribute('href') : null,
    };
  }).filter(p => p.sku && p.name && p.href));
}

async function addToBasket(page) {
  const button = page.locator('ish-product-detail [data-testing-id="addToCartButton"]').filter({ visible: true }).first();
  await button.waitFor({ state: 'visible', timeout: 15000 });
  const response = page.waitForResponse(
    r => r.request().method() === 'POST' && /\/baskets\/[^/]+\/items/.test(new URL(r.url()).pathname),
    { timeout: 30000 }
  );
  await button.click();
  const result = await response;
  if (result.status() >= 400) throw new Error(`add to basket failed: HTTP ${result.status()}`);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
}

async function gotoBasket(page) {
  let link = page.locator('a[href="/basket"]').filter({ visible: true }).first();
  if (!(await link.count())) {
    const miniBasket = page.locator('ish-mini-basket').filter({ visible: true }).first();
    if (await miniBasket.count()) {
      await miniBasket.click().catch(() => {});
      await page.waitForTimeout(500);
      link = page.locator('a[href="/basket"]').filter({ visible: true }).first();
    }
  }
  if (await link.count()) {
    await link.click();
    await page.waitForURL(/\/basket/, { timeout: 20000 }).catch(() => {});
    return 'click';
  }
  await goto(page, '/basket');
  return 'url';
}

async function lineItemCount(page) {
  return page.locator('ish-line-item-list-element').count();
}

async function startCheckout(page) {
  const button = page
    .locator('[data-testing-id="cart-page"] button.btn-lg.btn-primary:not([disabled]), ish-shopping-basket button.btn-lg.btn-primary:not([disabled])')
    .filter({ visible: true })
    .first();
  await button.click();
  await page.waitForURL(/\/checkout/, { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
}

async function visibleError(page) {
  const alerts = page.locator('.alert-danger, ish-basket-validation-results .alert, .invalid-feedback').filter({ visible: true });
  if (!(await alerts.count())) return '';
  return (await alerts.first().innerText()).trim().replace(/\s+/g, ' ').slice(0, 200);
}

/** Click the "continue" button of the current checkout step and wait for the next step. */
async function continueCheckout(page, nextUrl) {
  if (nextUrl.test(page.url())) return; // already there
  const button = page
    .locator('ish-checkout-address-page button.btn-primary, ish-checkout-shipping-page button.btn-primary, ish-checkout-payment-page button.btn-primary')
    .filter({ visible: true })
    .last();
  await button.click();
  const reached = await page.waitForURL(nextUrl, { timeout: 30000 }).then(() => true).catch(() => false);
  if (!reached) {
    const error = await visibleError(page);
    throw new Error(`next checkout step not reached${error ? `: ${error}` : ''}`);
  }
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
}

async function selectFirstOption(field) {
  const tag = await field.evaluate(el => el.tagName);
  if (tag === 'SELECT') {
    const value = await field.evaluate(select => {
      const option = [...select.options].find(o => o.value && !o.disabled);
      return option ? option.value : null;
    });
    if (value) await field.selectOption(value);
  } else if (tag === 'NG-SELECT') {
    await field.click();
    // the selected option is the placeholder ("Please select")
    await field.page().locator('ng-dropdown-panel .ng-option:not(.ng-option-disabled):not(.ng-option-selected)').first().click();
  }
}

/** Select a country by ISO code: by value for <select>, by localized name for <ng-select>. */
async function selectCountry(field, countryCode) {
  const tag = await field.evaluate(el => el.tagName);
  if (tag === 'SELECT') {
    await field.selectOption(countryCode);
    return;
  }
  const name = await field.page().evaluate(code => {
    const lang = document.documentElement.lang || navigator.language || 'en';
    try {
      return new Intl.DisplayNames([lang], { type: 'region' }).of(code);
    } catch {
      return new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
    }
  }, countryCode);
  await field.click();
  await field.locator('input').fill(name);
  const option = field.page().locator('ng-dropdown-panel .ng-option:not(.ng-option-disabled)').first();
  await option.waitFor({ state: 'visible', timeout: 3000 });
  await option.click();
}

/** Fill a (formly) form by data-testing-id; remaining required fields get generic values. */
async function fillForm(page, scope, data) {
  const form = page.locator(scope).first();
  const field = key => form.locator(`[data-testing-id="${key}"]`).first();

  // country first – it can change the remaining address fields
  if (data.countryCode !== undefined && await field('countryCode').count()) {
    const country = field('countryCode');
    if (data.countryCode) {
      await selectCountry(country, data.countryCode).catch(async () => {
        await page.keyboard.press('Escape');
        await selectFirstOption(country);
      });
    } else {
      await selectFirstOption(country);
    }
    await page.waitForTimeout(1000);
  }

  for (const [key, value] of Object.entries(data)) {
    if (key === 'countryCode' || !value) continue;
    const input = field(key);
    if (!(await input.count()) || !(await input.isVisible())) continue;
    const tag = await input.evaluate(el => el.tagName);
    if (tag === 'INPUT' || tag === 'TEXTAREA') await input.fill(String(value));
    else if (tag === 'SELECT') await input.selectOption(String(value)).catch(() => selectFirstOption(input));
  }

  // remaining visible required fields that are still empty
  const missing = await form.evaluate(root => [...root.querySelectorAll('input, select, textarea, ng-select')]
    .filter(el => el.offsetParent !== null)
    .filter(el => (el.tagName === 'NG-SELECT'
      ? el.classList.contains('ng-invalid')
      : (el.required || el.classList.contains('ng-invalid')) && !['checkbox', 'radio'].includes(el.type) && !el.value))
    .map(el => el.getAttribute('data-testing-id'))
    .filter(Boolean));
  for (const key of missing) {
    const input = field(key);
    const tag = await input.evaluate(el => el.tagName);
    if (tag === 'INPUT' || tag === 'TEXTAREA') await input.fill('Test');
    else await selectFirstOption(input);
  }

  // required checkboxes (terms and conditions, privacy policy)
  const checkboxes = form.locator('input[type="checkbox"][required], input[data-testing-id="termsAndConditions"]');
  for (let i = 0; i < await checkboxes.count(); i++) {
    if (await checkboxes.nth(i).isVisible()) await checkboxes.nth(i).check();
  }
}

async function selectPayment(page) {
  const configured = config.testData.paymentMethod;
  if (configured) {
    await page.locator(`#paymentOption_${configured}`).check();
  } else if (!(await page.locator('ish-checkout-payment-page input[type="radio"]:checked').count())) {
    let radio = null;
    for (const id of ['ISH_INVOICE', 'ISH_CASH_ON_DELIVERY', 'ISH_CASH_IN_ADVANCE']) {
      const candidate = page.locator(`#paymentOption_${id}`);
      if (await candidate.count()) {
        radio = candidate;
        break;
      }
    }
    radio = radio || page.locator('ish-checkout-payment-page input[type="radio"]').first();
    if (!(await radio.count())) throw new Error('no payment method available');
    await radio.check();
  }
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await waitNoLoading(page);
}

async function reviewSummary(page) {
  return page.evaluate(() => {
    const text = selector => {
      const el = document.querySelector(selector);
      return el ? el.textContent.trim().replace(/\s+/g, ' ') : null;
    };
    return {
      items: document.querySelectorAll('ish-line-item-list-element').length,
      total: text('.total-price') || text('[data-testing-id="basket-total"]'),
      payment: text('ish-basket-payment-method') || text('[data-testing-id="basket-payment"]'),
    };
  }).catch(() => ({ items: null, total: null, payment: null }));
}

// ─── Step runner ────────────────────────────────────────────────────────────

async function runStep(session, id, title, fn, { fullPage = true, scroll = true } = {}) {
  const { page, viewport, collector } = session;
  const record = { id, title, viewport, status: 'ok', via: null, note: null, url: null, screenshot: null, consoleErrors: [], failedRequests: [] };
  collector.take();
  try {
    const result = await fn(record);
    if (result === false && record.status === 'ok') record.status = 'failed';
  } catch (err) {
    if (err instanceof FatalError) throw err;
    record.status = 'failed';
    record.note = record.note || String(err.message).split('\n')[0].slice(0, 300);
  }

  if (record.status !== 'skipped') {
    try {
      await stabilize(page, { scroll });
      const file = path.join(viewport, `${id}.png`);
      fs.mkdirSync(path.join(runDir, viewport), { recursive: true });
      await page.screenshot({
        path: path.join(runDir, file),
        fullPage,
        animations: 'disabled',
        caret: 'hide',
        mask: (config.mask || []).map(selector => page.locator(selector)),
        timeout: 60000,
      });
      record.screenshot = file.replace(/\\/g, '/');
    } catch (err) {
      record.note = `${record.note ? `${record.note}; ` : ''}screenshot failed: ${String(err.message).split('\n')[0]}`;
    }
    record.url = page.url().replace(config.baseUrl, '');
  }

  Object.assign(record, session.collector.take());
  runLog.steps.push(record);
  writeRunLog();

  const icon = record.status === 'ok' ? chalk.green('✓') : record.status === 'skipped' ? chalk.dim('–') : chalk.red('✗');
  const extra = [record.via === 'url' ? 'direct URL' : null, record.note].filter(Boolean).join(' · ');
  console.log(`  ${icon} ${viewport.padEnd(7)} ${id.padEnd(28)} ${chalk.dim(extra)}`);

  if (runLog.violations.length) {
    throw new FatalError('A request creating an order or a customer was blocked – the run is stopped (see violations in run-log.json).');
  }
  return record;
}

function skipStep(session, id, title, note) {
  return runStep(session, id, title, record => {
    record.status = 'skipped';
    record.note = note;
  });
}

async function openSession(browser, viewport, storageState) {
  const context = await newContext(browser, viewport, storageState);
  const page = await context.newPage();
  const collector = attachCollector(page);
  return { context, page, viewport, collector };
}

// ─── Baseline discovery ─────────────────────────────────────────────────────

/** Find the category path and two orderable products (baseline only). */
async function discoverPath(browser) {
  log.section('Discovering category path and products (baseline)');
  const session = await openSession(browser, config.viewports.includes('desktop') ? 'desktop' : config.viewports[0]);
  const { page } = session;
  await goto(page, '/home');
  await acceptCookies(page);

  let topLinks = await page.$$eval('a.main-navigation-link', links => links.map(a => ({
    text: a.textContent.trim().replace(/\s+/g, ' '),
    href: a.getAttribute('href'),
  })));
  if (!topLinks.length) {
    topLinks = await page.$$eval('header a[href*="ctg"], ish-header a[href*="ctg"]', links => links.map(a => ({
      text: a.textContent.trim().replace(/\s+/g, ' '),
      href: a.getAttribute('href'),
    })));
  }
  topLinks = topLinks.filter((l, i, all) => l.href && all.findIndex(o => o.href === l.href) === i);
  if (!topLinks.length) throw new Error('no category links found in the header navigation');

  const probe = await session.context.newPage();
  // orderable = add-to-cart button enabled; simple = no product set / bundle (one basket line per product)
  const checkProduct = async product => {
    await goto(probe, product.href);
    await waitNoLoading(probe);
    const button = probe.locator('ish-product-detail [data-testing-id="addToCartButton"]').first();
    const visible = await button.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    const orderable = visible && await button.isEnabled();
    // set / bundle components exist on every product page – they only have content for sets and bundles
    const simple = !(await probe.evaluate(() => [...document.querySelectorAll('ish-retail-set-parts, ish-product-bundle-parts')]
      .some(el => el.textContent.trim().length > 0)));
    return { orderable, simple };
  };

  const result = { categorySteps: null, product1: null, product2: null, accountPages: null, planPages: null };
  for (const top of topLinks.slice(0, 10)) {
    // descend into sub categories until a product list is shown
    const steps = [top];
    await goto(page, top.href);
    await waitNoLoading(page);
    let products = await listProducts(page);
    for (let depth = 0; depth < 4 && !products.length; depth++) {
      const visited = new Set(steps.map(s => s.href));
      const subs = await page.$$eval('ish-category-page a[href*="ctg"], ish-category-categories a[href*="ctg"]', links => links
        .filter(a => !a.closest('ish-breadcrumb'))
        .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' '), href: a.getAttribute('href') })));
      const sub = subs.find(s => s.href && !visited.has(s.href));
      if (!sub) break;
      steps.push(sub);
      await goto(page, sub.href);
      await waitNoLoading(page);
      products = await listProducts(page);
    }

    const orderable = [];
    for (const product of products.slice(0, 8)) {
      if (result.product1 && product.sku === result.product1.sku) continue;
      const { orderable: ok, simple } = await checkProduct(product);
      if (ok) orderable.push({ product, simple });
      if (orderable.filter(o => o.simple).length >= 2) break;
    }
    // prefer simple products – sets and bundles add several basket lines
    orderable.sort((a, b) => Number(b.simple) - Number(a.simple));
    for (const { product } of orderable) {
      if (!result.product1) {
        result.product1 = product;
        result.categorySteps = steps;
      } else if (!result.product2) {
        result.product2 = { ...product, categorySteps: steps };
      }
    }
    if (result.product1 && result.product2) break;
  }
  await session.context.close();

  if (!result.product1) throw new Error('no orderable product found via the category navigation');
  log.info(`Category path: ${result.categorySteps.map(s => s.text || s.href).join(' › ')}`);
  log.info(`Product 1:     ${result.product1.name} (${result.product1.sku})`);
  if (result.product2) log.info(`Product 2:     ${result.product2.name} (${result.product2.sku})`);
  else log.warning('No second orderable product found – the search steps (5–7) are skipped.');
  return result;
}

function loadPlanPages() {
  if (!fs.existsSync(paths.testPlanJson)) {
    log.warning('No test plan found (npm run regression:inventory) – only the happy path is tested.');
    return [];
  }
  const plan = readJson(paths.testPlanJson);
  return (plan.entries || [])
    .filter(e => e.enabled && e.url && !e.coveredBy)
    .map(e => ({ id: e.id, title: e.title || e.route || e.url, url: e.url, requiresLogin: !!e.requiresLogin }));
}

// ─── User account ───────────────────────────────────────────────────────────

let loggedInState = null;

function readCredentials() {
  if (!fs.existsSync(paths.credentials)) return null;
  return readJson(paths.credentials);
}

/** Register a new test user (test systems only, baseline only). */
async function registerUser(browser) {
  if (production) throw new FatalError('production mode: creating a user is not allowed');
  log.section('Registering a new test user');
  const session = await openSession(browser, config.viewports.includes('desktop') ? 'desktop' : config.viewports[0]);
  const { page } = session;
  const credentials = {
    login: `regression-${Date.now()}@example.com`,
    password: config.testData.registration.password,
    createdAt: new Date().toISOString(),
    baseUrl: config.baseUrl,
  };
  try {
    await goto(page, '/register');
    await acceptCookies(page);
    await waitNoLoading(page);
    const scope = (await page.locator('[data-testing-id="account-create-full-page"]').count())
      ? '[data-testing-id="account-create-full-page"]'
      : 'ish-registration-page';
    await fillForm(page, scope, {
      ...config.testData.guest,
      email: undefined,
      login: credentials.login,
      loginConfirmation: credentials.login,
      password: credentials.password,
      passwordConfirmation: credentials.password,
    });
    guard.allowCustomer = true;
    const response = page.waitForResponse(
      r => r.request().method() === 'POST' && CUSTOMER_CREATION.pattern.test(new URL(r.url()).pathname),
      { timeout: 30000 }
    );
    await page.locator(`${scope} form button[type="submit"]`).first().click();
    const result = await response.catch(() => null);
    if (!result || result.status() >= 400) {
      const error = await visibleError(page);
      throw new Error(`registration failed${result ? ` (HTTP ${result.status()})` : ''}${error ? `: ${error}` : ''} – use the "manual" account mode if the registration needs a captcha`);
    }
  } finally {
    guard.allowCustomer = false;
    await session.context.close();
  }
  fs.writeFileSync(paths.credentials, `${JSON.stringify(credentials, null, 2)}\n`);
  log.success(`Test user registered: ${credentials.login} (stored in ${path.relative(projectDir, paths.credentials)}, git-ignored)`);
}

/** Log in on the current login page (page must show the login form). */
async function login(page) {
  if (config.account === 'new') {
    const credentials = readCredentials();
    if (!credentials) throw new FatalError(`no test user credentials found (${paths.credentials})`);
    await page.locator('input[data-testing-id="login"]').first().fill(credentials.login);
    await page.locator('input[data-testing-id="password"]').first().fill(credentials.password);
    await page.locator('button[name="login"]').first().click();
    await page.waitForURL(u => !/\/login/.test(new URL(u).pathname), { timeout: 30000 });
  } else {
    console.log();
    log.warning('Please log in now in the browser window. Waiting up to 5 minutes…');
    log.dim('  Your credentials are not stored. The login is reused for all viewports of this run.');
    await page.waitForURL(u => !/\/login/.test(new URL(u).pathname), { timeout: 300000 });
  }
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await waitNoLoading(page);
}

/** Open a logged-in session: the login form is captured, the login itself happens once per run. */
async function openUserSession(browser, viewport, stepId) {
  let session = await openSession(browser, viewport);
  await goto(session.page, '/login?returnUrl=%2Fhome');
  await acceptCookies(session.page);
  await runStep(session, stepId, 'Login', async () => {
    await session.page.locator('input[data-testing-id="login"]').first().waitFor({ state: 'visible', timeout: 15000 });
  });

  if (!loggedInState) {
    await login(session.page);
    loggedInState = await session.context.storageState();
    return session;
  }
  await session.context.close();
  session = await openSession(browser, viewport, loggedInState);
  await goto(session.page, '/home');
  return session;
}

/** Remove leftover line items from the user's basket (e.g. from earlier runs). */
async function cleanUserBasket(page) {
  await goto(page, '/basket');
  await waitNoLoading(page);
  const count = await lineItemCount(page);
  if (!count) return null;

  let remove = config.account === 'new' && !production;
  if (!remove) {
    const answer = await askInput(`The basket of the user contains ${count} item(s) from earlier sessions. Remove them for comparable screenshots? (y/N)`);
    remove = /^(y|yes|j|ja)$/i.test(answer);
  }
  if (!remove) return `basket contained ${count} item(s) before the test`;

  for (let i = 0; i < 30 && await lineItemCount(page); i++) {
    await page.locator('[data-testing-id="remove-line-item"]').filter({ visible: true }).first().click();
    const confirm = page.locator('ish-modal-dialog .btn-primary, .modal-dialog .btn-primary').filter({ visible: true }).first();
    if (await confirm.waitFor({ state: 'visible', timeout: 1500 }).then(() => true).catch(() => false)) await confirm.click();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await waitNoLoading(page);
  }
  return `removed ${count} leftover item(s) from the basket`;
}

// ─── Order submission ───────────────────────────────────────────────────────

async function submitOrderIfConfirmed(session, type) {
  const { page, viewport } = session;
  const order = { viewport, type, submitted: false, reason: null };
  runLog.orders.push(order);

  if (production) {
    order.reason = 'production mode';
    return false;
  }

  const summary = await reviewSummary(page);
  const vp = config.viewportSizes[viewport];
  const credentials = type === 'user' && config.account === 'new' ? readCredentials() : null;
  console.log();
  console.log(chalk.red.bold('  ⚠ ATTENTION: This will submit a REAL order!'));
  console.log(`    ICM:         ${runLog.icmHost || 'unknown'}`);
  console.log(`    Order type:  ${type === 'guest' ? 'guest' : `registered user${credentials ? ` ${credentials.login}` : ''}`}`);
  console.log(`    Viewport:    ${viewport} (${vp.width}×${vp.height})`);
  console.log(`    Basket:      ${summary.items ?? '?'} item(s), total ${summary.total || '?'}`);
  console.log(`    Payment:     ${summary.payment || '?'}`);
  console.log();
  const answer = await askInput('Submit the order now? (y/N)');
  if (!/^(y|yes|j|ja)$/i.test(answer)) {
    order.reason = 'not confirmed';
    return false;
  }

  const tac = page.locator('input[data-testing-id="termsAndConditions"]').first();
  if (await tac.count()) await tac.check();
  guard.allowOrder = true;
  try {
    const response = page.waitForResponse(
      r => r.request().method() === 'POST' && ORDER_CREATION.pattern.test(new URL(r.url()).pathname),
      { timeout: 60000 }
    );
    await page.locator('ish-checkout-review-page button.btn-primary[type="submit"]').filter({ visible: true }).last().click();
    const result = await response;
    if (result.status() >= 400) throw new Error(`order submission failed: HTTP ${result.status()}`);
    order.submitted = true;
    await page.waitForURL(/\/checkout\/receipt/, { timeout: 60000 }).catch(() => {});
  } finally {
    guard.allowOrder = false;
  }
  return true;
}

// ─── Test sequence ──────────────────────────────────────────────────────────

async function checkoutSteps(session, prefix, type) {
  const { page } = session;
  const steps = type === 'guest'
    ? [
      [`${prefix}-1-checkout-start`, 'Checkout start', async r => { r.via = 'click'; await startCheckout(page); }],
      [`${prefix}-2-guest-address-form`, 'Guest address form', async r => {
        const guestButton = page.locator('button[data-testing-id="guest-checkout-button"]').first();
        if (!(await guestButton.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false))) {
          r.status = 'skipped';
          r.note = 'guest checkout not available in this shop (feature "guestCheckout")';
          return;
        }
        await guestButton.click();
        await page.locator('[data-testing-id="create-address-form"]').waitFor({ state: 'visible', timeout: 15000 });
        await fillForm(page, '[data-testing-id="create-address-form"]', { ...config.testData.guest, email: undefined });
        const email = page.locator('ish-checkout-address-page [data-testing-id="email"]').first();
        if (await email.count()) await email.fill(config.testData.guest.email);
      }],
      [`${prefix}-3-address`, 'Checkout address', async r => {
        await page.locator('[data-testing-id="create-address-form"] button[type="submit"]').first().click();
        // older versions stay on the address page, newer ones continue directly to shipping
        await Promise.race([
          page.locator('[data-testing-id="invoiceToAddress"]').first().waitFor({ state: 'visible', timeout: 30000 }),
          page.waitForURL(/\/checkout\/shipping/, { timeout: 30000 }),
        ]);
        if (/\/checkout\/shipping/.test(page.url())) r.note = 'continued directly to shipping';
      }],
    ]
    : [
      [`${prefix}-3-address`, 'Checkout address', async r => { r.via = 'click'; await startCheckout(page); }],
    ];

  steps.push(
    [`${prefix}-4-shipping`, 'Checkout shipping', async () => continueCheckout(page, /\/checkout\/shipping/)],
    [`${prefix}-5-payment`, 'Checkout payment', async () => {
      await continueCheckout(page, /\/checkout\/payment/);
      await selectPayment(page);
    }],
    [`${prefix}-6-review`, 'Checkout review', async () => continueCheckout(page, /\/checkout\/review/)],
  );

  for (const [id, title, fn] of steps) {
    const record = await runStep(session, id, title, fn);
    if (record.status !== 'ok') return;
  }

  let submitted = false;
  try {
    submitted = await submitOrderIfConfirmed(session, type);
  } catch (err) {
    if (err instanceof FatalError) throw err;
    runLog.orders[runLog.orders.length - 1].reason = err.message;
  }
  const order = runLog.orders[runLog.orders.length - 1];
  if (submitted) {
    await runStep(session, `${prefix}-7-confirmation`, 'Order confirmation', async () => {});
  } else {
    await skipStep(session, `${prefix}-7-confirmation`, 'Order confirmation', `order not submitted (${order.reason})`);
  }
}

async function runViewport(browser, viewport) {
  log.section(`Viewport ${viewport} (${config.viewportSizes[viewport].width}×${config.viewportSizes[viewport].height})`);
  const route = runLog.path;
  const session = await openSession(browser, viewport);
  const { page } = session;

  try {
    // 1. Homepage
    await goto(page, '/home');
    await acceptCookies(page);
    await runStep(session, '01-home', 'Homepage', async () => {
      await page.locator('ish-home-page').first().waitFor({ state: 'attached', timeout: 15000 });
    });

    // 2. Category / navigation
    let categoryOk = true;
    for (let i = 0; i < route.categorySteps.length; i++) {
      const link = route.categorySteps[i];
      const record = await runStep(session, `02-category-${i + 1}`, `Category ${link.text || link.href}`, async r => {
        if (i === 0) {
          const visible = await page.locator(`a[href="${link.href}"]`).filter({ visible: true }).count();
          if (!visible) await openMobileNavigation(page);
          r.via = await navigate(page, link.href, 'header, ish-header');
        } else {
          r.via = await navigate(page, link.href, 'ish-category-page, ish-category-categories');
        }
        await page.waitForURL(u => u.href.includes(link.href.split('?')[0]), { timeout: 30000 });
      });
      if (record.status !== 'ok') categoryOk = false;
    }

    // 3. Open product 1
    await runStep(session, '03-product-1', `Product 1: ${route.product1.name}`, async r => {
      r.via = categoryOk ? await navigate(page, route.product1.href, 'ish-product-listing, ish-category-page, main') : (await goto(page, route.product1.href), 'url');
      await page.locator('ish-product-detail').first().waitFor({ timeout: 20000 });
    });

    // 4. Add product 1 to basket
    await runStep(session, '04-add-product-1', 'Add product 1 to basket', () => addToBasket(page), { fullPage: false, scroll: false });

    // 5.–7. Header search for product 2, open it, add it to basket
    if (route.product2) {
      const p2 = route.product2;
      const encodedSku = encodeURIComponent(p2.sku);
      let foundInResult = false;
      await runStep(session, '05-search-suggestions', `Search suggestions: ${p2.name}`, async r => {
        await page.evaluate(() => window.scrollTo(0, 0));
        let input = page.locator('input.searchTerm').filter({ visible: true }).first();
        if (!(await input.count())) {
          await page.locator('.search-toggler').filter({ visible: true }).first().click().catch(() => {});
          await page.waitForTimeout(500);
          input = page.locator('input.searchTerm').filter({ visible: true }).first();
        }
        await input.click();
        await input.fill('');
        await input.pressSequentially(p2.name, { delay: 40 });
        const suggestions = page.locator('.search-suggest-container, .search-suggest-results, .search-suggest-terms').filter({ visible: true }).first();
        const shown = await suggestions.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
        if (!shown) r.note = 'no search suggestions shown';
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1000);
      }, { fullPage: false, scroll: false });

      await runStep(session, '05-search-result', 'Search result', async r => {
        const input = page.locator('input.searchTerm').filter({ visible: true }).first();
        await input.press('Enter');
        await page.waitForURL(u => /\/search\//.test(u.pathname) || u.href.includes(`prd${encodedSku}`) || u.href.includes(`prd${p2.sku}`), { timeout: 30000 });
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
        await waitNoLoading(page);
        if (/prd/.test(new URL(page.url()).pathname)) {
          foundInResult = true;
          r.note = 'search redirected directly to the product';
          return;
        }
        foundInResult = (await page.locator(`[data-testing-sku="${p2.sku}"]`).count()) > 0
          || (await page.locator(`a[href*="prd${encodedSku}"]`).count()) > 0;
        if (!foundInResult) {
          r.status = 'failed';
          r.note = `product 2 (${p2.sku}) not found in the search result`;
        }
      });

      await runStep(session, '06-product-2', `Product 2: ${p2.name}`, async r => {
        if (!/prd/.test(new URL(page.url()).pathname)) {
          const link = page.locator(`ish-product-listing a[href*="prd${encodedSku}"], ish-search-page a[href*="prd${encodedSku}"]`).filter({ visible: true }).first();
          if (foundInResult && await link.count()) {
            await link.click();
            r.via = 'click';
          } else {
            await goto(page, p2.href);
            r.via = 'url';
          }
        }
        await page.locator('ish-product-detail').first().waitFor({ timeout: 20000 });
      });

      await runStep(session, '07-add-product-2', 'Add product 2 to basket', () => addToBasket(page), { fullPage: false, scroll: false });
    } else {
      for (const [id, title] of [['05-search-suggestions', 'Search suggestions'], ['05-search-result', 'Search result'], ['06-product-2', 'Product 2'], ['07-add-product-2', 'Add product 2 to basket']]) {
        await skipStep(session, id, title, 'no second orderable product found in the baseline');
      }
    }

    await runStep(session, '07-basket', 'Basket', async r => {
      r.via = await gotoBasket(page);
      await page.locator('ish-shopping-basket, [data-testing-id="cart-page"]').first().waitFor({ timeout: 20000 });
      const count = await lineItemCount(page);
      const expected = route.product2 ? 2 : 1;
      if (count !== expected) r.note = `basket contains ${count} line item(s), expected ${expected}`;
    });

    // 8a. Guest checkout
    if (config.orders.includes('guest')) {
      await checkoutSteps(session, '08a', 'guest');
    }
  } finally {
    await session.context.close();
  }

  // 8b. Registered user checkout / 9. My Account
  let userSession = null;
  if (config.orders.includes('user') || config.myAccount) {
    try {
      userSession = await openUserSession(browser, viewport, config.orders.includes('user') ? '08b-1-login' : '09-0-login');
    } catch (err) {
      if (err instanceof FatalError) throw err;
      const loginStep = runLog.steps[runLog.steps.length - 1];
      loginStep.status = 'failed';
      loginStep.note = `login failed: ${String(err.message).split('\n')[0]}`;
      writeRunLog();
      log.warning(`  Login failed (${viewport}) – registered user checkout and My Account are skipped.`);
    }
  }
  try {
    if (userSession && config.orders.includes('user')) {
      const record = await runStep(userSession, '08b-2-basket', 'Basket (registered user)', async r => {
        const { page } = userSession;
        r.note = await cleanUserBasket(page);
        await goto(page, route.product1.href);
        await addToBasket(page);
        if (route.product2) {
          await goto(page, route.product2.href);
          await addToBasket(page);
        }
        r.via = await gotoBasket(page);
        await page.locator('ish-shopping-basket, [data-testing-id="cart-page"]').first().waitFor({ timeout: 20000 });
      });
      if (record.status === 'ok') await checkoutSteps(userSession, '08b', 'user');
    }

    // 9. My Account
    if (userSession && config.myAccount) {
      const { page } = userSession;
      await goto(page, '/account');
      await runStep(userSession, '09-account', 'My Account', async () => {
        await page.waitForURL(/\/account/, { timeout: 20000 });
      });
      if (!route.accountPages) {
        route.accountPages = await page.$$eval(
          'ish-account-navigation a[href^="/account"], ish-account-navigation option[value^="/account"]',
          els => els.map(el => el.getAttribute('href') || el.getAttribute('value'))
        );
        route.accountPages = [...new Set(route.accountPages)].filter(href => href !== '/account' && !/logout/.test(href));
      }
      for (const href of route.accountPages) {
        const slug = href.replace(/^\/account\/?/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'overview';
        await runStep(userSession, `09-account-${slug}`, `My Account ${href}`, async r => {
          await goto(page, href);
          r.via = 'url';
        });
      }
    }
  } finally {
    if (userSession) await userSession.context.close();
  }

  // 10. Pages from the test plan
  for (const entry of route.planPages || []) {
    const slug = entry.url.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'root';
    const id = `10-${entry.id}-${slug}`;
    if (entry.requiresLogin && !loggedInState) {
      const planSession = await openSession(browser, viewport);
      await skipStep(planSession, id, entry.title, 'requires login – select "order as registered user" or "My Account" to test it');
      await planSession.context.close();
      continue;
    }
    const planSession = await openSession(browser, viewport, entry.requiresLogin ? loggedInState : undefined);
    try {
      await goto(planSession.page, entry.url);
      await acceptCookies(planSession.page);
      await runStep(planSession, id, entry.title, async r => { r.via = 'url'; });
    } finally {
      await planSession.context.close();
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log.header(`Regression Capture – ${isBaseline ? 'baseline (before)' : 'after'}`);
  log.info(`Project:     ${projectDir}`);
  log.info(`Run:         ${path.relative(projectDir, runDir)}`);
  log.info(`PWA URL:     ${config.baseUrl}`);
  log.info(`Viewports:   ${config.viewports.join(', ')}`);
  printProductionBanner(config);
  if (isBaseline && runLog.git.dirty) log.warning('The project has uncommitted changes – the baseline should reflect the unchanged project state.');
  if (forceNewBaseline && config.baseline) log.warning(`Replacing baseline ${config.baseline.run} – existing after runs and findings refer to the old baseline.`);

  writeRunLog();
  runLog.jest = skipJest ? { skipped: true } : runJest();
  writeRunLog();

  const { chromium } = requireOptional('playwright');
  const browser = await chromium.launch({ headless: !config.headed });
  try {
    if (isBaseline) {
      runLog.path = await discoverPath(browser);
      runLog.path.planPages = loadPlanPages();
      writeRunLog();
      if (config.account === 'new' && (config.orders.includes('user') || config.myAccount) && !readCredentials()) {
        await registerUser(browser);
      }
    } else if (config.account === 'new' && !readCredentials()) {
      throw new FatalError(`the test user of the baseline is missing (${paths.credentials})`);
    }

    for (const viewport of config.viewports) {
      await runViewport(browser, viewport);
    }
  } finally {
    await browser.close();
    runLog.finishedAt = new Date().toISOString();
    writeRunLog();
  }

  if (isBaseline) {
    config.baseline = { run: runName, fingerprint, createdAt: runLog.finishedAt };
    if (baseUrlArg) config.baseUrl = loadConfig(projectDir).baseUrl; // keep the configured default URL
    saveConfig(projectDir, config);
  }

  // ─── Summary ────────────────────────────────────────────────────────────
  const failed = runLog.steps.filter(s => s.status === 'failed');
  const skipped = runLog.steps.filter(s => s.status === 'skipped');
  console.log();
  log.header('Summary');
  console.log(`  Steps:     ${runLog.steps.length} (${chalk.red(`${failed.length} failed`)}, ${skipped.length} skipped)`);
  console.log(`  Orders:    ${runLog.orders.length ? runLog.orders.map(o => `${o.viewport}/${o.type}: ${o.submitted ? 'submitted' : `not submitted (${o.reason})`}`).join(', ') : '–'}`);
  if (runLog.jest && !runLog.jest.skipped) console.log(`  Jest:      ${runLog.jest.passed ?? '?'}/${runLog.jest.total ?? '?'} passed, ${runLog.jest.failed ?? '?'} failed`);
  console.log(`  Run:       ${runDir}`);
  console.log();
  if (isBaseline) {
    log.success('Baseline captured. The configuration is now locked.');
    log.info('Commit migration-qa/regression.config.json and the test plan, then start the migration.');
  } else {
    log.info('Next: npm run regression:compare');
  }
}

main().catch(err => {
  runLog.finishedAt = new Date().toISOString();
  runLog.error = err.message;
  writeRunLog();
  log.error(err.message);
  process.exit(1);
});
