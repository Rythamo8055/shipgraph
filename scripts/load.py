"""Load normalized data into CognoDB.

Pre-flight: purge the entire graph (this instance is dedicated to ShipGraph),
then create unique constraints, then MERGE nodes and relationships in batches
(UNWIND 500). Idempotent: totals identical across runs.

Usage: .venv/bin/python scripts/load.py
"""
import json
import os
import sys

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "acquire"))
from schema import NODE_LABELS, KEYS, REL_TYPES

NODE_LABEL_SET = set(NODE_LABELS)

URI = os.environ.get("COGNODB_URI", "")
USER = os.environ.get("COGNODB_USERNAME", "cognodb")
PASSWORD = os.environ.get("COGNODB_PASSWORD", "")

if not URI or not PASSWORD:
    raise SystemExit("COGNODB_URI/COGNODB_PASSWORD missing - refusing to run")

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NORM = os.path.join(HERE, "data", "normalized")


def read_jsonl(name):
    rows = []
    path = os.path.join(NORM, name)
    if not os.path.exists(path):
        raise SystemExit("missing %s - run normalize first" % path)
    with open(path) as f:
        for line in f:
            rows.append(json.loads(line))
    return rows


def _noop(records):
    return None


def main():
    from neo4j import GraphDatabase
    nodes = read_jsonl("nodes.jsonl")
    rels = read_jsonl("rels.jsonl")

    driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))
    try:
        # 1. purge in batches (cloud instance can be slow)
        while True:
            recs, _, _ = driver.execute_query(
                "MATCH (n) WITH n LIMIT 50000 DETACH DELETE n RETURN count(n) AS c")
            c = recs[0]["c"] if recs else 0
            print("purged batch (deleted %d nodes)" % c, flush=True)
            if c == 0:
                break
        print("purged existing graph", flush=True)

        # 2. constraints
        for label in NODE_LABELS:
            key = KEYS[label]
            q = ("CREATE CONSTRAINT shipgraph_" + label.lower() + "_" + key +
                 " IF NOT EXISTS FOR (n:" + label + ") REQUIRE n." + key +
                 " IS UNIQUE")  # label/key from schema constants only
            try:
                driver.execute_query(q, result_transformer_=_noop)
            except Exception as e:
                print("  constraint %s failed: %s" % (label, e))
        print("constraints ensured")

        # 3. nodes
        by_label = {l: [] for l in NODE_LABELS}
        for n in nodes:
            lbl = n.get("_label")
            by_label.get(lbl, []).append({k: v for k, v in n.items() if k != "_label"})
        total = 0
        for label in NODE_LABELS:
            rows = by_label[label]
            if not rows:
                continue
            for i in range(0, len(rows), 500):
                chunk = rows[i:i + 500]
                q = ("UNWIND $rows AS row "
                     "MERGE (n:" + label + " {key: row.key}) "
                     "ON CREATE SET n += row "
                     "ON MATCH SET n += row")  # label from schema constants only
                driver.execute_query(q, rows=chunk, result_transformer_=_noop)
            total += len(rows)
            print("  nodes %-12s %d" % (label, len(rows)))

        # 4. relationships (label-scoped MATCH: bare-key scans time out on cloud)
        by_combo = {}
        for r in rels:
            rtype = r.get("_type") or r["type"]
            if rtype not in REL_TYPES:
                raise ValueError("non-whitelisted rel: %r" % rtype)
            fl = r.get("fromLabel", "Node")
            tl = r.get("toLabel", "Node")
            if fl not in NODE_LABEL_SET or tl not in NODE_LABEL_SET:
                raise ValueError("non-schema labels on rel: %r %r" % (fl, tl))
            combo = (rtype, fl, tl)
            props = {k: v for k, v in r.items()
                     if k not in ("type", "_type", "from", "to", "fromLabel", "toLabel")}
            by_combo.setdefault(combo, []).append((r["from"], r["to"], props))
        edge_total = 0
        for (rtype, fl, tl), rows in sorted(by_combo.items()):
            if not rows:
                continue
            for i in range(0, len(rows), 300):
                chunk = rows[i:i + 300]
                q = ("UNWIND $rows AS row "
                     "MATCH (a:" + fl + " {key: row.from}) "
                     "MATCH (b:" + tl + " {key: row.to}) "
                     "MERGE (a)-[r:" + rtype + "]->(b)")  # labels/types from schema constants only
                driver.execute_query(q,
                                     rows=[{"from": f, "to": t} for f, t, _ in chunk],
                                     result_transformer_=_noop)
                q2 = ("UNWIND $rows AS row "
                      "MATCH (a:" + fl + " {key: row.from})-[r:" + rtype + "]->(b:" + tl + " {key: row.to}) "
                      "SET r += row.props")  # labels/types from schema constants only
                driver.execute_query(q2,
                                     rows=[{"from": f, "to": t, "props": p}
                                           for f, t, p in chunk],
                                     result_transformer_=_noop)
            edge_total += len(rows)
            print("  rels  %-12s %d" % (rtype, len(rows)), flush=True)

        # 5. sanity counts
        for label in NODE_LABELS:
            recs, _, _ = driver.execute_query(
                "MATCH (n:" + label + ") RETURN count(n) AS c")  # label from schema constants only
            print("  db %-12s %d" % (label, recs[0]["c"]))
        recs, _, _ = driver.execute_query("MATCH ()-[r]->() RETURN count(r) AS c")
        print("  db edges %d" % recs[0]["c"])
        print("OK nodes=%d rels=%d" % (total, edge_total))
    finally:
        driver.close()


if __name__ == "__main__":
    main()