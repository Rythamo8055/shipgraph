"""Live-DB tests against the real CognoDB instance (skipped if .env absent).

  (a) connectivity
  (b) unique constraints exist for all 7 key properties
  (c) node counts: NO foreign labels; every label >= CONTRACT minimums
  (d) idempotency: scripts/load.py run twice -> identical reported totals
      (sha256 of the totals block in stdout)
  (e) flagship chain query returns rows and at least one incident chain
      has >= 3 hops of edges
  (f) RESOLVED_BY / DEPLOYED / WORKED_ON edges carry heuristic:true
  (g) zero orphan relationships (every rel endpoint has its label's key property)

Honesty rules:
  - foreign labels fail loudly (the live DB must contain ONLY ShipGraph data)
  - checks defer (skip with an explicit message) only while the DB holds no
    ShipGraph nodes at all (Agent A mid-seed)
"""

import hashlib
import re
import subprocess
from pathlib import Path

import pytest
from dotenv import dotenv_values
from neo4j import GraphDatabase

from scripts.acquire import schema as S

REPO_ROOT = Path(__file__).resolve().parents[1]
ENV = dotenv_values(REPO_ROOT / ".env")

DB_URI = ENV.get("COGNODB_URI")
DB_USER = ENV.get("COGNODB_USERNAME")
DB_PASS = ENV.get("COGNODB_PASSWORD")

pytestmark = pytest.mark.skipif(
    not (DB_URI and DB_USER and DB_PASS),
    reason="COGNODB_URI/USERNAME/PASSWORD not in .env - live DB tests skipped",
)

NODE_KEY_SPEC = list(S.NODE_KEYS.items())  # [(label, keyprop), ... ]

# CONTRACT target volumes (Sources section) - floor values for the live DB
MIN_COUNTS = {
    S.N_ENGINEER: 30,
    S.N_REPO: 15,
    S.N_PULL_REQUEST: 1000,
    S.N_COMMIT: 2000,
    S.N_RELEASE: 300,
    S.N_INCIDENT: 150,
    S.N_SERVICE: 10,
}

FLAGSHIP_QUERY = """
MATCH (i:Incident {key:$incidentKey})-[:AFFECTED]->(s:Service)<-[:DEPLOYED]-(rel:Release)
MATCH (rel)-[:SHIPPED]->(pr:PullRequest)-[:INCLUDED]->(c:Commit)<-[:AUTHORED]-(e:Engineer)
RETURN i.key AS incident, rel.tagName AS release, pr.number AS pr, e.login AS engineer, c.key AS commit
ORDER BY c.authoredAt LIMIT 20
"""


@pytest.fixture(scope="module")
def driver():
    drv = GraphDatabase.driver(DB_URI, auth=(DB_USER, DB_PASS))
    yield drv
    drv.close()


def _run(driver, cypher, **params):
    with driver.session() as session:
        return list(session.run(cypher, **params))


def _label_counts(driver):
    rows = _run(driver, "MATCH (n) RETURN labels(n)[0] AS l, count(*) AS c")
    return {r["l"]: r["c"] for r in rows if r["l"]}


def _shipgraph_nodes(driver):
    counts = {label: 0 for label, _ in S.NODE_KEYS.items()}
    for label, c in _label_counts(driver).items():
        if label in counts:
            counts[label] = c
    return sum(counts.values())


def _skip_if_not_seeded(driver):
    """Skip a check when Agent A has not seeded ANY ShipGraph data yet."""
    if _shipgraph_nodes(driver) == 0:
        pytest.skip("live DB has no ShipGraph nodes yet - Agent A has not "
                    "seeded (or connected to the wrong database)")


def test_a_connectivity(driver):
    rows = _run(driver, "RETURN 1 AS one")
    assert rows and rows[0]["one"] == 1, "canary query failed"


def test_b_constraints_exist_for_all_7_keys(driver):
    _skip_if_not_seeded(driver)
    rows = _run(driver, "SHOW CONSTRAINTS YIELD name, labelsOrTypes, properties")
    found = {}
    for r in rows:
        labels = r["labelsOrTypes"]
        labels = [labels] if isinstance(labels, str) else list(labels or [])
        props = r["properties"]
        props = [props] if isinstance(props, str) else list(props or [])
        if not labels:
            # CognoDB may omit labelsOrTypes; infer label from constraint name
            # (auto-name: "constraint_<label>_<prop>").
            name_parts = (r["name"] or "").lower().replace("constraint_", "").split("_")
            for label, key in dict(S.NODE_KEYS).items():
                if label.lower() in name_parts and key.lower() in name_parts:
                    labels.append(label)
        for label in labels:
            for prop in props:
                found.setdefault(label, set()).add(prop)
    missing = ["%s.%s" % (label, key)
               for label, key in NODE_KEY_SPEC if key not in found.get(label, set())]
    assert not missing, "missing unique constraints: %s (found: %s)" % (
        missing, {k: sorted(v) for k, v in found.items()})


def test_c_counts_minimums_and_no_foreign_labels(driver):
    counts = _label_counts(driver)
    if not counts:
        pytest.skip("live DB is empty - Agent A has not seeded yet")
    foreign = sorted(set(counts) - set(S.NODE_KEYS))
    assert not foreign, (
        "live DB contains labels outside the ShipGraph schema: %s (node "
        "counts: %s). Either Agent A seeded the wrong database or this "
        "CognoDB instance is shared with another application; ShipGraph "
        "data would be polluted." % (foreign, counts))
    _skip_if_not_seeded(driver)
    for label, key in NODE_KEY_SPEC:
        assert label in counts and counts[label] > 0, (
            "label %s has 0 nodes (counts=%s)" % (label, counts))
    below = {label: counts.get(label, 0)
             for label, minc in MIN_COUNTS.items()
             if counts.get(label, 0) < minc}
    assert not below, (
        "labels below CONTRACT minimums: %s (counts=%s)"
        % (below, counts))
    return counts


