# PWA Migration Skills

This directory contains **GitHub Copilot Skills** for PWA migration workflows. Skills are invoked explicitly by users or AI agents for complex, multi-step processes that require decision-making, tool orchestration, and interactive guidance.

## Available Skills

### 🎯 [pwa-migration.SKILL.md](pwa-migration.SKILL.md)
**Primary migration planning and execution skill**

**Use for:**
- Planning migrations between PWA versions
- Assessing migration complexity (Tier 1/2/3)
- Step-by-step guided migration
- Post-migration validation
- Migration report generation

**Example invocation:**
```
User: "I need help migrating from PWA 4.0 to 9.1"
AI: [Invokes pwa-migration skill]
```

### 🐛 [pwa-troubleshooting.SKILL.md](pwa-troubleshooting.SKILL.md)
**Specialized debugging and conflict resolution skill**

**Use for:**
- Diagnosing build errors
- Resolving Git merge conflicts
- Fixing SCSS/theme issues
- Template syntax problems
- Investigating unknown errors
- Emergency recovery procedures

**Example invocation:**
```
User: "Build is broken with 'Undefined variable $theme-color'"
AI: [Invokes pwa-troubleshooting skill]
```

## Skills vs Instructions

### Instructions (`.github/instructions/*.instructions.md`)
- **Passive:** Auto-loaded when editing matching files
- **Purpose:** Quick reference, coding patterns, checklists
- **Context:** Always available for relevant files
- **Size:** Kept small to avoid context bloat

### Skills (`.github/skills/*.SKILL.md`)
- **Active:** Explicitly invoked by user or AI
- **Purpose:** Complex workflows, decision trees, multi-step processes
- **Context:** Loaded only when needed
- **Size:** Can be comprehensive (1000+ lines)

## Architecture

```
PWA Migration Toolkit
│
├── Instructions (Context Injection)
│   └── Provide passive guidance when editing migration scripts
│
└── Skills (Active Orchestration)
    ├── pwa-migration → Plans and executes migrations
    └── pwa-troubleshooting → Diagnoses and fixes issues
```

## How Skills Work

1. **User invokes skill:** "Help me with PWA migration" or "@pwa-migration"
2. **Skill loads:** Full content becomes available to AI
3. **Skill orchestrates:**
   - Asks clarifying questions
   - Runs diagnostic scripts
   - References instruction files for details
   - Invokes tools (file operations, terminal commands)
   - Uses subagents for complex exploration
4. **Skill completes:** Provides comprehensive guidance and documentation

## Relationship to Existing Instructions

Skills **complement** rather than **replace** instructions:

| Instruction File | Used By Skill | Purpose |
|-----------------|---------------|---------|
| migration-patterns.instructions.md | pwa-migration | Reference breaking change patterns |
| migration-issues.instructions.md | pwa-troubleshooting | Lookup known issues |
| migration-workflow.instructions.md | pwa-migration | Build cycle patterns |
| migration-git.instructions.md | both | Git operations reference |
| migration-examples.instructions.md | both | Code examples |
| migration-checklist.instructions.md | pwa-migration | Validation checklist |
| migration-pattern-detection.instructions.md | pwa-migration | Detection system guide |

Skills orchestrate **when** and **how** to use these resources.

## Future Skills (Potential)

### pwa-complexity-analyzer.SKILL.md
Advanced complexity assessment using ML patterns and historical data

### pwa-conflict-resolver.SKILL.md
Specialized skill for intricate merge conflicts with semantic analysis

### pwa-documentation-generator.SKILL.md
Comprehensive migration documentation and knowledge transfer

## Contributing

When creating new skills:

1. **Clear scope:** One skill = one workflow domain
2. **YAML frontmatter:** Include name and description
3. **When to invoke:** Explicit guidance on usage
4. **Capabilities:** List what the skill can do
5. **Examples:** Show typical interactions
6. **Tool references:** Link to scripts and instructions
7. **Success criteria:** Define what "done" means

## Testing Skills

To test a skill:

```bash
# In your PWA project
# 1. Copy skills to your project
cp -r .github/skills .github/

# 2. Invoke the skill via Copilot
# "Help me plan a migration from 4.0 to 9.1" → should invoke pwa-migration skill
# "My build is broken with SCSS errors" → should invoke pwa-troubleshooting skill
```

---

**Last Updated:** March 2026  
**Maintained by:** Intershop PWA Training Team
