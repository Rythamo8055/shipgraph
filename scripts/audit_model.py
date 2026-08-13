#!/usr/bin/env python3
"""ShipGraph model audit - Agent D.

Checks the contract constants (scripts/acquire/schema.py) against CONTRACT.md
tables, and - when a live DB is reachable - audits constraints and counts.

Exit 0 = model consistent with CONTRACT; 1 = violation found; 2 = error.

Usage:
    .venv/bin/python scripts/audit_model.py
"""

import sys
from pathlib import Path

from dotenv import dotenv_values

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, REPO_ROOT.as_posix())

from scripts.acquire import schema as S  # noqa: E402

EXPECTED_NODE_KEYS = {
    "Engineer": "login",
    "Repo": "name",
    "PullRequest": "key",
    "Commit": "key",
    "Release": "key",
    "Incident": "key",
    "Service": "key",
}

EXPECTED_REL_TYPES = {
    "AUTHORED", "COMMITTED", "OPENED", "MERGED_BY", "IMPROVED", "INCLUDED",
    "SHIPPED", "DEPLOYED", "AFFECTED", "RESOLVED_BY", "WORKED_ON",
}

EXPECTED_HEURISTIC = {"SHIPPED", "DEPLOYED", "RESOLVED_BY", "WORKED_ON"}

failures = []


def check(name, ok, detail=""):
    print("%-40s %s %s" % (name, "PASS" if ok else "FAIL", detail))
    if not ok:
        failures.append(name)


def audit_static():
    check("node labels+keys match CONTRACT",
          S.NODE_KEYS == EXPECTED_NODE_KEYS,
          "" if S.NODE_KEYS == EXPECTED_NODE_KEYS
          else "schema=%s" % sorted(S.NODE_KEYS.items()))
    check("rel types match CONTRACT",
          set(S.REL_TYPES) == EXPECTED_REL_TYPES,
          "" if set(S.REL_TYPES) == EXPECTED_REL_TYPES
          else "schema=%s" % sorted(S.REL_TYPES))
    check("heuristic rel set matches CONTRACT",
          set(S.HEURISTIC_RELS) == EXPECTED_HEURISTIC,
          "" if set(S.HEURISTIC_RELS) == EXPECTED_HEURISTIC
          else "schema=%s" % sorted(S.HEURISTIC_RELS))
    missing = EXPECTED_NODE_KEYS.keys() - set(S.NODE_LABELS)
    check("NODE_LABELS covers all 7 labels", not missing,
          "missing: %s" % sorted(missing) if missing else "")
    check("MAX_TEXT truncation cap defined", S.MAX_TEXT == 200, "")


def audit_live():
    env = dotenv_values(REPO_ROOT / ".env")
    uri, user, pw = env.get("COGNODB_URI"), env.get("COGNODB_USERNAME"), env.get("COGNODB_PASSWORD")
    if not (uri and user and pw):
        print("live DB audit: SKIP (no .env credentials)")
        return
    try:
        from neo4j import GraphDatabase
        driver = GraphDatabase.driver(uri, auth=(user, pw))
        with driver.session() as session:
            rows = list(session.run(
                "SHOW CONSTRAINTS YIELD labelsOrTypes, properties"))
            found = {}
            for r in rows:
                for label in (r["labelsOrTypes"] or []):
                    found.setdefault(label, set()).update(r["properties"] or [])
            for label, key in EXPECTED_NODE_KEYS.items():
                check("constraint %s.%s" % (label, key),
                      key in found.get(label, set()),
                      "found=%s" % sorted(found.get(label, set())) if label in found else "none")
            for label, key in EXPECTED_NODE_KEYS.items():
                c = list(session.run(
                    "MATCH (n:" + label + ") RETURN count(n) AS c"))[0]["c"]
                print("%-40s %s (%d nodes)" % ("count %s" % label,
                                               "SKIP" if c == 0 else "OK", c))
    except Exception as e:  # pragma: no cover
        check("live DB reachable", False, "error: %s" % e)


def main():
    audit_static()
    audit_live()
    print("----")
    if failures:
        print("audit_model: RED (%d violations)" % len(failures))
        return 1
    print("audit_model: GREEN - schema consistent with CONTRACT")
    return 0


if __name__ == "__main__":
    sys.exit(main())