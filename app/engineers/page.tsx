'use client'

import Link from 'next/link'
import { useApi } from '@/components/api'
import type { Engineers } from '@/components/types'
import { Avatar, CardSkeleton, EmptyState, ErrorBanner, PageHeader } from '@/components/ui'
import { fmtNum } from '@/components/format'

export default function EngineersPage() {
  const { result, reload } = useApi<Engineers>('/api/engineers?limit=50')

  return (
    <>
      <PageHeader
        title="Engineers"
        sub="The people behind the code: what they shipped, and which incidents they resolved."
      />
      {result.status === 'loading' && <CardSkeleton count={8} label="Loading engineers" />}
      {result.status === 'error' && <ErrorBanner message={result.message} onRetry={reload} />}
      {result.status === 'ok' &&
        (result.data.engineers.length === 0 ? (
          <EmptyState title="No engineers yet" hint="Engineers appear in the graph once data has been loaded." />
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {result.data.engineers.map((e) => (
              <Link key={e.login} className="card engineer-card" href={`/engineers/${encodeURIComponent(e.login)}`}>
                <Avatar src={e.avatarUrl ?? null} name={e.name ?? e.login} size={44} />
                <div className="engineer-card-main">
                  <div className="engineer-card-name">{e.name ?? e.login}</div>
                  <div className="engineer-card-login">@{e.login}</div>
                </div>
                <div className="engineer-stats">
                  <div className="engineer-stat">
                    <b>{e.incidents}</b>
                    <span>fixed</span>
                  </div>
                  <div className="engineer-stat">
                    <b>{e.repos}</b>
                    <span>repos</span>
                  </div>
                  <div className="engineer-stat">
                    <b>{fmtNum(e.commits)}</b>
                    <span>commits</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ))}
    </>
  )
}