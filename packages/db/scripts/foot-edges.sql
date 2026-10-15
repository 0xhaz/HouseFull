-- Builds foot_edges from osm2pgrouting's osm.ways (run by import-osm.sh).
-- ODbL data: kept in the database for routing, never published as a dump.
-- osm.way_lit (osm_id, lit) is loaded from osm-way-tags.py output before this runs.
DELETE FROM foot_edges WHERE city_id = 'nyc';
INSERT INTO foot_edges (city_id, source, target, length_m, lit, highway, geom)
SELECT 'nyc', w.source, w.target, w.length_m,
       CASE WHEN l.lit IN ('yes', '24/7', 'automatic', 'limited', 'interval') THEN true
            WHEN l.lit = 'no' THEN false END,
       c.tag_value,
       ST_LineMerge(w.the_geom)
FROM osm.ways w
LEFT JOIN osm.configuration c ON c.tag_id = w.tag_id
LEFT JOIN osm.way_lit l ON l.osm_id = w.osm_id
WHERE w.source IS NOT NULL AND w.target IS NOT NULL AND GeometryType(ST_LineMerge(w.the_geom)) = 'LINESTRING';
CREATE INDEX IF NOT EXISTS foot_edges_source_idx ON foot_edges (source);
CREATE INDEX IF NOT EXISTS foot_edges_target_idx ON foot_edges (target);
ANALYZE foot_edges;
SELECT count(*) AS edges,
       round(100.0 * count(*) FILTER (WHERE lit IS NOT NULL) / count(*), 1) AS lit_tagged_pct
FROM foot_edges WHERE city_id = 'nyc';
