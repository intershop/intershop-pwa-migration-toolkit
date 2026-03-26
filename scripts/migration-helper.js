#!/usr/bin/env node

/**
 * Interactive Migration Helper
 *
 * This tool provides an interactive interface for migrating customizations
 * from an old PWA version to a new one.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const readline = require('readline');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: msg => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: msg => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: msg => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: msg => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  step: (num, msg) => console.log(`\n${colors.cyan}Step ${num}:${colors.reset} ${msg}`),
};

// Helper to execute shell commands
function exec(command, silent = false) {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
    });
    return { success: true, output: output?.trim() };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      output: error.stdout?.toString()?.trim(),
    };
  }
}

// Helper to ask yes/no questions
function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(`${colors.cyan}${question} (y/n):${colors.reset} `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Helper to ask for text input
function askText(question, defaultValue = '') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = defaultValue
    ? `${colors.cyan}${question} [${defaultValue}]:${colors.reset} `
    : `${colors.cyan}${question}:${colors.reset} `;

  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

// Get list of branches
function getBranches() {
  const result = exec('git branch -a', true);
  if (!result.success) return [];

  return result.output
    .split('\n')
    .map(b => b.replace('*', '').trim())
    .filter(b => b && !b.startsWith('remotes/origin/HEAD'));
}

// Get list of tags (releases)
function getTags() {
  const result = exec('git tag -l', true);
  if (!result.success) return [];

  return result.output
    .split('\n')
    .filter(t => t)
    .sort((a, b) => {
      // Sort by semantic version
      const aParts = a.split('.').map(n => parseInt(n) || 0);
      const bParts = b.split('.').map(n => parseInt(n) || 0);
      for (let i = 0; i < 3; i++) {
        if (aParts[i] !== bParts[i]) return aParts[i] - bParts[i];
      }
      return 0;
    });
}

// Extract version from branch/tag name
function extractVersion(branchOrTag) {
  // Try to extract version pattern like X.Y.Z or X.Y
  const patterns = [
    /(\d+\.\d+\.\d+)/,     // X.Y.Z
    /(\d+\.\d+)/,          // X.Y
    /v?(\d+)\.(\d+)/,      // vX.Y or X.Y
  ];
  
  for (const pattern of patterns) {
    const match = branchOrTag.match(pattern);
    if (match) {
      // Return just the major.minor version for comparison
      const version = match[1] || `${match[1]}.${match[2]}`;
      const parts = version.split('.');
      return {
        full: version,
        major: parseInt(parts[0]),
        minor: parseInt(parts[1]) || 0,
        shortVersion: `${parts[0]}.${parts[1] || 0}`
      };
    }
  }
  
  return null;
}

// Show video tutorial links if available
function showVideoTutorials(sourceVersion, targetVersion) {
  if (!sourceVersion || !targetVersion) return;
  
  const source = extractVersion(sourceVersion);
  const target = extractVersion(targetVersion);
  
  if (!source || !target) return;
  
  // Define available video tutorials
  const tutorials = [
    {
      sourceMin: 7.0,
      sourceMax: 7.2,
      targetMin: 8.0,
      targetMax: 8.9,
      title: 'Migrating from PWA 7.0 to 8.0',
      url: 'https://public.academy.intershop.com/plus/catalog/courses/452',
      description: 'Visual walkthrough covering Node.js 22 upgrade, Stylelint changes, and key breaking changes'
    },
    {
      sourceMin: 8.0,
      sourceMax: 8.9,
      targetMin: 9.0,
      targetMax: 9.9,
      title: 'Migrating from PWA 8.0 to 9.0',
      url: 'https://public.academy.intershop.com/plus/catalog/courses/454',
      description: 'Bootstrap 5 migration, Sass module system, and major structural changes'
    }
  ];
  
  // Check if any tutorial matches
  const sourceMajorMinor = source.major + (source.minor / 10);
  const targetMajorMinor = target.major + (target.minor / 10);
  
  const matchingTutorials = tutorials.filter(t => 
    sourceMajorMinor >= t.sourceMin && sourceMajorMinor <= t.sourceMax &&
    targetMajorMinor >= t.targetMin && targetMajorMinor <= t.targetMax
  );
  
  if (matchingTutorials.length > 0) {
    console.log('\n' + colors.blue + '='.repeat(60));
    console.log('  📺 Video Tutorial Available!');
    console.log('='.repeat(60) + colors.reset + '\n');
    
    matchingTutorials.forEach(tutorial => {
      console.log(`${colors.green}${tutorial.title}${colors.reset}`);
      console.log(`${colors.cyan}${tutorial.url}${colors.reset}\n`);
      console.log(`${colors.yellow}What it covers:${colors.reset} ${tutorial.description}\n`);
    });
    
    console.log(`${colors.blue}ℹ️  Note:${colors.reset} Free registration required at Intershop Academy`);
    console.log(`${colors.blue}ℹ️  Tip:${colors.reset} Watch the video before starting for best results`);
    console.log('');
  }
}

// Get list of branches
function getBranches() {
  const result = exec('git branch -a', true);
  if (!result.success) return [];

  return result.output
    .split('\n')
    .map(b => b.replace('*', '').trim())
    .filter(b => b && !b.startsWith('remotes/origin/HEAD'));
}

// Get list of tags (releases) - old function below (will be replaced above)
function getTagsOld() {
  const result = exec('git tag -l', true);
  if (!result.success) return [];
    .filter(t => t.trim())
    .filter(t => /^\d+\.\d+\.\d+/.test(t)) // Only version tags
    .sort((a, b) => {
      // Version sort
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if (aParts[i] !== bParts[i]) return aParts[i] - bParts[i];
      }
      return 0;
    });
}

// Detect Intershop PWA remote
function detectIntershopRemote() {
  const remotes = ['upstream', 'intershop-pwa', 'intershop', 'origin'];
  
  for (const remote of remotes) {
    const urlResult = exec(`git remote get-url ${remote}`, true);
    if (urlResult.success && urlResult.output.includes('intershop/intershop-pwa')) {
      return remote;
    }
  }
  
  return null;
}

// Fetch tags and branches from Intershop remote
async function setupIntershopRemote() {
  log.info('Checking Intershop PWA remote...');
  
  let intershopRemote = detectIntershopRemote();
  
  if (!intershopRemote) {
    log.warning('Intershop PWA remote not found');
    const shouldAdd = await ask('Would you like to add it now?');
    
    if (shouldAdd) {
      const remoteName = await askText('Remote name', 'intershop-pwa');
      const result = exec(
        `git remote add ${remoteName} git@github.com:intershop/intershop-pwa.git`,
        true
      );
      
      if (result.success) {
        intershopRemote = remoteName;
        log.success(`Added remote: ${remoteName}`);
      } else {
        log.error('Failed to add remote');
        return null;
      }
    } else {
      return null;
    }
  }
  
  // Fetch from Intershop remote
  log.info(`Fetching from ${intershopRemote}...`);
  exec(`git fetch ${intershopRemote} --tags`, true);
  
  return intershopRemote;
}

// Interactive tag/branch selection
async function selectTargetVersion(intershopRemote) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}  Select Target PWA Version${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
  
  const tags = getTags();
  const recentTags = tags.slice(-10); // Last 10 tags
  
  if (recentTags.length > 0) {
    console.log(`${colors.green}Available stable releases (tags):${colors.reset}`);
    recentTags.forEach((tag, i) => {
      const num = (i + 1).toString().padStart(2, ' ');
      console.log(`  ${num}. ${tag}`);
    });
    console.log();
  }
  
  console.log(`${colors.yellow}Recommendation:${colors.reset}`);
  console.log('  • Use a stable TAG (e.g., 9.1.0) for production migrations');
  console.log('  • Use a BRANCH (e.g., develop) only for testing bleeding edge\n');
  
  const useTag = await ask('Use a stable release tag? (recommended)');
  
  if (useTag) {
    const targetTag = await askText(
      'Enter target version tag',
      recentTags.length > 0 ? recentTags[recentTags.length - 1] : '9.1.0'
    );
    
    // Validate tag exists
    const tagCheck = exec(`git rev-parse tags/${targetTag}`, true);
    if (!tagCheck.success) {
      const remoteTagCheck = exec(`git rev-parse ${intershopRemote}/${targetTag}`, true);
      if (!remoteTagCheck.success) {
        log.error(`Tag '${targetTag}' not found`);
        log.info('Available tags:');
        tags.slice(-5).forEach(t => console.log(`  - ${t}`));
        return null;
      }
      return `${intershopRemote}/${targetTag}`;
    }
    
    return `tags/${targetTag}`;
  } else {
    // Branch selection
    const branches = getBranches().filter(b => 
      b.startsWith(`remotes/${intershopRemote}/`) &&
      !b.includes('HEAD')
    );
    
    console.log(`\n${colors.green}Available branches from ${intershopRemote}:${colors.reset}`);
    branches.slice(0, 10).forEach((b, i) => {
      const displayName = b.replace(`remotes/${intershopRemote}/`, '');
      console.log(`  ${i + 1}. ${displayName}`);
    });
    
    const branchName = await askText(
      '\nEnter branch name',
      'develop'
    );
    
    return `${intershopRemote}/${branchName}`;
  }
}

// Detect customization files
function analyzeCustomizations(sourceBranch, baseBranch = 'develop') {
  log.info('Analyzing customizations...');

  const mergeBase = exec(`git merge-base ${sourceBranch} ${baseBranch}`, true);
  if (!mergeBase.success) {
    log.warning('Could not find common ancestor, using develop as base');
    return null;
  }

  const diff = exec(`git diff --name-status ${mergeBase.output} ${sourceBranch}`, true);
  if (!diff.success) return null;

  const files = {
    modified: [],
    added: [],
    deleted: [],
    total: 0,
  };

  diff.output.split('\n').forEach(line => {
    const [status, file] = line.split('\t');
    if (file) {
      files.total++;
      if (status === 'M') files.modified.push(file);
      else if (status === 'A') files.added.push(file);
      else if (status === 'D') files.deleted.push(file);
    }
  });

  return files;
}

// Auto-resolve simple conflicts
function autoResolveConflicts() {
  const conflictFiles = exec('git diff --name-only --diff-filter=U', true);
  if (!conflictFiles.success || !conflictFiles.output) {
    log.info('No conflicts to resolve');
    return { resolved: 0, failed: 0 };
  }

  const files = conflictFiles.output.split('\n').filter(f => f);
  let resolved = 0;
  let failed = 0;

  files.forEach(file => {
    // Try simple resolution strategies
    const content = fs.readFileSync(file, 'utf-8');

    // Strategy 1: If conflict is only in imports, keep both
    if (file.endsWith('.ts') && content.includes('import ')) {
      const isResolved = autoResolveImports(file, content);
      if (isResolved) {
        exec(`git add ${file}`, true);
        resolved++;
        return;
      }
    }

    // Strategy 2: For test files, prefer 'ours' (customizations)
    if (file.endsWith('.spec.ts')) {
      const result = exec(`git checkout --ours ${file}`, true);
      if (result.success) {
        exec(`git add ${file}`, true);
        resolved++;
        return;
      }
    }

    // Strategy 3: For SCSS/CSS files, try to merge both sections
    if (file.endsWith('.scss') || file.endsWith('.css') || file.endsWith('.sass')) {
      const isResolved = autoResolveStyles(file, content);
      if (isResolved) {
        exec(`git add ${file}`, true);
        resolved++;
        log.info(`Auto-resolved styles in: ${file}`);
        return;
      }
    }

    failed++;
  });

  return { resolved, failed, total: files.length };
}

// Smart import conflict resolution
function autoResolveImports(file, content) {
  const lines = content.split('\n');
  const resolved = [];
  let inConflict = false;
  let conflictType = null;
  let oursImports = [];
  let theirsImports = [];

  lines.forEach(line => {
    if (line.startsWith('<<<<<<<')) {
      inConflict = true;
      conflictType = 'ours';
      oursImports = [];
      theirsImports = [];
    } else if (line.startsWith('=======')) {
      conflictType = 'theirs';
    } else if (line.startsWith('>>>>>>>')) {
      // Merge imports
      const allImports = [...new Set([...oursImports, ...theirsImports])].sort();
      resolved.push(...allImports);
      inConflict = false;
    } else if (inConflict) {
      if (line.trim().startsWith('import ')) {
        if (conflictType === 'ours') {
          oursImports.push(line);
        } else {
          theirsImports.push(line);
        }
      }
    } else {
      resolved.push(line);
    }
  });

  // Only save if we successfully resolved everything
  if (!inConflict) {
    fs.writeFileSync(file, resolved.join('\n'));
    return true;
  }

  return false;
}

// Smart styles conflict resolution (SCSS/CSS)
function autoResolveStyles(file, content) {
  const lines = content.split('\n');
  const resolved = [];
  let inConflict = false;
  let oursStyles = [];
  let theirsStyles = [];
  let conflictType = null;

  lines.forEach(line => {
    if (line.startsWith('<<<<<<<')) {
      inConflict = true;
      conflictType = 'ours';
      oursStyles = [];
      theirsStyles = [];
    } else if (line.startsWith('=======')) {
      conflictType = 'theirs';
    } else if (line.startsWith('>>>>>>>')) {
      // Merge both style sections
      // Add comment to indicate merged sections
      if (oursStyles.length > 0 || theirsStyles.length > 0) {
        resolved.push('  /* === Merged PWA 9.1 styles === */');
        resolved.push(...theirsStyles);
        if (oursStyles.length > 0) {
          resolved.push('');
          resolved.push('  /* === Custom project styles === */');
          resolved.push(...oursStyles);
        }
      }
      inConflict = false;
    } else if (inConflict) {
      if (conflictType === 'ours') {
        oursStyles.push(line);
      } else {
        theirsStyles.push(line);
      }
    } else {
      resolved.push(line);
    }
  });

  // Only save if we successfully resolved everything
  if (!inConflict) {
    fs.writeFileSync(file, resolved.join('\n'));
    return true;
  }

  return false;
}

