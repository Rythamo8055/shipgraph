'use client'

import Link from 'next/link'
import { useApi } from '@/components/api'
import type { Repos } from '@/components/types'
import { Avatar, CardSkeleton, EmptyState, ErrorBanner, PageHeader } from '@/components/ui'
import { fmtRelative, fmtStars } from '@/components/format'

const langColors: Record<string, string> = {
  JavaScript: '#f1c40f',
  TypeScript: '#3178c6',
  Go: '#00add8',
  Rust: '#dea584',
  Python: '#3572a5',
  shell: '#89e051',
}

export default function ReposPage() {
  const { result, reload } = useApi<Repos>('/api/repos?limit=50')

  return (
    <>
      <PageHeader
        title="Repos"
        sub="Open-source projects in the graph — with the people who ship them and the releases that deploy."
      />
      {result.status === 'loading' && <CardSkeleton count={8} label="Loading repos" />}
      {result.status === 'error' && <ErrorBanner message={result.message} onRetry={reload} />}
      {result.status === 'ok' &&
        (result.data.repos.length === 0 ? (
          <EmptyState title="No repos yet" hint="Repos appear here once data has been loaded." icon="repo" />
        ) : (
          <div className="section-stack">
            {result.data.repos.map((r) => (
              <Link key={r.name} className="card repo-card" href={`/repos/${encodeURIComponent(r.name)}`}>
                <span className="repo-glyph" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7Zm3 9h5m-5-4h10M7 5v3m0 0v11"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div className="repo-card-main">
                  <div className="repo-card-name">
                    {r.name} <small>{r.language ?? ''}</small>
                  </div>
                  <div className="repo-card-desc">
                    {r.language && <span className="lang-dot" style={{ background: langColors[r.language] ?? '#9aa0a8' }} aria-hidden="true" />}
                    <span>pushed {fmtRelative(r.pushedAt)}</span>
                    <span className="repo-owners" aria-label={`Owners: ${r.owners.join(', ')}`}>
                      {r.owners.map((o) => (
                        <Avatar key={o} src={`https://avatars.githubusercontent.com/${o}?v=4`} name={o} size={22} />
                      ))}
                    </span>
                  </div>
                </div>
                <div className="repo-stat">
                  {fmtStars(r.stars)}
                  <small>stars</small>
                </div>
              </Link>
            ))}
          </div>
        ))}
    </>
  )
}