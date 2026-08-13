"""Fetch statuspage.io public v2 incident + component data for 7 orgs (CONTRACT).

Keeps ONLY factual fields: id, name, status, impact, created_at/started_at,
resolved_at, shortlink/url, component ids. No incident_updates[].body prose.
Component ids resolved to names via components.json. Raw + minimal JSON cached
in data/raw/statuspage/.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw" / "statuspage"

# (org_label, base_url) per CONTRACT
ORGS = [
    ("githubstatus", "https://www.githubstatus.com/api/v2"),
    ("vercelstatus", "https://www.vercel-status.com/api/v2"),
    ("figmastatus", "https://status.figma.com/api/v2"),
    ("1passwordstatus", "https://status.1password.com/api/v2"),
    ("supabasestatus", "https://status.supabase.com/api/v2"),
    ("atlassianstatus", "https://status.atlassian.com/api/v2"),
    ("linearstatus", "https://linearstatus.com/api/v2"),
]

MAX_INCIDENTS = 50  # per CONTRACT: incidents.json (50 each)


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def fetch_json(url: str, timeout: int = 60) -> dict | list:
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "shipgraph-acquire"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            print(f"[warn] {url} attempt {attempt}: {exc}")
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"failed to fetch {url}")


def cache_write(org: str, kind: str, payload) -> None:
    raw = json.dumps(payload, sort_keys=True).encode("utf-8")
    digest = hashlib.sha256(raw).hexdigest()[:12]
    fname = f"{org}_{kind}_{digest}.json.gz"
    with gzip.open(RAW_DIR / fname, "wb") as fh:
        fh.write(raw)


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    summary: dict[str, dict] = {}
    all_minimal: list[dict] = []

    for org, base in ORGS:
        inc = fetch_json(f"{base}/incidents.json?limit={MAX_INCIDENTS}")
        comp = fetch_json(f"{base}/components.json")
        cache_write(org, "incidents", inc)
        cache_write(org, "components", comp)

        comp_ids = {}
        for c in comp.get("components", []):
            comp_ids[c["id"]] = c["name"]

        minimal_incidents = []
        for it in inc.get("incidents", []):
            comp_ids_of_incident = sorted(
                c["id"] if isinstance(c, dict) else c for c in (it.get("components") or [])
            )
            component_names = sorted(
                comp_ids[cid] for cid in comp_ids_of_incident if cid in comp_ids
            )
            minimal_incidents.append(
                {
                    "source": org,
                    "incidentId": it["id"],
                    "name": it["name"],
                    "status": it["status"],
                    "impact": it["impact"],
                    "created_at": it.get("created_at") or it.get("started_at"),
                    "started_at": it.get("started_at"),
                    "resolved_at": it.get("resolved_at"),
                    "url": it.get("shortlink") or it.get("page_url") or "",
                    "component_ids": comp_ids_of_incident,
                    "component_names": component_names,
                }
            )
            all_minimal.append({"source": org, "incident": minimal_incidents[-1]})

        summary[org] = {
            "incidents": len(minimal_incidents),
            "components": len(comp_ids),
            "fetched_at": iso_now(),
            "url_incidents": f"{base}/incidents.json?limit={MAX_INCIDENTS}",
            "url_components": f"{base}/components.json",
        }
        print(f"[incidents] {org}: {len(minimal_incidents)} incidents, {len(comp_ids)} components")

    out = ROOT / "data" / "raw" / "statuspage_incidents.json"
    out.write_text(json.dumps({"summary": summary, "incidents": all_minimal}, indent=2, sort_keys=True))
    print(f"[incidents] wrote {out}")


if __name__ == "__main__":
    main()