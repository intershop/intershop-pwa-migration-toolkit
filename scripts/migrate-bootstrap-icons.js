#!/usr/bin/env node

/**
 * PWA 10.0 Migration: Font Awesome → Bootstrap Icons
 * 
 * Detects Font Awesome icon usage and provides migration report
 * with Bootstrap Icons equivalents.
 * 
 * Usage:
 *   node scripts/migrate-bootstrap-icons.js                    # Detection only
 *   node scripts/migrate-bootstrap-icons.js --auto-replace     # Auto-replace common icons
 *   node scripts/migrate-bootstrap-icons.js --report report.md # Generate markdown report
 */

const fs = require('fs');
const path = require('path');
const { findFiles } = require('./_utils');

// Font Awesome to Bootstrap Icons mapping
// https://icons.getbootstrap.com/
const ICON_MAPPING = {
  // Common icons
  'fa-search': 'bi-search',
  'fa-times': 'bi-x',
  'fa-close': 'bi-x',
  'fa-check': 'bi-check',
  'fa-plus': 'bi-plus',
  'fa-minus': 'bi-dash',
  'fa-edit': 'bi-pencil',
  'fa-trash': 'bi-trash',
  'fa-delete': 'bi-trash',
  'fa-save': 'bi-save',
  'fa-upload': 'bi-upload',
  'fa-download': 'bi-download',
  'fa-print': 'bi-printer',
  'fa-share': 'bi-share',
  'fa-link': 'bi-link-45deg',
  'fa-external-link': 'bi-box-arrow-up-right',
  
  // Navigation
  'fa-home': 'bi-house',
  'fa-user': 'bi-person',
  'fa-users': 'bi-people',
  'fa-cog': 'bi-gear',
  'fa-settings': 'bi-gear',
  'fa-bars': 'bi-list',
  'fa-menu': 'bi-list',
  'fa-arrow-left': 'bi-arrow-left',
  'fa-arrow-right': 'bi-arrow-right',
  'fa-arrow-up': 'bi-arrow-up',
  'fa-arrow-down': 'bi-arrow-down',
  'fa-chevron-left': 'bi-chevron-left',
  'fa-chevron-right': 'bi-chevron-right',
  'fa-chevron-up': 'bi-chevron-up',
  'fa-chevron-down': 'bi-chevron-down',
  'fa-angle-left': 'bi-caret-left',
  'fa-angle-right': 'bi-caret-right',
  'fa-angle-up': 'bi-caret-up',
  'fa-angle-down': 'bi-caret-down',
  
  // E-commerce
  'fa-shopping-cart': 'bi-cart',
  'fa-cart': 'bi-cart',
  'fa-credit-card': 'bi-credit-card',
  'fa-tag': 'bi-tag',
  'fa-tags': 'bi-tags',
  'fa-heart': 'bi-heart',
  'fa-star': 'bi-star',
  
  // Communication
  'fa-envelope': 'bi-envelope',
  'fa-mail': 'bi-envelope',
  'fa-phone': 'bi-telephone',
  'fa-comment': 'bi-chat',
  'fa-comments': 'bi-chat-dots',
  'fa-bell': 'bi-bell',
  'fa-info': 'bi-info-circle',
  'fa-question': 'bi-question-circle',
  'fa-exclamation': 'bi-exclamation-circle',
  
  // Status
  'fa-spinner': 'bi-arrow-repeat',
  'fa-circle-notch': 'bi-arrow-clockwise',
  'fa-check-circle': 'bi-check-circle',
  'fa-times-circle': 'bi-x-circle',
  'fa-exclamation-circle': 'bi-exclamation-circle',
  'fa-exclamation-triangle': 'bi-exclamation-triangle',
  'fa-info-circle': 'bi-info-circle',
  
  // Media
  'fa-image': 'bi-image',
  'fa-file': 'bi-file-earmark',
  'fa-folder': 'bi-folder',
  'fa-play': 'bi-play',
  'fa-pause': 'bi-pause',
  'fa-stop': 'bi-stop',
  
  // Other
  'fa-calendar': 'bi-calendar',
  'fa-clock': 'bi-clock',
  'fa-lock': 'bi-lock',
  'fa-unlock': 'bi-unlock',
  'fa-eye': 'bi-eye',
  'fa-eye-slash': 'bi-eye-slash',
  'fa-filter': 'bi-funnel',
  'fa-sort': 'bi-sort-down',
  'fa-grid': 'bi-grid',
  'fa-list': 'bi-list-ul',
};

