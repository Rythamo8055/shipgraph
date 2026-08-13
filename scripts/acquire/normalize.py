"""Normalize raw caches into data/normalized/*.jsonl per CONTRACT schema.

Derives: Engineer/Repo/PullRequest/Commit/Release/Incident/Service nodes and
11 typed relationships. Heuristic edges carry heuristic:true and use the
deterministic mapping in schema.py SERVICE_MAPPING.
"""
import gzip
import json
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch import read_cached
from schema import (ORG_REPOS, SERVICE_MAPPING,
                    MAX_RELEASES_PER_REPO, MAX_CONTRIBUTORS, BODY_TRUNCATE)

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(HERE, "data", "raw")
NORM = os.path.join(HERE, "data", "normalized")
os.makedirs(NORM, exist_ok=True)

EMPTY_KEY = ""


def iso(v):
    """CONTRACT rule 4: datetimes stored as ISO-8601 UTC strings with Z."""
    if not v:
        return None
    if isinstance(v, str):
        try:
            dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            return v
    else:
        dt = v
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def trim(s, n=BODY_TRUNCATE):
    if not s:
        return ""
    s = s.strip()
    return s[:n] + "..." if len(s) > n else s


def out(file, rows):
    with open(os.path.join(NORM, file), "w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print("  wrote %s (%d rows)" % (file, len(rows)))


def load():
    nodes = {"Engineer": {}, "Repo": {}, "PullRequest": {}, "Commit": {},
             "Release": {}, "Incident": {}, "Service": {}}
    rels = []
    key_label = {}

    def add_node(label, node):
        key = node["key"]
        key_label[key] = label
        if key in nodes[label]:
            nodes[label][key] = {**nodes[label][key], **node}
        else:
            nodes[label][key] = node

    def add_rel(t, a, b, props=None, heuristic=False):
        if not a or not b:
            return
        rel = {"type": t, "from": a, "to": b,
               "fromLabel": key_label.get(a, "Node"), "toLabel": key_label.get(b, "Node")}
        if props:
            rel.update(props)
        if heuristic:
            rel["heuristic"] = True
        rels.append(rel)

    # ---- repos ----
    # ---- Repos: stub first, then enrich from the richest crawled source
    #      (base.repo of merged PRs carries real language/stars/pushed_at)
    for org, repos in ORG_REPOS.items():
        for name in repos:
            rkey = "%s/%s" % (org, name)
            add_node("Repo", {
                "key": rkey, "name": rkey, "owner": org,
                "language": None, "stars": 0, "createdAt": None,
                "pushedAt": None, "defaultBranch": "main"})

    # ---- statuspage: services + incidents ----
    components = {}
    for source in ("github", "vercel", "figma", "1password", "supabase",
                   "atlassian", "linear", "hashicorp"):
        data = read_cached("statuspage/%s/components" % source)
        if not data:
            continue
        for c in data.get("components", []):
            if c.get("status") == "under_maintenance":
                continue
            skey = "%s|%s" % (source, c["name"])
            components[c["id"]] = skey
            add_node("Service", {"key": skey, "name": c["name"], "source": source})

    incident_map = {}
    for source in ("github", "vercel", "figma", "1password", "supabase",
                   "atlassian", "linear", "hashicorp"):
        data = read_cached("statuspage/%s/incidents" % source)
        if not data:
            continue
        for inc in data.get("incidents", []):
            if inc["status"] in ("investigating", "identified", "monitoring") or \
                    not inc.get("resolved_at", "") and inc.get("status") == "resolved":
                pass
            key = "%s|%s" % (source, inc["id"])
            started = inc.get("started_at") or inc.get("created_at")
            incident_map[key] = {
                "key": key, "source": source, "incidentId": inc["id"],
                "name": trim(inc.get("name", ""), 120), "status": inc.get("status"),
                "impact": inc.get("impact"), "createdAt": iso(started),
                "resolvedAt": iso(inc.get("resolved_at")), "url": inc.get("shortlink"),
            }
            add_node("Incident", incident_map[key])
            for cid in inc.get("components", []):
                if isinstance(cid, dict):
                    cid = cid.get("id")
                skey = components.get(cid) if cid else None
                if skey:
                    add_rel("AFFECTED", key, skey)

    # ---- GitHub pulls, releases, contributors, commits ----
    pulls_by_repo = {}
    for org, repos in ORG_REPOS.items():
        for repo in repos:
            rkey = "%s/%s" % (org, repo)
            data = read_cached("repos/%s/pulls?state=all&sort=updated&direction=desc&per_page=100&page=1" % rkey)
            if data is None:
                data = []
            rows = data if isinstance(data, list) else []
            pulls_by_repo[rkey] = [p for p in rows if p.get("merged_at")]

    with open(os.path.join(RAW, "merged_pulls.json")) as f:
        merged_pulls = json.load(f)

    merged_by = {}
    mbp = os.path.join(RAW, "merged_by.jsonl")
    if os.path.exists(mbp):
        with open(mbp) as f:
            for line in f:
                row = json.loads(line)
                merged_by[row["key"]] = row["login"]

    cap = {}
    for mp in merged_pulls:
        org, repo, pr = mp["org"], mp["repo"], mp["pr"]
        rkey = "%s/%s" % (org, repo)
        cap.setdefault(rkey, []).append(pr)
        br = (pr.get("base") or {}).get("repo") or {}
        if isinstance(br, dict) and br.get("stargazers_count") is not None:
            key = "%s/%s" % (org, repo)
            meta = {k: v for k, v in (
                ("stars", br.get("stargazers_count")),
                ("language", br.get("language")),
                ("createdAt", br.get("created_at")),
                ("pushedAt", br.get("pushed_at")),
                ("defaultBranch", br.get("default_branch")),
            ) if v is not None}
            if key in nodes["Repo"]:
                nodes["Repo"][key] = {**nodes["Repo"][key], **meta}

    # ---- repo metadata fallback (repos with no merged PRs in the window) ----
    for org, repos in ORG_REPOS.items():
        for repo in repos:
            meta2 = read_cached("repos/%s/%s" % (org, repo))
            if isinstance(meta2, dict) and meta2.get("stargazers_count") is not None:
                rkey = "%s/%s" % (org, repo)
                nodes["Repo"][rkey] = {**nodes["Repo"][rkey],
                                       "stars": meta2.get("stargazers_count"),
                                       "language": meta2.get("language"),
                                       "createdAt": meta2.get("created_at"),
                                       "pushedAt": meta2.get("pushed_at"),
                                       "defaultBranch": meta2.get("default_branch")}

    commits_by_sha = {}
    for org, repos in ORG_REPOS.items():
        for repo in repos:
            rkey = "%s/%s" % (org, repo)
            for pr in cap.get(rkey, [])[:300]:
                prkey = "%s#%d" % (rkey, pr["number"])
                add_node("PullRequest", {
                    "key": prkey, "repo": rkey, "number": pr["number"],
                    "title": trim(pr.get("title", ""), 120),
                    "state": pr.get("state"), "createdAt": iso(pr.get("created_at")),
                    "mergedAt": iso(pr.get("merged_at")),
                    "additions": pr.get("additions") or 0,
                    "deletions": pr.get("deletions") or 0,
                    "changedFiles": pr.get("changed_files") or 0,
                })
                author = (pr.get("user") or {}).get("login")
                merger = (pr.get("merged_by") or {}).get("login") or \
                    merged_by.get(prkey)
                if author and author != "ghost":
                    add_node("Engineer", {"key": author, "login": author,
                                          "avatarUrl": ((pr.get("user") or {}).get("avatar_url"))})
                    add_rel("OPENED", author, prkey)
                if merger and merger != "ghost":
                    add_node("Engineer", {"key": merger, "login": merger})
                    add_rel("MERGED_BY", merger, prkey)
                add_rel("IMPROVED", prkey, rkey)

                commits = read_cached("repos/%s/pulls/%d/commits?per_page=100&page=1" % (rkey, pr["number"]))
                if commits is None:
                    continue
                for c in commits if isinstance(commits, list) else []:
                    sha = c.get("sha")
                    if not sha:
                        continue
                    ckey = "%s:%s" % (rkey, sha)
                    aname = ((c.get("commit") or {}).get("author") or {}).get("name", "")
                    commit = {
                        "key": ckey, "repo": rkey, "sha": sha,
                        "message": trim(((c.get("commit") or {}).get("message") or ""), 120),
                        "authoredAt": iso(((c.get("commit") or {}).get("author") or {}).get("date")),
                        "authorLogin": aname or None,
                    }
                    if ckey not in commits_by_sha:
                        commits_by_sha[ckey] = commit
                        add_node("Commit", commit)
                    add_rel("INCLUDED", prkey, ckey)
                    if aname:
                        add_node("Engineer", {"key": aname, "login": aname})
                        add_rel("AUTHORED", aname, ckey)
                    add_rel("COMMITTED", ckey, rkey)

    # ---- releases (deploy anchors) ----
    prev_release = {}
    for org, repos in ORG_REPOS.items():
        for repo in repos:
            rkey = "%s/%s" % (org, repo)
            data = read_cached("repos/%s/releases?per_page=100&page=1" % rkey)
            if data is None:
                continue
            rows = [r for r in (data if isinstance(data, list) else []) if r.get("tag_name")][:MAX_RELEASES_PER_REPO]
            rows.sort(key=lambda r: r.get("published_at") or "")
            for i, rel in enumerate(rows):
                rk = "%s@%s" % (rkey, rel["tag_name"])
                relnode = {
                    "key": rk, "repo": rkey, "tagName": rel["tag_name"],
                    "name": trim(rel.get("name") or rel["tag_name"], 80),
                    "publishedAt": iso(rel.get("published_at")),
                    "authorLogin": ((rel.get("author") or {}).get("login")),
                }
                add_node("Release", relnode)
                add_rel("SHIPPED", rk, rkey)
                prev = rows[i - 1] if i > 0 else None
                # link merged PRs between prev release and this release
                if prev:
                    for pr in cap.get(rkey, [])[:300]:
                        ma = pr.get("merged_at")
                        if ma and prev["published_at"] < ma <= rel["published_at"]:
                            add_rel("SHIPPED", rk, "%s#%d" % (rkey, pr["number"]), heuristic=True)
                if rkey in SERVICE_MAPPING:
                    source, comp = SERVICE_MAPPING[rkey]
                    skey = "%s|%s" % (source, comp)
                    add_rel("DEPLOYED", rk, skey, {"window": "release->service"}, heuristic=True)

    # ---- contributors -> WORKED_ON ----
    for org, repos in ORG_REPOS.items():
        for repo in repos:
            rkey = "%s/%s" % (org, repo)
            data = read_cached("repos/%s/contributors?per_page=100&page=1" % rkey)
            if data is None:
                continue
            rows = sorted((data if isinstance(data, list) else []),
                          key=lambda c: c.get("contributions", 0), reverse=True)[:MAX_CONTRIBUTORS]
            for c in rows:
                login = c.get("login")
                if not login or login == "ghost":
                    continue
                add_node("Engineer", {"key": login, "login": login,
                                      "avatarUrl": c.get("avatar_url")})
                add_rel("WORKED_ON", login, rkey,
                        {"contributions": c.get("contributions", 0)}, heuristic=True)

    # ---- RESOLVED_BY: merger of PR in mapped repo near incidents on its service ----
    for rkey, (source, comp) in SERVICE_MAPPING.items():
        skey = "%s|%s" % (source, comp)
        incident_keys = [i["key"] for i in nodes["Incident"].values() if i["source"] == source]
        affected = {rel["from"] for rel in rels
                    if rel["type"] == "AFFECTED" and rel["to"] == skey}
        for pr in cap.get(rkey, [])[:300]:
            prkey = "%s#%d" % (rkey, pr["number"])
            merger = (pr.get("merged_by") or {}).get("login") or \
                merged_by.get(prkey)
            if not merger or merger == "ghost":
                continue
            ma = pr.get("merged_at")
            if not ma:
                continue
            t = datetime.fromisoformat(ma.replace("Z", "+00:00")) if isinstance(ma, str) else ma
            for ikey in incident_keys:
                inc = nodes["Incident"][ikey]
                if inc.get("key") not in affected:
                    continue
                st = datetime.fromisoformat(inc["createdAt"].replace("Z", "+00:00")) \
                    if inc.get("createdAt") else None
                if st and abs((t - st).total_seconds()) < 7 * 86400:
                    add_rel("RESOLVED_BY", merger, ikey, {}, heuristic=True)
                    break

    out("nodes.jsonl", [{**n, "_label": lbl}
                        for lbl, d in nodes.items() for n in d.values()])
    seen = set()
    deduped = []
    for r in rels:
        sig = (r["type"], r["from"], r["to"])
        if sig in seen:
            continue
        seen.add(sig)
        deduped.append(r)
    out("rels.jsonl", [{**r, "_type": r["type"]} for r in deduped])
    print("  totals: nodes=%d rels=%d" % (sum(len(d) for d in nodes.values()), len(rels)))


if __name__ == "__main__":
    load()