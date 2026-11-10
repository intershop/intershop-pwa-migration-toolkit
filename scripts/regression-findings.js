#!/usr/bin/env node

/**
 * Regression Findings: Document, triage and check the differences
 *
 * Maintains migration-qa/findings.md (committed with the migration):
 *   - default:  take over the differences of the latest comparison
 *               (new → open, gone → verified, still present → open again)
 *   - --triage: classify untriaged findings interactively
 *               (intended | unintended, cause, fix | won't fix, reference)
 *   - --set:    update a finding (e.g. status fixed + commit reference)
 *   - --check:  exit criteria – exit code 1 while unintended findings are open
 *
 * The table can also be edited by hand; keep one finding per row.
 * See docs/guides/regression-testing-guide.md
 *
 * Usage:
 *   node scripts/regression-findings.js [OPTIONS]
 *
 * Options:
 *   --report <dir>          Comparison report (default: latest report)
 *   --triage                Classify untriaged findings interactively
 *   --set <ID>              Finding to update, combined with:
 *     --status <status>       open | fixed | verified | accepted
 *     --classification <c>    intended | unintended
 *     --decision <d>          fix | won't fix
 *     --cause <text>
 *     --reference <text>      commit, issue or changelog reference
 *   --check                 Check the exit criteria
 *   --project-dir <dir>     Path to PWA project (default: cwd)
 *   --help                  Show this help message
 */

const fs = require('fs');
const path = require('path');
const { log, askChoice, askInput, chalk } = require('./_utils');
const { projectDir } = require('./_project-dir');
const { qaPaths, runRound } = require('./_regression');

// Parse arguments
const args = process.argv.slice(2);
let reportArg = '';
let mode = 'update';
let setId = '';
const setFields = {};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--report': reportArg = args[++i]; break;
    case '--triage': mode = 'triage'; break;
    case '--check': mode = 'check'; break;
    case '--set': mode = 'set'; setId = args[++i]; break;
    case '--status': setFields.status = args[++i]; break;
    case '--classification': setFields.classification = args[++i]; break;
    case '--decision': setFields.decision = args[++i]; break;
    case '--cause': setFields.cause = args[++i]; break;
    case '--reference': setFields.reference = args[++i]; break;
    case '--project-dir': i++; break; // handled by _project-dir.js
    case '--help':
      console.log(`Usage: node scripts/regression-findings.js [OPTIONS]

Options:
  --report <dir>          Comparison report (default: latest report)
  --triage                Classify untriaged findings interactively
  --set <ID>              Update a finding, combined with:
    --status <status>       open | fixed | verified | accepted
    --classification <c>    intended | unintended
    --decision <d>          fix | "won't fix"
    --cause <text>
    --reference <text>      commit, issue or changelog reference
  --check                 Check the exit criteria (exit code 1 if not met)
  --project-dir <dir>     Path to PWA project (default: cwd)

Examples:
  # Take over the latest comparison
  node scripts/regression-findings.js

  # Classify new findings
  node scripts/regression-findings.js --triage

  # Mark a finding as fixed
  node scripts/regression-findings.js --set F-003 --status fixed --reference "commit abc1234"

  # Exit criteria
  node scripts/regression-findings.js --check`);
      process.exit(0);
  }
}

const paths = qaPaths(projectDir);
const COLUMNS = ['ID', 'Step', 'Viewport', 'Type', 'Description', 'Classification', 'Cause', 'Decision', 'Status', 'Reference', 'Found', 'Last seen'];
const FIELDS = ['id', 'step', 'viewport', 'type', 'description', 'classification', 'cause', 'decision', 'status', 'reference', 'found', 'lastSeen'];
const STATUSES = ['open', 'fixed', 'verified', 'accepted'];

// ─── findings.md ────────────────────────────────────────────────────────────

function readFindings() {
  if (!fs.existsSync(paths.findings)) return [];
  return fs.readFileSync(paths.findings, 'utf-8')
    .split(/\r?\n/)
    .filter(line => /^\|\s*F-\d+/.test(line))
    .map(line => {
      const cells = line.slice(1, line.lastIndexOf('|')).split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
      return Object.fromEntries(FIELDS.map((f, i) => [f, cells[i] === '–' ? '' : (cells[i] || '')]));
    });
}

