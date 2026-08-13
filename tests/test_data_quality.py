"""Data quality checks over data/normalized/*.jsonl (Agent A's output).

Real normalized format (scripts/acquire/normalize.py):
  - nodes_<Label>.jsonl   : one flat props-dict JSON per line
  - rels_<TYPE>.jsonl     : {"a_label","a_key","b_label","b_key","props":{...}}

Checks per CONTRACT:
  (a) every node carries its label's key property
  (b) no duplicate keys per label
  (c) timestamps are parseable ISO-8601 with UTC (Z) offset
  (d) no `ghost` engineer login
  (e) free-text bodies (commit message / PR title / incident name / etc.) <= 200 chars
  (f) every relationship references existing node keys (0 orphans)
  (g) every heuristic relationship carries heuristic:true
  (h) every relationship type is in the CONTRACT whitelist

Skips (with an explicit message) while Agent A has not yet populated
data/normalized/. Fails loudly if the file shape is unrecognized.
"""

import json
import re
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from scripts.acquire import schema as S

REPO_ROOT = Path(__file__).resolve().parents[1]
NORMALIZED_DIR = REPO_ROOT / "data" / "normalized"

TIMESTAMP_KEYS = {
    "createdAt", "startedAt", "mergedAt", "authoredAt", "publishedAt",
    "pushedAt", "resolvedAt", "updatedAt", "fetchedAt",
}
BODY_KEYS = {"title", "message", "name", "body", "description", "summary"}
ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$")


def _normalized_files():
    if not NORMALIZED_DIR.exists():
        return []
    return sorted(p for p in NORMALIZED_DIR.glob("*.jsonl"))


def _jsonl_records(path):
    records = []
    with open(path, encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, 1):
            line = line.strip()
            if not line:
                continue
            try:
                records.append((lineno, json.loads(line)))
            except json.JSONDecodeError as e:
                raise ValueError("%s:%d invalid JSON: %s" % (path, lineno, e))
    return records


class Dataset:
    """Parsed normalized dataset.

    node_keys[label] -> Counter of key values across ALL node records.
    rels: (reltype, a_label, a_key, b_label, b_key, props, source)
    """

    def __init__(self, records_by_file):
        self.nodes = []      # (label, props, source)
        self.rels = []       # (reltype, a_label, a_key, b_label, b_key, props, source)
        self.unknown = []    # (source, keys)
        self.node_keys = {}
        self._rel_count = 0
        names = {p.name for p in records_by_file}
        # the aggregate nodes.jsonl/rels.jsonl are what scripts/load.py reads;
        # when present they are authoritative and the per-label splits are the
        # same records in another shape (skip them to avoid double-counting).
        if "nodes.jsonl" in names or "rels.jsonl" in names:
            names = {"nodes.jsonl", "rels.jsonl"} & names
        for path, records in records_by_file.items():
            fname = path.name
            if fname not in names:
                continue
            if fname == "nodes.jsonl":
                # aggregate file - the exact input scripts/load.py reads
                for lineno, rec in records:
                    where = "%s:%d" % (fname, lineno)
                    label = rec.get("_label")
                    if label not in S.NODE_KEYS:
                        self.unknown.append((where, sorted(rec.keys())
                                             if isinstance(rec, dict) else ["non-dict"]))
                        continue
                    props = {k: v for k, v in rec.items() if k != "_label"}
                    self.nodes.append((label, props, where))
                    key = props.get(S.NODE_KEYS[label])
                    if isinstance(key, str) and key:
                        self.node_keys.setdefault(label, Counter())[key] += 1
            elif fname == "rels.jsonl":
                # aggregate file - the exact input scripts/load.py reads
                for lineno, rec in records:
                    where = "%s:%d" % (fname, lineno)
                    if not isinstance(rec, dict) or not all(
                            k in rec for k in ("from", "to", "fromLabel", "toLabel")):
                        self.unknown.append((where, sorted(rec.keys())
                                             if isinstance(rec, dict) else ["non-dict"]))
                        continue
                    rtype = rec.get("_type") or rec.get("type")
                    props = rec.get("props") or {}
                    if not isinstance(props, dict):
                        self.unknown.append((where, ["props non-dict"]))
                        continue
                    self._rel_count += 1
                    self.rels.append((rtype, rec["fromLabel"], rec["from"],
                                      rec["toLabel"], rec["to"], props, where))
            elif fname.startswith("nodes_"):
                label = fname[len("nodes_"):-len(".jsonl")]
                if label not in S.NODE_KEYS:
                    self.unknown.append(("%s" % path.name, ["label=%s" % label]))
                    continue
                for lineno, props in records:
                    where = "%s:%d" % (path.name, lineno)
                    if not isinstance(props, dict):
                        self.unknown.append((where, sorted(props.keys())
                                             if isinstance(props, dict) else ["non-dict"]))
                        continue
                    self.nodes.append((label, props, where))
                    key = props.get(S.NODE_KEYS[label])
                    if isinstance(key, str) and key:
                        self.node_keys.setdefault(label, Counter())[key] += 1
            elif fname.startswith("rels_"):
                rtype = fname[len("rels_"):-len(".jsonl")]
                if rtype not in S.REL_TYPES:
                    self.unknown.append(("%s" % path.name, ["reltype=%s" % rtype]))
                    continue
                for lineno, rec in records:
                    where = "%s:%d" % (path.name, lineno)
                    if not isinstance(rec, dict) or not all(
                            k in rec for k in ("a_label", "a_key", "b_label", "b_key")):
                        self.unknown.append((where, sorted(rec.keys())
                                             if isinstance(rec, dict) else ["non-dict"]))
                        continue
                    props = rec.get("props") or {}
                    if not isinstance(props, dict):
                        self.unknown.append((where, ["props non-dict"]))
                        continue
                    self._rel_count += 1
                    self.rels.append((rtype, rec["a_label"], rec["a_key"],
                                      rec["b_label"], rec["b_key"], props, where))
            else:
                for lineno, rec in records:
                    self.unknown.append(("%s:%d" % (path.name, lineno),
                                         sorted(rec.keys())
                                         if isinstance(rec, dict) else ["non-dict"]))


