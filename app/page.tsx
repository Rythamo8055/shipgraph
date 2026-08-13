'use client'

import Link from 'next/link'
import { useApi } from '@/components/api'
import type { Stats } from '@/components/types'
import { SearchBox } from '@/components/search'
import { CardSkeleton, EmptyState, ErrorBanner, Spinner, SectionTitle } from '@/components/ui'
import { IncidentCard } from '@/components/incident-card'
import { Avatar } from '@/components/ui'
import { fmtNum } from '@/components/format'

const STAT_ORDER = [
  { key: 'Incident', label: 'Incidents' },
  { key: 'Engineer', label: 'Engineers' },
  { key: 'Release', label: 'Releases' },
  { key: 'Repo', label: 'Repos' },
  { key: 'PullRequest', label: 'Pull requests' },
  { key: 'Commit', label: 'Commits' },
]

function StatsSection({ stats }: { stats: Stats }) {
  const top = STAT_ORDER.filter((s) => stats.nodes[s.key] != null)
  return (
    <div className="grid cards-grid" aria-label="Graph statistics">
      {top.map((s) => (
        <div key={s.key} className="card stat-card">
          <div className="stat-label">{s.label}</div>
          <div className="stat-value">{fmtNum(stats.nodes[s.key])}</div>
          <div className="stat-sub">{fmtNum(stats.totalNodes)} nodes · {stats.edges[s.key] != null ? fmtNum(stats.edges[s.key]) + ' linked' : ''}</div>
        </div>
      ))}
    </div>
  )
}

