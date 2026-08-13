"""Fetch real GitHub (via gh api) + statuspage incident data, cache raw to data/raw/.

Stdlib only. Resume-safe: per-endpoint-page cached + manifest. Rate-limit aware.
"""
import gzip
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from schema import ORG_REPOS, STATUSPAGES

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(HERE, "data", "raw")
MANIFEST = os.path.join(RAW, "manifest.jsonl")
os.makedirs(RAW, exist_ok=True)


def _cache_path(path):
    return os.path.join(RAW, hashlib.sha256(path.encode()).hexdigest()[:16] + ".json.gz")


def cache_json(path, payload):
    with open(MANIFEST, "a") as mf, open(_cache_path(path), "wb") as out:
        raw = json.dumps(payload).encode()
        gf = gzip.GzipFile(fileobj=out, mode="wb")
        gf.write(raw)
        gf.close()
        mf.write(json.dumps({"path": path, "bytes": len(raw)}) + "\n")


def read_cached(path):
    p = _cache_path(path)
    if not os.path.exists(p):
        return None
    with gzip.open(p, "rb") as f:
        return json.loads(f.read().decode())


def gh_api(path, params=None):
    """Fetch a GitHub REST endpoint page-by-page; returns merged list/dict."""
    out = []
    page = 1
    while True:
        q = (path + "?per_page=100&page=%d" % page) if params is None else \
            (path + "?" + params + "&per_page=100&page=%d" % page)
        cached = read_cached(q)
        if cached is not None:
            data = cached
        else:
            for attempt in range(6):
                env = os.environ.copy()
                if os.environ.get("GITHUB_TOKEN"):
                    env["GH_TOKEN"] = os.environ["GITHUB_TOKEN"]
                proc = subprocess.run(
                    ["gh", "api", q, "-H", "Accept: application/vnd.github+json"],
                    capture_output=True, text=True, env=env)
                err = (proc.stderr or "").lower()
                if proc.returncode == 0:
                    break
                if "not found" in err or "http 404" in err or "404" in err:
                    cache_json(q, [])
                    print("  [404] %s -> cached empty" % q, flush=True)
                    data = []
                    break
                if "rate limit" in err or "rate_limit" in err:
                    print("  [rate] %s backoff 30s (%s)" % (q, err.splitlines()[0][:80]), flush=True)
                    time.sleep(30)
                    continue
                print("  [retry%d] %s rc=%s (%s)" % (attempt, q, proc.returncode,
                                                     err.splitlines()[0][:100]), flush=True)
                time.sleep(20 * (attempt + 1))
            else:
                cache_json(q, [])
                print("  [404/perm] %s -> cached empty" % q, flush=True)
                data = []
                break
            data = json.loads(proc.stdout)
            cache_json(q, data)
        out.extend(data if isinstance(data, list) else [data])
        if not isinstance(data, list) or len(data) < 100 or page >= 10:
            break
        page += 1
    return out


def fetch_github_repos():
    jobs = []
    for org, repos in ORG_REPOS.items():
        for repo in repos:
            r = "%s/%s" % (org, repo)
            jobs += [("repos/%s/contributors" % r, r, "contributors"),
                     ("repos/%s/releases" % r, r, "releases"),
                     ("repos/%s/pulls" % r, r, "pulls")]
    with ThreadPoolExecutor(max_workers=10) as ex:
        futs = {ex.submit(gh_api, path): (r, kind)
                for path, r, kind in jobs}
        done = 0
        for fut in as_completed(futs):
            r, kind = futs[fut]
            fut.result()
            done += 1
            print("  [%d/%d] %s %s" % (done, len(futs), kind, r), flush=True)


def merged_pulls():
    """Newest merged PRs across pages 1..5 (resume-safe via cache), capped globally at 1500."""
    pulls = []
    for org, repos in ORG_REPOS.items():
        for repo in repos:
            path = "repos/%s/%s/pulls" % (org, repo)
            for page in range(1, 6):
                q = "state=all&sort=updated&direction=desc&per_page=100&page=%d" % page
                cached = read_cached(path + "?" + q)
                data = cached if cached is not None else gh_api(path, q)
                rows = data if isinstance(data, list) else []
                for pr in rows:
                    if pr.get("merged_at") and pr.get("merge_commit_sha") not in (None, ""):
                        pulls.append((org, repo, pr))
                if len(rows) < 100:
                    break
    pulls.sort(key=lambda t: t[2]["merged_at"], reverse=True)
    return pulls[:1500]


def fetch_pr_commits():
    pulls = merged_pulls()
    with ThreadPoolExecutor(max_workers=12) as ex:
        futs = []
        for org, repo, pr in pulls:
            path = "repos/%s/%s/pulls/%d/commits" % (org, repo, pr["number"])
            futs.append(ex.submit(gh_api, path))
        done = 0
        for fut in as_completed(futs):
            fut.result()
            done += 1
            if done % 250 == 0:
                print("  pr-commits %d/%d" % (done, len(pulls)), flush=True)
    with open(os.path.join(RAW, "merged_pulls.json"), "w") as f:
        json.dump([{"org": o, "repo": r, "pr": p} for o, r, p in pulls], f)
    return len(pulls)


def fetch_statuspages():
    for source, host in STATUSPAGES.items():
        for kind in ("incidents", "components"):
            key = "statuspage/%s/%s" % (source, kind)
            cached = read_cached(key)
            if cached is not None:
                continue
            url = "https://%s/api/v2/%s.json" % (host, kind)
            try:
                with urllib.request.urlopen(url, timeout=20) as r:
                    raw = r.read()
                data = json.loads(raw)
                cache_json(key, data)
                print("  statuspage %s/%s: %d items" % (source, kind, len(data.get(kind, []))))
            except Exception as e:
                print("  statuspage %s/%s FAILED: %s" % (source, kind, e))


def fetch_repo_meta():
    """Single-object repo metadata (language/stars/pushed_at) for repos with
    no merged PRs in the crawl window; cached under repos/<org>/<repo>."""
    for org, repos in ORG_REPOS.items():
        for repo in repos:
            key = "repos/%s/%s" % (org, repo)
            if read_cached(key) is not None:
                continue
            try:
                proc = subprocess.run(
                    ["gh", "api", key, "-H", "Accept: application/vnd.github+json"],
                    capture_output=True, text=True, timeout=60)
                if proc.returncode != 0:
                    print("  repo meta %s FAILED: %s" % (key, proc.stderr.strip()[:120]))
                    continue
                cache_json(key, json.loads(proc.stdout))
                print("  repo meta %s" % key, flush=True)
            except Exception as e:
                print("  repo meta %s FAILED: %s" % (key, e))


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--github", action="store_true")
    ap.add_argument("--statuspages", action="store_true")
    ap.add_argument("--pr-commits", action="store_true")
    args = ap.parse_args()
    if not os.environ.get("GITHUB_TOKEN") and not os.environ.get("GH_TOKEN"):
        print("WARNING: no GITHUB_TOKEN set - unauthenticated API is 60 req/hr; crawl will take many hours")
    any_flag = args.github or args.pr_commits or args.statuspages
    if args.github or not any_flag:
        fetch_github_repos()
    if args.pr_commits or not any_flag:
        fetch_pr_commits()
    if args.statuspages or not any_flag:
        fetch_statuspages()
    if args.github or not any_flag:
        fetch_repo_meta()
    print("done")