// Detect features that were removed in target PWA
async function detectRemovedFeatures(targetBranch) {
  log.info('Comparing extensions with target PWA...');

  // Get current extensions
  const currentExtensions = exec('ls -1 src/app/extensions/', true);
  if (!currentExtensions.success) {
    return [];
  }

  const currentList = currentExtensions.output.split('\n').filter(e => e);

  // Get target extensions
  const targetExtensions = exec(`git ls-tree -d --name-only ${targetBranch}:src/app/extensions`, true);
  if (!targetExtensions.success) {
    log.warning('Could not compare with target branch extensions');
    return [];
  }

  const targetList = targetExtensions.output.split('\n').filter(e => e);

  // Find removed features
  const removed = currentList.filter(ext => !targetList.includes(ext));

  return removed;
}

// Handle removed features interactively
async function handleRemovedFeatures(removedFeatures) {
  console.log(`\n${colors.yellow}!  WARNING: Following features were removed from new PWA:${colors.reset}`);
  console.log(removedFeatures.map(f => `  - ${f}`).join('\n'));

  for (const feature of removedFeatures) {
    console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.cyan}>>> Feature: ${feature}${colors.reset}`);
    console.log(`   Path: src/app/extensions/${feature}/`);

    // Check for references
    const templateRefs = exec(
      `grep -r "ish-lazy-${feature}\\|${feature}" src/app --include="*.html" 2>/dev/null | wc -l`,
      true
    );
    const refsCount = templateRefs.success ? parseInt(templateRefs.output) : 0;

    if (refsCount > 0) {
      console.log(`   ${colors.yellow}!${colors.reset}  Found ${refsCount} reference(s) in templates`);
    }

    const choice = await askText(
      `\n${colors.yellow}How should this feature be handled?${colors.reset}\n` +
        `  ${colors.green}A)${colors.reset} Keep and maintain independently (you will maintain it)\n` +
        `  ${colors.red}B)${colors.reset} Remove completely from customization\n` +
        `  ${colors.blue}C)${colors.reset} Check documentation for alternatives\n` +
        `  ${colors.cyan}S)${colors.reset} Skip for now (decide later)\n` +
        '\nYour choice (A/B/C/S): '
    );

    switch (choice.toUpperCase()) {
      case 'A':
        log.success(`Keeping ${feature} as custom-maintained extension`);
        console.log(`  ${colors.yellow}->${colors.reset} Verify all dependencies still work`);
        console.log(`  ${colors.yellow}->${colors.reset} Document in MIGRATION_SUCCESS_REPORT.md`);
        console.log(`  ${colors.yellow}->${colors.reset} Test thoroughly after build succeeds`);
        break;

      case 'B': {
        log.warning(`Removing ${feature} completely...`);
        const confirmRemove = await ask(`  Really remove src/app/extensions/${feature}/ ?`);
        if (confirmRemove) {
          exec(`rm -rf src/app/extensions/${feature}/`);
          exec(`git add src/app/extensions/${feature}/`);
          log.success(`Removed ${feature} extension`);
          console.log(`  ${colors.yellow}->${colors.reset} Check for remaining references in templates`);
          console.log(`  ${colors.yellow}->${colors.reset} Remove from environment configs if present`);
          console.log(`  ${colors.yellow}->${colors.reset} Remove from module imports/exports`);
        } else {
          log.info('Removal cancelled - will need manual cleanup');
        }
        break;
      }

      case 'C':
        log.info(`Check PWA 9.1 documentation for ${feature} alternatives`);
        console.log(`  ${colors.blue}->${colors.reset} Search in docs/guides/ for similar features`);
        console.log(`  ${colors.blue}->${colors.reset} Check if functionality moved to different extension`);
        console.log(`  ${colors.blue}->${colors.reset} Manual migration may be required`);
        break;

      case 'S':
        log.info(`Skipping ${feature} - will need manual handling`);
        console.log(`  ${colors.yellow}->${colors.reset} Document decision needed in migration report`);
        break;

      default:
        log.warning('Invalid choice, skipping feature');
    }
  }

  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

// Main migration workflow
async function main() {
  console.clear();
  console.log(`
