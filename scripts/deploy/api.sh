#!/usr/bin/env bash
# Deploys the API to Cloud Run from the latest image (scripts/deploy/cloudbuild.api.yaml).
# Secrets are referenced by name from Secret Manager (scripts/deploy/secrets.sh); only
# non-secret settings are passed here.
#
#   WEB_PUBLIC_URL=https://housefull.vercel.app bash scripts/deploy/api.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
PROJECT=${PROJECT:-housefull-2026}
REGION=${REGION:-us-east4}
IMAGE=${IMAGE:-$REGION-docker.pkg.dev/$PROJECT/housefull/api:latest}
WEB_PUBLIC_URL=${WEB_PUBLIC_URL:?set WEB_PUBLIC_URL to the web app origin(s), comma-separated}

setting() { grep -E "^$1=" "$2" | head -1 | cut -d= -f2- | sed -E 's/ +#.*$//; s/^["'\'']|["'\'']$//g'; }
PK=$(setting NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY apps/web/.env.local) # publishable: safe to pass as env

# `^@^` switches the list delimiter so comma-separated origins survive.
gcloud run deploy housefull-api --project "$PROJECT" --region "$REGION" --image "$IMAGE" \
  --service-account "housefull-api@$PROJECT.iam.gserviceaccount.com" \
  --allow-unauthenticated --port 8080 --cpu 1 --memory 1Gi \
  --min-instances 1 --max-instances 3 --no-cpu-throttling --timeout 3600 \
  --set-env-vars "^@^NODE_ENV=production@GOOGLE_VERTEX_PROJECT=$PROJECT@GOOGLE_VERTEX_LOCATION=global@GEMINI_MODEL_FAST=gemini-3.8-flash@GEMINI_MODEL_PRO=gemini-2.5-pro@WEB_PUBLIC_URL=$WEB_PUBLIC_URL@NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$PK@PRESET_REUSE_HOURS=1440@QLOO_DAILY_BUDGET=1500@LOG_LEVEL=info" \
  --set-secrets "QLOO_API_KEY=QLOO_API_KEY:latest,TICKETMASTER_API_KEY=TICKETMASTER_API_KEY:latest,CLERK_SECRET_KEY=CLERK_SECRET_KEY:latest,DATABASE_URL=DATABASE_URL:latest,CLICK_SALT=CLICK_SALT:latest"

gcloud run services describe housefull-api --project "$PROJECT" --region "$REGION" --format='value(status.url)'
