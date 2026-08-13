'use client'

import { useState } from 'react'
import { useApi } from '@/components/api'
import type { Path } from '@/components/types'
import { SearchSelect } from '@/components/search'
import { EmptyState, ErrorBanner, PageHeader, SkeletonBlock } from '@/components/ui'
import { PathView } from '@/components/path-view'

export default function PathfinderPage() {
  const [from, setFrom] = useState<string | null>(null)
  const [to, setTo] = useState<string | null>(null)
  const pathPath = from && to ? `/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : null
  const { result, reload } = useApi<Path>(pathPath)

  return (
    <>
      <PageHeader
        title="Path between two engineers"
        sub="Pick two people and ShipGraph will walk the delivery graph to find how they connect — through code, deploys, and incidents."
      />

      <div className="card path-picker">
        <SearchSelect label="Engineer A" value={from} onSelect={setFrom} onClear={() => setFrom(null)} />
        <span className="path-swap" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M8 7h11m0 0-3-3m3 3-3 3M16 17H5m0 0 3-3m-3 3 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <SearchSelect label="Engineer B" value={to} onSelect={setTo} onClear={() => setTo(null)} />
      </div>

      {!pathPath && (
        <EmptyState
          icon="path"
          title="Pick two engineers to find their path"
          hint="Paths use shortestPath over AUTHORED · COMMITTED · OPENED · MERGED_BY · IMPROVED · INCLUDED · SHIPPED · DEPLOYED · AFFECTED · RESOLVED_BY · WORKED_ON, up to 6 hops."
        />
      )}
      {pathPath && result.status === 'loading' && <SkeletonBlock lines={4} ariaLabel="Finding path" />}
      {pathPath && result.status === 'error' && <ErrorBanner message={result.message} onRetry={reload} />}
      {pathPath && result.status === 'ok' && (
        <div className="card" style={{ padding: '22px 24px' }}>
          <PathView path={result.data} />
        </div>
      )}
    </>
  )
}