${colors.cyan}${'='.repeat(61)}
|                                                           |
|     Intershop PWA - Interactive Migration Helper         |
|          Migrate from PWA 4.x to PWA 9.1.0                |
|                                                           |
${'='.repeat(61)}${colors.reset}

${colors.yellow}This tool will guide you through:${colors.reset}
  1. [*] Validating your environment (Node.js, npm)
  2. [*] Selecting source and target branches
  3. [*] Creating a new migration branch
  4. [*] Merging changes and resolving conflicts
  5. [*] Intelligent localization file merging
  6. [*] Handling removed features
  7. [*] Running automated fixes
  8. [*] Generating a migration report

${colors.green}Tip:${colors.reset} Press Enter to accept default values shown in [brackets]
${colors.green}Tip:${colors.reset} You can safely exit with Ctrl+C and restart anytime
`);

  // Check if we're in a git repository
  const gitCheck = exec('git rev-parse --git-dir', true);
  if (!gitCheck.success) {
    log.error('Not in a git repository!');
    log.info('Please run this script from the root of your PWA project.');
    process.exit(1);
  }

  // Check for uncommitted changes
  const statusCheck = exec('git diff-index --quiet HEAD --', true);
  if (!statusCheck.success) {
    log.warning('You have uncommitted changes.');
    const proceed = await ask('Do you want to continue anyway?');
    if (!proceed) {
      log.info('Please commit or stash your changes first:');
      log.info('  git add . && git commit -m "your message"');
      log.info('  or: git stash');
      process.exit(0);
    }
  }

  // Check Node.js and npm versions
  log.step(1, 'Validate Environment');

  const nodeVersion = process.version.replace('v', '');
  const npmVersion = exec('npm --version', true).output.trim();

  console.log(`\n${colors.blue}Current environment:${colors.reset}`);
  console.log(`  Node.js: ${colors.green}${nodeVersion}${colors.reset}`);
  console.log(`  npm:     ${colors.green}${npmVersion}${colors.reset}`);

  // Step 2: Select branches
  log.step(2, 'Configure Migration');

  // Set up Intershop remote if not already configured
  const intershopRemote = await setupIntershopRemote();
  
  const branches = getBranches();
  log.info(`Found ${branches.length} branches`);

  // Find migration branches
  const localBranches = branches.filter(b => !b.startsWith('remotes/'));
  const migrationBranches = branches.filter(b => b.includes('migration') || b.includes('9.1') || b.includes('9.0'));
  
  console.log('\n' + colors.cyan + '='.repeat(60));
  console.log('  Branch Selection Guide                                  ');
  console.log('='.repeat(60) + colors.reset);
  console.log('\n' + colors.yellow + 'What each branch means:' + colors.reset);
  console.log('  -> SOURCE branch: Your current customization branch (e.g., training_4.0.0)');
  console.log('  -> TARGET branch/tag: The PWA version to migrate TO (e.g., 9.1.0 tag)');
  console.log('  -> MIGRATION branch: New branch name to CREATE (e.g., migration/4.0-to-9.1)\n');

  console.log(colors.green + 'Local branches:' + colors.reset);
  localBranches.slice(0, 10).forEach((b, i) => {
    const indicator = b === 'training_4.0.0' ? ' ' + colors.yellow + '<-- (likely your source)' + colors.reset : '';
    console.log(`  ${i + 1}. ${b}${indicator}`);
  });

  const sourceBranch = await askText(
    '\n' + colors.cyan + 'SOURCE branch' + colors.reset + ' (your customizations)',
    'training_4.0.0'
  );

  // Interactive target selection
  let targetBranch;
  if (intershopRemote) {
    console.log(`\n${colors.blue}Now select the TARGET PWA version...${colors.reset}`);
    targetBranch = await selectTargetVersion(intershopRemote);
    
    if (!targetBranch) {
      log.error('Target version selection failed');
      process.exit(1);
    }
    
    log.success(`Selected target: ${targetBranch}`);
  } else {
    // Fallback to manual entry if no Intershop remote
    if (migrationBranches.length > 0) {
      console.log('\n' + colors.green + 'Available migration/target branches:' + colors.reset);
      migrationBranches.forEach((b, i) => {
        const indicator = b.includes('training-to-9.1') ? ' ' + colors.yellow + '<-- (recommended)' + colors.reset : '';
        console.log(`  ${i + 1}. ${b}${indicator}`);
      });
    }
    
    targetBranch = await askText(
      colors.cyan + 'TARGET branch/tag' + colors.reset + ' (PWA version to migrate to)',
      'tags/9.1.0'
    );
  }
  
  const migrationBranch = await askText(
    colors.cyan + 'NEW MIGRATION branch' + colors.reset + ' (will be created)',
    'migration/4.0-to-9.1'
  );

  console.log('\n' + colors.blue + 'Migration plan:' + colors.reset);
  console.log(`  1. Start from: ${colors.green}${sourceBranch}${colors.reset}`);
  console.log(`  2. Merge from: ${colors.green}${targetBranch}${colors.reset}`);
  console.log(`  3. Create new: ${colors.green}${migrationBranch}${colors.reset}\n`);

  // Show video tutorials if available
  showVideoTutorials(sourceBranch, targetBranch);

  // Verify branches exist
  const sourceBranchCheck = exec(`git rev-parse --verify ${sourceBranch}`, true);
  const targetBranchCheck = exec(`git rev-parse --verify ${targetBranch}`, true);

  if (!sourceBranchCheck.success) {
    log.error(`Source branch '${sourceBranch}' does not exist`);
    log.info('Available local branches:');
    localBranches.forEach(b => console.log(`  - ${b}`));
    process.exit(1);
  }

  if (!targetBranchCheck.success) {
    log.error(`Target branch '${targetBranch}' does not exist`);
    log.info('Available migration branches:');
    migrationBranches.forEach(b => console.log(`  - ${b}`));
    log.info('\nTip: You might need to fetch first: git fetch origin');
    process.exit(1);
  }

  // Validate Node.js/npm versions against target branch
  console.log(`\n${colors.blue}Checking target branch requirements...${colors.reset}`);
  const targetBranchForCheck = targetBranch.startsWith('origin/') ? targetBranch : `origin/${targetBranch}`;
  const targetPackageJson = exec(`git show ${targetBranchForCheck}:package.json`, true);
  
  if (targetPackageJson.success) {
    const targetPkg = JSON.parse(targetPackageJson.output);
    if (targetPkg.engines) {
      const requiredNode = targetPkg.engines.node;
      const requiredNpm = targetPkg.engines.npm;

      console.log(`\n${colors.blue}Target PWA requirements:${colors.reset}`);
      console.log(`  Node.js: ${colors.yellow}${requiredNode}${colors.reset}`);
      console.log(`  npm:     ${colors.yellow}${requiredNpm}${colors.reset}`);
      
      console.log(`\n${colors.blue}Version comparison:${colors.reset}`);

      // Compare Node.js versions
      const nodeMatch = nodeVersion === requiredNode || nodeVersion.startsWith(requiredNode.split('.')[0]);
      if (nodeMatch) {
        console.log(`  ${colors.green}[OK]${colors.reset} Node.js: ${nodeVersion} (compatible with ${requiredNode})`);
      } else {
        console.log(`  ${colors.yellow}[!]${colors.reset} Node.js: ${nodeVersion} (required: ${requiredNode})`);
        log.warning('Node.js version mismatch detected!');
        const continueAnyway = await ask('Continue anyway? (may cause build issues)');
        if (!continueAnyway) {
          log.info('Migration cancelled. Please update Node.js version:');
          log.info(`  ${colors.cyan}nvm install ${requiredNode} && nvm use ${requiredNode}${colors.reset}`);
          process.exit(0);
        }
      }

      // Compare npm versions
      const npmMajor = npmVersion.split('.')[0];
      const requiredNpmMajor = requiredNpm.split('.')[0];
      if (npmMajor === requiredNpmMajor) {
        console.log(`  ${colors.green}[OK]${colors.reset} npm: ${npmVersion} (compatible with ${requiredNpm})`);
      } else {
        console.log(`  ${colors.yellow}[!]${colors.reset} npm: ${npmVersion} (required: ${requiredNpm})`);
        log.warning('npm version mismatch detected!');
        const continueAnyway = await ask('Continue anyway? (may cause build issues)');
        if (!continueAnyway) {
          log.info('Migration cancelled. Please update npm version:');
          log.info(`  ${colors.cyan}npm install -g npm@${requiredNpm}${colors.reset}`);
          process.exit(0);
        }
      }
    }
  } else {
    log.warning('Could not read target branch package.json');
    log.info('Version validation skipped - continuing...');
  }

  // Step 3: Analyze customizations
  log.step(3, 'Analyze Customizations');

  const customFiles = analyzeCustomizations(sourceBranch);
  if (customFiles) {
    log.info(`Total customized files: ${customFiles.total}`);
    log.info(`  Modified: ${customFiles.modified.length}`);
    log.info(`  Added: ${customFiles.added.length}`);
    log.info(`  Deleted: ${customFiles.deleted.length}`);

    if (customFiles.modified.length > 0) {
      console.log('\nMost modified files:');
      customFiles.modified.slice(0, 10).forEach(f => console.log(`  - ${f}`));
    }
  }

  const proceed = await ask('\nProceed with migration?');
  if (!proceed) {
    log.info('Migration cancelled');
    process.exit(0);
  }

  // Step 4: Create migration branch
  log.step(4, 'Create Migration Branch');

  // Delete if exists
  exec(`git branch -D ${migrationBranch}`, true);

  exec(`git checkout ${targetBranch}`);
  const createBranch = exec(`git checkout -b ${migrationBranch}`);

  if (!createBranch.success) {
    log.error('Failed to create migration branch');
    process.exit(1);
  }

  log.success(`Created branch: ${migrationBranch}`);

  // Step 5: Merge customizations
  log.step(5, 'Merge Customizations');

  const merge = exec(`git merge --no-commit --no-ff ${sourceBranch}`, true);

  if (merge.success) {
    log.success('Merge successful without conflicts');
    exec(`git commit -m "feat: merge customizations from ${sourceBranch}"`);
  } else {
    // Check for conflicts
    const conflicts = exec('git diff --name-only --diff-filter=U', true);

    if (conflicts.success && conflicts.output) {
      const conflictFiles = conflicts.output.split('\n').filter(f => f);
      log.warning(`Found ${conflictFiles.length} files with conflicts`);

      console.log('\nConflicted files:');
      conflictFiles.forEach(f => console.log(`  - ${f}`));

      const autoResolve = await ask('\nAttempt automatic conflict resolution?');

      if (autoResolve) {
        log.info('Attempting automatic resolution...');
        const result = autoResolveConflicts();

        log.info(`Resolved: ${result.resolved}/${result.total} conflicts`);

        if (result.failed === 0) {
          exec(`git commit -m "feat: merge customizations from ${sourceBranch} (auto-resolved)"`);
          log.success('All conflicts automatically resolved');
        } else {
          log.warning(`${result.failed} conflicts require manual resolution`);
          log.info('\nPlease resolve remaining conflicts manually');
          log.info('After resolving, run:');
          log.info(`  git add <resolved-files>`);
          log.info(`  git commit -m "feat: merge customizations from ${sourceBranch}"`);
          log.info(`  node scripts/migration-helper.js --continue`);
          process.exit(1);
        }
      } else {
        log.info('Please resolve conflicts manually');
        log.info('After resolving, continue with: node scripts/migration-helper.js --continue');
        process.exit(1);
      }
    }
  }

  // Step 6: Handle Localization Merges
  log.step(6, 'Handle Localization Files');
  
  const localesPath = 'src/assets/locales';
  if (fs.existsSync(localesPath)) {
    log.info('Checking localization files...');
    
    // Check if there are conflicted or modified locale files
    const localeStatus = exec(`git diff --name-only ${localesPath}`, true);
    const conflictedLocales = exec(`git diff --name-only --diff-filter=U ${localesPath}`, true);
    
    const hasConflicts = conflictedLocales.success && conflictedLocales.output;
    const hasChanges = localeStatus.success && localeStatus.output;
    
    if (hasConflicts || hasChanges) {
      const localeFiles = hasConflicts 
        ? conflictedLocales.output.split('\n').filter(f => f.endsWith('.json'))
        : localeStatus.output.split('\n').filter(f => f.endsWith('.json'));
      
      if (localeFiles.length > 0) {
        log.warning(`Found ${localeFiles.length} localization file(s) that need merging`);
        console.log('\nLocale files:');
        localeFiles.forEach(f => console.log(`  - ${f}`));
        
        const mergeLocales = await ask('\nPerform intelligent 3-way merge of localization files?');
        
        if (mergeLocales) {
          log.info('Running merge-i18n-files.js...');
          console.log('\nIMPORTANT: This will:');
          console.log('  1. Keep your custom translation keys');
          console.log('  2. Add new standard PWA keys');
          console.log('  3. Flag semantic conflicts for review');
          console.log('  4. Generate a detailed merge report\n');
          
          // Run the i18n merger
          const mergeResult = exec(`node scripts/merge-i18n-files.js ${sourceBranch} ${targetBranch}`, false);
          
          if (mergeResult.success) {
            log.success('Localization files merged successfully');
            log.info('Review the generated i18n-merge-report.json for conflicts');
            
            // Stage merged files
            exec(`git add ${localesPath}/*.json`);
            
            const commitLocales = await ask('Commit merged localization files?');
            if (commitLocales) {
              exec(`git commit -m "chore: merge localization files from ${sourceBranch}"`);
              log.success('Localization changes committed');
            }
          } else {
            log.warning('Localization merge had issues - manual review needed');
          }
        } else {
          log.info('Skipping automatic localization merge');
          log.warning('IMPORTANT: You must manually merge localization files!');
          console.log('\nManual steps:');
          console.log(`  1. Run: node scripts/merge-i18n-files.js ${sourceBranch} ${targetBranch}`);
          console.log('  2. Review i18n-merge-report.json for conflicts');
          console.log('  3. Manually resolve any semantic conflicts');
          console.log('  4. git add src/assets/locales/*.json');
          console.log('  5. git commit -m "chore: merge localization files"');
        }
      }
    } else {
      log.success('No localization conflicts detected');
    }
  }

  // Step 7: Check for Removed Features
  log.step(7, 'Check for Removed Features');

  const removedFeatures = await detectRemovedFeatures(targetBranch);

  if (removedFeatures.length > 0) {
    log.warning(`Found ${removedFeatures.length} feature(s) that were removed from target PWA`);
    await handleRemovedFeatures(removedFeatures);

    // Check if there are changes to commit
    const status = exec('git status --porcelain', true);
    if (status.success && status.output) {
      const commitChanges = await ask('\nCommit feature removal changes?');
      if (commitChanges) {
        exec(`git commit -am "chore: handle removed features"`);
        log.success('Feature removal changes committed');
      }
    }
  } else {
    log.success('No removed features detected');
  }

  // Step 8: Run Automated Fixes
  await runAutomatedFixes();

  // Step 9: Generate report
  log.step(9, 'Generate Migration Report');
  await generateReport(sourceBranch, targetBranch, migrationBranch);

  // Final summary
  console.log(`
${colors.green}${'='.repeat(61)}
|                                                           |
|            Migration Process Complete!                    |
|                                                           |
${'='.repeat(61)}${colors.reset}
  `);

  log.info(`Migration branch: ${migrationBranch}`);
  log.info(`Review changes: git diff ${targetBranch}`);
  log.info(`Run tests: npm test`);
  log.info(``);
  log.info(`Next: Choose your workflow:`);
  log.info(`  - Local testing: npm run start`);
  log.info(`  - Push to remote: git push -u origin ${migrationBranch}`);
  log.info(`  - Create patch: git format-patch ${targetBranch}..${migrationBranch}`);
}

async function checkAngularCLI() {
  // Check if Angular CLI is globally available
  const globalNgCheck = exec('which ng || where ng', true);
  const hasGlobalCLI = globalNgCheck.success && globalNgCheck.output;

  if (!hasGlobalCLI) {
    log.warning('Global Angular CLI (ng command) is not available');
    console.log('');
    console.log('The local CLI is installed in node_modules, but the global');
    console.log('"ng" command will not work after stopping the dev server.');
    console.log('');
    
    // Check what version is needed from package.json
    if (fs.existsSync('package.json')) {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      const cliVersion = packageJson.devDependencies?.['@angular/cli'] || packageJson.dependencies?.['@angular/cli'];
      
      if (cliVersion) {
        const cleanVersion = cliVersion.replace(/[^0-9.]/g, '');
        console.log(`${colors.blue}Required Angular CLI version:${colors.reset} ${cliVersion}`);
        console.log('');
        
        const installGlobal = await ask('Install Angular CLI globally now?');
        
        if (installGlobal) {
          log.info(`Installing @angular/cli@${cleanVersion} globally...`);
          const installResult = exec(`npm install -g @angular/cli@${cleanVersion}`);
          
          if (installResult.success) {
            log.success('Angular CLI installed globally');
            const versionCheck = exec('ng version', true);
            if (versionCheck.success) {
              console.log('');
              console.log('Installed version:');
              console.log(versionCheck.output.split('\n')[0]);
            }
          } else {
            log.error('Failed to install Angular CLI globally');
            log.info('You can install it manually later with:');
            log.info(`  ${colors.cyan}npm install -g @angular/cli@${cleanVersion}${colors.reset}`);
          }
        } else {
          log.info('Skipping global CLI installation');
          log.warning('Remember to install it later to use "ng" commands:');
          log.info(`  ${colors.cyan}npm install -g @angular/cli@${cleanVersion}${colors.reset}`);
        }
      }
    }
  } else {
    log.success('Global Angular CLI is available');
    const version = exec('ng version 2>/dev/null | head -n 1', true);
    if (version.success && version.output) {
      console.log(`  ${version.output}`);
    }
  }
}

async function runAutomatedFixes() {
  log.step(7, 'Run Automated Fixes');

  // Check if node_modules exists
  if (!fs.existsSync('node_modules')) {
    log.info('Installing dependencies...');
    exec('npm ci --prefer-offline --no-audit');
  }
  
  // Check for global Angular CLI
  console.log('');
  await checkAngularCLI();
  console.log('');

  const runLint = await ask('Run ESLint auto-fix?');
  if (runLint) {
    log.info('Running ESLint...');
    exec('npm run lint -- --fix 2>&1 || true');
  }

  const runFormat = await ask('Run Prettier formatting?');
  if (runFormat) {
    log.info('Running Prettier...');
    exec('npm run format 2>&1 || true');
  }

  // Commit auto-fixes
  const hasChanges = exec('git diff-index --quiet HEAD --', true);
  if (!hasChanges.success) {
    exec('git add -A');
    exec('git commit -m "chore: apply automated code formatting and linting fixes"');
    log.success('Auto-fixes committed');
  }

  const runBuild = await ask('Test build?');
  if (runBuild) {
    log.info('Building...');
    const build = exec('npm run build');
    if (build.success) {
      log.success('Build successful!');
    } else {
      log.error('Build failed');
    }
  }
}

async function generateReport(sourceBranch, targetBranch, migrationBranch) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const reportFile = `MIGRATION_REPORT_${timestamp}.md`;

  const changedFiles = exec(`git diff --name-only ${targetBranch} ${migrationBranch}`, true);

  const report = `# Migration Report

**Date:** ${new Date().toLocaleString()}  
**Source Branch:** ${sourceBranch}  
**Target Branch:** ${targetBranch}  
**Migration Branch:** ${migrationBranch}

## Summary

This report documents the migration of customizations from ${sourceBranch} to ${targetBranch}.

## Files Changed

\`\`\`
${changedFiles.output || 'No files changed'}
\`\`\`

## Next Steps

### 1. Review Changes
\`\`\`bash
git diff ${targetBranch}..${migrationBranch}
\`\`\`

### 2. Manual Migration Tasks

Based on the [Migration Guide](docs/guides/migrations.md):

- [ ] Update control flow syntax (@if, @for)
- [ ] Convert class guards to functional guards
- [ ] Migrate to standalone components where applicable
- [ ] Update Formly configurations (templateOptions ?? props)
- [ ] Replace Font Awesome icons with Bootstrap Icons
- [ ] Update environment configurations
- [ ] Review and update test files

### 3. Testing

\`\`\`bash
# Run tests
npm test

# Run e2e tests  
npm run e2e:local

# Check build
npm run build

# Lint
npm run lint
\`\`\`

### 4. Documentation

- [ ] Update project README
- [ ] Document breaking changes
- [ ] Update deployment docs

## Resources

- [PWA Migration Guide](docs/guides/migrations.md)
- [Component Patterns](.github/instructions/component-patterns.instructions.md)
- [Testing Patterns](.github/instructions/testing-patterns.instructions.md)
- [State Management](.github/instructions/state-management-patterns.instructions.md)
`;

  fs.writeFileSync(reportFile, report);
  log.success(`Migration report saved: ${reportFile}`);
}

// Handle --continue flag
if (process.argv.includes('--continue')) {
  (async () => {
    try {
      log.info('Continuing migration...');
      await runAutomatedFixes();
      log.success('Migration continued successfully');
    } catch (error) {
      log.error(`Migration continuation failed: ${error.message}`);
      process.exit(1);
    }
  })();
} else {
  main().catch(error => {
    log.error(`Migration failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}
