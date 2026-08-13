'use client'

import Link from 'next/link'
import type { IncidentDetail } from './types'
import { fmtDateTime, shortSha, fmtNum } from './format'
import { Avatar, ImpactChip, StatusPill } from './ui'

export function ChainView({ detail }: { detail: IncidentDetail }) {
  const { incident, services, chain } = detail
  const resolved = Boolean(incident.resolvedAt)
  const window = [
    new Date(new Date(incident.createdAt).getTime() - 6 * 3600 * 1000),
    new Date(new Date(resolved ? incident.resolvedAt! : Date.now()).getTime() + 6 * 3600 * 1000),
  ]

  return (
    <div className="chain">
      <section className="card chain-incident" aria-label="Incident">
        <div className="incident-head">
          <ImpactChip impact={incident.impact} />
          <StatusPill resolved={resolved} />
          <span className="incident-source">{incident.source}</span>
        </div>
        <h2>{incident.name}</h2>
        <dl className="kv-grid chain-kv">
          <div>
            <dt>Started</dt>
            <dd>{fmtDateTime(incident.createdAt)}</dd>
          </div>
          <div>
            <dt>{resolved ? 'Resolved' : 'Last update'}</dt>
            <dd>{incident.resolvedAt ? fmtDateTime(incident.resolvedAt) : <span className="text-ongoing">Still ongoing</span>}</dd>
          </div>
          <div>
            <dt>Affected services</dt>
            <dd className="chip-row">
              {services.length ? (
                services.map((s) => (
                  <span key={s} className="chip service-chip">
                    {s}
                  </span>
                ))
              ) : (
                <span className="muted">None mapped</span>
              )}
            </dd>
          </div>
        </dl>
        {incident.url && (
          <p className="chain-source-link">
            Source: <a href={incident.url} target="_blank" rel="noreferrer">{incident.url}</a>
          </p>
        )}
      </section>

      <section className="chain-legend" aria-label="How to read this chain">
        <p className="chain-explainer">
          Search window: <strong>{fmtDateTime(window[0].toISOString())}</strong> → <strong>{fmtDateTime(window[1].toISOString())}</strong>. Anything deployed in this window — and the commits riding it — is a suspect.
        </p>
        <ol className="chain-steps-note">
          <li>Release deployed into the affected service</li>
          <li>Commits that rode that release</li>
          <li>Engineers who authored them — <em>who shipped it</em></li>
        </ol>
      </section>

      <div className="chain-section">
        <div className="chain-section-head">
          <h3>Deploys in the window</h3>
          <span className="count-badge">{chain.releases.length}</span>
        </div>
        {chain.releases.length === 0 ? (
          <p className="muted note">No releases fell inside the search window.</p>
        ) : (
          <ul className="timeline">
            {chain.releases.map((rel, i) => (
              <li key={rel.repo + '@' + rel.tagName} className="timeline-item timeline-release">
                <div className="timeline-dot" aria-hidden="true" />
                <div className="timeline-card card">
                  <div className="timeline-card-row">
                    <span className="chip chip-release">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M20 8 12 4 4 8l2 10h12l2-10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                      </svg>
                      {rel.tagName}
                    </span>
                    <Link className="timeline-repo" href={`/repos/${encodeURIComponent(rel.repo)}`}>
                      {rel.repo}
                    </Link>
                    <span className="timeline-date">{fmtDateTime(rel.publishedAt)}</span>
                    {i === 0 && <span className="chip chip-hot">in window</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="chain-section">
        <div className="chain-section-head">
          <h3>Commits riding the window</h3>
          <span className="count-badge">{chain.commits.length}</span>
        </div>
        {chain.commits.length === 0 ? (
          <p className="muted note">No commits were linked through those releases.</p>
        ) : (
          <ul className="timeline">
            {chain.commits.map((c) => (
              <li key={c.sha} className="timeline-item timeline-commit">
                <div className="timeline-dot" aria-hidden="true" />
                <div className="timeline-card card">
                  <code className="commit-sha">{shortSha(c.sha)}</code>
                  <span className="commit-msg">{c.message}</span>
                  <span className="timeline-date">{fmtDateTime(c.authoredAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="chain-section">
        <div className="chain-section-head">
          <h3>Who shipped it</h3>
          <span className="count-badge">{chain.engineers.length}</span>
        </div>
        {chain.engineers.length === 0 ? (
          <p className="muted note">No engineers were linked to this chain.</p>
        ) : (
          <div className="engineer-chip-row">
            {chain.engineers.map((login) => (
              <Link key={login} className="engineer-chip card" href={`/engineers/${encodeURIComponent(login)}`}>
                <Avatar src={null} name={login} size={34} />
                <span>{login}</span>
              </Link>
            ))}
          </div>
        )}
        <p className="chain-proof">
          Multi-hop proof: incident → affected service → release → PR → commit → engineer ({fmtNum(chain.engineers.length)} engineers linked).
        </p>
      </div>
    </div>
  )
}