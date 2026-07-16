#!/usr/bin/env node

/**
 * ICM Compatibility Check Script
 *
 * Checks if your ICM backend version is compatible with your PWA version.
 * Based on requirements from: https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/migrations.md
 *
 * Usage:
 *   node scripts/check-icm-compatibility.js
 *   node scripts/check-icm-compatibility.js --pwa-version 11.0.0
 *   node scripts/check-icm-compatibility.js --icm-url https://your-icm-server.com
 */

const fs = require('fs');
const path = require('path');
const { projectDir } = require('./_project-dir');
const { log, execSilent, parseVersion, compareVersions, chalk } = require('./_utils');

process.chdir(projectDir);

// Parse arguments
const args = process.argv.slice(2);
let pwaVersion = '';
let icmBaseUrl = '';

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--pwa-version': pwaVersion = args[++i] || ''; break;
    case '--icm-url': icmBaseUrl = args[++i] || ''; break;
    case '-h': case '--help':
      console.log(`Usage: node scripts/check-icm-compatibility.js [OPTIONS]

Options:
  --pwa-version <version>   Specify PWA version (default: from package.json)
  --icm-url <url>           Specify ICM base URL (default: from environment.ts)
  -h, --help                Show this help message`);
      process.exit(0);
  }
}

console.log('==================================================');
console.log('  ICM Compatibility Check');
console.log('==================================================');
console.log();

// Step 1: Detect PWA version
if (!pwaVersion) {
  const pkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    pwaVersion = pkg.version || '';
    console.log(`${chalk.blue('🔍 Detected PWA Version:')} ${pwaVersion} (from package.json)`);
  } else {
    console.log(chalk.red('❌ Error: Could not detect PWA version. package.json not found.'));
    console.log('   Please specify with --pwa-version <version>');
    process.exit(1);
  }
} else {
  console.log(`${chalk.blue('📦 PWA Version:')} ${pwaVersion} (from argument)`);
}

const pwaVersionClean = pwaVersion.replace(/-.*$/, '');
const pwaVer = parseVersion(pwaVersionClean);
console.log();

// Step 2: Check for pattern-migrations.json
const patternDbPath = path.join(__dirname, '..', 'data', 'pattern-migrations.json');
let patternDb = null;
try {
  patternDb = JSON.parse(fs.readFileSync(patternDbPath, 'utf-8'));
} catch {
  console.log(chalk.yellow('⚠️  Warning: pattern-migrations.json not found'));
  console.log('   Cannot verify detailed ICM requirements');
  console.log();
}

// Step 3: Detect ICM base URL
if (!icmBaseUrl) {
  const envFiles = [
    path.join(projectDir, 'src/environments/environment.ts'),
    path.join(projectDir, 'src/environments/environment.model.ts'),
  ];
  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf-8');
      const match = content.match(/icmBaseURL.*?['"](\s*https?:\/\/[^'"]+)['"]/);
      if (match) {
        icmBaseUrl = match[1].trim();
        console.log(`${chalk.blue('🔍 Detected ICM URL:')} ${icmBaseUrl} (from ${path.basename(envFile)})`);
        break;
      }
    }
  }
  if (!icmBaseUrl) {
    console.log(chalk.yellow('⚠️  Could not auto-detect ICM URL'));
    console.log('   Please specify with --icm-url <url>');
    console.log();
    console.log('Skipping live ICM version check...');
  }
} else {
  console.log(`${chalk.blue('🌐 ICM URL:')} ${icmBaseUrl} (from argument)`);
}
console.log();

// Step 4: Fetch ICM version from REST API (if URL available)
let icmVersion = 'unknown';

async function fetchIcmVersion() {
  if (!icmBaseUrl) return;

  console.log(chalk.blue('🔄 Fetching ICM version from REST API...'));

  const configUrl = `${icmBaseUrl}/INTERSHOP/rest/WFS/-;loc=en_US;cur=USD/configurations`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(configUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      console.log(chalk.yellow('⚠️  Could not fetch ICM version from REST API'));
      console.log(`   URL tried: ${configUrl}`);
      return;
    }

    const data = await response.json();
    icmVersion = data.version || data?.data?.version || 'unknown';

    if (icmVersion !== 'unknown') {
      console.log(`${chalk.green('✅ ICM Version:')} ${icmVersion}`);
    } else {
      console.log(chalk.yellow('⚠️  Could not parse ICM version from response'));
    }
  } catch (err) {
    console.log(chalk.yellow('⚠️  Could not fetch ICM version from REST API'));
    console.log(`   URL tried: ${configUrl}`);
    console.log(`   Error: ${err.message}`);
  }
}

// ICM requirements by PWA version
const ICM_REQUIREMENTS = {
  '11.0': '14.0.1',
  '10.0': '11.0.0',
  '9.1': '11.0.0',
  '9.0': '11.0.0',
  '8.0': '11.0.0',
  '7.1': '7.10.38.0',
  '7.0': '7.10.0.0',
};

