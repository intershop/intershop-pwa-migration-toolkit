/**
 * Shared helpers for the regression testing scripts (regression-*.js)
 *
 * Covers the migration-qa/ folder layout, the regression configuration
 * (including the lock after the baseline), production mode rules,
 * run directories and the optional dependencies (Playwright, pixelmatch).
 *
 * See docs/guides/regression-testing-guide.md
 *
 * Usage:
 *   const { qaPaths, loadConfig, validateConfig } = require('./_regression');
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { log } = require('./_utils');

// ─── Constants ──────────────────────────────────────────────────────────────

const QA_DIR = 'migration-qa';

// Fixed viewport sizes – deliberately away from the Bootstrap breakpoints of the PWA
const VIEWPORTS = {
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true },
  tablet: { width: 820, height: 1180, isMobile: true, hasTouch: true },
  desktop: { width: 1920, height: 1080, isMobile: false, hasTouch: false },
};

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

const DEFAULT_SETTINGS = {
  deviceScaleFactor: 1,
  locale: 'en-US',
  timezoneId: 'Europe/Berlin',
  reducedMotion: 'reduce',
};

const DEFAULT_TEST_DATA = {
  guest: {
    email: 'regression-test@example.com',
    title: '',
    firstName: 'Test',
    lastName: 'Regression',
    addressLine1: 'Teststreet 1',
    postalCode: '12345',
    city: 'Testcity',
    phoneHome: '123456789',
    countryCode: 'DE', // ISO code; falls back to the first country offered by the address form
  },
  registration: {
    password: '!InterShop00!',
  },
  paymentMethod: '', // empty = first payment method without parameter form
};

// Configuration fields that must not change after the baseline
const LOCKED_FIELDS = ['environment', 'viewports', 'viewportSizes', 'orders', 'myAccount', 'account', 'headed', 'settings', 'mask', 'testData'];

// ICM REST requests that create orders or customers (matched against the URL path).
// They are blocked at network level unless explicitly allowed (never in production mode).
const ORDER_CREATION = { method: 'POST', pattern: /\/orders\/?(;[^/]*)?$/ };
const CUSTOMER_CREATION = { method: 'POST', pattern: /\/(private)?customers\/?(;[^/]*)?$/ };

// ─── Paths ──────────────────────────────────────────────────────────────────

function qaPaths(projectDir) {
  const root = path.join(projectDir, QA_DIR);
  return {
    root,
    config: path.join(root, 'regression.config.json'),
    testPlanJson: path.join(root, 'test-plan.json'),
    testPlanMd: path.join(root, 'test-plan.md'),
    findings: path.join(root, 'findings.md'),
    credentials: path.join(root, '.credentials.json'),
    runs: path.join(root, 'runs'),
    reports: path.join(root, 'reports'),
  };
}

// ─── Configuration ──────────────────────────────────────────────────────────

function loadConfig(projectDir) {
  const { config } = qaPaths(projectDir);
  if (!fs.existsSync(config)) {
    log.error(`No regression configuration found: ${config}`);
    log.info('Run "npm run regression:init" first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(config, 'utf-8'));
}

function saveConfig(projectDir, config) {
  const paths = qaPaths(projectDir);
  fs.mkdirSync(paths.root, { recursive: true });
  fs.writeFileSync(paths.config, `${JSON.stringify(config, null, 2)}\n`);
}

/**
 * Validate the configuration. Returns a list of error messages (empty = valid).
 * Enforces the production mode rules: no order submission, no user creation.
 */
function validateConfig(config) {
  const errors = [];
  if (!['test', 'production'].includes(config.environment)) {
    errors.push(`environment must be "test" or "production" (is "${config.environment}")`);
  }
  if (!Array.isArray(config.viewports) || config.viewports.length === 0) {
    errors.push('at least one viewport must be selected');
  } else {
    const unknown = config.viewports.filter(v => !VIEWPORTS[v]);
    if (unknown.length) errors.push(`unknown viewport(s): ${unknown.join(', ')}`);
  }
  const orders = config.orders || [];
  const unknownOrders = orders.filter(o => !['guest', 'user'].includes(o));
  if (unknownOrders.length) errors.push(`unknown order type(s): ${unknownOrders.join(', ')}`);

  const needsAccount = orders.includes('user') || config.myAccount;
  if (needsAccount && !['new', 'manual'].includes(config.account)) {
    errors.push('a user account mode ("new" or "manual") is required for "order as registered user" or "My Account"');
  }
  if (config.environment === 'production' && config.account === 'new') {
    errors.push('production mode: creating a new user is not allowed – use "manual" (enter credentials during the tests)');
  }
  if (config.account === 'manual' && !config.headed) {
    errors.push('"manual" credentials require a visible browser (headed: true)');
  }
  if (!config.baseUrl || !/^https?:\/\//.test(config.baseUrl)) {
    errors.push('baseUrl must be an http(s) URL');
  }
  return errors;
}

