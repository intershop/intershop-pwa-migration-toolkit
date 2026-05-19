#!/bin/bash
# Migration Progress Tracker
# Persists migration state to a JSON file so work can resume after VM shutdown.
#
# Usage:
#   ./scripts/migration-progress.sh init <source_version> <target_version>
#   ./scripts/migration-progress.sh status
#   ./scripts/migration-progress.sh update <step_id> <completed|in-progress|skipped> [notes]
#   ./scripts/migration-progress.sh note "Free-form note about current state"
#   ./scripts/migration-progress.sh summary
#
# The progress file (.migration-progress.json) is created in the project root.
# It survives VM restarts and can be read by Copilot to resume work.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Resolve project directory: PWA_PROJECT_DIR > --project-dir arg > cwd
PROJECT_DIR="${PWA_PROJECT_DIR:-$(pwd)}"
for ((i=1; i<=$#; i++)); do
  if [[ "${!i}" == "--project-dir" ]]; then
    next=$((i+1))
    PROJECT_DIR="${!next}"
    break
  fi
done

PROGRESS_FILE="$PROJECT_DIR/.migration-progress.json"

# Migration steps with IDs matching the checklist
STEPS=(
  "version-identification:Document source and target versions"
  "angular-version-check:Check Angular version compatibility"
  "node-version-check:Verify Node.js version requirements"
  "git-remote-setup:Configure git remotes (intershop + project)"
  "branch-creation:Create migration branch"
  "theme-validation:Validate custom theme completeness"
  "theme-sync:Sync missing theme variables"
  "first-build:First build attempt and error capture"
  "typescript-fixes:Fix TypeScript compilation errors"
  "scss-fixes:Fix SCSS compilation errors"
  "template-fixes:Fix template errors"
  "removed-features:Handle removed features/extensions"
  "i18n-merge:Merge localization files"
  "control-flow-migration:Migrate Angular control flow (PWA 10+)"
  "icon-migration:Migrate icons (PWA 10+)"
  "clean-build:Achieve clean build (browser + SSR)"
  "lint-check:Run and fix lint issues"
  "test-run:Run unit tests"
  "smoke-test:Manual smoke test of custom features"
  "documentation:Update documentation and changelog"
  "commit-and-push:Final commit and push to project remote"
)

init_progress() {
  local source_version="${1:-unknown}"
  local target_version="${2:-unknown}"
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  local steps_json="["
  local first=true
  for step_entry in "${STEPS[@]}"; do
    local id="${step_entry%%:*}"
    local desc="${step_entry#*:}"
    if [ "$first" = true ]; then
      first=false
    else
      steps_json+=","
    fi
    steps_json+=$(cat <<EOF

    {
      "id": "$id",
      "description": "$desc",
      "status": "not-started",
      "notes": "",
      "updatedAt": ""
    }
EOF
    )
  done
  steps_json+=$'\n  ]'

  cat > "$PROGRESS_FILE" <<EOF
{
  "migrationId": "$(date +%Y%m%d)-${source_version}-to-${target_version}",
  "sourceVersion": "$source_version",
  "targetVersion": "$target_version",
  "approach": "",
  "startedAt": "$timestamp",
  "lastUpdated": "$timestamp",
  "currentStep": "version-identification",
  "overallStatus": "in-progress",
  "notes": [],
  "steps": $steps_json
}
EOF

  echo "✅ Migration progress initialized: $PROGRESS_FILE"
  echo "   Source: PWA $source_version → Target: PWA $target_version"
  echo ""
  echo "💡 Copilot will read this file to understand migration state."
  echo "   Update progress with: ./scripts/migration-progress.sh update <step_id> completed"
}

show_status() {
  if [ ! -f "$PROGRESS_FILE" ]; then
    echo "❌ No migration in progress. Run: ./scripts/migration-progress.sh init <source> <target>"
    exit 1
  fi

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 Migration Progress"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  local source target current overall last_updated
  source=$(cat "$PROGRESS_FILE" | jq -r '.sourceVersion')
  target=$(cat "$PROGRESS_FILE" | jq -r '.targetVersion')
  current=$(cat "$PROGRESS_FILE" | jq -r '.currentStep')
  overall=$(cat "$PROGRESS_FILE" | jq -r '.overallStatus')
  last_updated=$(cat "$PROGRESS_FILE" | jq -r '.lastUpdated')

  echo "   Source: PWA $source → Target: PWA $target"
  echo "   Status: $overall"
  echo "   Last updated: $last_updated"
  echo "   Current step: $current"
  echo ""

  local completed in_progress not_started skipped
  completed=$(cat "$PROGRESS_FILE" | jq '[.steps[] | select(.status == "completed")] | length')
  in_progress=$(cat "$PROGRESS_FILE" | jq '[.steps[] | select(.status == "in-progress")] | length')
  not_started=$(cat "$PROGRESS_FILE" | jq '[.steps[] | select(.status == "not-started")] | length')
  skipped=$(cat "$PROGRESS_FILE" | jq '[.steps[] | select(.status == "skipped")] | length')
  local total=${#STEPS[@]}

  echo "   Progress: $completed/$total completed, $in_progress in-progress, $skipped skipped"
  echo ""

  # Show each step with status indicator
  cat "$PROGRESS_FILE" | jq -r '.steps[] | 
    (if .status == "completed" then "✅"
     elif .status == "in-progress" then "🔄"
     elif .status == "skipped" then "⏭️ "
     else "⬚ " end) + " " + .id + " - " + .description +
    (if .notes != "" then " (" + .notes + ")" else "" end)'

  echo ""

  # Show recent notes
  local note_count
  note_count=$(cat "$PROGRESS_FILE" | jq '.notes | length')
  if [ "$note_count" -gt 0 ]; then
    echo "📝 Recent notes:"
    cat "$PROGRESS_FILE" | jq -r '.notes[-3:][] | "   [" + .timestamp + "] " + .text'
    echo ""
  fi
}

update_step() {
  local step_id="$1"
  local new_status="$2"
  local notes="${3:-}"
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  if [ ! -f "$PROGRESS_FILE" ]; then
    echo "❌ No migration in progress. Run: ./scripts/migration-progress.sh init <source> <target>"
    exit 1
  fi

  # Validate step_id exists
  local exists
  exists=$(cat "$PROGRESS_FILE" | jq --arg id "$step_id" '[.steps[] | select(.id == $id)] | length')
  if [ "$exists" -eq 0 ]; then
    echo "❌ Unknown step: $step_id"
    echo "   Valid steps:"
    cat "$PROGRESS_FILE" | jq -r '.steps[].id' | sed 's/^/     /'
    exit 1
  fi

  # Validate status
  if [[ "$new_status" != "completed" && "$new_status" != "in-progress" && "$new_status" != "skipped" && "$new_status" != "not-started" ]]; then
    echo "❌ Invalid status: $new_status (use: completed, in-progress, skipped, not-started)"
    exit 1
  fi

  # Update the step
  local tmp
  tmp=$(mktemp)
  cat "$PROGRESS_FILE" | jq --arg id "$step_id" --arg status "$new_status" --arg notes "$notes" --arg ts "$timestamp" '
    .steps = [.steps[] | if .id == $id then .status = $status | .notes = $notes | .updatedAt = $ts else . end] |
    .lastUpdated = $ts |
    (if $status == "in-progress" then .currentStep = $id else . end)
  ' > "$tmp" && mv "$tmp" "$PROGRESS_FILE"

  local icon
  case "$new_status" in
    completed)   icon="✅" ;;
    in-progress) icon="🔄" ;;
    skipped)     icon="⏭️" ;;
    *)           icon="⬚" ;;
  esac

  echo "$icon Step '$step_id' → $new_status"
  [ -n "$notes" ] && echo "   Notes: $notes"
}

