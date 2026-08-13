# SUBMISSION_EMAIL.md — ShipGraph submission mail (Wexa AI — CognoDB take-home)

**To:** hr@wexa.ai

**Subject:** CognoDB Assignment 2 – Vishnu Vardhan

---

Hi Team,

Please find my submission for the CognoDB take-home assignment.

**Repository:** https://github.com/Rythamo8055/shipgraph

**Live demo:** https://shipgraph-lovat.vercel.app (deployed on Vercel, connected to
the live CognoDB instance)

**Short walkthrough recording:** `docs/screenshots/demo.mp4` in the repo
(also: 6 screenshots under `docs/screenshots/`)

**What it is.** ShipGraph is a graph application over real open-source delivery
history: 15 flagship repos (Express.js, Vite, HashiCorp suite), their merged PRs,
commits, releases, engineers, and the 7 public statuspage feeds that cover them —
**7,847 nodes and 20,296 edges**, all from public APIs, zero synthetic data.

**The use case.** *What broke, who shipped it, and who fixed it?* From any
incident the app walks the chain end-to-end: the service affected → the release
deployed in its blast window → the PRs shipped in that release → the commits →
the engineers who authored them. It also computes blast radius per release and
shortest structural paths (≤6 hops) between any two engineers.

**Why a graph database.** Every flagship question is a path question (incident →
service → release → PR → commit → engineer), which a relational schema would
flatten into six-plus joins and a recursive path query. In a graph the traversal
*is* the query — one parameterised Cypher statement, and the hop semantics stay
visible. The README's "Why a graph database?" section spells this out with the
exact flagship Cypher.

**Engineering notes.**
- Fetch → normalize → load pipeline (`scripts/`), resume-safe: every API response
  is cached by SHA-256 key, so the crawl is deterministic and reproducible.
- Heuristic derivations (SHIPPED/DEPLOYED/RESOLVED_BY/WORKED_ON) are explicit
  edges flagged `heuristic:true` — observed facts vs. derived inference stay
  inspectable.
- Parameterised Cypher only; no string-concatenated queries; labels/types
  interpolated exclusively from schema constants.
- Credentials live only in gitignored `.env` (CognoDB `bolt+s` URI + password).
- Graceful degradation: Live/Sample mode pill; sample fixtures mirror the API so
  the UI works even with the DB unreachable (503 handling sanitised).
- `CONTRACT.md` is the single source of truth; `PROVENANCE.md` lists every
  source URL and fetch date; tests cover data quality, live-DB constraints,
  idempotency, flagship chains and the API contract (Vitest 68/68 + pytest).

The CognoDB instance is running and will stay up so you can try the app against
the live database. Happy to walk through any part of the pipeline or model in a
follow-up call.

Best regards,
Vishnu Vardhan

---

## Sending checklist

- [x] Repository: https://github.com/Rythamo8055/shipgraph (public)
- [x] Subject: `CognoDB Assignment 2 – Vishnu Vardhan`
- [x] Demo link: https://shipgraph-lovat.vercel.app (Vercel production)
- [x] Screen recording: docs/screenshots/demo.mp4 (+ screenshots in repo)
- [ ] Sent with SMTP (app password) — confirm in `sent` after send
- [ ] Do NOT attach `.env` / any credentials
