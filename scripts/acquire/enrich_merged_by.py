"""Enrich merged PRs with merged_by (not present in GH list responses anymore).

Reads data/raw/merged_pulls.json, GETs each PR, caches responses, writes
data/raw/merged_by.jsonl [{key: "org/repo#num", login}]. Resume-safe.
"""
import gzip
import hashlib
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(HERE, "data", "raw")
LOCK = os.path.join(RAW, ".merged_by.lock")


def cache_path(path):
    return os.path.join(RAW, hashlib.sha256(path.encode()).hexdigest()[:16] + ".json.gz")


def read_cached(path):
    p = cache_path(path)
    if not os.path.exists(p):
        return None
    with gzip.open(p, "rb") as f:
        return json.loads(f.read().decode())


def write_cached(path, payload):
    with open(cache_path(path), "wb") as out:
        gf = gzip.GzipFile(fileobj=out, mode="wb")
        gf.write(json.dumps(payload).encode())
        gf.close()


def main():
    with open(os.path.join(RAW, "merged_pulls.json")) as f:
        pulls = json.load(f)
    jobs = [("%s/%s#%d" % (m["org"], m["repo"], m["pr"]["number"]), m) for m in pulls]
    done = {}
    results = {}

    def fetch(item):
        key, m = item
        org, repo, pr = m["org"], m["repo"], m["pr"]
        path = "repos/%s/%s/pulls/%d" % (org, repo, pr["number"])
        data = read_cached(path)
        if data is None:
            env = os.environ.copy()
            if os.environ.get("GITHUB_TOKEN"):
                env["GH_TOKEN"] = os.environ["GITHUB_TOKEN"]
            for attempt in range(5):
                proc = subprocess.run(["gh", "api", path],
                                      capture_output=True, text=True, env=env)
                if proc.returncode == 0:
                    break
                time.sleep(10 * (attempt + 1))
            else:
                return key, None
            data = json.loads(proc.stdout)
            write_cached(path, data)
        mb = (data.get("merged_by") or {}).get("login")
        return key, mb

    with ThreadPoolExecutor(max_workers=12) as ex:
        futs = {ex.submit(fetch, i): i for i in jobs}
        for fut in as_completed(futs):
            key, login = fut.result()
            done[key] = login
            if len(done) % 100 == 0:
                print("enriched %d/%d" % (len(done), len(jobs)), flush=True)

    with open(os.path.join(RAW, "merged_by.jsonl"), "w") as f:
        for key, login in sorted(done.items()):
            if login:
                f.write(json.dumps({"key": key, "login": login}) + "\n")
    print("merged_by entries: %d/%d" % (len([v for v in done.values() if v]), len(done)))


if __name__ == "__main__":
    main()