@pytest.fixture(scope="module")
def dataset():
    files = _normalized_files()
    if not files:
        pytest.skip("data/normalized/ is empty - Agent A has not seeded yet")
    records_by_file = {}
    for path in files:
        try:
            records_by_file[path] = _jsonl_records(path)
        except ValueError:
            raise
    ds = Dataset(records_by_file)
    assert not ds.unknown, (
        "unrecognized record shapes (fix Agent A's normalized format or extend "
        "the test parser): %s"
        % "; ".join("%s keys=%s" % (w, k) for w, k in ds.unknown[:5]))
    return ds


def test_a_every_node_has_its_key_property(dataset):
    bad = [src for label, props, src in dataset.nodes
           if S.NODE_KEYS.get(label) not in props
           or not isinstance(props.get(S.NODE_KEYS.get(label)), str)
           or not props[S.NODE_KEYS.get(label)]]
    assert not bad, "nodes missing key property: %s" % bad


def test_b_no_duplicate_keys_per_label(dataset):
    dupes = []
    for label, keys in dataset.node_keys.items():
        dupes.extend("%s:%s x%d" % (label, k, n)
                     for k, n in keys.items() if n > 1)
    assert not dupes, "duplicate keys: %s" % dupes


def test_c_timestamps_are_iso8601_utc(dataset):
    bad = []
    for label, props, src in dataset.nodes:
        for k in TIMESTAMP_KEYS:
            if k not in props or props[k] is None:
                continue
            v = props[k]
            if not isinstance(v, str):
                bad.append("%s %s=%r not a string" % (src, k, v))
                continue
            if not ISO_RE.match(v):
                bad.append("%s %s=%r not ISO-8601 UTC" % (src, k, v))
                continue
            try:
                dt = datetime.fromisoformat(v)
            except ValueError:
                bad.append("%s %s=%r unparseable" % (src, k, v))
                continue
            if dt.tzinfo is None or dt.utcoffset() != timedelta(0):
                bad.append("%s %s=%r not UTC" % (src, k, v))
    assert not bad, "bad timestamps: %s" % bad[:20]


def test_d_no_ghost_login(dataset):
    ghosts = [src for label, props, src in dataset.nodes
              if label == S.N_ENGINEER and props.get("login") == "ghost"]
    assert not ghosts, "ghost engineer present: %s" % ghosts


def test_e_body_lengths_within_200(dataset):
    bad = []
    for label, props, src in dataset.nodes:
        if label not in (S.N_PULL_REQUEST, S.N_COMMIT, S.N_INCIDENT) \
                and label != S.N_RELEASE:
            continue
        for k, v in props.items():
            if not isinstance(v, str):
                continue
            if k in BODY_KEYS or any(tok in k for tok in
                                     ("message", "title", "body", "desc", "summary")):
                if len(v) > S.MAX_TEXT:
                    bad.append("%s %s=%d chars" % (src, k, len(v)))
    assert not bad, "free-text bodies not truncated to %d: %s" % (S.MAX_TEXT, bad[:20])


def test_f_no_orphan_relationships(dataset):
    if not dataset.rels:
        pytest.fail("no relationship records found in normalized data")
    keyset = dataset.node_keys
    orphans = []
    for rtype, a_label, a_key, b_label, b_key, props, src in dataset.rels:
        for side, label, key in (("start", a_label, a_key), ("end", b_label, b_key)):
            if label not in keyset:
                orphans.append("%s %s %s(%s) label has no nodes" % (src, side, label, key))
                continue
            if key not in keyset[label]:
                orphans.append("%s %s %s(%s) key missing" % (src, side, label, key))
    assert not orphans, "orphan relationships: %s" % orphans[:20]


def test_g_heuristic_rels_carry_heuristic_true(dataset):
    missing = []
    for rtype, a_label, a_key, b_label, b_key, props, src in dataset.rels:
        if rtype not in S.HEURISTIC_RELS:
            continue
        if rtype == S.R_SHIPPED and b_label == S.N_REPO:
            continue  # Release->Repo variant is real (CONTRACT)
        if props.get("heuristic") is not True:
            missing.append("%s %s missing heuristic:true" % (src, rtype))
    assert not missing, "heuristic edges missing flag: %s" % missing[:20]


def test_h_rel_types_whitelisted(dataset):
    unknown = sorted({r[0] for r in dataset.rels} - set(S.REL_TYPES))
    assert not unknown, "relationship types outside whitelist: %s" % unknown
