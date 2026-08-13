'use client'

import { useState } from 'react'
import { useApi } from '@/components/api'
import type { Incidents, Impact } from '@/components/types'
import { CardSkeleton, EmptyState, ErrorBanner, PageHeader } from '@/components/ui'
import { IncidentCard } from '@/components/incident-card'

const FILTERS: Array<{ value: Impact | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'none', label: 'None' },
]

export default function IncidentsPage() {
  const [impact, setImpact] = useState<Impact | 'all'>('all')
  const { result, reload } = useApi<Incidents>(`/api/incidents${impact === 'all' ? '' : `?impact=${impact}`}`)

  return (
    <>
      <PageHeader
        title="Incidents"
        sub="What broke. Each incident chains back to the releases in its window, the commits that rode them, and the people who shipped them."
      />
      <div className="impact-filter" role="group" aria-label="Filter incidents by impact">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" aria-pressed={impact === f.value} onClick={() => setImpact(f.value)}>
            {f.label}
          </button>
        ))}
      </div>
      {result.status === 'loading' && <CardSkeleton count={6} label="Loading incidents" />}
      {result.status === 'error' && <ErrorBanner message={result.message} onRetry={reload} />}
      {result.status === 'ok' &&
        (result.data.incidents.length === 0 ? (
          <EmptyState
            title={impact === 'all' ? 'No incidents yet' : `No ${impact} incidents`}
            hint={impact === 'all' ? 'Incidents appear here once the graph is loaded.' : 'Try another impact filter.'}
          />
        ) : (
          <div className="section-stack">
            {result.data.incidents.map((i) => (
              <IncidentCard key={i.key} incident={i} />
            ))}
          </div>
        ))}
    </>
  )
}