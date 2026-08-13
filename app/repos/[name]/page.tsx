'use client'

import { use } from 'react'
import Link from 'next/link'
import { useApi } from '@/components/api'
import type { Blast, RepoDetail } from '@/components/types'
import { EmptyState, ErrorBanner, ImpactChip, SkeletonBlock } from '@/components/ui'
import { fmtDateTime, fmtNum, fmtRelative } from '@/components/format'

export default function RepoDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params)
  const { result, reload } = useApi<RepoDetail>(`/repos/${encodeURIComponent(name)}`)
  const blast = useApi<Blast>(`/blast?repo=${encodeURIComponent(name)}`)

  return (
    <>
      <p className="breadcrumbs">
        <Link href="/repos">Repos</Link> · <span>{name}</span>
      </p>
      {result.status === 'loading' && <SkeletonBlock lines={5} ariaLabel={`Loading ${name}`} />}
      {result.status === 'error' && <ErrorBanner message={result.message} onRetry={reload} />}
      {result.status === 'ok' && (
        <>
          <RepoHeader detail={result.data} />

          <div className="grid two-col" style={{ marginTop: 24 }}>
            <section className="card" style={{ padding: '18px 20px' }} aria-label="Contributors">
              <div className="chain-section-head">
                <h3>Top contributors</h3>
                <span className="count-badge">{result.data.contributors.length}</span>
              </div>
              {result.data.contributors.length === 0 ? (
                <p className="muted note">No contributors recorded yet.</p>
              ) : (
                <div>
                  {result.data.contributors.map((c) => (
                    <div key={c.login} className="row">
                      <Link className="row-sub" href={`/engineers/${encodeURIComponent(c.login)}`} style={{ minWidth: 130, fontWeight: 650 }}>
                        {c.login}
                      </Link>
                      <div className="contrib-bar" aria-hidden="true">
                        <span style={{ width: `${Math.max(6, (c.contributions / result.data.contributors[0].contributions) * 100)}%` }} />
                      </div>
                      <span className="contrib-num">{fmtNum(c.contributions)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card" style={{ padding: '18px 20px' }} aria-label="Releases">
              <div className="chain-section-head">
                <h3>Release timeline</h3>
                <span className="count-badge">{result.data.releases.length}</span>
              </div>
              {result.data.releases.length === 0 ? (
                <p className="muted note">No releases yet.</p>
              ) : (
                <ul className="timeline">
                  {result.data.releases.map((rel) => (
                    <li key={rel.tagName} className="timeline-item timeline-commit">
                      <div className="timeline-dot" aria-hidden="true" />
                      <div className="timeline-card card">
                        <span className="chip chip-release">{rel.tagName}</span>
                        <span className="timeline-date">{fmtDateTime(rel.publishedAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section style={{ marginTop: 24 }} aria-label="Blast radius">
            <div className="chain-section-head">
              <h3>Blast radius</h3>
              <span className="count-badge">multi-hop</span>
            </div>
            {blast.result.status === 'loading' && <SkeletonBlock lines={2} ariaLabel="Loading blast radius" />}
            {blast.result.status === 'error' && <ErrorBanner message={blast.result.message} onRetry={blast.reload} />}
            {blast.result.status === 'ok' && <BlastPanel blast={blast.result.data} repoName={name} />}
            <p className="chain-proof">
              How: latest release → deployed services → incidents that affected them (release → DEPLOYED → service → AFFECTED → incident).
            </p>
          </section>
        </>
      )}
    </>
  )
}

function RepoHeader({ detail }: { detail: RepoDetail }) {
  const { repo } = detail
  return (
    <div className="card detail-hero">
      <span className="repo-glyph" style={{ width: 64, height: 64, borderRadius: 16 }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7Zm3 9h5m-5-4h10M7 5v3m0 0v11"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1>
          {repo.name} <small style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 15 }}>{repo.language}</small>
        </h1>
        <div className="login" style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
          {repo.owner}
          {repo.defaultBranch ? ` · default branch: ${repo.defaultBranch}` : ''}
        </div>
        <div className="detail-hero-stats">
          <div className="detail-stat">
            <b>{fmtNum(repo.stars)}</b>
            <span>stars</span>
          </div>
          <div className="detail-stat">
            <b>{fmtNum(detail.prs)}</b>
            <span>PRs</span>
          </div>
          <div className="detail-stat">
            <b>{detail.releases.length}</b>
            <span>releases</span>
          </div>
          <div className="detail-stat">
            <b>{fmtRelative(repo.pushedAt)}</b>
            <span>last push</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function BlastPanel({ blast, repoName }: { blast: Blast; repoName: string }) {
  if (!blast.release.tagName && blast.services.length === 0 && blast.incidents.length === 0) {
    return <EmptyState title="Blast radius unknown" hint={`No release → service → incident chain found for ${repoName}.`} />
  }
  return (
    <div className="card blast">
      <div className="blast-flow" aria-label="Blast radius chain">
        <span className="blast-node">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M20 8 12 4 4 8l2 10h12l2-10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          {repoName}@{blast.release.tagName}
        </span>
        <span className="blast-arrow" aria-hidden="true">
          →
        </span>
        {blast.services.map((s) => (
          <span className="blast-node" key={s}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 21v-7m7 7v-7m7 7v-7M4 8l8-5 8 5-8 5-8-5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {s}
          </span>
        ))}
        <span className="blast-arrow" aria-hidden="true">
          ←
        </span>
        <span className="blast-fire" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {blast.incidents.length > 0 && <ImpactChip impact="critical" />}
        </span>
      </div>
      {blast.incidents.length > 0 && (
        <div className="blast-incidents-row">
          {blast.incidents.map((key) => (
            <Link key={key} className="blast-incident-link" href={`/incidents/${encodeURIComponent(key)}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3 2.5 20h19L12 3Zm0 5.5v5m0 3.5v.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {key}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}