#!/usr/bin/env bash
# Check every non-merge commit in a range with the same rules as the local hooks:
# size (scripts/check-commit-size.sh) and message format (.githooks/commit-msg).
# Usage: check-pr-commits.sh <base-ref> [head-ref]   e.g. check-pr-commits.sh origin/main HEAD
# CHECK_ROOT: directory holding the rule scripts (CI passes the base branch's copies, so a PR
# cannot relax the rules it is checked against). Defaults to this checkout.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
rules="${CHECK_ROOT:-.}"

base="${1:?usage: check-pr-commits.sh <base-ref> [head-ref]}"
head="${2:-HEAD}"
msg_file="$(mktemp)"
trap 'rm -f "$msg_file"' EXIT

failed=0
commits=$(git rev-list --no-merges --reverse "$base..$head")
for c in $commits; do
  git log -1 --format=%B "$c" > "$msg_file"
  "$rules/scripts/check-commit-size.sh" "$c" || failed=1
  if ! "$rules/.githooks/commit-msg" "$msg_file" 2>/dev/null; then
    echo "✗ commit $(git rev-parse --short "$c"): message does not follow Conventional Commits with a scope: $(head -n1 "$msg_file")" >&2
    failed=1
  fi
done

count=$(printf '%s\n' "$commits" | grep -c . || true)
if (( failed )); then
  echo "✗ $count commit(s) checked — fix the ones above (split large commits, reword messages)." >&2
  exit 1
fi
echo "✓ $count commit(s): size and message OK"
