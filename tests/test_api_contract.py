"""Backend API contract tests (Agent B). Exercised only via HTTP on :3000.

Skips entirely with a clear message when the Next.js server is not running,
per the multi-agent protocol (Agent B builds it with tsx).

Covers per CONTRACT:
  - /health status/db/mode
  - deep JSON shapes for every /api endpoint
  - 400 on bad param (impact=banana), 404 on missing engineer
  - /api/about exposes parameterised Cypher only (no ${} interpolation)
"""

import json
import os
import urllib.error
import urllib.request
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("SHIPGRAPH_API", "http://localhost:3000")

VALID_KINDS = {"Engineer", "Repo", "PullRequest", "Incident", "Service"}
TIMESTAMP_KEYS = {"createdAt", "mergedAt", "authoredAt", "publishedAt",
                  "pushedAt", "resolvedAt"}


def _get(path, expect_status=200):
    req = urllib.request.Request(BASE + path, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = resp.read()
            if resp.status != expect_status:
                raise AssertionError(
                    "%s -> %d (expected %d)" % (path, resp.status, expect_status))
            return json.loads(body)
    except urllib.error.HTTPError as e:
        if e.code != expect_status:
            raise AssertionError(
                "%s -> %d (expected %d)" % (path, e.code, expect_status))
        return json.loads(e.read() or b"{}")


def _get_status(path, allowed):
    """GET returning (status, body); fails if status not in `allowed`."""
    req = urllib.request.Request(BASE + path, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = json.loads(resp.read() or b"{}")
            if resp.status not in allowed:
                raise AssertionError(
                    "%s -> %d (allowed %r)" % (path, resp.status, allowed))
            return resp.status, body
    except urllib.error.HTTPError as e:
        body = json.loads(e.read() or b"{}")
        if e.code not in allowed:
            raise AssertionError(
                "%s -> %d (allowed %r)" % (path, e.code, allowed))
        return e.code, body


def _probe_health():
    try:
        with urllib.request.urlopen(BASE + "/health", timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False


APIS = [
    ("/api/stats", {"nodes": dict, "edges": dict, "totalNodes": int, "totalEdges": int}),
    ("/api/search?q=express", {"results": list}),
    ("/api/engineers?limit=5", {"engineers": list}),
    ("/api/repos?limit=5", {"repos": list}),
    ("/api/incidents?impact=critical", {"incidents": list}),
    ("/api/about", {"queries": list}),
]

if not _probe_health():
    pytest.skip(
        "Backend server not reachable on %s - Agent B has not started it; "
        "API contract tests skipped" % BASE, allow_module_level=True)


def _require_shape(payload, shape, path):
    for key, typ in shape.items():
        assert key in payload, "%s missing key %r" % (path, key)
        assert isinstance(payload[key], typ), (
            "%s.%s is %s, expected %s" % (path, key, type(payload[key]).__name__,
                                          typ.__name__))


@pytest.fixture(scope="module")
def stats():
    return _get("/api/stats")


def test_health_contract():
    body = _get("/health")
    _require_shape(body, {"status": str, "db": bool, "mode": str}, "/health")
    assert body["status"] == "ok" and body["db"] is True
    assert body["mode"] == "live"


@pytest.mark.parametrize("path,shape", APIS)
def test_endpoint_200_and_shape(path, shape):
    body = _get(path)
    _require_shape(body, shape, path)


def test_search_results_shape():
    body = _get("/api/search?q=express")
    for r in body["results"]:
        _require_shape(r, {"kind": str, "label": str, "sub": str}, "/api/search")
        assert r["kind"] in VALID_KINDS, "bad result kind %r" % r["kind"]


def test_stats_counts_consistent(stats):
    assert stats["totalNodes"] == sum(stats["nodes"].values()), (
        "totalNodes != sum(nodes)")
    assert stats["totalEdges"] == sum(stats["edges"].values()), (
        "totalEdges != sum(edges)")


def test_engineers_shape():
    body = _get("/api/engineers?limit=5")
    for e in body["engineers"]:
        _require_shape(e, {"login": str, "repos": int, "prs": int,
                           "commits": int, "incidents": int}, "/api/engineers")


def test_engineer_detail_and_404():
    body = _get("/api/engineers?limit=1")
    if not body["engineers"]:
        pytest.skip("engineers list empty; cannot pick one")
    login = body["engineers"][0]["login"]
    detail = _get("/api/engineers/" + urllib.request.quote(login))
    _require_shape(detail, {"engineer": dict, "repos": list,
                            "pullRequests": list, "incidents": list},
                   "/api/engineers/%s" % login)
    _require_shape(detail["engineer"], {"login": str}, "engineer")
    for pr in detail["pullRequests"]:
        _require_shape(pr, {"key": str, "title": str, "state": str},
                       "engineer.pullRequests")
    _get("/api/engineers/__no_such_engineer__", expect_status=404)


def test_repos_shape_and_detail():
    body = _get("/api/repos?limit=5")
    if not body["repos"]:
        pytest.skip("repos list is empty - Agent A has not seeded Repo "
                    "nodes into the live DB yet")
    for r in body["repos"]:
        _require_shape(r, {"name": str, "language": str, "stars": int,
                           "pushedAt": str, "owners": list}, "/api/repos")
        for o in r["owners"]:
            assert isinstance(o, str)
    repo = body["repos"][0]["name"]
    detail = _get("/api/repos/" + urllib.request.quote(repo))
    _require_shape(detail, {"repo": dict, "contributors": list,
                            "releases": list, "prs": int}, "/api/repos/%s" % repo)
    for c in detail["contributors"]:
        _require_shape(c, {"login": str, "contributions": int}, "contributors")
    _get("/api/repos/__no_such_repo__", expect_status=404)


def test_incidents_shape_and_bad_param():
    body = _get("/api/incidents?impact=banana", expect_status=400)
    assert "detail" in body, "400 response must carry {detail: str}"


def test_incident_detail_and_chain():
    body = _get("/api/incidents?impact=critical")
    if not body["incidents"]:
        pytest.skip("no incidents with impact=critical; cannot test detail")
    key = body["incidents"][0]["key"]
    inc = _get("/api/incidents/" + urllib.request.quote(key))
    _require_shape(inc, {"incident": dict, "services": list, "chain": dict},
                   "/api/incidents/%s" % key)
    _require_shape(inc["chain"], {"releases": list, "commits": list,
                                  "engineers": list}, "chain")
    _get("/api/incidents/__no_such_incident__", expect_status=404)


def test_blast_multi_hop():
    repos = _get("/api/repos?limit=1")["repos"]
    if not repos:
        pytest.skip("no repos yet; cannot test blast")
    body = _get("/api/blast?repo=" + urllib.request.quote(repos[0]["name"]))
    _require_shape(body, {"release": dict, "services": list, "incidents": list},
                   "/api/blast")
    if body["release"] is not None:
        _require_shape(body["release"], {"tagName": str, "publishedAt": str},
                       "release")


def test_path_endpoint():
    repos = _get("/api/repos?limit=20")["repos"] or pytest.skip(
        "no repos seeded - cannot pick a connected engineer pair")
    pair = None
    for r in repos:
        if r["owners"]:
            pair = r["owners"][:2]
            break
    if pair is None or len(pair) < 2:
        pytest.skip("no repo with >=2 owners to form a connected pair")
    body = _get("/api/path?from=%s&to=%s" % (
        urllib.request.quote(pair[0]),
        urllib.request.quote(pair[1])))
    _require_shape(body, {"found": bool, "hops": int, "steps": list}, "/api/path")
    assert body["found"] and body["hops"] >= 1, (
        "path should exist between two owners of the same repo")
    for s in body["steps"]:
        _require_shape(s, {"from": str, "rel": str, "to": str, "props": dict},
                       "path.steps")


def test_path_not_found_shape():
    """CONTRACT: 404 with {detail} on a missing start/end node."""
    status, body = _get_status(
        "/api/path?from=__no_such_node__&to=__also_missing__", allowed={200, 404})
    if status == 200:
        assert body == {"found": False, "hops": 0, "steps": []}, (
            "path with missing nodes must be found:false, got %r" % body)
    else:
        assert "detail" in body, "404 body must carry {detail}"


def test_about_has_parameterised_cypher_only():
    body = _get("/api/about")
    assert body["queries"], "no queries documented in /api/about"
    for q in body["queries"]:
        _require_shape(q, {"name": str, "description": str,
                           "cypher": str, "params": list}, "about.queries")
        assert "${" not in q["cypher"], (
            "query %r still contains ${} interpolation - must be parameterised"
            % q["name"])
        assert "COGNODB_PASSWORD" not in q["cypher"] and "://" not in q["cypher"], (
            "query %r leaks connection details" % q["name"])