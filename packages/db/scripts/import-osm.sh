#!/bin/sh
# NYC walking network for F5/F8 routing (OpenStreetMap, ODbL; never published as a dump).
#
#   pnpm import:osm            # local Supabase (DATABASE_URL host/port parsed below)
#
# Needs Docker and Python with pyosmium (pip install osmium). ~10–20 min, mostly osm2pgrouting.
set -eu
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OSM="$ROOT/data/osm"
URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54522/postgres}"
PY="${PYTHON:-python3}"
mkdir -p "$OSM"

if [ ! -f "$OSM/NewYork.osm.pbf" ]; then
  echo "Downloading BBBike NewYork extract…"
  curl -sf -o "$OSM/NewYork.osm.pbf" https://download.bbbike.org/osm/bbbike/NewYork/NewYork.osm.pbf
fi
if [ ! -f "$OSM/nyc-walk.osm" ]; then
  "$PY" -I "$ROOT/packages/db/scripts/osm-extract.py" "$OSM/NewYork.osm.pbf" "$OSM/nyc-walk.osm"
fi

psql "$URL" -qc "CREATE SCHEMA IF NOT EXISTS osm; CREATE EXTENSION IF NOT EXISTS hstore WITH SCHEMA extensions;"

# Connection details for the container (localhost on the host = host.docker.internal inside Docker).
HOSTPORT=$(echo "$URL" | sed -E 's#.*@([^/]+)/.*#\1#')
HOST=$(echo "$HOSTPORT" | cut -d: -f1 | sed 's/127.0.0.1\|localhost/host.docker.internal/')
PORT=$(echo "$HOSTPORT" | cut -s -d: -f2)
USERPASS=$(echo "$URL" | sed -E 's#postgresql://([^@]+)@.*#\1#')
DB=$(echo "$URL" | sed -E 's#.*/([^/?]+)(\?.*)?$#\1#')

docker run --rm --platform linux/amd64 -v "$OSM:/data" -v "$ROOT/packages/db/scripts/mapconfig-walk.xml:/conf/walk.xml:ro" iboates/osm2pgrouting:2.3.8 \
  osm2pgrouting -f /data/nyc-walk.osm -c /conf/walk.xml \
  --schema osm --clean -d "$DB" -U "${USERPASS%%:*}" -W "${USERPASS#*:}" -h "$HOST" -p "${PORT:-5432}"

"$PY" -I "$ROOT/packages/db/scripts/osm-way-tags.py" "$OSM/nyc-walk.osm" "$OSM/way-lit.csv"
psql "$URL" -v ON_ERROR_STOP=1 -c "DROP TABLE IF EXISTS osm.way_lit; CREATE TABLE osm.way_lit (osm_id bigint PRIMARY KEY, lit text);" \
  -c "\\copy osm.way_lit FROM '$OSM/way-lit.csv' CSV HEADER"
psql "$URL" -v ON_ERROR_STOP=1 -f "$ROOT/packages/db/scripts/foot-edges.sql"
