#!/usr/bin/env bash
# Commit size guard. Usage: check-commit-size.sh [--staged | <commit>]
# Used by .githooks/pre-commit (staged) and CI (each commit of a PR).
set -euo pipefail

MAX="${PAYPROOF_MAX_COMMIT_LINES:-200}"
EXCLUDES=(
  ':(exclude)*.lock' ':(exclude)pnpm-lock.yaml' ':(exclude)uv.lock'
  ':(exclude)packages/api-client/src/generated/**'
  ':(exclude)apps/api/migrations/versions/**'
  ':(exclude)fixtures/**' ':(exclude)docs/**' ':(exclude)*.md'
  ':(exclude)*.png' ':(exclude)*.jpg' ':(exclude)*.svg' ':(exclude)*.pdf' ':(exclude)*.ico'
)

target="${1:---staged}"
if [[ "$target" == "--staged" ]]; then
  stats=$(git diff --cached --numstat -- . "${EXCLUDES[@]}")
  label="staged changes"
else
  stats=$(git show --numstat --format= "$target" -- . "${EXCLUDES[@]}")
  label="commit $(git rev-parse --short "$target")"
fi

total=$(printf '%s\n' "$stats" | awk '$1 != "-" && NF >= 3 {s += $1 + $2} END {print s + 0}')

if (( total > MAX )); then
  echo "✗ $label: $total lines changed — limit is $MAX (lock, generated, fixtures, docs excluded)." >&2
  echo "  Split into smaller logical commits: git restore --staged . && git add -p" >&2
  echo "  Largest files:" >&2
  printf '%s\n' "$stats" | sort -k1,1nr | head -8 | sed 's/^/    /' >&2
  exit 1
fi
echo "✓ $label: $total lines (limit $MAX)"