function assertValidConfig(config) {
  const errors = validateConfig(config);
  if (errors.length) {
    log.error('Invalid regression configuration:');
    errors.forEach(e => log.error(`  - ${e}`));
    process.exit(1);
  }
}

/** Fingerprint of all locked fields – compared between baseline and after runs. */
function configFingerprint(config) {
  const locked = {};
  for (const field of LOCKED_FIELDS) locked[field] = config[field] === undefined ? null : config[field];
  return crypto.createHash('sha256').update(JSON.stringify(locked)).digest('hex').slice(0, 16);
}

function isProduction(config) {
  return config.environment === 'production';
}

function printProductionBanner(config) {
  if (isProduction(config)) {
    log.warning('🔒 PRODUCTION MODE (read-only): no orders are submitted, no users are created.');
  }
}

// ─── Runs ───────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function listRuns(projectDir) {
  const { runs } = qaPaths(projectDir);
  if (!fs.existsSync(runs)) return [];
  return fs
    .readdirSync(runs, { withFileTypes: true })
    .filter(e => e.isDirectory() && fs.existsSync(path.join(runs, e.name, 'run-log.json')))
    .map(e => e.name)
    .sort((a, b) => runRound(a) - runRound(b) || a.localeCompare(b));
}

/** Round number of a run directory: before = 0, after = 1, after-2 = 2, … */
function runRound(runName) {
  if (/-before$/.test(runName)) return 0;
  const match = runName.match(/-after(?:-(\d+))?$/);
  if (!match) return -1;
  return match[1] ? parseInt(match[1], 10) : 1;
}

function nextAfterRunName(projectDir) {
  const rounds = listRuns(projectDir).map(runRound).filter(r => r > 0);
  const next = rounds.length ? Math.max(...rounds) + 1 : 1;
  return next === 1 ? `${today()}-after` : `${today()}-after-${next}`;
}

function readRunLog(projectDir, runName) {
  const file = path.join(qaPaths(projectDir).runs, runName, 'run-log.json');
  if (!fs.existsSync(file)) {
    log.error(`Run not found: ${runName}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

// ─── .gitignore ─────────────────────────────────────────────────────────────

const GITIGNORE_ENTRIES = [`${QA_DIR}/.credentials.json`, `${QA_DIR}/runs/`, `${QA_DIR}/reports/`];

/** Add the migration-qa entries to the project's .gitignore. Returns the added entries. */
function ensureGitignore(projectDir) {
  const file = path.join(projectDir, '.gitignore');
  const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
  const lines = content.split(/\r?\n/).map(l => l.trim());
  const missing = GITIGNORE_ENTRIES.filter(e => !lines.includes(e));
  if (missing.length) {
    const prefix = content && !content.endsWith('\n') ? '\n' : '';
    fs.appendFileSync(file, `${prefix}\n# PWA migration regression testing\n${missing.join('\n')}\n`);
  }
  return missing;
}

// ─── Optional dependencies ──────────────────────────────────────────────────

function requireOptional(name) {
  try {
    return require(name);
  } catch {
    log.error(`The optional dependency "${name}" is not installed.`);
    log.info('Install the toolkit dependencies with: npm install');
    if (name === 'playwright') log.info('Then install the browser once with: npx playwright install chromium');
    process.exit(1);
  }
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  QA_DIR,
  VIEWPORTS,
  MOBILE_USER_AGENT,
  DEFAULT_SETTINGS,
  DEFAULT_TEST_DATA,
  LOCKED_FIELDS,
  ORDER_CREATION,
  CUSTOMER_CREATION,
  qaPaths,
  loadConfig,
  saveConfig,
  validateConfig,
  assertValidConfig,
  configFingerprint,
  isProduction,
  printProductionBanner,
  today,
  listRuns,
  runRound,
  nextAfterRunName,
  readRunLog,
  ensureGitignore,
  requireOptional,
};
