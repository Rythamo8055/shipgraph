'use client'

import Link from 'next/link'
import type { IncidentRow } from './types'
import { ImpactChip, StatusPill } from './ui'
import { fmtRelative } from './format'

export function IncidentCard({ incident }: { incident: IncidentRow }) {
  return (
    <Link className="card incident-card" href={`/incidents/${encodeURIComponent(incident.key)}`}>
      <div className="incident-head">
        <ImpactChip impact={incident.impact} />
        <StatusPill resolved={Boolean(incident.resolvedAt)} />
        <span className="incident-ago">{fmtRelative(incident.createdAt)}</span>
      </div>
      <h3 className="incident-name">{incident.name}</h3>
      <div className="incident-meta">
        <span className="incident-source">{incident.source}</span>
        {incident.services.map((s) => (
          <span key={s} className="chip service-chip">
            {s}
          </span>
        ))}
      </div>
    </Link>
  )
}