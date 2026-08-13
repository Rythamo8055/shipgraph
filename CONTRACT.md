# CONTRACT.md - ShipGraph multi-agent build

Single source of truth. ALL agents read this first. NO file overlaps.

App: ShipGraph. Delivery graph of REAL open-source data (GitHub API + public statuspage incident APIs). No synthetic data.

Live DB: CognoDB c0, bolt+s://db-91e59c42.databases.cognodb.com, user cognodb. Credentials ONLY in `.env` (gitignored, exists). Never print/commit them.

## File ownership (STRICT, no overlaps)

- Agent A (data): `scripts/acquire/*.py`, `scripts/load.py`, `data/raw/*.jsonl`, `data/normalized/*.jsonl`, `data/PROVENANCE.md`
- Agent B (backend): `package.json`, `tsconfig.json`, `next.config.*`, `.node-version`, `lib/*.ts`, `app/api/**` (ONLY under app/api/)
- Agent C (frontend): `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `app/manifest.ts`, `components/**`, `fixtures/**`, `public/**`, `postcss.config.*`, `tailwind.config.*` if used
- Agent D (tests+audit): `tests/**` (pytest), `scripts/quality.py`, `scripts/audit_model.py`
- Agent E (docs): `README.md`, `SUBMISSION_EMAIL.md` (only AFTER data loaded; E runs last)

## Node schema (key = property that must be unique via constraint)

| Label | key | Properties |
|---|---|---|
| Engineer | login | name?, avatarUrl? |
| Repo | name | owner, language?, stars, createdAt, pushedAt, defaultBranch |
| PullRequest | key = `repo#number` | repo, number, title, state, createdAt, mergedAt?, additions, deletions, changedFiles |
| Commit | key = `repo:sha` | repo, sha, message, authoredAt, authorLogin |
| Release | key = `repo@tagName` | repo, tagName, name?, publishedAt, authorLogin? |
| Incident | key | source, incidentId, name, status, impact, createdAt, resolvedAt?, url |
| Service | key = `source|component` | name, source |

Constraints: unique on each key property (CREATE CONSTRAINT ... IF NOT EXISTS). Create on: Engineeer.login, Repo.name, PullRequest.key, Commit.key, Release.key, Incident.key, Service.key.

## Relationship schema

| Type | Direction | Props | Provenance |
|---|---|---|---|
| AUTHORED | Engineer->Commit | | real |
| COMMITTED | Commit->Repo | | real |
| OPENED | Engineer->PullRequest | | real |
| MERGED_BY | Engineer->PullRequest | | real |
| IMPROVED | PullRequest->Repo | | real |
| INCLUDED | PullRequest->Commit | | real (per-PR head commits) |
| SHIPPED | Release->Repo | | real |
| SHIPPED | Release->PullRequest | heuristic:true | derived (window) |
| DEPLOYED | Release->Service | heuristic:true | derived (mapping) |
| AFFECTED | Incident->Service | | real (components) |
| RESOLVED_BY | Engineer->Incident | heuristic:true | derived (closed_by/fix PR) |
| WORKED_ON | Engineer->Repo | contributions | derived (contributor counts) |

Every derived edge MUST carry `heuristic:true`.

## Sources (target volumes)

- GitHub: expressjs (express, body-parser, morgan, debug, cors, serve-static), vitejs (vite, plugin-react, create-vite, plugin-vue), hashicorp (terraform, vault, consul, packer, nomad) = 15 repos
- PullRequests: state=all, per_page=100, then per-PR commits endpoint (head commits only)
- Releases: per repo (deploy anchors)
- Incidents: statuspage.io public API v2, orgs: www.githubstatus.com, www.vercel-status.com, status.figma.com, status.1password.com, status.supabase.com, status.atlassian.com, linearstatus.com. incidents.json (50 each) + components.json. Store factual fields only (NO incident_updates[].body prose).
- Engineers: contributors endpoint (top by contributions) union authors/mergers. Filter out `ghost`.
- Target: ~40 engineers, 15 repos, ~1500 PRs, ~3000 unique commits, ~400 releases, ~200 incidents, ~25 services.

## Service mapping (deterministic, ~25 rows)

Mapping table in `scripts/acquire/mapping.py`: repo -> service component name. e.g. express -> "Web", terraform -> "API". Heuristic matches: hashicorp/vercel/figma/1password/supabase software ships to their own infra; each statuspage component maps to a mapped service only where a sensible repo exists. Unmatchable components SKIP (no incident->service edges for them). Every DEPLOYED + AFFECTED edge flags heuristic:true. Mapping MUST be deterministic, hardcoded, reviewable.

## Loading rules (scripts/load.py)

- Reads data/normalized/*.jsonl
- UNWIND batched (batch 500), MERGE nodes, then relationships
- Node MERGE on key property; ON CREATE SET n += props; ON MATCH SET n += props (idempotent)
- Relationship creation idempotent: MATCH endpoints, CREATE path but use MERGE on relationship with no props conflicts -> use `MERGE (a)-[r:TYPE]->(b) SET r += props` after MATCH by key
- Refuses to run without COGNODB_URI; prints final counts per label + per rel type
- Deterministic: rerun => same totals (assert in agent D)

## API contract (backend Agent B implements; frontend Agent C consumes EXACTLY)

All responses JSON. Errors: 503 {"detail": str} when DB unreachable; 404 on missing entity; 400 on bad param. No free-form Cypher input anywhere.

- GET /health -> {"status":"ok","db":bool,"mode":"live"}
- GET /api/stats -> {"nodes":{Label:count...},"edges":{Rel:count...},"totalNodes","totalEdges"}
- GET /api/search?q= -> {"results":[{"kind":"Engineer|Repo|PullRequest|Incident|Service","label":string,"sub":string}]}
- GET /api/engineers?limit= -> {"engineers":[{"login","avatarUrl?","repos":n,"prs":n,"commits":n,"incidents":n}]}
- GET /api/engineers/[login] -> {"engineer":{...},"repos":[names],"pullRequests":[{key,title,state,mergedAt}],"incidents":[{key,name,impact,createdAt,resolvedAt}]}
- GET /api/repos?limit= -> {"repos":[{"name","language","stars","pushedAt","owners":[logins]}]}
- GET /api/repos/[name] -> {"repo":{...},"contributors":[{login,contributions}],"releases":[{tagName,publishedAt}],"prs":n}
- GET /api/incidents?impact=> -> {"incidents":[{key,name,source,impact,createdAt,resolvedAt,services:[names]}]}
- GET /api/incidents/[key] -> {"incident":{...},"services":[names],"chain":{releases:[{tagName,repo,publishedAt}],"commits":[sha,message,authoredAt],"engineers":[logins]}}  (chain = releases in incident window [startedAt-6h, resolvedAt+6h] linked via INCLUDED commits; window launch heuristic)
- GET /api/blast?repo= -> {"release":{"tagName","publishedAt"},"services":[names],"incidents":[keys]} (release -> DEPLOYED services -> AFFECTED incidents; multi-hop proof)
- GET /api/path?from=&to= -> {"found":true,"hops":n,"steps":[{"from","rel","to","props"}]} using shortestPath over AUTHORED|COMMITTED|OPENED|MERGED_BY|IMPROVED|INCLUDED|SHIPPED|DEPLOYED|AFFECTED|RESOLVED_BY|WORKED_ON*1..6
- GET /api/about -> {"queries":[{"name","description","cypher","params":[...]}]} full parameterised text, no secrets

## Flagship Cypher (must exist verbatim, parameterised)

```cypher
MATCH (i:Incident {key:$incidentKey})-[:AFFECTED]->(s:Service)<-[:DEPLOYED]-(rel:Release)
MATCH (rel)-[:SHIPPED]->(pr:PullRequest)-[:INCLUDED]->(c:Commit)<-[:AUTHORED]-(e:Engineer)
RETURN i.key AS incident, rel.tagName AS release, pr.number AS pr, e.login AS engineer, c.key AS commit
ORDER BY c.authoredAt LIMIT 20
```

## Hard rules

1. NO string-concatenated Cypher anywhere (no f-strings/Cypher interpolation except 100% hardcoded labels built from this contract's constants file `lib/schema.ts` for TS, `scripts/acquire/schema.py` for Python)
2. Relationship type names only from the table above
3. Secrets: never read/write COGNODB_PASSWORD outside `.env`; never log it; tests assert it is NOT in any tracked file
4. All datetime stored as ISO-8601 strings (UTC, Z) — string compare safe in Cypher
5. Every heuristic edge: heuristic:true
6. No synthetic data. PROVENANCE.md lists every source URL + fetch date + license note