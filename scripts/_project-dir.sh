#!/bin/bash
##############################################################################
# Shared helper: Resolve the target PWA project directory
#
# Usage (source from any script):
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   source "$SCRIPT_DIR/_project-dir.sh"
#   # Now $PROJECT_DIR points to the PWA project root
#
# Resolution order:
#   1. --project-dir <path> argument (if passed to the calling script)
#   2. $PWA_PROJECT_DIR environment variable
#   3. Current working directory (legacy behavior)
#
# Cross-platform notes:
#   - Works on Linux, macOS, and Git Bash/WSL on Windows
#   - Paths should use forward slashes (Git Bash handles conversion)
#   - Set PWA_PROJECT_DIR in your shell profile or .code-workspace terminal env
##############################################################################

_resolve_project_dir() {
  local dir=""

  # 1. Check if --project-dir was passed as argument to the calling script
  #    Scripts should pass their $@ to this function
  local args=("$@")
  for ((i=0; i<${#args[@]}; i++)); do
    if [[ "${args[$i]}" == "--project-dir" ]] && [[ $((i+1)) -lt ${#args[@]} ]]; then
      dir="${args[$((i+1))]}"
      break
    fi
  done

  # 2. Fall back to environment variable
  if [[ -z "$dir" ]] && [[ -n "$PWA_PROJECT_DIR" ]]; then
    dir="$PWA_PROJECT_DIR"
  fi

  # 3. Fall back to current working directory (legacy behavior)
  if [[ -z "$dir" ]]; then
    dir="$(pwd)"
  fi

  # Resolve to absolute path
  if [[ -d "$dir" ]]; then
    dir="$(cd "$dir" && pwd)"
  else
    echo "ERROR: Project directory does not exist: $dir" >&2
    return 1
  fi

  # Validate it looks like a PWA project (has package.json)
  if [[ ! -f "$dir/package.json" ]]; then
    echo "WARNING: No package.json found in $dir" >&2
    echo "         Ensure --project-dir or PWA_PROJECT_DIR points to the PWA project root." >&2
  fi

  echo "$dir"
}

# Auto-resolve when sourced (passes calling script's args if available)
PROJECT_DIR="$(_resolve_project_dir "$@")" || exit 1

# Export for child processes
export PROJECT_DIR