function writeFindings(findings) {
  const esc = s => (s ? String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ') : '–');
  const lines = [
    '# Regression Findings',
    '',
    'Differences between the baseline (before the migration) and the after runs.',
    'Classification: `intended` (justification/reference required) | `unintended` (bug) | `?` (not triaged).',
    'Decision: `fix` | `won\'t fix` (reason + who decided in Cause/Reference).',
    'Status: `open` → `fixed` → `verified` | `accepted` (intended or won\'t fix).',
    '',
    'Maintained by `node scripts/regression-findings.js` – cells can be edited by hand, keep one finding per row.',
    '',
    `| ${COLUMNS.join(' | ')} |`,
    `|${COLUMNS.map(() => '---').join('|')}|`,
    ...findings.map(f => `| ${FIELDS.map(field => esc(f[field])).join(' | ')} |`),
    '',
  ];
  fs.mkdirSync(paths.root, { recursive: true });
  fs.writeFileSync(paths.findings, lines.join('\n'));
}

const keyOf = f => `${f.type}|${f.viewport}|${f.step}`;

function latestReport() {
  if (reportArg) return path.isAbsolute(reportArg) ? reportArg : path.join(paths.reports, reportArg);
  if (!fs.existsSync(paths.reports)) return null;
  const reports = fs.readdirSync(paths.reports)
    .map(name => path.join(paths.reports, name, 'compare.json'))
    .filter(file => fs.existsSync(file))
    .map(file => ({ file, data: JSON.parse(fs.readFileSync(file, 'utf-8')) }))
    .sort((a, b) => a.data.round - b.data.round || a.data.createdAt.localeCompare(b.data.createdAt));
  return reports.length ? path.dirname(reports[reports.length - 1].file) : null;
}

function roundLabel(run) {
  const round = runRound(run);
  return round === 1 ? 'after' : `after-${round}`;
}

// ─── Modes ──────────────────────────────────────────────────────────────────

function update() {
  const reportDir = latestReport();
  if (!reportDir) {
    log.error('No comparison found. Run regression:compare first.');
    process.exit(1);
  }
  const compare = JSON.parse(fs.readFileSync(path.join(reportDir, 'compare.json'), 'utf-8'));
  const round = roundLabel(compare.after);
  const findings = readFindings();
  const byKey = new Map(findings.map(f => [keyOf(f), f]));

  // one finding per type/viewport/step – descriptions of the same key are combined
  const current = new Map();
  for (const d of compare.differences) {
    const k = keyOf(d);
    const description = d.diff ? `${d.description} (diff: reports/${path.basename(reportDir)}/${d.diff})` : d.description;
    if (current.has(k)) current.get(k).description += `; ${description}`;
    else current.set(k, { ...d, description });
  }

  let added = 0;
  let reopened = 0;
  let verified = 0;
  for (const [k, d] of current) {
    const existing = byKey.get(k);
    if (!existing) {
      findings.push({
        id: `F-${String(findings.length + 1).padStart(3, '0')}`,
        step: d.step,
        viewport: d.viewport,
        type: d.type,
        description: d.description,
        classification: '?',
        cause: '',
        decision: '',
        status: 'open',
        reference: '',
        found: round,
        lastSeen: round,
      });
      added++;
    } else {
      existing.lastSeen = round;
      existing.description = d.description;
      if (existing.status === 'fixed' || existing.status === 'verified') {
        existing.status = 'open';
        reopened++;
      }
    }
  }
  for (const f of findings) {
    if (current.has(keyOf(f))) continue;
    if (f.status === 'open' || f.status === 'fixed') {
      f.status = f.classification === 'unintended' || f.classification === '?' ? 'verified' : 'accepted';
      f.lastSeen = `gone in ${round}`;
      verified++;
    }
  }
  writeFindings(findings);

  log.header('Regression Findings');
  log.info(`Comparison: ${path.basename(reportDir)} (round ${round})`);
  console.log();
  console.log(`  New findings              ${String(added).padStart(4)}`);
  console.log(`  Still present / reopened  ${String(reopened).padStart(4)}`);
  console.log(`  Gone → verified           ${String(verified).padStart(4)}`);
  console.log();
  log.success(`Updated: ${path.relative(projectDir, paths.findings)}`);
  const untriaged = findings.filter(f => f.classification === '?').length;
  if (untriaged) log.info(`Next: node scripts/regression-findings.js --triage   (${untriaged} finding(s) not triaged)`);
  else check(false);
}

async function triage() {
  const findings = readFindings();
  const open = findings.filter(f => f.classification === '?');
  if (!open.length) {
    log.success('All findings are triaged.');
    return;
  }
  log.header(`Triage – ${open.length} finding(s)`);
  for (const f of open) {
    console.log();
    console.log(chalk.bold(`${f.id} · ${f.step} · ${f.viewport} · ${f.type}`));
    console.log(`  ${f.description}`);
    const classification = await askChoice('Is this difference intended?', [
      { value: 'intended', label: 'intended (e.g. documented upstream change)' },
      { value: 'unintended', label: 'unintended (bug)' },
      { value: 'skip', label: 'decide later' },
    ]);
    if (classification === 'skip') continue;
    f.classification = classification;
    if (classification === 'intended') {
      f.reference = await askInput('Justification / reference (e.g. upstream changelog entry):');
      f.decision = '';
      f.status = 'accepted';
    } else {
      f.cause = await askInput('Cause (if known):');
      const decision = await askChoice('Decision?', [
        { value: 'fix', label: 'fix' },
        { value: "won't fix", label: "won't fix (reason and who decided required)" },
      ]);
      f.decision = decision;
      if (decision === "won't fix") {
        f.reference = await askInput('Reason and who decided:');
        f.status = 'accepted';
      } else {
        // a difference that already disappeared stays verified
        f.status = f.status === 'verified' ? 'verified' : 'open';
      }
    }
    writeFindings(findings);
  }
  log.success(`Updated: ${path.relative(projectDir, paths.findings)}`);
}

function set() {
  const findings = readFindings();
  const finding = findings.find(f => f.id === setId);
  if (!finding) {
    log.error(`Finding ${setId} not found.`);
    process.exit(1);
  }
  if (setFields.status && !STATUSES.includes(setFields.status)) {
    log.error(`Status must be one of: ${STATUSES.join(', ')}`);
    process.exit(1);
  }
  Object.assign(finding, setFields);
  if (!setFields.status && (finding.classification === 'intended' || finding.decision === "won't fix")) finding.status = 'accepted';
  writeFindings(findings);
  log.success(`${setId} updated.`);
}

function check(exit = true) {
  const findings = readFindings();
  const problems = [];
  const untriaged = findings.filter(f => f.classification === '?');
  const openBugs = findings.filter(f => f.classification === 'unintended' && ['open', 'fixed'].includes(f.status));
  const unjustified = findings.filter(f => (f.classification === 'intended' || f.decision === "won't fix") && !f.reference && !f.cause);
  if (untriaged.length) problems.push(`${untriaged.length} finding(s) not triaged: ${untriaged.map(f => f.id).join(', ')}`);
  if (openBugs.length) problems.push(`${openBugs.length} unintended finding(s) open or not yet verified: ${openBugs.map(f => `${f.id} (${f.status})`).join(', ')}`);
  if (unjustified.length) problems.push(`${unjustified.length} intended / won't fix finding(s) without justification: ${unjustified.map(f => f.id).join(', ')}`);

  console.log();
  if (problems.length) {
    log.warning('Exit criteria NOT met:');
    problems.forEach(p => log.warning(`  - ${p}`));
    if (exit) process.exit(1);
  } else {
    log.success(`Exit criteria met: ${findings.length} finding(s), none unintended open.`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

if (mode === 'update') update();
else if (mode === 'set') set();
else if (mode === 'check') check();
else triage().catch(err => {
  log.error(err.message);
  process.exit(1);
});