export default function HomePage() {
  const stats = useApi<Stats>('/api/stats')
  const incidents = useApi<{ incidents: import('@/components/types').IncidentRow[] }>('/api/incidents?limit=5')
  const engineers = useApi<{ engineers: import('@/components/types').EngineerRow[] }>('/api/engineers?limit=5')

  const topEngineers = engineers.result.status === 'ok' ? [...engineers.result.data.engineers].sort((a, b) => b.incidents - a.incidents).slice(0, 5) : []

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">
          Who <span className="accent">shipped</span> it?
        </h1>
        <p className="hero-sub">
          Every incident has a story: a service that broke, a release that went out, commits that rode it, and the engineers who
          wrote them. ShipGraph connects the dots across people, code, and deploys.
        </p>
        <div className="hero-search">
          <SearchBox />
        </div>
      </section>

      <section aria-labelledby="graph-stats-title">
        <div className="section-head">
          <h2 id="graph-stats-title" className="section-title">
            The graph at a glance
          </h2>
          <Link className="section-link" href="/queries">
            How is this computed? →
          </Link>
        </div>
        {stats.result.status === 'loading' && <CardSkeleton count={6} label="Loading graph statistics" />}
        {stats.result.status === 'error' && <ErrorBanner message={stats.result.message} onRetry={stats.reload} />}
        {stats.result.status === 'ok' && <StatsSection stats={stats.result.data} />}
      </section>

      <section aria-labelledby="recent-incidents-title">
        <div className="section-head">
          <h2 id="recent-incidents-title" className="section-title">
            Recent incidents
          </h2>
          <Link className="section-link" href="/incidents">
            All incidents →
          </Link>
        </div>
        {incidents.result.status === 'loading' && <Spinner label="Loading recent incidents…" />}
        {incidents.result.status === 'error' && <ErrorBanner message={incidents.result.message} onRetry={incidents.reload} />}
        {incidents.result.status === 'ok' &&
          (incidents.result.data.incidents.length === 0 ? (
            <EmptyState title="No incidents yet" hint="When the graph picks up incidents they will appear here." />
          ) : (
            <div className="section-stack">
              {incidents.result.data.incidents.slice(0, 5).map((i) => (
                <IncidentCard key={i.key} incident={i} />
              ))}
            </div>
          ))}
      </section>

      <section aria-labelledby="top-engineers-title">
        <div className="section-head">
          <h2 id="top-engineers-title" className="section-title">
            Top fixers
          </h2>
          <Link className="section-link" href="/engineers">
            All engineers →
          </Link>
        </div>
        {engineers.result.status === 'loading' && <Spinner label="Loading engineers…" />}
        {engineers.result.status === 'error' && <ErrorBanner message={engineers.result.message} onRetry={engineers.reload} />}
        {engineers.result.status === 'ok' &&
          (topEngineers.length === 0 ? (
            <EmptyState title="No engineers yet" hint="Engineers appear once the delivery graph is loaded." icon="search" />
          ) : (
            <div className="section-stack">
              {topEngineers.map((e) => (
                <Link key={e.login} className="card engineer-card" href={`/engineers/${encodeURIComponent(e.login)}`}>
                  <Avatar src={e.avatarUrl ?? null} name={e.name ?? e.login} size={40} />
                  <div className="engineer-card-main">
                    <div className="engineer-card-name">{e.name ?? e.login}</div>
                    <div className="engineer-card-login">@{e.login}</div>
                  </div>
                  <div className="engineer-stats">
                    <div className="engineer-stat">
                      <b>{e.incidents}</b>
                      <span>incidents fixed</span>
                    </div>
                    <div className="engineer-stat">
                      <b>{e.prs}</b>
                      <span>PRs</span>
                    </div>
                    <div className="engineer-stat">
                      <b>{e.commits}</b>
                      <span>commits</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ))}
      </section>

      <section aria-labelledby="how-to-title">
        <div className="section-head">
          <h2 id="how-to-title" className="section-title">
            How to use ShipGraph
          </h2>
          <Link className="section-link" href="/queries">
            How is this computed? →
          </Link>
        </div>
        <p className="page-sub" style={{ marginTop: 6 }}>
          Four worked examples — each one follows a real trail through the graph.
        </p>
        <div className="examples-grid">
          <article className="card example-card">
            <div className="example-num" aria-hidden="true">1</div>
            <div className="example-body">
              <h3>Follow an incident to its fixers</h3>
              <ol className="example-steps">
                <li>Open <Link href="/incidents">Incidents</Link> and click any one (e.g. a GitHub “Incident with Actions”).</li>
                <li>The detail page walks the chain: incident → affected service → deployed release → shipped PRs → commits.</li>
                <li>At the bottom you get the engineers who authored those commits — the people behind the fix.</li>
              </ol>
            </div>
          </article>

          <article className="card example-card">
            <div className="example-num" aria-hidden="true">2</div>
            <div className="example-body">
              <h3>Measure a release's blast radius</h3>
              <ol className="example-steps">
                <li>Open <Link href="/repos">Repos</Link> and pick a repo, e.g. <Link href="/repos/vitejs/vite">vitejs/vite</Link>.</li>
                <li>The <em>Blast radius</em> panel lists the latest release, the services it deployed to, and incidents that overlapped it.</li>
                <li>Use it to answer: “if this release breaks something, what is affected?”</li>
              </ol>
            </div>
          </article>

          <article className="card example-card">
            <div className="example-num" aria-hidden="true">3</div>
            <div className="example-body">
              <h3>Prove two engineers are connected</h3>
              <ol className="example-steps">
                <li>Open <Link href="/pathfinder">Pathfinder</Link> and pick two engineers, e.g. <code>SarahFrench</code> (Terraform) and <code>patak-dev</code> (Vite).</li>
                <li>ShipGraph returns the delivery-graph hops between them — shared repos, merged PRs, commits, incidents.</li>
                <li>A real answer to “do these two people work on the same software?”</li>
              </ol>
            </div>
          </article>

          <article className="card example-card">
            <div className="example-num" aria-hidden="true">4</div>
            <div className="example-body">
              <h3>Search anything in the graph</h3>
              <ol className="example-steps">
                <li>Type <code>vite</code>, <code>express</code> or <code>terraform</code> in the search box on this page.</li>
                <li>Results are grouped by kind — engineers, repos, pull requests, incidents.</li>
                <li>Click one to jump straight to its detail page.</li>
              </ol>
            </div>
          </article>
        </div>
      </section>

      <section aria-label="Graph summary strip">
        <div className="section-stack">
          <div className="card" style={{ padding: '18px 22px' }}>
            <p style={{ margin: 0, fontSize: 14.5 }} className="muted">
              <strong style={{ color: 'var(--ink-2)' }}>{stats.result.status === 'ok' ? fmtNum(stats.result.data.totalNodes) : '–'}</strong>{' '}
              nodes connected by{' '}
              <strong style={{ color: 'var(--ink-2)' }}>{stats.result.status === 'ok' ? fmtNum(stats.result.data.totalEdges) : '–'}</strong>{' '}
              relationships — <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{stats.result.status === 'ok' ? topRel(stats.result.data) : ''}</span> among them.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}

function topRel(stats: Stats): string {
  const rels = Object.entries(stats.edges).sort((a, b) => b[1] - a[1])
  if (!rels.length) return ''
  const [rel, count] = rels[0]
  return `${rel} (${fmtNum(count)})`
}