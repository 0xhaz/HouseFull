"""
Writes the OSM `lit` tag per way as CSV (osm_id,lit), for foot_edges.
osm2pgrouting only keeps tags with --addnodes, which also imports every node;
reading the one tag we need from the extract is much cheaper.

    python osm-way-tags.py data/osm/nyc-walk.osm data/osm/way-lit.csv
"""

import csv
import sys

import osmium


def main(src: str, dst: str) -> None:
    n = 0
    with open(dst, "w", newline="") as f:
        out = csv.writer(f)
        out.writerow(["osm_id", "lit"])
        for w in osmium.FileProcessor(src, osmium.osm.WAY):
            lit = w.tags.get("lit")
            if lit:
                out.writerow([w.id, lit])
                n += 1
    print(f"{n:,} ways with a lit tag -> {dst}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
