#!/usr/bin/env bash
set -e

# merge-docker-compose.sh
# Intelligent merge of docker-compose.yml files between custom PWA and new PWA versions

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_section() {
  echo ""
  echo -e "${YELLOW}▶ $1${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

show_usage() {
  cat << EOF
Usage: $0 [OPTIONS]

Intelligently merge docker-compose.yml from custom PWA and new PWA version.

This script helps you merge docker-compose.yml files by:
  1. Detecting custom services and configurations
  2. Preserving custom environment variables
  3. Merging base PWA updates
  4. Creating a comprehensive merged file

OPTIONS:
  --auto             Automatically merge (default: interactive)
  --dry-run          Show what would be merged without making changes
  -h, --help         Show this help message

EXAMPLES:
  # Interactive merge (recommended for first time)
  $0

  # Automatic merge
  $0 --auto

  # Preview merge without changing files
  $0 --dry-run

EOF
}

# Parse arguments
AUTO_MODE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --auto)
      AUTO_MODE=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      show_usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      show_usage
      exit 1
      ;;
  esac
done

print_header "🐳 Docker Compose Merge Tool"

# Check if we're in a git merge conflict
if git status 2>/dev/null | grep -q "both modified.*docker-compose.yml"; then
  print_section "Detected Merge Conflict"
  IN_CONFLICT=true
else
  print_section "Checking for docker-compose.yml"
  IN_CONFLICT=false
fi

# Verify docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
  print_error "docker-compose.yml not found in current directory"
  exit 1
fi

# Create backup
BACKUP_FILE="docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)"
cp docker-compose.yml "$BACKUP_FILE"
print_success "Backup created: $BACKUP_FILE"

# Extract versions from git conflict if exists
if [ "$IN_CONFLICT" = true ]; then
  print_section "Extracting Conflict Versions"
  
  # Extract different versions
  git show :2:docker-compose.yml > docker-compose.theirs.yml 2>/dev/null || \
    print_warning "Could not extract 'theirs' version (new PWA)"
  
  git show :3:docker-compose.yml > docker-compose.ours.yml 2>/dev/null || \
    print_warning "Could not extract 'ours' version (custom PWA)"
  
  THEIRS_FILE="docker-compose.theirs.yml"
  OURS_FILE="docker-compose.ours.yml"
else
  print_warning "Not in a merge conflict. Using current file as base."
  THEIRS_FILE="docker-compose.yml"
  OURS_FILE="docker-compose.yml"
fi

# Analyze differences using Node.js
print_section "Analyzing Docker Compose Configurations"

node << 'NODESCRIPT' "$OURS_FILE" "$THEIRS_FILE" "$DRY_RUN" "$AUTO_MODE"
const fs = require('fs');
const yaml = require('yaml');

const [,, oursFile, theirsFile, dryRun, autoMode] = process.argv;
const isDryRun = dryRun === 'true';
const isAuto = autoMode === 'true';

function loadYaml(file) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    return yaml.parse(content);
  } catch (err) {
    console.error(`Error loading ${file}:`, err.message);
    return null;
  }
}

function compareServices(ours, theirs) {
  const oursServices = Object.keys(ours.services || {});
  const theirsServices = Object.keys(theirs.services || {});
  
  const customOnly = oursServices.filter(s => !theirsServices.includes(s));
  const pwaOnly = theirsServices.filter(s => !oursServices.includes(s));
  const common = oursServices.filter(s => theirsServices.includes(s));
  
  return { customOnly, pwaOnly, common };
}

function detectCustomizations(ours, theirs, serviceName) {
  const ourService = ours.services[serviceName];
  const theirService = theirs.services[serviceName];
  
  const customizations = [];
  
  // Check environment variables
  const ourEnv = ourService.environment || {};
  const theirEnv = theirService.environment || {};
  
  Object.keys(ourEnv).forEach(key => {
    if (!theirEnv[key] || ourEnv[key] !== theirEnv[key]) {
      customizations.push({
        type: 'environment',
        key,
        ourValue: ourEnv[key],
        theirValue: theirEnv[key] || '(not in PWA)'
      });
    }
  });
  
  // Check ports
  if (JSON.stringify(ourService.ports) !== JSON.stringify(theirService.ports)) {
    customizations.push({
      type: 'ports',
      ourValue: ourService.ports,
      theirValue: theirService.ports
    });
  }
  
  // Check volumes
  if (JSON.stringify(ourService.volumes) !== JSON.stringify(theirService.volumes)) {
    customizations.push({
      type: 'volumes',
      ourValue: ourService.volumes,
      theirValue: theirService.volumes
    });
  }
  
  return customizations;
}