async function run() {
  await fetchIcmVersion();
  console.log();

  // Step 5: Check requirements
  console.log('==================================================');
  console.log('  Compatibility Analysis');
  console.log('==================================================');
  console.log();

  const pwaKey = `${pwaVer.major}.${pwaVer.minor}`;

  // Try to load from pattern DB
  if (patternDb) {
    const migration = patternDb.migrations?.find(m => {
      const v = m.toVersion;
      return v === `${pwaKey}.0` || v === pwaKey;
    });
    if (migration?.icmRequirements?.minimum) {
      ICM_REQUIREMENTS[pwaKey] = migration.icmRequirements.minimum;
    }
  }

  let requiredIcmVersion = ICM_REQUIREMENTS[pwaKey] || 'unknown';

  if (requiredIcmVersion === 'unknown') {
    console.log(chalk.yellow(`⚠️  No specific ICM requirement found for PWA ${pwaVersion}`));
    console.log('   Using general compatibility rules...');
    console.log();
    if (pwaVer.major >= 8) {
      requiredIcmVersion = '11.0.0';
      console.log(`   PWA ${pwaVer.major}.x generally requires ${chalk.blue('ICM 11.0.0+')}`);
    } else {
      requiredIcmVersion = '7.10.38.0';
      console.log(`   PWA ${pwaVer.major}.x generally requires ${chalk.blue('ICM 7.10.38+')}`);
    }
  } else {
    console.log(`${chalk.blue('📋 Minimum ICM Version Required:')} ${requiredIcmVersion}`);
  }
  console.log();

  // Step 6: Compare versions
  let compatibilityIssues = false;
  if (icmVersion !== 'unknown') {
    const icmVersionClean = icmVersion.replace(/-.*$/, '');
    if (compareVersions(icmVersionClean, requiredIcmVersion) >= 0) {
      console.log(chalk.green('✅ ICM VERSION COMPATIBLE'));
      console.log(`   Your ICM ${icmVersionClean} meets the minimum requirement of ${requiredIcmVersion}`);
    } else {
      console.log(chalk.red('❌ ICM VERSION TOO OLD'));
      console.log(`   Your ICM: ${icmVersionClean}`);
      console.log(`   Required: ${requiredIcmVersion} or higher`);
      console.log();
      console.log(chalk.yellow('⚠️  Warning: Some PWA features may not work correctly!'));
      compatibilityIssues = true;
    }
  } else {
    console.log(chalk.yellow('⚠️  Cannot verify compatibility - ICM version unknown'));
    console.log(`   Please check manually that your ICM is at least version ${requiredIcmVersion}`);
  }
  console.log();

  // Step 7: Feature-specific requirements from pattern DB
  if (patternDb) {
    console.log('==================================================');
    console.log('  Feature-Specific Requirements');
    console.log('==================================================');
    console.log();

    const migration = patternDb.migrations?.find(m => {
      const v = m.toVersion;
      return v === `${pwaKey}.0` || v === pwaKey;
    });

    if (migration?.icmRequirements?.features?.length) {
      console.log('Some features have specific ICM requirements:');
      console.log();
      for (const feat of migration.icmRequirements.features) {
        console.log(`- ${feat.feature}: ICM ${feat.icmMinVersion}+ (${feat.description})`);
      }
      console.log();
    }

    if (migration?.icmRequirements?.extensions?.length) {
      console.log('Required ICM Extensions:');
      console.log();
      for (const ext of migration.icmRequirements.extensions) {
        console.log(`- ${ext.name}: ${ext.packageId}:${ext.minVersion}`);
      }
      console.log();
    }
  }

  // Step 8: Summary
  console.log('==================================================');
  console.log('  Summary');
  console.log('==================================================');
  console.log();

  if (compatibilityIssues) {
    console.log(chalk.red('⚠️  COMPATIBILITY ISSUES DETECTED'));
    console.log();
    console.log('Recommendations:');
    console.log(`  1. Upgrade your ICM to at least version ${requiredIcmVersion}`);
    console.log('  2. Review migration notes: https://github.com/intershop/intershop-pwa/blob/develop/docs/guides/migrations.md');
    console.log('  3. Test thoroughly in staging environment');
    console.log();
    process.exit(1);
  } else if (icmVersion !== 'unknown') {
    console.log(chalk.green('✅ No compatibility issues detected'));
    console.log();
    console.log(`Your ICM version appears compatible with PWA ${pwaVersion}`);
  } else {
    console.log(chalk.yellow('⚠️  Manual verification needed'));
    console.log();
    console.log('Recommendations:');
    console.log(`  1. Verify ICM version is at least ${requiredIcmVersion}`);
    console.log('  2. Check with your ops team for backend version');
    console.log('  3. Test API connectivity before proceeding');
  }
  console.log();
}

run();
