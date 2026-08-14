#!/usr/bin/env node
/**
 * Post-merge pattern verification.
 *
 * Scans the merged codebase for old patterns that should have been migrated
 * but survived the auto-merge (e.g., Git picked the wrong hunk side).
 *
 * Usage:
 *   node scripts/verify-merge-patterns.js <sourceVersion> <targetVersion> [options]
 *   node scripts/verify-merge-patterns.js 11.0.0 12.0.0
 *   node scripts/verify-merge-patterns.js 11.0.0 12.0.0 --project-dir /path/to/pwa --fix
 *
 * Options:
 *   --project-dir <dir>    PWA project directory (default: cwd or $PWA_PROJECT_DIR)
 *   --fix                  Auto-fix by restoring affected files from the upstream tag
 *   --target-tag <tag>     Upstream tag to restore from (default: targetVersion)
 */

const fs = require('fs');
const path = require('path');
const { log, findFiles } = require('./_utils');
const { projectDir: defaultProjectDir } = require('./_project-dir');

const patternDb = require('../data/pattern-migrations.json');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { fix: false };
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project-dir' && args[i + 1]) {
      opts.projectDir = args[++i];
    } else if (args[i] === '--target-tag' && args[i + 1]) {
      opts.targetTag = args[++i];
    } else if (args[i] === '--fix') {
      opts.fix = true;
    } else if (!args[i].startsWith('-')) {
      positional.push(args[i]);
    }
  }

  if (positional.length < 2) {
    console.log('Usage: node scripts/verify-merge-patterns.js <sourceVersion> <targetVersion> [options]');
    console.log('Example: node scripts/verify-merge-patterns.js 11.0.0 12.0.0');
    process.exit(1);
  }

  opts.sourceVersion = positional[0];
  opts.targetVersion = positional[1];
  opts.targetTag = opts.targetTag || opts.targetVersion;

  return opts;
}

function getRelevantPatterns(sourceVersion, targetVersion) {
  const srcMajor = parseFloat(sourceVersion);
  const tgtMajor = parseFloat(targetVersion);

  const patterns = [];
  for (const migration of patternDb.migrations) {
    const from = parseFloat(migration.fromVersion);
    const to = parseFloat(migration.toVersion);
    if (from >= srcMajor && to <= tgtMajor) {
      for (const p of migration.patterns) {
        if (p.searchRegex && (p.severity === 'critical' || p.severity === 'high')) {
          patterns.push({
            ...p,
            migrationDesc: migration.description,
          });
        }
      }
    }
  }
  return patterns;
}

function getFileGlob(globPattern) {
  if (!globPattern) return /\.(ts|html)$/;
  if (globPattern.includes('.scss')) return /\.scss$/;
  if (globPattern.includes('.html')) return /\.html$/;
  if (globPattern.includes('.ts')) return /\.ts$/;
  return /\.(ts|html)$/;
}

function scanForStalePatterns(projectDir, patterns) {
  const findings = [];

  for (const pattern of patterns) {
    const fileRegex = getFileGlob(pattern.files);
    const files = findFiles(path.join(projectDir, 'src'), fileRegex)
      .concat(findFiles(path.join(projectDir, 'projects'), fileRegex));

    const searchRegex = new RegExp(pattern.searchRegex, 'g');

    for (const file of files) {
      // skip spec snapshots for certain patterns
      const content = fs.readFileSync(file, 'utf-8');
      const matches = content.match(searchRegex);
      if (matches) {
        const relPath = path.relative(projectDir, file);
        findings.push({
          file: relPath,
          pattern: pattern.description,
          severity: pattern.severity,
          count: matches.length,
          migrationDesc: pattern.migrationDesc,
        });
      }
    }
  }

  return findings;
}

function isUpstreamFile(projectDir, file, targetTag) {
  try {
    const { execSync } = require('child_process');
    execSync(`git show ${targetTag}:${file}`, { cwd: projectDir, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function fixFile(projectDir, file, targetTag) {
  try {
    const { execSync } = require('child_process');
    const content = execSync(`git show ${targetTag}:${file}`, { cwd: projectDir, encoding: 'utf-8' });
    fs.writeFileSync(path.join(projectDir, file), content);
    return true;
  } catch {
    return false;
  }
}

function main() {
  const opts = parseArgs();
  const projectDir = opts.projectDir || defaultProjectDir;

  log.header('Post-Merge Pattern Verification');
  log.info(`Source: ${opts.sourceVersion} → Target: ${opts.targetVersion}`);
  log.info(`Project: ${projectDir}`);

  const patterns = getRelevantPatterns(opts.sourceVersion, opts.targetVersion);
  if (patterns.length === 0) {
    log.info('No critical/high patterns found for this version range.');
    return;
  }
  log.info(`Checking ${patterns.length} critical/high patterns...`);

  const findings = scanForStalePatterns(projectDir, patterns);

  if (findings.length === 0) {
    log.success('No stale patterns found. Merge looks clean.');
    return;
  }

  // Group by custom vs upstream
  const customFindings = [];
  const upstreamFindings = [];

  for (const f of findings) {
    if (isUpstreamFile(projectDir, f.file, opts.targetTag)) {
      // Check if the file differs from upstream
      try {
        const { execSync } = require('child_process');
        const upstreamContent = execSync(`git show ${opts.targetTag}:${f.file}`, { cwd: projectDir, encoding: 'utf-8' });
        const localContent = fs.readFileSync(path.join(projectDir, f.file), 'utf-8');
        if (upstreamContent !== localContent) {
          upstreamFindings.push(f);
        }
        // If identical to upstream, the pattern exists upstream too — not our problem
      } catch {
        customFindings.push(f);
      }
    } else {
      customFindings.push(f);
    }
  }

  if (upstreamFindings.length > 0) {
    log.section(`Stale patterns in upstream files (likely auto-merge errors): ${upstreamFindings.length}`);
    console.log('');
    for (const f of upstreamFindings) {
      log.warning(`  ${f.file}`);
      console.log(`    Pattern: ${f.pattern} (${f.count}x, ${f.severity})`);
    }
    console.log('');

    if (opts.fix) {
      log.section('Auto-fixing by restoring from upstream tag...');
      let fixed = 0;
      for (const f of upstreamFindings) {
        if (fixFile(projectDir, f.file, opts.targetTag)) {
          log.success(`  Restored: ${f.file}`);
          fixed++;
        } else {
          log.error(`  Failed: ${f.file}`);
        }
      }
      log.info(`Fixed ${fixed}/${upstreamFindings.length} files.`);
    } else {
      log.info('Run with --fix to auto-restore these files from the upstream tag.');
    }
  }

  if (customFindings.length > 0) {
    log.section(`Stale patterns in custom files (need manual migration): ${customFindings.length}`);
    for (const f of customFindings) {
      log.warning(`  ${f.file}`);
      console.log(`    Pattern: ${f.pattern} (${f.count}x, ${f.severity})`);
    }
  }

  if (upstreamFindings.length === 0 && customFindings.length === 0) {
    log.success('All pattern findings are identical to upstream — no action needed.');
  }
}

main();
