#!/usr/bin/env node

/**
 * Regression Inventory: Test plan of custom and overridden pages
 *
 * Determines what the project created or overrode compared to the standard
 * PWA of the source version and maps the files to pages (routes):
 *   - custom files (not in the upstream tag)
 *   - customized standard files
 *   - theme overrides (*.<theme>.html|ts|scss)
 *
 * Writes migration-qa/test-plan.json (used by regression:capture) and
 * migration-qa/test-plan.md (for the team review). Manual entries and edits
 * (enabled, url, title) of an existing test plan are kept.
 *
 * Run it on the UNCHANGED project state (before the migration).
 * See docs/guides/regression-testing-guide.md
 *
 * Usage:
 *   node scripts/regression-inventory.js [OPTIONS]
 *
 * Options:
 *   --source-tag <tag>     Upstream tag of the source version (default: version from package.json)
 *   --json                 Print the test plan as JSON
 *   --project-dir <dir>    Path to PWA project (default: cwd)
 *   --help                 Show this help message
 */

const fs = require('fs');
const path = require('path');
const { log, execSilent, findFiles, chalk } = require('./_utils');
const { projectDir } = require('./_project-dir');
const { qaPaths, readJson } = require('./_regression');

// Parse arguments
const args = process.argv.slice(2);
let sourceTag = '';
let outputJson = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--source-tag': sourceTag = args[++i]; break;
    case '--json': outputJson = true; break;
    case '--project-dir': i++; break; // handled by _project-dir.js
    case '--help':
      console.log(`Usage: node scripts/regression-inventory.js [OPTIONS]

Options:
  --source-tag <tag>     Upstream tag of the source version (default: version from package.json)
  --json                 Print the test plan as JSON
  --project-dir <dir>    Path to PWA project (default: cwd)

Examples:
  # Test plan for a project based on PWA 9.0.0
  node scripts/regression-inventory.js --project-dir ../custom-pwa

  # Explicit source tag
  node scripts/regression-inventory.js --source-tag 9.0.0`);
      process.exit(0);
  }
}

const git = cmd => execSilent(`git -C "${projectDir}" ${cmd}`);
const rel = file => path.relative(projectDir, file).replace(/\\/g, '/');
const read = file => {
  try {
    return fs.readFileSync(path.join(projectDir, file), 'utf-8');
  } catch {
    return '';
  }
};

// ─── Source tag ─────────────────────────────────────────────────────────────

if (!sourceTag) {
  try {
    sourceTag = JSON.parse(read('package.json')).version;
  } catch {
    // handled below
  }
}
if (!sourceTag) {
  log.error('Could not determine the source version. Use --source-tag <tag>.');
  process.exit(1);
}
let sourceRef = '';
for (const candidate of [sourceTag, `v${sourceTag}`, `tags/${sourceTag}`]) {
  if (git(`rev-parse --verify --quiet "${candidate}^{commit}"`)) {
    sourceRef = candidate;
    break;
  }
}
if (!sourceRef) {
  log.error(`Upstream tag '${sourceTag}' not found in the project repository.`);
  log.info('Fetch the Intershop tags first, e.g.: git fetch <intershop-remote> --tags');
  process.exit(1);
}

// ─── Changed files ──────────────────────────────────────────────────────────

const changes = git(`diff --name-status -M "${sourceRef}" HEAD -- src projects`)
  .split('\n')
  .filter(Boolean)
  .map(line => {
    const [status, ...files] = line.split('\t');
    return { status: status[0], file: files[files.length - 1] };
  })
  .filter(c => c.status !== 'D');

const upstreamFiles = new Set(git(`ls-tree -r --name-only "${sourceRef}" -- src projects`).split('\n').filter(Boolean));

/** Theme override: foo.component.<theme>.html next to foo.component.html */
function overrideBase(file) {
  const match = file.match(/^(.*)\.([a-z0-9-]+)\.(html|ts|scss)$/);
  if (!match) return null;
  const base = `${match[1]}.${match[3]}`;
  if (base === file || !/\.component$/.test(match[1])) return null;
  return fs.existsSync(path.join(projectDir, base)) || upstreamFiles.has(base) ? { base, theme: match[2] } : null;
}

// ─── Component index ────────────────────────────────────────────────────────

