#!/usr/bin/env bash
# Copies HouseFull's server secrets into Google Secret Manager (project housefull-2026).
# Values are read from .env (API keys) and .env.deploy (production database URL); nothing is
# printed except each secret's name and length. Re-running adds a new version.
#
#   bash scripts/deploy/secrets.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
PROJECT=${PROJECT:-housefull-2026}

val() { # val KEY FILE → the value, without quotes or trailing comments
  python3 - "$1" "$2" <<'EOF'
import sys
key, path = sys.argv[1], sys.argv[2]
for line in open(path):
    if line.startswith(key + '='):
        sys.stdout.write(line.split('=', 1)[1].split(' #')[0].strip().strip('"').strip("'"))
        break
EOF
}

put() { # put NAME VALUE
  local name=$1 value=$2
  if [ -z "$value" ]; then echo "skip $name: no value"; return; fi
  if gcloud secrets describe "$name" --project "$PROJECT" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- --project "$PROJECT" >/dev/null
    echo "updated $name (${#value} chars)"
  else
    printf '%s' "$value" | gcloud secrets create "$name" --replication-policy=automatic \
      --data-file=- --project "$PROJECT" >/dev/null
    echo "created $name (${#value} chars)"
  fi
}

put QLOO_API_KEY "$(val QLOO_API_KEY .env)"
put TICKETMASTER_API_KEY "$(val TICKETMASTER_API_KEY .env)"
put CLERK_SECRET_KEY "$(val CLERK_SECRET_KEY .env)"
put DATABASE_URL "$(val DATABASE_URL .env.deploy)"
# A fresh salt for production click de-duplication (only set the first time).
gcloud secrets describe CLICK_SALT --project "$PROJECT" >/dev/null 2>&1 || put CLICK_SALT "$(openssl rand -hex 32)"
