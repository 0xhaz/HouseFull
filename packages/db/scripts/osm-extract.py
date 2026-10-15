"""
Cuts an OSM extract down to the walkable street network of New York City and
writes it as .osm XML, which osm2pgrouting needs (it doesn't read PBF and loads
the whole file into memory, so the smaller the better).

    python osm-extract.py data/osm/NewYork.osm.pbf data/osm/nyc-walk.osm

Requires pyosmium (pip install osmium). Data: © OpenStreetMap contributors, ODbL.
"""

import sys

import osmium

# Five boroughs (lng/lat).
WEST, SOUTH, EAST, NORTH = -74.26, 40.49, -73.69, 40.92

# Ways people can walk on. Motorways and trunks are excluded.
WALKABLE = {
    "footway", "pedestrian", "path", "steps", "living_street", "residential",
    "service", "unclassified", "tertiary", "tertiary_link", "secondary",
    "secondary_link", "primary", "primary_link", "track", "corridor", "cycleway",
}


def inside(loc) -> bool:
    return loc.valid() and WEST <= loc.lon <= EAST and SOUTH <= loc.lat <= NORTH


def main(src: str, dst: str) -> None:
    keep_ways: set[int] = set()
    keep_nodes: set[int] = set()

    # Pass 1: walkable ways with at least one node in the box (needs node locations).
    for w in osmium.FileProcessor(src, osmium.osm.NODE | osmium.osm.WAY).with_locations():
        if not w.is_way():
            continue
        hw = w.tags.get("highway")
        if hw not in WALKABLE or w.tags.get("access") in ("private", "no") or w.tags.get("foot") == "no":
            continue
        if any(inside(n.location) for n in w.nodes):
            keep_ways.add(w.id)
            keep_nodes.update(n.ref for n in w.nodes)

    # Pass 2: write the nodes those ways use, then the ways.
    with osmium.SimpleWriter(dst, overwrite=True) as out:
        for obj in osmium.FileProcessor(src, osmium.osm.NODE | osmium.osm.WAY):
            if obj.is_node() and obj.id in keep_nodes:
                out.add_node(obj)
            elif obj.is_way() and obj.id in keep_ways:
                out.add_way(obj)

    print(f"{len(keep_ways):,} ways, {len(keep_nodes):,} nodes -> {dst}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
