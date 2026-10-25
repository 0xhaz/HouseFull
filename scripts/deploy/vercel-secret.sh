#!/usr/bin/env bash
# Adds the Clerk secret key to the Vercel project (production), read from
# apps/web/.env.local. Nothing is printed. The non-secret variables are set separately.
#
#   bash scripts/deploy/vercel-secret.sh
set -euo pipefail
cd "$(dirname "$0")/../../apps/web"
KEY=$(grep -E '^CLERK_SECRET_KEY=' .env.local | head -1 | cut -d= -f2- | sed -E 's/^["'\'']|["'\'']$//g')
[ -n "$KEY" ] || { echo "CLERK_SECRET_KEY not found in apps/web/.env.local"; exit 1; }
for target in production; do
  vercel env rm CLERK_SECRET_KEY "$target" --yes >/dev/null 2>&1 || true
  printf '%s' "$KEY" | vercel env add CLERK_SECRET_KEY "$target" --sensitive >/dev/null
  echo "set CLERK_SECRET_KEY for $target (${#KEY} chars)"
done