const appDirs = [path.join(projectDir, 'src', 'app')];
const projectsDir = path.join(projectDir, 'projects');
if (fs.existsSync(projectsDir)) {
  for (const entry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (entry.isDirectory()) appDirs.push(path.join(projectsDir, entry.name, 'src', 'app'));
  }
}
const tsFiles = appDirs.flatMap(dir => findFiles(dir, /\.ts$/)).filter(f => !/\.spec\.ts$/.test(f)).map(rel);
const htmlFiles = appDirs.flatMap(dir => findFiles(dir, /\.html$/)).map(rel);
const components = new Map(); // ts file -> { selector, className, template }
const classToFile = new Map();
for (const file of tsFiles) {
  const content = read(file);
  const decorator = content.match(/@Component\(\s*\{([\s\S]*?)\}\s*\)\s*export\s+class\s+(\w+)/);
  if (!decorator) continue;
  const selector = (decorator[1].match(/selector:\s*'([^']+)'/) || [])[1];
  const templateUrl = (decorator[1].match(/templateUrl:\s*'([^']+)'/) || [])[1];
  const template = templateUrl ? path.posix.join(path.posix.dirname(file), templateUrl.replace(/^\.\//, '')) : null;
  components.set(file, { selector, className: decorator[2], template });
  classToFile.set(decorator[2], file);
}

/** Component .ts file for any component related file (html, scss, ts, overrides). */
function componentFileOf(file) {
  const override = overrideBase(file);
  const base = override ? override.base : file;
  const candidate = base.replace(/\.(html|scss|ts)$/, '.ts');
  return components.has(candidate) ? candidate : null;
}

// selector -> component files whose templates (including theme overrides) use it
const usedBy = new Map();
for (const html of htmlFiles) {
  const owner = componentFileOf(html);
  if (!owner) continue;
  for (const match of read(html).matchAll(/<([a-z][a-z0-9]*-[a-z0-9-]+)/g)) {
    if (!usedBy.has(match[1])) usedBy.set(match[1], new Set());
    usedBy.get(match[1]).add(owner);
  }
}

// ─── Routes ─────────────────────────────────────────────────────────────────

const routingFiles = tsFiles.filter(f => /routing|routes|-page\.module\.ts$|\.module\.ts$/.test(f) && /\bpath:\s*'/.test(read(f)));
const loadedModules = new Set();
for (const file of routingFiles) {
  for (const match of read(file).matchAll(/import\(\s*'([^']+)'\s*\)/g)) {
    loadedModules.add(path.posix.join(path.posix.dirname(file), `${match[1]}.ts`));
  }
}

const routes = [];
const visitedModules = new Set();

function parseRoutes(file, prefix, depth, uncertain) {
  if (depth > 6 || visitedModules.has(`${file}|${prefix}`)) return;
  visitedModules.add(`${file}|${prefix}`);
  const content = read(file);
  const matches = [...content.matchAll(/\bpath:\s*'([^']*)'/g)];
  matches.forEach((match, i) => {
    const segment = match[1];
    if (segment === '**') return;
    const block = content.slice(match.index, i + 1 < matches.length ? matches[i + 1].index : content.length);
    if (/redirectTo:/.test(block) && !/component:|loadChildren:/.test(block)) return;
    const full = [prefix, segment].filter(Boolean).join('/');
    const requiresLogin = /canActivate:\s*\[[^\]]*(auth|login|identity)/i.test(block);
    const lazy = block.match(/loadChildren:[\s\S]*?import\(\s*'([^']+)'\s*\)/);
    const component = (block.match(/component:\s*(\w+)/) || [])[1];
    if (lazy) {
      const moduleFile = path.posix.join(path.posix.dirname(file), `${lazy[1]}.ts`);
      routes.push({ route: full, dir: `${path.posix.dirname(moduleFile)}/`, component: null, requiresLogin, uncertain });
      parseRoutes(moduleFile, full, depth + 1, uncertain);
    } else if (component) {
      const componentFile = classToFile.get(component) || null;
      routes.push({ route: full, dir: null, component: componentFile, requiresLogin, uncertain });
    }
  });
}

// sub projects (projects/*) are mounted by the app under a prefix that cannot be resolved statically
for (const file of routingFiles.filter(f => !loadedModules.has(f))) parseRoutes(file, '', 0, file.startsWith('projects/'));

// inherit login requirement from parent routes, merge duplicates
for (const r of routes) {
  if (routes.some(p => p.requiresLogin && p.route && r.route.startsWith(`${p.route}/`))) r.requiresLogin = true;
}

/** Routes whose page directory or component contains the given component file. */
function routesOfComponent(componentFile, depth = 0, seen = new Set()) {
  if (depth > 5 || seen.has(componentFile)) return [];
  seen.add(componentFile);
  const direct = routes.filter(r => r.component === componentFile || (r.dir && componentFile.startsWith(r.dir)));
  if (direct.length) return direct;
  const selector = components.get(componentFile) && components.get(componentFile).selector;
  if (!selector) return [];
  // lazy components are used via a generated wrapper: ish-lazy-<name> loads ish-<name>
  const lazySelector = selector.replace(/^([a-z]+)-/, '$1-lazy-');
  const parents = new Set([...(usedBy.get(selector) || []), ...(usedBy.get(lazySelector) || [])]);
  return [...parents].flatMap(parent => routesOfComponent(parent, depth + 1, seen));
}

// ─── Happy path coverage ────────────────────────────────────────────────────

function coveredBy(route) {
  const r = `/${route}`;
  if (r === '/' || /^\/home\b/.test(r)) return '01-home';
  if (/categoryUniqueId|category|ctg/i.test(r)) return '02-category';
  if (/productSKU|\/product|prd/i.test(r)) return '03-product-1';
  if (/^\/search/.test(r)) return '05-search-result';
  if (/^\/basket/.test(r)) return '07-basket';
  if (/^\/checkout/.test(r)) return '08 checkout (order type selected in regression:init)';
  if (/^\/(login|register)/.test(r)) return '08b-1-login';
  // only the account overview is certain – sub pages are covered if they are in the account navigation
  if (r === '/account') return '09-account (My Account selected in regression:init)';
  return null;
}

// ─── Map changes to pages ───────────────────────────────────────────────────

const pages = new Map(); // route -> { route, requiresLogin, kinds:Set, reasons:Set }
const shell = [];
const globalStyles = [];
const nonVisual = [];
const unmapped = [];

function addPage(route, kind, file) {
  if (!pages.has(route.route)) pages.set(route.route, { ...route, kinds: new Set(), reasons: new Set() });
  pages.get(route.route).kinds.add(kind);
  pages.get(route.route).reasons.add(file);
}

for (const { status, file } of changes) {
  if (!/\.(ts|html|scss|json)$/.test(file) || /\.spec\.ts$/.test(file)) continue;
  const override = overrideBase(file);
  const isNew = !upstreamFiles.has(file) && !override;
  const kind = override ? `theme override (${override.theme})` : isNew ? 'custom' : 'customized standard';

  if (/^src\/styles\//.test(file)) { globalStyles.push(`${file} (${kind})`); continue; }
  if (/^src\/app\/(shell\/|app\.component)/.test(file)) { shell.push(`${file} (${kind})`); continue; }
  if (/^src\/assets\/i18n\//.test(file)) { globalStyles.push(`${file} (localization)`); continue; }

  const pageRoutes = routes.filter(r => r.dir && file.startsWith(r.dir));
  const componentFile = componentFileOf(file);
  const viaComponent = componentFile ? routesOfComponent(componentFile) : [];
  const matched = [...pageRoutes, ...viaComponent];

  if (matched.length) {
    const pageKind = pageRoutes.length ? (isNew ? 'new page' : 'overridden page') : 'uses changed component';
    for (const route of matched) addPage(route, pageKind, `${file} (${kind}${status === 'A' ? ', added' : ''})`);
  } else if (componentFile || /\.html$/.test(file)) {
    unmapped.push(`${file} (${kind})`);
  } else {
    nonVisual.push(`${file} (${kind})`);
  }
}

// ─── Build test plan ────────────────────────────────────────────────────────

const paths = qaPaths(projectDir);
const previous = fs.existsSync(paths.testPlanJson) ? readJson(paths.testPlanJson) : { entries: [] };
const previousByRoute = new Map(previous.entries.filter(e => !e.manual).map(e => [e.route, e]));

const entries = [...pages.values()]
  .sort((a, b) => a.route.localeCompare(b.route))
  .map((page, i) => {
    const covered = coveredBy(page.route);
    const hasParams = /:/.test(page.route);
    const before = previousByRoute.get(`/${page.route}`) || {};
    const url = before.url !== undefined ? before.url : (hasParams || page.uncertain ? null : `/${page.route}`);
    let note;
    if (!before.url && page.uncertain) note = 'route of a sub project (projects/*) – the URL prefix is unknown, enter the URL';
    else if (!before.url && hasParams) note = 'route with parameters – enter a concrete URL';
    return {
      id: `P-${String(i + 1).padStart(3, '0')}`,
      title: before.title || `/${page.route}`,
      route: `/${page.route}`,
      url,
      requiresLogin: page.requiresLogin || /^account(\/|$)/.test(page.route),
      coveredBy: covered,
      enabled: before.enabled !== undefined ? before.enabled : (!!url && !covered),
      kinds: [...page.kinds],
      reasons: [...page.reasons].slice(0, 30),
      note,
    };
  });

// keep manual entries
const manual = previous.entries.filter(e => e.manual).map((e, i) => ({ ...e, id: e.id || `M-${String(i + 1).padStart(3, '0')}` }));

const plan = {
  generatedAt: new Date().toISOString(),
  sourceTag: sourceRef,
  head: git('rev-parse --short HEAD'),
  entries: [...entries, ...manual],
  shell,
  globalStyles,
  unmapped,
  nonVisual,
};

fs.mkdirSync(paths.root, { recursive: true });
fs.writeFileSync(paths.testPlanJson, `${JSON.stringify(plan, null, 2)}\n`);
fs.writeFileSync(paths.testPlanMd, renderMarkdown(plan));

// ─── Output ─────────────────────────────────────────────────────────────────

function renderMarkdown(p) {
  const esc = s => String(s === undefined || s === null ? '' : s).replace(/\|/g, '\\|');
  const lines = [
    '# Regression Test Plan',
    '',
    `Generated ${p.generatedAt.slice(0, 10)} from the differences to the upstream tag \`${p.sourceTag}\` (project HEAD \`${p.head}\`).`,
    'Edit `test-plan.json` (`enabled`, `url`, `title`) and add manual entries (`"manual": true`) **before** the baseline run.',
    '',
    '## Pages',
    '',
    '| ID | Route | URL | Login | Covered by happy path | Tested | Why |',
    '|---|---|---|---|---|---|---|',
    ...p.entries.map(e => `| ${e.id} | ${esc(e.route)} | ${esc(e.url || '– (enter URL)')} | ${e.requiresLogin ? 'yes' : ''} | ${esc(e.coveredBy || '')} | ${e.enabled ? '✅' : '–'} | ${esc((e.kinds || []).join(', '))}: ${esc((e.reasons || []).slice(0, 3).join('; '))}${(e.reasons || []).length > 3 ? ` (+${e.reasons.length - 3})` : ''} |`),
    '',
  ];
  const section = (title, hint, items) => {
    if (!items.length) return;
    lines.push(`## ${title}`, '', hint, '', ...items.map(i => `- ${i}`), '');
  };
  section('Shell (header, footer, navigation)', 'Visible on every page – covered by the happy path.', p.shell);
  section('Global styles and localization', 'Affect all pages – covered by the happy path screenshots.', p.globalStyles);
  section('Components without known page', 'Could not be mapped to a route (e.g. CMS components, dialogs). Add a manual entry with the URL where they are visible.', p.unmapped);
  section('Non-visual changes', 'Services, store, models, configuration – no own page; covered indirectly by the happy path and Jest.', p.nonVisual);
  return `${lines.join('\n')}\n`;
}

if (outputJson) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}

log.header('Regression Inventory');
log.info(`Project:     ${projectDir}`);
log.info(`Source tag:  ${sourceRef}`);
log.info(`Changes:     ${changes.length} file(s) compared to the source tag`);
console.log();
console.log(`  ${chalk.green('Pages in the test plan')}           ${String(entries.filter(e => e.enabled).length).padStart(4)}`);
console.log(`  ${chalk.cyan('Covered by the happy path')}        ${String(entries.filter(e => e.coveredBy).length).padStart(4)}`);
console.log(`  ${chalk.yellow('Need a URL (route parameters)')}    ${String(entries.filter(e => !e.url && !e.coveredBy).length).padStart(4)}`);
console.log(`  ${chalk.yellow('Components without known page')}    ${String(unmapped.length).padStart(4)}`);
console.log(`  Shell / global styles               ${String(shell.length + globalStyles.length).padStart(4)}`);
console.log(`  Non-visual changes                  ${String(nonVisual.length).padStart(4)}`);
if (manual.length) console.log(`  Manual entries (kept)               ${String(manual.length).padStart(4)}`);
console.log();
log.success(`Test plan written: ${rel(paths.testPlanMd)} and ${rel(paths.testPlanJson)}`);
log.info('Review the test plan with the team: enter missing URLs, disable irrelevant entries, add manual entries.');
log.info('Next: npm run regression:capture -- --label before');