// Style class mapping
const STYLE_MAPPING = {
  'fas': 'bi', // Font Awesome Solid → Bootstrap Icons
  'far': 'bi', // Font Awesome Regular → Bootstrap Icons  
  'fab': 'bi', // Font Awesome Brands → Bootstrap Icons (manual review needed)
  'fa': 'bi',  // Font Awesome base class → Bootstrap Icons
};

class IconMigrator {
  constructor() {
    this.detectedIcons = new Map();
    this.unmappedIcons = new Set();
    this.files = [];
    this.autoReplace = process.argv.includes('--auto-replace');
    this.reportPath = this.getReportPath();
  }

  getReportPath() {
    const idx = process.argv.indexOf('--report');
    return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
  }

  async run() {
    console.log('🔍 Detecting Font Awesome icon usage...\n');

    await this.detectIcons();
    this.analyzeResults();
    
    if (this.autoReplace) {
      await this.replaceIcons();
    }
    
    if (this.reportPath) {
      this.generateReport();
    }
    
    this.printSummary();
  }

  async detectIcons() {
    const htmlFiles = findFiles('src', /\.html$/);
    const tsFiles = findFiles('src', /\.ts$/);
    const scssFiles = findFiles('src', /\.scss$/);

    this.files = [...htmlFiles, ...tsFiles, ...scssFiles];

    for (const file of this.files) {
      if (!fs.existsSync(file)) continue;

      const content = fs.readFileSync(file, 'utf8');
      
      // Match Font Awesome icon classes
      const faRegex = /\b(fa-[\w-]+|fas|far|fab|font-awesome)\b/g;
      const matches = [...content.matchAll(faRegex)];

      if (matches.length > 0) {
        for (const match of matches) {
          const icon = match[1];
          if (!this.detectedIcons.has(icon)) {
            this.detectedIcons.set(icon, []);
          }
          this.detectedIcons.get(icon).push({
            file,
            line: content.substring(0, match.index).split('\n').length,
            context: this.getContext(content, match.index)
          });
        }
      }
    }
  }

  getContext(content, index) {
    const lines = content.split('\n');
    const lineIndex = content.substring(0, index).split('\n').length - 1;
    return lines[lineIndex].trim();
  }

  analyzeResults() {
    for (const [icon] of this.detectedIcons) {
      if (!ICON_MAPPING[icon] && !STYLE_MAPPING[icon]) {
        this.unmappedIcons.add(icon);
      }
    }
  }

