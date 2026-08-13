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
Right now the dataset holds ~3.8k nodes and ~7.8k edges: engineers, PRs, commits, releases,
incidents, and services. The app walks those relationships end-to-end — from a live incident
back to the release deployed to the affected service, the commits that rode in it, and the
engineers who authored them. It also finds structural paths between any two engineers, and
traces a release's "blast radius" across services and incidents.

**How it's built.** A multi-agent pipeline: Python fetch/normalize/load scripts push the
graph into a hosted Neo4j-compatible database (CognoDB); a Next.js 15 + TypeScript frontend
reads it through a fixed, parameterised Cypher layer — no user-supplied queries, no
string-built Cypher. Heuristically derived edges are flagged `heuristic:true` and surfaced
honestly in the UI, and the header pill always shows whether you're looking at the live
database or clearly-marked sample data. The full query contract, schema, and provenance are
documented in the repo (`CONTRACT.md`, `PROVENANCE.md`, and an `MODEL_AUDIT.md` that
benchmarks the model against MNC/FAANG graph practices).

**Quality.** The app ships green: production build, a Vitest + Testing Library suite
(components, API fallback behaviour, search combobox a11y), a Python quality suite, and a
model audit. No data is synthetic; every source URL and fetch date is recorded.

Repo + live demo details are in my portfolio; I'd love a quick call to walk through the
incident chain or the pathfinding view.

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