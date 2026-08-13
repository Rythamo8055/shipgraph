# MODEL_AUDIT.md — ShipGraph graph data model audit (Agent D2)

Date: 2026-08-13 · Auditor: Agent D2 (model audit) · Subject: CONTRACT.md schema tables vs MNC/FAANG-class production graph models.

Run `python scripts/audit_model.py` to regenerate metric output (reads `data/normalized/*.jsonl` first, else live CognoDB via `.env`; never prints secrets).

## 1. Metrics computed (live CognoDB, 2026-08-13)

| Metric | Contract target | Seniority expected | Actual (live) | Verdict |
|---|---|---|---|---|
| Nodes / edges | ~4.7k / ~9–11k | n/a | **133 / 0** | ❌ load incomplete |
| ShipGraph labels present | 7 | 7 | **0** (Company, Firm, Person, University, Student, Mentor, Course, Hospital, Department, Condition, Doctor, Patient) | ❌ foreign schema |
| ShipGraph rel types present | 11 | 11 | **0** (17 foreign types: INVESTED_IN, WORKS_AT, TREATS, TOOK … = 330 rels) | ❌ foreign edges |
| Avg degree / max degree | ~4 / ≤8k | ≤100k = supernode threshold [1] | n/a (0 edges) | unmeasurable until load |
| Top-10 degree | — | — | n/a | unmeasurable until load |
| Heuristic edge ratio | ≤60% (4 of 11 types flagged) | <10–20% of *real* models [8] | n/a | pred. ~30–55% |
| Key uniqueness violations | 0 | 0 | 0 (no contract nodes to violate) | n/a |
| Orphan rels | 0 | 0 | 0 | n/a |
| Timestamp validity % (ISO-8601 UTC Z) | 100% (CONTRACT rule 4) | 100% | 0/0 (no ts props present) | n/a |

Real finding: the live DB holds a **different application's graph** (LinkedIn-style + hospital demo schema). Zero ShipGraph data is loaded; `data/normalized/` is empty. Metrics for the ShipGraph model are therefore **not computable end-to-end yet** — the tool reports what it can and flags schema mismatch. All numeric rows below are contract/target-derived estimates where shown.

## 2. Scorecard (MNC-grade bar)

| # | Dimension (1–10) | MNC practice | Our practice | Gap | Fix if funded |
|---|---|---|---|---|---|
| 1 | **Schema discipline (labels+keys+constraints)** — **6/10** | Neo4j: unique composite key per entity, existence constraints, index on every anchor used in WHERE [1][2]; TAO shards objects w/ stable IDs [3]; LIquid relational schema w/ constraints [4]. | Single unique key prop/label; `key` = composite packed into one string (`repo#number`, `repo:sha`, `repo@tagName`); CONSTRAINT_CYPHER defined but **never executed on live DB** (schema.py:74). | Composite keys as strings = value-in-property anti-pattern; no composite `(repo, number)` constraint, no existence/fulltext indexes; constraints unapplied. | Composite constraints `FOR (n:PullRequest) REQUIRE (n.repo, n.number) IS UNIQUE`; run DDL in load.py; add property-existence + `defaultBranch`/`language` lookup indexes. |
| 2 | **Anti-supernode design** — **8/10** | Split generic rels into role-specific types; ≤100k edges/node; label segregation; bucket pattern for time-series [1][2]. | 11 granular typed rels (AUTHORED/COMMITTED/OPENED…); expected max degree ~6–8k on express/vite/terraform Repo (WORKED_ON + COMMITTED + SHIPPED + IMPROVED) — well under 100k. | No rel budget per node; single-hub Repo nodes will dominate; no bucketing if 5–10x data. | Node-cap check in CI (assert degree histogram); if scaling: label-segregate `:FlagshipRepo` or bucket COMMITTED by month. |
| 3 | **Temporal data handling** — **5/10** | Native `datetime()` for range/arithmetic; "all-dates-as-strings ⇒ no range queries" is an explicit Neo4j anti-pattern [1][2]. | ISO-8601 UTC `Z` strings (CONTRACT rule 4); string-compare safe; `mergedAt?`/`resolvedAt?` nullables. | 6h incident-window (API chain, CONTRACT line 84) needs arithmetic → must parse `datetime()` at query time; no temporal validity ranges on rels. | Store native datetimes; materialize rel-level `windowStart`/`windowEnd` during load; add `convertedAt` snapshot column. |
| 4 | **Provenance / derived-data honesty** — **7/10** | Netflix KG: per-triple provenance + confidence score [5]; LIquid: explicit derived vs asserted data [4]; Intuit: lineage + human review for ML-derived edges [9]. | Every derived edge carries `heuristic:true` (rule 5); deterministic mapping table; PROVENANCE.md; only 4 of 11 types derived. | Single boolean — no source/method/confidence; `SHIPPED` rel is *both* real (→Repo) and heuristic (→PR) under one type; `WORKED_ON` caches scalar `contributions`. | `derivedFrom`, `method`, `confidence` props on heuristic rels; split `SHIPPED` vs `SHIPPED_PR_HEURISTIC`; document thresholds in PROVENANCE.md. |
| 5 | **Query expressivity (6 canonical multi-hop shapes)** — **7/10** | Uber config KG + Netflix: traverse city→products→requirements→docs in ms; shortestPath, fan-out blast radius [6][7]. | Flagship 5-hop Incident→Service←Release→PR→Commit←Engineer; `shortestPath *1..6` over 11 rel types [1]; blast-radius fan-out (DEPLOYED→AFFECTED). | No unbounded variable-depth, no weighted/aggregation (GDS) queries, no cycle detection, time-ordered traversal only via property sort. | Add k-hopPageRank/GDS module on WORKED_ON+AUTHORED; expose `*1..N` endpoint with depth guard. |
| 6 | **Naming conventions (OpenCypher style guide)** — **8/10** | Labels PascalCase, rels SCREAMING_SNAKE, props camelCase [2][10]. | `Engineer/Repo/PullRequest…`, `AUTHORED/MERGED_BY/RESOLVED_BY`, `editedAt/authoredAt/defaultBranch` — all correct; hard rule 1 forbids string-concat Cypher. | `Repo` (docs say Repository), composite `key` prop with `#/:/@` separators; `Engineeer` typo lives only in CONTRACT comment. | Rename `Repo`→`Repository` (or keep for brevity); keep `key` but add structured `(repo, number)` props. |
| 7 | **Real-data scalability headroom (1GB tier)** — **7/10** | TAO serves 1B reads/s at FB scale [3]; LIquid 270B edges [4]; Uber 12-week AuraDB rollout handles millions [6]. | Target ~4.7k nodes / ~10k edges on 1GB CognoDB tier ≈ <1% of tier capacity; degree ≤8k ≪ 100k threshold. | Foreign-schema data squatting the shared DB; no purge/tenant isolation documented; no load test. | `MATCH (n) DETACH DELETE n` pre-flight + `db.schema` assertion in load.py; add 100k-edge load test. |

