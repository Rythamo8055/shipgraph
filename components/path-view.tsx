'use client'

import type { Path } from './types'

const relTone: Record<string, string> = {
  AUTHORED: 'tone-graph',
  COMMITTED: 'tone-graph',
  OPENED: 'tone-graph',
  MERGED_BY: 'tone-graph',
  IMPROVED: 'tone-graph',
  INCLUDED: 'tone-graph',
  SHIPPED: 'tone-ship',
  DEPLOYED: 'tone-ship',
  AFFECTED: 'tone-fire',
  RESOLVED_BY: 'tone-fix',
  WORKED_ON: 'tone-fix',
}

export function PathView({ path }: { path: Path }) {
  if (!path.found) {
    return (
      <div className="path-not-found card">
        <p className="path-not-found-title">No path found</p>
        <p className="muted">No connection within 6 hops between these two engineers in the delivery graph.</p>
      </div>
    )
  }

  return (
    <div className="path-view">
      <p className="path-summary" role="status">
        Connection found — <strong>{path.hops}</strong> hop{path.hops === 1 ? '' : 's'}
        {path.hops > 1 ? ' (multi-hop)' : ''} across the delivery graph.
      </p>
      <ol className="path-steps">
        {path.steps.map((step, i) => (
          <li key={i} className="path-step">
            <span className="path-node path-from">{step.from}</span>
            <span className={`path-rel ${relTone[step.rel] ?? 'tone-graph'}`}>
              <span className="path-rel-arrow" aria-hidden="true" />
              <span className="path-rel-name">{step.rel}</span>
              {Object.keys(step.props).length > 0 && (
                <span className="path-props">
                  {Object.entries(step.props)
                    .map(([k, v]) => `${k}=${String(v)}`)
                    .join(' · ')}
                </span>
              )}
            </span>
            <span className="path-node path-to">{step.to}</span>
            {i < path.steps.length - 1 && <span className="path-connector" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </div>
  )
}