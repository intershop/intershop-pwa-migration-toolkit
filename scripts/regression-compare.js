#!/usr/bin/env node

/**
 * Regression Compare: Compare an after run with the baseline
 *
 * Compares per viewport and step:
 *   - screenshots (pixel diff, changed page height)
 *   - functional results (step status, click → direct URL, notes)
 *   - new console errors and failed requests
 *   - Jest results (new failures, fixed, added, removed tests)
 *
 * Writes migration-qa/reports/<before>-vs-<after>/index.html (before | after | diff)
 * and compare.json (input for regression:findings).
 *
 * See docs/guides/regression-testing-guide.md
 *
 * Usage:
 *   node scripts/regression-compare.js [OPTIONS]
 *
 * Options:
 *   --before <run>         Baseline run (default: baseline from the configuration)
 *   --after <run>          After run (default: latest after run)
 *   --project-dir <dir>    Path to PWA project (default: cwd)
 *   --help                 Show this help message
 */

const fs = require('fs');
const path = require('path');
const { log, chalk } = require('./_utils');
const { projectDir } = require('./_project-dir');
const { qaPaths, loadConfig, listRuns, runRound, readRunLog, requireOptional } = require('./_regression');

// Parse arguments
const args = process.argv.slice(2);
let beforeRun = '';
let afterRun = '';

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--before': beforeRun = args[++i]; break;
    case '--after': afterRun = args[++i]; break;
    case '--project-dir': i++; break; // handled by _project-dir.js
    case '--help':
      console.log(`Usage: node scripts/regression-compare.js [OPTIONS]

Options:
  --before <run>         Baseline run (default: baseline from the configuration)
  --after <run>          After run (default: latest after run)
  --project-dir <dir>    Path to PWA project (default: cwd)

Examples:
  # Compare the latest after run with the baseline
  node scripts/regression-compare.js

  # Compare a specific round
  node scripts/regression-compare.js --after 2026-11-12-after-2`);
      process.exit(0);
  }
}

// ─── Setup ──────────────────────────────────────────────────────────────────

const config = loadConfig(projectDir);
const paths = qaPaths(projectDir);
beforeRun = beforeRun || (config.baseline && config.baseline.run);
if (!beforeRun) {
  log.error('No baseline found. Run regression:capture --label before first.');
  process.exit(1);
}
if (!afterRun) {
  const afterRuns = listRuns(projectDir).filter(r => runRound(r) > 0);
  afterRun = afterRuns[afterRuns.length - 1];
  if (!afterRun) {
    log.error('No after run found. Run regression:capture --label after first.');
    process.exit(1);
  }
}

const { PNG } = requireOptional('pngjs');
const pixelmatch = requireOptional('pixelmatch');

const before = readRunLog(projectDir, beforeRun);
const after = readRunLog(projectDir, afterRun);
const reportName = `${beforeRun}-vs-${afterRun}`;
const reportDir = path.join(paths.reports, reportName);
fs.rmSync(reportDir, { recursive: true, force: true });
fs.mkdirSync(reportDir, { recursive: true });

const diffSettings = config.diff || { threshold: 0.1, maxDiffRatio: 0.0005 };

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Remove IDs, numbers and query strings so equal errors match across runs. */
function normalize(message) {
  return message
    .replace(/https?:\/\/[^/\s]+/g, '<host>')
    .replace(/\?[^\s]*/g, '')
    .replace(/[0-9a-f]{8,}/gi, '<id>')
    .replace(/\d+/g, '<n>');
}

function readPng(run, file) {
  return PNG.sync.read(fs.readFileSync(path.join(paths.runs, run, file)));
}

/** Copy an image into a canvas of the given size (missing area stays transparent). */
function pad(png, width, height) {
  if (png.width === width && png.height === height) return png;
  const out = new PNG({ width, height });
  PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);
  return out;
}

function compareImages(beforeFile, afterFile, diffFile) {
  const a = readPng(before.run, beforeFile);
  const b = readPng(after.run, afterFile);
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const diff = new PNG({ width, height });
  const pixels = pixelmatch(pad(a, width, height).data, pad(b, width, height).data, diff.data, width, height, {
    threshold: diffSettings.threshold,
  });
  const ratio = pixels / (width * height);
  const sizeChanged = a.width !== b.width || a.height !== b.height;
  if (ratio > diffSettings.maxDiffRatio || sizeChanged) {
    fs.mkdirSync(path.dirname(path.join(reportDir, diffFile)), { recursive: true });
    fs.writeFileSync(path.join(reportDir, diffFile), PNG.sync.write(diff));
  }
  return { pixels, ratio, sizeChanged, beforeSize: `${a.width}×${a.height}`, afterSize: `${b.width}×${b.height}`, heightDelta: b.height - a.height };
}

// ─── Compare steps ──────────────────────────────────────────────────────────

const key = s => `${s.viewport}/${s.id}`;
const beforeSteps = new Map(before.steps.map(s => [key(s), s]));
const afterSteps = new Map(after.steps.map(s => [key(s), s]));
const keys = [...new Set([...beforeSteps.keys(), ...afterSteps.keys()])];

