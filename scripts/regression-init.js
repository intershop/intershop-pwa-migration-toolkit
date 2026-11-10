#!/usr/bin/env node

/**
 * Regression Init: Select what the regression tests cover
 *
 * Asks (multiple choice) which environment, viewports, order types and
 * My Account pages are tested and how the user account is handled.
 * The answers are stored in migration-qa/regression.config.json and are
 * locked after the baseline run, so before and after use the same selection.
 *
 * See docs/guides/regression-testing-guide.md
 *
 * Usage:
 *   node scripts/regression-init.js [OPTIONS]
 *
 * Options (all optional – missing answers are asked interactively):
 *   --base-url <url>               URL of the PWA used for the baseline
 *   --environment <test|production>
 *   --viewports <list>             Comma-separated: mobile,tablet,desktop
 *   --orders <list>                Comma-separated: guest,user (or "none")
 *   --my-account <yes|no>
 *   --account <new|manual>         User account mode (only with orders=user or My Account)
 *   --force                        Overwrite a configuration that is locked by a baseline
 *   --project-dir <dir>            Path to PWA project (default: cwd)
 *   --help                         Show this help message
 */

const fs = require('fs');
const { log, askChoice, askMultiChoice, askInput, chalk } = require('./_utils');
const { projectDir } = require('./_project-dir');
const {
  VIEWPORTS,
  DEFAULT_SETTINGS,
  DEFAULT_TEST_DATA,
  qaPaths,
  readJson,
  saveConfig,
  validateConfig,
  ensureGitignore,
} = require('./_regression');

// Parse arguments
const args = process.argv.slice(2);
const opts = {};
let force = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--base-url': opts.baseUrl = args[++i]; break;
    case '--environment': opts.environment = args[++i]; break;
    case '--viewports': opts.viewports = args[++i].split(',').map(v => v.trim()).filter(Boolean); break;
    case '--orders': {
      const value = args[++i];
      opts.orders = value === 'none' ? [] : value.split(',').map(v => v.trim()).filter(Boolean);
      break;
    }
    case '--my-account': opts.myAccount = ['yes', 'y', 'true'].includes(args[++i]); break;
    case '--account': opts.account = args[++i]; break;
    case '--force': force = true; break;
    case '--project-dir': i++; break; // handled by _project-dir.js
    case '--help':
      console.log(`Usage: node scripts/regression-init.js [OPTIONS]

Options (missing answers are asked interactively):
  --base-url <url>                 URL of the PWA used for the baseline
  --environment <test|production>  Production = read-only: no orders, no new users
  --viewports <list>               Comma-separated: mobile,tablet,desktop
  --orders <list>                  Comma-separated: guest,user (or "none")
  --my-account <yes|no>            Test the My Account pages
  --account <new|manual>           User account: create a new user | enter credentials during the tests
  --force                          Overwrite a configuration that is locked by a baseline
  --project-dir <dir>              Path to PWA project (default: cwd)

Examples:
  # Interactive
  node scripts/regression-init.js --project-dir ../my-pwa

  # Non-interactive, read-only against production
  node scripts/regression-init.js --base-url https://shop.example.com --environment production \\
    --viewports mobile,desktop --orders guest --my-account no`);
      process.exit(0);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log.header('Regression Testing – Init');
  log.info(`Project: ${projectDir}`);

  const paths = qaPaths(projectDir);
  const existing = fs.existsSync(paths.config) ? readJson(paths.config) : null;

  if (existing && existing.baseline) {
    if (!force) {
      log.error(`The configuration is locked by the baseline run "${existing.baseline.run}".`);
      log.info('Before and after runs must use the same selection. To start over with a new baseline, use --force.');
      process.exit(1);
    }
    log.warning(`Overwriting the configuration locked by baseline "${existing.baseline.run}". A new baseline run is required.`);
  }

  // 1. Base URL
  let baseUrl = opts.baseUrl || (existing && existing.baseUrl);
  if (!baseUrl) {
    baseUrl = await askInput('URL of the PWA for the baseline (e.g. https://shop.example.com):');
  }
  baseUrl = baseUrl.replace(/\/+$/, '');

  // 2. Environment
  const environment = opts.environment || await askChoice('Against which environment do the tests run?', [
    { value: 'test', label: 'Test / UAT system' },
    { value: 'production', label: 'Production system (read-only: no orders, no new users)' },
  ]);

  // 3. Viewports
  const viewports = opts.viewports || await askMultiChoice('Which viewports should be tested?', Object.entries(VIEWPORTS).map(([name, v]) => ({
    value: name,
    label: `${name} (${v.width}×${v.height})`,
  })), { min: 1 });

  // 4. Order types
  const orders = opts.orders || await askMultiChoice('Which order types should be tested?', [
    { value: 'guest', label: 'Order as guest' },
    { value: 'user', label: 'Order as registered user' },
  ]);

  // 5. My Account
  const myAccount = opts.myAccount !== undefined ? opts.myAccount : (await askChoice('Test My Account?', [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ])) === 'yes';

  // 6. User account (only if needed)
  let account = null;
  if (orders.includes('user') || myAccount) {
    if (opts.account) {
      account = opts.account;
    } else if (environment === 'production') {
      log.info('Production mode: no user is created – you enter your credentials during the tests.');
      account = 'manual';
    } else {
      account = await askChoice('User account for "order as registered user" / "My Account"?', [
        { value: 'new', label: 'Create a new user (registered during the baseline, reused afterwards)' },
        { value: 'manual', label: 'I enter my credentials during the tests (visible browser, nothing is stored)' },
      ]);
    }
  }

  const config = {
    version: 1,
    createdAt: new Date().toISOString(),
    baseUrl,
    environment,
    viewports,
    viewportSizes: Object.fromEntries(viewports.map(v => [v, VIEWPORTS[v]])),
    orders,
    myAccount,
    account,
    headed: account === 'manual',
    settings: (existing && existing.settings) || DEFAULT_SETTINGS,
    mask: (existing && existing.mask) || [],
    testData: (existing && existing.testData) || DEFAULT_TEST_DATA,
    diff: (existing && existing.diff) || { threshold: 0.1, maxDiffRatio: 0.0005 },
  };

  const errors = validateConfig(config);
  if (errors.length) {
    log.error('Invalid selection:');
    errors.forEach(e => log.error(`  - ${e}`));
    process.exit(1);
  }

  saveConfig(projectDir, config);
  const added = ensureGitignore(projectDir);

  // ─── Summary ────────────────────────────────────────────────────────────
  console.log();
  log.success(`Configuration saved: ${paths.config}`);
  if (added.length) log.info(`Added to .gitignore: ${added.join(', ')}`);
  console.log();
  console.log(`  Environment:   ${environment === 'production' ? chalk.yellow('production (read-only)') : 'test / UAT'}`);
  console.log(`  Base URL:      ${baseUrl}`);
  console.log(`  Viewports:     ${viewports.join(', ')}`);
  console.log(`  Order types:   ${orders.length ? orders.map(o => (o === 'guest' ? 'guest' : 'registered user')).join(', ') : 'none (happy path ends at the basket)'}`);
  console.log(`  My Account:    ${myAccount ? 'yes' : 'no'}`);
  if (account) console.log(`  User account:  ${account === 'new' ? 'create a new user' : 'enter credentials during the tests'}`);
  console.log();
  log.info('Optional: adjust "mask" (selectors of dynamic areas) and "testData" in the configuration now – they are locked after the baseline.');
  log.info('Next: npm run regression:inventory   (test plan of custom and overridden pages)');
}

main().catch(err => {
  log.error(err.message);
  process.exit(1);
});
