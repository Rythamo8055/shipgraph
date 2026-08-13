'use client'

import { useMode } from './api'

export function ModePill() {
  const mode = useMode()

  if (mode === 'checking') {
    return (
      <span className="mode-pill mode-checking" title="Checking database connection…">
        <span className="mode-dot" aria-hidden="true" />
        checking…
      </span>
    )
  }
  if (mode === 'live') {
    return (
      <span className="mode-pill mode-live" title="Connected to the live delivery graph database.">
        <span className="mode-dot" aria-hidden="true" />
        live database
      </span>
    )
  }
  return (
    <span className="mode-pill mode-sample" title="The live database is not reachable right now, so this view shows bundled sample data from fixtures/. Everything is clearly a demo.">
      <span className="mode-dot" aria-hidden="true" />
      sample data mode
    </span>
  )
}