function mergeServiceConfig(ours, theirs, serviceName, preferences) {
  const ourService = ours.services[serviceName] || {};
  const theirService = theirs.services[serviceName] || {};
  
  // Start with PWA base
  const merged = { ...theirService };
  
  // Merge environment variables (custom takes precedence)
  merged.environment = {
    ...(theirService.environment || {}),
    ...(ourService.environment || {})
  };
  
  // Apply preferences for ports, volumes, etc.
  if (preferences.keepCustomPorts && ourService.ports) {
    merged.ports = ourService.ports;
  }
  
  if (preferences.keepCustomVolumes && ourService.volumes) {
    merged.volumes = ourService.volumes;
  }
  
  return merged;
}

const ours = loadYaml(oursFile);
const theirs = loadYaml(theirsFile);

if (!ours || !theirs) {
  console.error('Failed to load docker-compose files');
  process.exit(1);
}

console.log('\n📊 Analysis Results:\n');

const { customOnly, pwaOnly, common } = compareServices(ours, theirs);

console.log(`Custom-only services: ${customOnly.length}`);
customOnly.forEach(s => console.log(`  • ${s}`));

console.log(`\nPWA-only services: ${pwaOnly.length}`);
pwaOnly.forEach(s => console.log(`  • ${s}`));

console.log(`\nCommon services: ${common.length}`);
common.forEach(s => console.log(`  • ${s}`));

// Detect customizations in common services
console.log('\n\n🔍 Customizations Detected:\n');

const allCustomizations = {};
common.forEach(serviceName => {
  const customizations = detectCustomizations(ours, theirs, serviceName);
  if (customizations.length > 0) {
    allCustomizations[serviceName] = customizations;
    console.log(`${serviceName}:`);
    customizations.forEach(c => {
      console.log(`  • ${c.type}:`);
      if (c.type === 'environment') {
        console.log(`     - ${c.key}: "${c.ourValue}" (custom) vs "${c.theirValue}" (PWA)`);
      } else {
        console.log(`     - Custom: ${JSON.stringify(c.ourValue)}`);
        console.log(`     - PWA:    ${JSON.stringify(c.theirValue)}`);
      }
    });
    console.log('');
  }
});

// Merge strategy
console.log('\n📝 Merge Strategy:\n');
console.log('1. Keep all custom-only services');
console.log('2. Add all new PWA services');
console.log('3. For common services:');
console.log('   • Use PWA base configuration');
console.log('   • Merge custom environment variables (custom takes precedence)');
console.log('   • Preserve custom ports and volumes if significantly different');
console.log('');

if (isDryRun) {
  console.log('🔍 DRY RUN MODE - No changes will be made');
  process.exit(0);
}

// Create merged configuration
const merged = {
  version: theirs.version || ours.version,
  services: {}
};

// Add all services
const allServices = new Set([...Object.keys(ours.services || {}), ...Object.keys(theirs.services || {})]);

const preferences = {
  keepCustomPorts: true,
  keepCustomVolumes: true
};

allServices.forEach(serviceName => {
  if (customOnly.includes(serviceName)) {
    // Keep custom service as-is
    merged.services[serviceName] = ours.services[serviceName];
  } else if (pwaOnly.includes(serviceName)) {
    // Add PWA service
    merged.services[serviceName] = theirs.services[serviceName];
  } else {
    // Merge common service
    merged.services[serviceName] = mergeServiceConfig(ours, theirs, serviceName, preferences);
  }
});

// Preserve other top-level keys (networks, volumes, etc.)
['networks', 'volumes', 'configs', 'secrets'].forEach(key => {
  if (ours[key] || theirs[key]) {
    merged[key] = { ...(theirs[key] || {}), ...(ours[key] || {}) };
  }
});

// Write merged file
const mergedYaml = yaml.stringify(merged, { lineWidth: 0 });
fs.writeFileSync('docker-compose.yml', mergedYaml);

console.log('✅ Merged docker-compose.yml created');
console.log('\n📋 Summary:');
console.log(`   • Total services: ${allServices.size}`);
console.log(`   • Custom services preserved: ${customOnly.length}`);
console.log(`   • New PWA services added: ${pwaOnly.length}`);
console.log(`   • Common services merged: ${common.length}`);

NODESCRIPT

if [ $? -eq 0 ]; then
  if [ "$DRY_RUN" = false ]; then
    print_success "docker-compose.yml successfully merged"
    
    if [ "$IN_CONFLICT" = true ]; then
      # Mark as resolved in git
      git add docker-compose.yml
      print_success "Conflict marked as resolved in git"
    fi
    
    print_section "Next Steps"
    echo "1. Review docker-compose.yml for correctness"
    echo "2. Test with: docker-compose config"
    echo "3. Verify services start: docker-compose up -d"
    echo ""
    echo "Backup saved at: $BACKUP_FILE"
    
    # Cleanup temp files
    rm -f docker-compose.theirs.yml docker-compose.ours.yml
  fi
else
  print_error "Merge failed"
  print_warning "Restoring from backup: $BACKUP_FILE"
  cp "$BACKUP_FILE" docker-compose.yml
  exit 1
fi

exit 0