const differences = [];
const notes = [];
const results = [];

for (const k of keys) {
  const b = beforeSteps.get(k);
  const a = afterSteps.get(k);
  const step = (a || b).id;
  const viewport = (a || b).viewport;
  const result = { key: k, step, viewport, title: (a || b).title, before: b || null, after: a || null, visual: null, issues: [] };
  results.push(result);
  const add = (type, description, extra = {}) => {
    const difference = { key: `${type}|${viewport}|${step}`, type, step, viewport, description, ...extra };
    differences.push(difference);
    result.issues.push(difference);
  };

  if (!b) { add('functional', 'step only exists in the after run'); continue; }
  if (!a) { add('functional', 'step missing in the after run'); continue; }

  // order confirmation: only comparable if the order was submitted in both runs
  if (/-confirmation$/.test(step) && (a.status === 'skipped' || b.status === 'skipped') && a.status !== b.status) {
    notes.push(`${k}: order confirmation only captured in one run (before: ${b.note || b.status}, after: ${a.note || a.status}) – not compared`);
    continue;
  }

  if (a.status !== b.status) {
    add('functional', `status ${b.status} → ${a.status}${a.note ? ` (${a.note})` : ''}`);
  } else if (a.status === 'failed' && a.note !== b.note) {
    add('functional', `still failing, different reason: ${a.note}`);
  }
  if (b.via === 'click' && a.via === 'url') add('functional', 'element could not be clicked any more – reached by direct URL');
  if (a.note && a.note !== b.note && a.status === b.status && a.status === 'ok') add('functional', `new note: ${a.note}`);

  if (a.screenshot && b.screenshot) {
    const diffFile = `${viewport}/${step}-diff.png`;
    const visual = compareImages(b.screenshot, a.screenshot, diffFile);
    result.visual = { ...visual, diff: visual.ratio > diffSettings.maxDiffRatio || visual.sizeChanged ? diffFile : null };
    if (result.visual.diff) {
      const height = visual.heightDelta ? `, page height ${visual.heightDelta > 0 ? '+' : ''}${visual.heightDelta} px` : '';
      add('visual', `${(visual.ratio * 100).toFixed(2)} % pixels differ${height}`, { ratio: visual.ratio, diff: diffFile });
    }
  }

  const beforeErrors = new Set((b.consoleErrors || []).map(normalize));
  const newErrors = [...new Set((a.consoleErrors || []).filter(e => !beforeErrors.has(normalize(e))))];
  if (newErrors.length) add('console', `${newErrors.length} new console error(s): ${newErrors.slice(0, 3).join(' | ').slice(0, 300)}`, { messages: newErrors });

  const beforeRequests = new Set((b.failedRequests || []).map(normalize));
  const newRequests = [...new Set((a.failedRequests || []).filter(r => !beforeRequests.has(normalize(r))))];
  if (newRequests.length) add('request', `${newRequests.length} new failed request(s): ${newRequests.slice(0, 3).join(' | ').slice(0, 300)}`, { messages: newRequests });
}

// ─── Compare Jest ───────────────────────────────────────────────────────────

function readJest(run) {
  const file = path.join(paths.runs, run.run, 'jest-results.json');
  if (!fs.existsSync(file)) return null;
  const json = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const tests = new Map();
  for (const suite of json.testResults || []) {
    const suiteName = path.relative(projectDir, suite.name || suite.testFilePath || '').replace(/\\/g, '/');
    for (const t of suite.assertionResults || []) tests.set(`${suiteName} › ${t.fullName || t.title}`, t.status);
    if ((!suite.assertionResults || !suite.assertionResults.length) && suite.status === 'failed') {
      tests.set(`${suiteName} › (test suite failed to run)`, 'failed');
    }
  }
  return tests;
}

const jestBefore = readJest(before);
const jestAfter = readJest(after);
let jest = null;
if (jestBefore && jestAfter) {
  const failed = (map, name) => map.get(name) === 'failed';
  jest = {
    newFailures: [...jestAfter.keys()].filter(n => failed(jestAfter, n) && !failed(jestBefore, n)),
    fixed: [...jestBefore.keys()].filter(n => failed(jestBefore, n) && jestAfter.get(n) === 'passed'),
    added: [...jestAfter.keys()].filter(n => !jestBefore.has(n)).length,
    removed: [...jestBefore.keys()].filter(n => !jestAfter.has(n)).length,
    before: { total: jestBefore.size, failed: [...jestBefore.values()].filter(s => s === 'failed').length },
    after: { total: jestAfter.size, failed: [...jestAfter.values()].filter(s => s === 'failed').length },
  };
  for (const name of jest.newFailures) {
    differences.push({ key: `jest|-|${name}`, type: 'jest', step: `jest: ${name}`.slice(0, 200), viewport: '-', description: 'new failing test' });
  }
} else {
  notes.push(`Jest not compared (${!jestBefore ? 'no results in the baseline' : 'no results in the after run'})`);
}

