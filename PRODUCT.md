# ShipGraph

**Who shipped it?** ShipGraph is a delivery-graph explorer. It ingests real open-source
data — repos, merged PRs, releases, commits, engineers, and statuspage incidents — into a
Neo4j-compatible graph (CognoDB), then answers one question across it: *what broke, who
shipped it, and who fixed it?*

## Product truth

- **Data is real.** Every node traces to GitHub REST responses or statuspage.com feeds
  (see `scripts/acquire/` and `CONTRACT.md`). Graph contents are the single source of
  truth; the UI renders what the graph returns and does not fabricate numbers.
- **Three surfaces, one graph.** People (`Engineer`), code (`Repo`/`PullRequest`/`Commit`/
  `Release`), and operations (`Service`/`Incident`) are linked by 11 typed relationships.
  Edges derived by heuristics are marked `heuristic: true` and called out in the UI.
- **Honesty about provenance.** The header pill shows *Live* when queries hit the database
  and *Sample* when the demo dataset serves instead — users always know which world they
  are looking at.
- **The flagship story is the incident chain:** an incident affects a service; the
  releases deployed to that service in its time window; the commits those releases
  shipped; the engineers who authored them. Detail pages render this chain end-to-end.
- **Pathfinding is structural proof.** Two engineers can be connected through any
  whitelisted relationship type (depth ≤6) — the path view walks the graph, not a search
  index.

## Users and jobs

| User | Job |
|---|---|
| Engineering manager | See who contributed where, what shipped, and which incidents our releases touched. |
| Engineer | Find their own footprint (PRs merged, repos, incidents resolved) and how they connect to others. |
| On-call / SRE | For a given incident, see the releases and commits in its window and the engineers behind them. |
| Curious reader | Explore graphs, read the exact Cypher behind every endpoint, copy it, run it. |

## Non-goals

- No write paths from the UI — the app is read-only by design (security surface stays small).
- No user-supplied Cypher. Every endpoint runs a fixed, parameterised query
  (see `lib/queries.ts` hard rules).
- No marketing claims beyond what the data shows.

## Success criteria

- Every page renders correctly in **Live and Sample** modes and degrades with a clear
  error state when the database is unreachable.
- Keyboard and screen-reader users can complete search, pathfinding, and copy-query flows.
- The app ships green: `npm run build`, `npx vitest run`, and the pipeline's
  `pytest` suite all pass.