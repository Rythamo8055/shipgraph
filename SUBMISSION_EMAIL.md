# SUBMISSION_EMAIL.md — ShipGraph submission mail (Agent E deliverable)

Ready to send. Copy the block below, fill nothing gated, paste into Gmail
(to: the hiring manager / founder; subject pre-filled).

---

**To:** Hiring / Engineering Leadership

**Subject:** ShipGraph — a live delivery graph over real open-source data (portfolio submission)

Hi,

I built a portfolio project you might find interesting: **ShipGraph**, a web app that
answers one question across a real dataset — *what broke, who shipped it, and who fixed it?*

**What it does.** I crawled 15 flagship open-source repositories (Express.js, Vite, and the
HashiCorp suite — Terraform, Vault, Consul, Nomad, Packer) plus 7 public statuspage feeds.
Right now the dataset holds **7,847 nodes and 20,296 edges**: engineers, PRs, commits,
releases, incidents, and services. The app walks those relationships end-to-end — from a
live incident back to the release deployed to the affected service, the commits that rode
in it, and the engineers who authored them. It also finds structural paths between any two
engineers, and traces a release's "blast radius" across services and incidents.

**Screenshots** (captured against the live app): [home](https://github.com/Rythamo8055/shipgraph/blob/main/docs/screenshots/home.png),
[incident chain](https://github.com/Rythamo8055/shipgraph/blob/main/docs/screenshots/incident-detail.png),
[pathfinder](https://github.com/Rythamo8055/shipgraph/blob/main/docs/screenshots/pathfinder.png) —
all six are in `docs/screenshots/` in the repo.

**How it's built.** A multi-agent pipeline: Python fetch/normalize/load scripts push the
graph into a hosted Neo4j-compatible database (CognoDB); a Next.js 15 + TypeScript frontend
reads it through a fixed, parameterised Cypher layer — no user-supplied queries, no
string-built Cypher. Heuristically derived edges are flagged `heuristic:true` and surfaced
honestly in the UI, and the header pill always shows whether you're looking at the live
database or clearly-marked sample data. The full query contract, schema, and provenance are
documented in the repo (`CONTRACT.md`, `DESIGN.md`, and an `MODEL_AUDIT.md` that benchmarks
the model against MNC/FAANG graph practices).

**Why a graph database.** This product is fundamentally about *paths*, not rows — "give me
every engineer who worked on a release deployed to a degraded service" is a multi-hop
relationship query that would flatten into a pile of joins in SQL. With a graph model the
walk is expressed natively and stays fast; the README has a worked example of the exact
Cypher against a live incident.

**Quality.** The app ships green: production build, a Vitest + Testing Library suite
(components, API fallback behaviour, search combobox a11y), a Python quality suite, and a
model audit. No data is synthetic; every source URL and fetch date is recorded. The
pipeline is deterministic and resume-safe (each raw fetch is cached by SHA-256 key), and
final lands: PR 1,371 / commits 4,065, releases 1,156, incidents 334, services 190.

Repo: **https://github.com/Rythamo8055/shipgraph** — I'd love a quick call to walk through
the incident chain or the pathfinding view.

Best,
Vishnu Vardhan

---

## Sending checklist

- [ ] Attach / link the repository (or `npm run dev` demo video) — do NOT attach `.env`.
- [ ] If sending to companies from the outreach tracker (TurboHire/ventures list), pick the
      same `template`/subject tone as the campaign for that company.
- [ ] Delay: use `send_emails.py` flow if sending from Gmail (35–90s default) or a normal
      single send — never blast the same mail to many companies in one minute.
- [ ] Personalize line 1 if the reader is known (name from the CSV).