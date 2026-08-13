'use client'

import { use } from 'react'
import Link from 'next/link'
import { useApi } from '@/components/api'
import type { EngineerDetail } from '@/components/types'
import { Avatar, EmptyState, ErrorBanner, ImpactChip, SkeletonBlock } from '@/components/ui'
import { fmtDate, fmtDateTime } from '@/components/format'

export default function EngineerDetailPage({ params }: { params: Promise<{ login: string }> }) {
  const { login } = use(params)
  const { result, reload } = useApi<EngineerDetail>(`/engineers/${encodeURIComponent(login)}`)

  return (
    <>
      <p className="breadcrumbs">
        <Link href="/engineers">Engineers</Link> · <span>{login}</span>
      </p>
      {result.status === 'loading' && <SkeletonBlock lines={5} ariaLabel={`Loading ${login}`} />}
      {result.status === 'error' && <ErrorBanner message={result.message} onRetry={reload} />}
      {result.status === 'ok' && <EngineerProfile detail={result.data} />}
    </>
  )
}

function EngineerProfile({ detail }: { detail: EngineerDetail }) {
  const { engineer, repos, pullRequests, incidents } = detail
  const resolved = incidents.filter((i) => i.resolvedAt).length
  const open = pullRequests.filter((p) => p.state !== 'merged').length

  return (
    <>
      <div className="card detail-hero">
        <Avatar src={engineer.avatarUrl ?? null} name={engineer.name ?? engineer.login} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{engineer.name ?? engineer.login}</h1>
          <div className="login">@{engineer.login}</div>
          <div className="detail-hero-stats">
            <div className="detail-stat">
              <b>{repos.length}</b>
              <span>repos</span>
            </div>
            <div className="detail-stat">
              <b>{pullRequests.length}</b>
              <span>PRs · {open} open</span>
            </div>
            <div className="detail-stat">
              <b>{resolved}</b>
              <span>incidents resolved</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid two-col">
        <section className="card" style={{ padding: '18px 20px' }} aria-label="Repos worked on">
          <div className="chain-section-head">
            <h3>Repos</h3>
            <span className="count-badge">{repos.length}</span>
          </div>
          {repos.length === 0 ? (
            <p className="muted note">No repos in this profile yet.</p>
          ) : (
            <div className="chip-row">
              {repos.map((r) => (
                <Link key={r} className="repo-chip" href={`/repos/${encodeURIComponent(r)}`}>
                  {r}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card" style={{ padding: '18px 20px' }} aria-label="Incidents resolved">
          <div className="chain-section-head">
            <h3>Incidents resolved</h3>
            <span className="count-badge">{incidents.length}</span>
          </div>
          {incidents.length === 0 ? (
            <p className="muted note">No incidents linked to this engineer yet.</p>
          ) : (
            <div className="section-stack">
              {incidents.map((i) => (
                <Link key={i.key} className="row" href={`/incidents/${encodeURIComponent(i.key)}`}>
                  <ImpactChip impact={i.impact} />
                  <div className="row-main">
                    <div className="row-title">{i.name}</div>
                    <div className="row-sub">
                      {fmtDate(i.createdAt)}
                      {i.resolvedAt ? ` → ${fmtDate(i.resolvedAt)}` : ' · ongoing'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section style={{ marginTop: 24 }} aria-label="Merged pull requests">
        <div className="chain-section-head">
          <h3>Recent pull requests</h3>
          <span className="count-badge">{pullRequests.length}</span>
        </div>
        {pullRequests.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 12 }}>
            <p className="empty-title">No pull requests linked</p>
            <p className="empty-hint">PRs authored or merged by this engineer will show up here.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: '4px 20px' }}>
            {pullRequests.map((pr) => (
              <div key={pr.key} className="row">
                <span className={`pr-state pr-state-${pr.state === 'merged' ? 'merged' : 'open'}`}>{pr.state}</span>
                <div className="row-main">
                  <div className="row-title">{pr.title}</div>
                  <div className="row-sub">{pr.key}</div>
                </div>
                <span className="row-date">{fmtDateTime(pr.mergedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}