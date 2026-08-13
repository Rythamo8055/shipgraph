'use client'

import { use } from 'react'
import Link from 'next/link'
import { useApi } from '@/components/api'
import type { IncidentDetail } from '@/components/types'
import { ErrorBanner, SkeletonBlock } from '@/components/ui'
import { ChainView } from '@/components/chain-view'

export default function IncidentDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params)
  const { result, reload } = useApi<IncidentDetail>(`/incidents/${encodeURIComponent(key)}`)

  return (
    <>
      <p className="breadcrumbs">
        <Link href="/incidents">Incidents</Link> · <span>{key}</span>
      </p>
      {result.status === 'loading' && <SkeletonBlock lines={6} ariaLabel="Loading incident chain" />}
      {result.status === 'error' && <ErrorBanner message={result.message} onRetry={reload} />}
      {result.status === 'ok' && <ChainView detail={result.data} />}
    </>
  )
}