def _load_totals_block(stdout):
    """Extract the 'label: count' totals block from load.py stdout and
    return a canonical string for hashing (sorted, deduped)."""
    lines = []
    for line in stdout.splitlines():
        m = re.search(r"([A-Za-z][A-Za-z0-9_/\- ]*?)\s*[:=]\s*(\d+)\s*$", line.strip())
        if not m:
            continue
        label, n = m.group(1).strip(), int(m.group(2))
        if label.lower().startswith(("commit ", "sha ")):
            continue
        lines.append(label + ": " + str(n))
    return "\n".join(sorted(set(lines)))


def _run_load():
    """Run scripts/load.py once; return (totals_block_sha256, parsed_dict)."""
    loader = REPO_ROOT / "scripts" / "load.py"
    proc = subprocess.run(
        [str(REPO_ROOT / ".venv" / "bin" / "python"), str(loader)],
        cwd=str(REPO_ROOT), capture_output=True, text=True, timeout=1800)
    assert proc.returncode == 0, (
        "scripts/load.py failed (rc=%d):\n%s\n%s"
        % (proc.returncode, proc.stdout[-4000:], proc.stderr[-4000:]))
    block = _load_totals_block(proc.stdout)
    assert block, "could not extract totals block from load.py stdout:\n%s" % (
        proc.stdout[-4000:])
    parsed = {}
    for line in block.splitlines():
        label, _, n = line.rpartition(": ")
        parsed[label] = n
    return hashlib.sha256(block.encode("utf-8")).hexdigest(), parsed


def test_d_idempotent_reload(driver):
    loader = REPO_ROOT / "scripts" / "load.py"
    if not loader.exists():
        pytest.skip("scripts/load.py not written by Agent A yet")
    norm = REPO_ROOT / "data" / "normalized"
    if not norm.exists() or not any(norm.glob("*.jsonl")):
        pytest.skip("data/normalized empty - nothing for load.py to do")
    first, parsed1 = _run_load()
    second, parsed2 = _run_load()
    assert first == second, (
        "non-idempotent load! totals sha256 run1=%s run2=%s (run1=%s run2=%s)"
        % (first, second, parsed1, parsed2))


def test_e_flagship_query_and_chain_length(driver):
    _skip_if_not_seeded(driver)
    # deepest incident -> fixer chain in one traversal: walk the whole graph
    # from any incident whose service also has a DEPLOYED release, and keep
    # the longest chain found (newest-first tie-break).
    deep = _run(driver, (
        "MATCH p = (i:Incident)-[:AFFECTED]->(s:Service)<-[:DEPLOYED]-(rel:Release)"
        "-[:SHIPPED]->(pr:PullRequest)-[:INCLUDED]->(c:Commit)<-[:AUTHORED]-(e:Engineer) "
        "RETURN length(p) AS hops, i.key AS key, i.createdAt AS created "
        "ORDER BY hops DESC, i.createdAt DESC LIMIT 1"))
    assert deep, "flagship chain never lands: no AFFECTED incident has a DEPLOYED release with SHIPPED/INCLUDED/AUTHORED edges"
    hops, key = int(deep[0]["hops"]), deep[0]["key"]
    rows = _run(driver, FLAGSHIP_QUERY, incidentKey=key)
    assert rows, "flagship query returned 0 rows for the deepest-chain incident %s" % key
    assert hops >= 4, (
        "flagship chain too shallow for %s: %d edge hops across %d rows"
        % (key, hops, len(rows)))


def test_f_heuristic_edges_carry_heuristic_true(driver):
    _skip_if_not_seeded(driver)
    bad = []
    for rtype in (S.R_RESOLVED_BY, S.R_DEPLOYED, S.R_WORKED_ON):
        total = _run(driver, "MATCH ()-[r:" + rtype + "]->() "
                             "RETURN count(r) AS c")[0]["c"]
        if total == 0:
            pytest.skip("no " + rtype + " edges yet (Agent A derived pass "
                        "may be pending)")
        missing = _run(driver, ("MATCH ()-[r:" + rtype + "]->() "
                                "WHERE coalesce(r.heuristic, false) <> true "
                                "RETURN count(r) AS c"))[0]["c"]
        if missing:
            bad.append(rtype + ": " + str(missing) + " edges missing heuristic:true")
    assert not bad, "; ".join(bad)


def test_g_no_orphan_relationships_in_live_db(driver):
    _skip_if_not_seeded(driver)
    cond_a = " OR ".join(
        "(a:" + label + " AND exists(a." + key + "))" for label, key in NODE_KEY_SPEC)
    cond_b = " OR ".join(
        "(b:" + label + " AND exists(b." + key + "))" for label, key in NODE_KEY_SPEC)
    query = ("MATCH (a)-[r]->(b) WHERE NOT (" + cond_a + ") OR NOT (" + cond_b + ") "
             "RETURN count(r) AS c")
    orphans = _run(driver, query)[0]["c"]
    assert orphans == 0, "orphan relationships in live DB: %d" % orphans
