#!/usr/bin/env bash
# Multiwarden: turns off Bitwarden's own GitHub Actions workflows in this repository, leaving
# only the multiwarden-* workflows on. Bitwarden's workflows need Bitwarden's secrets and
# infrastructure, so on this repository they would only fail.
#
# The workflow files stay in the repository, unchanged, so upstream syncs don't conflict.
# Run once after the first push (needs the GitHub CLI, logged in):
#   bash multiwarden/scripts/disable-upstream-workflows.sh
set -euo pipefail
repo="${1:-multiwarden/clients}"
for file in .github/workflows/*.yml; do
  name="$(basename "$file")"
  case "$name" in
    multiwarden-*) echo "keep     $name" ;;
    *)
      if gh workflow disable "$name" --repo "$repo" > /dev/null 2>&1; then
        echo "disabled $name"
      else
        echo "skipped  $name (not registered yet or already disabled)"
      fi
      ;;
  esac
done