**Weighted average: ≈ 6.9/10**

## 3. Top gaps (priority order)

1. **Contract schema is not in the live DB** — 0 ShipGraph labels/rels; 133 nodes of a foreign graph present. Fix: `load.py` must (a) refuse to run unless `db.schema` shows only contract labels or (b) purge foreign nodes first, (c) execute CONSTRAINT_CYPHER before MERGE (CONTRACT line 29).
2. **Composite keys as packed strings** (`repo#number`) defeat composite constraints and make joins/temporal merges stringy. Fix: composite unique constraints on structured props while keeping `key` as a back-compat alias.
3. **Provenance depth is a boolean, not lineage** — `heuristic:true` meets the honesty bar but not the Netflix/KG bar (confidence, method, derivedFrom). Fix: 3 extra props + split dual-nature `SHIPPED`.

## 4. References

1. Neo4j Data Modeling Best Practices — https://support.neo4j.com/s/article/360024789554-Data-Modeling-Best-Practices
2. Neo4j Cypher Manual — Naming rules and recommendations — https://neo4j.com/docs/cypher-manual/current/syntax/naming/
3. TAO: Facebook's Distributed Data Store for the Social Graph (USENIX ATC'13) — https://www.usenix.org/system/files/conference/atc13/atc13-bronson.pdf
4. How LIquid Connects Everything (LinkedIn Engineering) — https://engineering.linkedin.com/blog/2023/how-liquid-connects-everything-so-our-members-can-do-anything
5. Unlocking Entertainment Intelligence with Knowledge Graph (Netflix TechBlog) — https://netflixtechblog.medium.com/unlocking-entertainment-intelligence-with-knowledge-graph-da4b22090141
6. Uber Powers Cross-Domain Config Validation with Neo4j — https://neo4j.com/customer-stories/uber/
7. How Netflix Content Engineering makes a federated graph searchable — https://netflixtechblog.com/how-netflix-content-engineering-makes-a-federated-graph-searchable-5c0c1c7d7eaf
8. Building an Enterprise Knowledge Graph @Uber: Lessons from Reality — https://www.slideshare.net/slideshow/building-an-enterprise-knowledge-graph-uber-lessons-from-reality/146096919
9. Intuit SKIP knowledge graph (Neo4j customer story) — https://neo4j.com/customer-stories/intuit ; intuit/infigraph — https://github.com/intuit/infigraph
10. Cypher styleguide (official formatter/`cypherfmt`) — https://neo4j.com/docs/cypher-manual/current/styleguide/
11. How GitHub's dependency graph is generated — https://github.blog/enterprise-software/secure-software-development/secure-at-every-step-how-githubs-dependency-graph-is-generated/
12. Graph Data Modeling Core Principles (Neo4j GraphAcademy) — https://neo4j.com/graphacademy/training-gdm-40/03-graph-data-modeling-core-principles

## 5. Verdict

**B for a demo; would need composite constraints, native datetimes, and provenance depth (confidence/method) — plus a clean, schema-asserted load — for prod.** Schema discipline and naming are near-MNC; the model itself is honest and well-typed, but it cannot be exercised or verified until `load.py` runs against a ShipGraph-only database.