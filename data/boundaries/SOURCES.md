# Boundary and city data sources

Checked Oct 13, 2026. Downloads are cached in `data/boundaries/cache/` (gitignored) by `pnpm import:boundaries`.

| City | Dataset | Publisher | Endpoint | Units | Licence |
|---|---|---|---|---|---|
| NYC | 2020 Neighborhood Tabulation Areas (`9nt8-h7nd`) | NYC Dept. of City Planning, NYC Open Data | `data.cityofnewyork.us/resource/9nt8-h7nd.geojson` | 262 (197 residential) | NYC Open Data: no restrictions on use (Admin Code §23-502). Attribute "NYC Open Data / DCP" |
| NOLA | Neighborhood Statistical Areas (`exvn-jeh2`) | City of New Orleans, data.nola.gov | `data.nola.gov/resource/exvn-jeh2.geojson` | 72 | No licence stated on the dataset (other city datasets are CC0). Attribute "City of New Orleans / data.nola.gov" |
| LA | Neighborhood Councils (Certified), LAHub Boundaries layer 18 | City of Los Angeles, GeoHub | `maps.lacity.org/lahub/rest/services/Boundaries/MapServer/18` | 99 | CC BY 4.0. Attribute "City of Los Angeles GeoHub" |

LA uses Neighborhood Council polygons directly as the neighborhood unit. LA Times "Mapping L.A." is not used (terms unconfirmed; we believe non-commercial only).

## Other city data (Phase 2 imports)

| Use | Dataset | Notes |
|---|---|---|
| F7 permitted events | NYC `tvpp-9vvx` (current), `bkfu-528j` (historical) | No coordinates: free-text location + community board / precinct. Most rows are sports; filter `event_type`. Timestamps are local (America/New_York) |
| F8 incidents | NYPD Complaint Data Current YTD `5uac-w243` | Quarterly, ~1 quarter lag (data ends 2026-06-30). Some bad dates: filter on `rpt_dt`. Import category, time and point only; publish aggregates only |
| Transit | MTA subway GTFS `rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip`; alerts `api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts` | No key needed (Oct 2026). Terms: fetch server-side and cache, never serve from MTA to browsers; no endorsement; flag real-time data older than 1 min |
| Walking graph | OSM via Geofabrik `new-york-latest.osm.pbf` (or BBBike NewYork extract), clipped to NYC, osm2pgrouting | ODbL: show "© OpenStreetMap contributors"; never publish the routing database (share-alike) |