  async replaceIcons() {
    console.log('\n🔧 Auto-replacing common icons...\n');

    let totalReplacements = 0;

    for (const file of this.files) {
      if (!fs.existsSync(file)) continue;

      let content = fs.readFileSync(file, 'utf8');
      let modified = false;
      let fileReplacements = 0;

      // Replace style classes (fas, far, fab → bi)
      for (const [oldStyle, newStyle] of Object.entries(STYLE_MAPPING)) {
        const regex = new RegExp(`\\b${oldStyle}\\b`, 'g');
        if (regex.test(content)) {
          content = content.replace(regex, newStyle);
          modified = true;
        }
      }

      // Replace icon classes
      for (const [oldIcon, newIcon] of Object.entries(ICON_MAPPING)) {
        const regex = new RegExp(`\\b${oldIcon}\\b`, 'g');
        const matches = content.match(regex);
        if (matches) {
          content = content.replace(regex, newIcon);
          modified = true;
          fileReplacements += matches.length;
        }
      }

      if (modified) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`  ✓ ${file} (${fileReplacements} replacements)`);
        totalReplacements += fileReplacements;
      }
    }

    console.log(`\n✅ Replaced ${totalReplacements} icon references`);
  }

  generateReport() {
    const report = [];
    
    report.push('# Font Awesome → Bootstrap Icons Migration Report\n');
    report.push(`Generated: ${new Date().toISOString()}\n`);
    report.push('---\n\n');

    report.push('## Summary\n\n');
    report.push(`- **Total icons detected**: ${this.detectedIcons.size}\n`);
    report.push(`- **Mapped icons**: ${this.detectedIcons.size - this.unmappedIcons.size}\n`);
    report.push(`- **Unmapped icons**: ${this.unmappedIcons.size}\n`);
    report.push(`- **Files affected**: ${new Set([...this.detectedIcons.values()].flat().map(v => v.file)).size}\n\n`);

    if (this.unmappedIcons.size > 0) {
      report.push('## ⚠️ Unmapped Icons (Require Manual Review)\n\n');
      report.push('These icons do not have automatic mappings and need manual replacement:\n\n');
      
      for (const icon of this.unmappedIcons) {
        const occurrences = this.detectedIcons.get(icon);
        report.push(`### \`${icon}\` (${occurrences.length} occurrences)\n\n`);
        
        const fileGroups = new Map();
        for (const occ of occurrences) {
          if (!fileGroups.has(occ.file)) {
            fileGroups.set(occ.file, []);
          }
          fileGroups.get(occ.file).push(occ);
        }
        
        for (const [file, occs] of fileGroups) {
          report.push(`**${file}**\n`);
          for (const occ of occs.slice(0, 3)) {
            report.push(`- Line ${occ.line}: \`${occ.context}\`\n`);
          }
          if (occs.length > 3) {
            report.push(`- ... and ${occs.length - 3} more\n`);
          }
          report.push('\n');
        }
        
        report.push(`**Suggested Bootstrap Icon**: Search https://icons.getbootstrap.com/ for equivalent\n\n`);
      }
    }

    report.push('## ✅ Mapped Icons\n\n');
    report.push('| Font Awesome | Bootstrap Icons | Occurrences |\n');
    report.push('|--------------|-----------------|-------------|\n');
    
    const mapped = [...this.detectedIcons.keys()]
      .filter(icon => ICON_MAPPING[icon])
      .sort();
    
    for (const icon of mapped) {
      const count = this.detectedIcons.get(icon).length;
      report.push(`| \`${icon}\` | \`${ICON_MAPPING[icon]}\` | ${count} |\n`);
    }

    report.push('\n## Next Steps\n\n');
    report.push('1. Review unmapped icons and find Bootstrap Icons equivalents\n');
    report.push('2. Update package.json to include Bootstrap Icons:\n');
    report.push('   ```json\n');
    report.push('   "bootstrap-icons": "^1.11.0"\n');
    report.push('   ```\n');
    report.push('3. Import Bootstrap Icons in styles:\n');
    report.push('   ```scss\n');
    report.push('   @import "bootstrap-icons/font/bootstrap-icons.css";\n');
    report.push('   ```\n');
    report.push('4. Remove Font Awesome dependencies\n');
    report.push('5. Run auto-replace: `node scripts/migrate-bootstrap-icons.js --auto-replace`\n');
    report.push('6. Test thoroughly\n');

    fs.writeFileSync(this.reportPath, report.join(''), 'utf8');
    console.log(`\n📄 Report generated: ${this.reportPath}`);
  }

  printSummary() {
    console.log('\n' + '='.repeat(70));
    console.log('  Font Awesome → Bootstrap Icons Migration Summary');
    console.log('='.repeat(70) + '\n');

    console.log(`📊 Total icons detected: ${this.detectedIcons.size}`);
    console.log(`✅ Mapped icons: ${this.detectedIcons.size - this.unmappedIcons.size}`);
    console.log(`⚠️  Unmapped icons: ${this.unmappedIcons.size}`);
    console.log(`📁 Files affected: ${new Set([...this.detectedIcons.values()].flat().map(v => v.file)).size}\n`);

    if (this.unmappedIcons.size > 0) {
      console.log('⚠️  Unmapped icons requiring manual review:');
      for (const icon of [...this.unmappedIcons].slice(0, 10)) {
        console.log(`   - ${icon} (${this.detectedIcons.get(icon).length} occurrences)`);
      }
      if (this.unmappedIcons.size > 10) {
        console.log(`   ... and ${this.unmappedIcons.size - 10} more`);
      }
      console.log('');
    }

    console.log('💡 Next steps:');
    if (!this.autoReplace) {
      console.log('   1. Review detected icons');
      console.log('   2. Run with --auto-replace to replace common icons');
      console.log('   3. Generate report: --report migration-icons.md');
    }
    if (this.unmappedIcons.size > 0) {
      console.log('   4. Manually review unmapped icons');
      console.log('   5. Search https://icons.getbootstrap.com/ for equivalents');
    }
    console.log('');
  }
}

// Run migration
new IconMigrator().run().catch(console.error);
