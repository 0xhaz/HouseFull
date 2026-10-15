#!/bin/sh
# Blocks any commit containing a secret, then lints staged files.
set -e
if ! command -v gitleaks >/dev/null 2>&1; then
  echo "pre-commit: gitleaks not found. Install it (brew install gitleaks) so keys never get committed." >&2
  exit 1
fi
gitleaks git --pre-commit --staged --redact --no-banner
pnpm exec lint-staged
