#!/usr/bin/env bash
# One-time setup for every clone: git hooks + toolchain check.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

git config core.hooksPath .githooks
chmod +x .githooks/* scripts/*.sh
echo "✓ git hooks enabled (.githooks)"

missing=0
check() { # name, min-hint, command
  if command -v "$1" >/dev/null 2>&1; then
    printf "✓ %-7s %s\n" "$1" "$($3 2>/dev/null | head -1)"
  else
    printf "✗ %-7s not found — %s\n" "$1" "$2"; missing=1
  fi
}
check node   "install Node 22+ (https://nodejs.org or nvm)"  "node --version"
check pnpm   "corepack enable && corepack prepare pnpm@9 --activate" "pnpm --version"
check uv     "brew install uv  (Python 3.12 is installed by uv)"     "uv --version"
check docker "install Docker Desktop"                        "docker --version"
check gh     "brew install gh  (optional, for PRs)"          "gh --version"

if [[ -f package.json ]]; then pnpm install; fi
if [[ -f apps/api/pyproject.toml ]]; then (cd apps/api && uv sync); fi
if [[ ! -f .env && -f .env.example ]]; then cp .env.example .env && echo "✓ .env created from .env.example"; fi

if (( missing )); then echo "Install the missing tools above, then re-run ./scripts/setup.sh"; exit 1; fi
echo "Ready. Start Claude Code in the repo root and run: /next-step <your track>"