// ─── Output ─────────────────────────────────────────────────────────────────

const summary = {
  steps: keys.length,
  identical: results.filter(r => !r.issues.length).length,
  visual: differences.filter(d => d.type === 'visual').length,
  functional: differences.filter(d => d.type === 'functional').length,
  console: differences.filter(d => d.type === 'console').length,
  request: differences.filter(d => d.type === 'request').length,
  jest: differences.filter(d => d.type === 'jest').length,
};

const compareJson = {
  before: beforeRun,
  after: afterRun,
  round: runRound(afterRun),
  createdAt: new Date().toISOString(),
  baseUrls: { before: before.baseUrl, after: after.baseUrl },
  summary,
  differences,
  notes,
  jest,
};
fs.writeFileSync(path.join(reportDir, 'compare.json'), `${JSON.stringify(compareJson, null, 2)}\n`);
fs.writeFileSync(path.join(reportDir, 'index.html'), renderHtml());

function renderHtml() {
  const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const img = (run, file) => (file ? `<a href="../../runs/${run}/${file}"><img src="../../runs/${run}/${file}" loading="lazy"></a>` : '<div class="none">–</div>');
  const sorted = [...results].sort((x, y) => (y.issues.length > 0) - (x.issues.length > 0) || ((y.visual && y.visual.ratio) || 0) - ((x.visual && x.visual.ratio) || 0));
  const rows = sorted.map(r => `
    <section class="${r.issues.length ? 'diff' : 'same'}">
      <h2>${esc(r.viewport)} · ${esc(r.step)} <small>${esc(r.title)}</small></h2>
      ${r.issues.length ? `<ul>${r.issues.map(i => `<li><b>${esc(i.type)}</b> ${esc(i.description)}</li>`).join('')}</ul>` : '<p class="ok">no difference</p>'}
      <div class="images">
        <figure><figcaption>before</figcaption>${img(before.run, r.before && r.before.screenshot)}</figure>
        <figure><figcaption>after</figcaption>${img(after.run, r.after && r.after.screenshot)}</figure>
        <figure><figcaption>diff</figcaption>${r.visual && r.visual.diff ? `<a href="${r.visual.diff}"><img src="${r.visual.diff}" loading="lazy"></a>` : '<div class="none">–</div>'}</figure>
      </div>
    </section>`).join('\n');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Regression ${esc(reportName)}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #222; }
  .summary td { padding: .2rem 1rem .2rem 0; }
  section { border-top: 1px solid #ddd; padding: 1rem 0; }
  section.same { opacity: .6; }
  h2 { font-size: 1.1rem; margin: 0 0 .5rem; } h2 small { font-weight: normal; color: #666; }
  .images { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
  figure { margin: 0; } figcaption { font-size: .8rem; color: #666; }
  img { width: 100%; border: 1px solid #ccc; } .none { color: #999; }
  .ok { color: #2a7a2a; } li b { text-transform: uppercase; font-size: .75rem; margin-right: .5rem; }
</style></head><body>
<h1>Regression comparison</h1>
<table class="summary">
  <tr><td>Baseline</td><td>${esc(beforeRun)} (${esc(before.baseUrl)})</td></tr>
  <tr><td>After</td><td>${esc(afterRun)} (${esc(after.baseUrl)})</td></tr>
  <tr><td>Steps</td><td>${summary.steps}, identical ${summary.identical}</td></tr>
  <tr><td>Differences</td><td>visual ${summary.visual} · functional ${summary.functional} · console ${summary.console} · requests ${summary.request} · Jest ${summary.jest}</td></tr>
  ${jest ? `<tr><td>Jest</td><td>before ${jest.before.failed}/${jest.before.total} failed · after ${jest.after.failed}/${jest.after.total} failed · new failures ${jest.newFailures.length} · fixed ${jest.fixed.length}</td></tr>` : ''}
</table>
${notes.length ? `<h3>Notes</h3><ul>${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
${jest && jest.newFailures.length ? `<h3>New failing tests</h3><ul>${jest.newFailures.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
${rows}
</body></html>
`;
}

log.header('Regression Compare');
log.info(`Baseline: ${beforeRun}`);
log.info(`After:    ${afterRun}`);
console.log();
console.log(`  Steps compared        ${String(summary.steps).padStart(4)}   identical ${summary.identical}`);
console.log(`  ${chalk.yellow('Visual differences')}    ${String(summary.visual).padStart(4)}`);
console.log(`  ${chalk.red('Functional')}            ${String(summary.functional).padStart(4)}`);
console.log(`  New console errors    ${String(summary.console).padStart(4)}`);
console.log(`  New failed requests   ${String(summary.request).padStart(4)}`);
console.log(`  New Jest failures     ${String(summary.jest).padStart(4)}`);
notes.forEach(n => log.dim(`  note: ${n}`));
console.log();
log.success(`Report: ${path.relative(projectDir, path.join(reportDir, 'index.html'))}`);
log.info('Next: npm run regression:findings   (document and triage the differences)');