add_note() {
  local text="$1"
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  if [ ! -f "$PROGRESS_FILE" ]; then
    echo "❌ No migration in progress."
    exit 1
  fi

  local tmp
  tmp=$(mktemp)
  cat "$PROGRESS_FILE" | jq --arg text "$text" --arg ts "$timestamp" '
    .notes += [{"timestamp": $ts, "text": $text}] |
    .lastUpdated = $ts
  ' > "$tmp" && mv "$tmp" "$PROGRESS_FILE"

  echo "📝 Note added: $text"
}

show_summary() {
  if [ ! -f "$PROGRESS_FILE" ]; then
    echo "❌ No migration in progress."
    exit 1
  fi

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 Migration Summary (for Copilot context)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Copy-paste this into a new Copilot chat to resume:"
  echo ""
  echo "---"

  local source target approach current
  source=$(cat "$PROGRESS_FILE" | jq -r '.sourceVersion')
  target=$(cat "$PROGRESS_FILE" | jq -r '.targetVersion')
  approach=$(cat "$PROGRESS_FILE" | jq -r '.approach')
  current=$(cat "$PROGRESS_FILE" | jq -r '.currentStep')

  echo "I'm continuing a PWA migration from $source to $target."
  [ -n "$approach" ] && [ "$approach" != "" ] && echo "Approach: $approach"
  echo "Current step: $current"
  echo ""
  echo "Completed steps:"
  cat "$PROGRESS_FILE" | jq -r '.steps[] | select(.status == "completed") | "- " + .description + (if .notes != "" then " (" + .notes + ")" else "" end)'
  echo ""
  echo "Next steps:"
  cat "$PROGRESS_FILE" | jq -r '.steps[] | select(.status == "not-started") | "- " + .description' | head -3
  echo ""

  local note_count
  note_count=$(cat "$PROGRESS_FILE" | jq '.notes | length')
  if [ "$note_count" -gt 0 ]; then
    echo "Important notes:"
    cat "$PROGRESS_FILE" | jq -r '.notes[-5:][] | "- " + .text'
  fi

  echo "---"
  echo ""
  echo "Please read .migration-progress.json for full state and continue the migration."
}

# Main command dispatch
case "${1:-status}" in
  init)
    init_progress "${2:-}" "${3:-}"
    ;;
  status)
    show_status
    ;;
  update)
    if [ -z "${2:-}" ] || [ -z "${3:-}" ]; then
      echo "Usage: ./scripts/migration-progress.sh update <step_id> <status> [notes]"
      exit 1
    fi
    update_step "$2" "$3" "${4:-}"
    ;;
  note)
    if [ -z "${2:-}" ]; then
      echo "Usage: ./scripts/migration-progress.sh note \"Your note here\""
      exit 1
    fi
    add_note "$2"
    ;;
  summary)
    show_summary
    ;;
  *)
    echo "Migration Progress Tracker"
    echo ""
    echo "Usage:"
    echo "  ./scripts/migration-progress.sh init <source_version> <target_version>"
    echo "  ./scripts/migration-progress.sh status"
    echo "  ./scripts/migration-progress.sh update <step_id> <status> [notes]"
    echo "  ./scripts/migration-progress.sh note \"Free-form note\""
    echo "  ./scripts/migration-progress.sh summary"
    echo ""
    echo "Statuses: completed, in-progress, skipped, not-started"
    ;;
esac
