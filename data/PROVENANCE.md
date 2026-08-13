# PROVENANCE.md — every source, fetch date, and license note

Generated from the resume-safe crawl cache in `data/raw/`. Each cache file is the raw
HTTP response body of one public API call, keyed as `data/raw/<sha256(path)>.json.gz` (GitHub) or `data/raw/statuspage/<org>_<kind>_<sha>.json.gz` (Statuspage).

## Snapshot (2026-08-13)

- GitHub cache: 1771 raw responses, last write `2026-08-13T09:59:54Z`
- Statuspage cache: 309 incidents across 7 orgs, last write `2026-08-13T07:10:21Z`

## Sources and licenses

| Dataset | Base URL | License / terms |
|---|---|---|
| GitHub REST API — repos, PRs, commits, releases, contributors | https://api.github.com | GitHub Terms of Service, public API data; used for non-commercial portfolio demonstration. Data originates from the repositories listed below. |
| Statuspage v2 public API — incidents + components | `https://<org>.statuspage.io/api/v2` (per-org pages: githubstatus.com, vercel.statuspage.io, figma.statuspage.io, 1password.statuspage.io, supabase.statuspage.io, atlassian.statuspage.io, linear.statuspage.io) | Published by each organisation under their own terms; used for portfolio demonstration. |

## Repos crawled

- `https://github.com/debug-js/debug`
- `https://github.com/expressjs/body-parser`
- `https://github.com/expressjs/cors`
- `https://github.com/expressjs/express`
- `https://github.com/expressjs/morgan`
- `https://github.com/expressjs/serve-static`
- `https://github.com/hashicorp/consul`
- `https://github.com/hashicorp/nomad`
- `https://github.com/hashicorp/packer`
- `https://github.com/hashicorp/terraform`
- `https://github.com/hashicorp/vault`
- `https://github.com/vitejs/rolldown-vite`
- `https://github.com/vitejs/vite`
- `https://github.com/vitejs/vite-plugin-react`
- `https://github.com/vitejs/vite-plugin-vue`

## Statuspage orgs crawled

- `1passwordstatus`
- `atlassianstatus`
- `figmastatus`
- `githubstatus`
- `linearstatus`
- `supabasestatus`
- `vercelstatus`

## Notes

- `data/raw/merged_pulls.json` and `data/raw/merged_by.jsonl` are derived GitHub enrichment passes (pulls pages 1–5, per-PR `merged_by` lookups) built on the same cache rules.
- All data is real public API data — no synthetic rows. Every edge in the graph either comes verbatim from these responses or is a heuristic derivation explicitly flagged `heuristic:true` (see `scripts/acquire/normalize.py` and `CONTRACT.md`).
