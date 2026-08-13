'use client'

import { useApi } from '@/components/api'
import type { About } from '@/components/types'
import { CardSkeleton, CopyButton, ErrorBanner, PageHeader } from '@/components/ui'

export default function QueriesPage() {
  const { result, reload } = useApi<About>('/about')

  return (
    <>
      <PageHeader
        title="Queries behind the app"
        sub="Every endpoint is backed by a parameterised Cypher query — no user input ever reaches the database as free-form Cypher. Copy any query and read exactly what the graph is asked."
      />
      {result.status === 'loading' && <CardSkeleton count={5} label="Loading queries" />}
      {result.status === 'error' && <ErrorBanner message={result.message} onRetry={reload} />}
      {result.status === 'ok' &&
        (result.data.queries.length === 0 ? (
          <p className="muted note">No queries registered yet.</p>
        ) : (
          <div className="section-stack">
            {result.data.queries.map((q) => (
              <article key={q.name} className="card query-card">
                <div className="query-head">
                  <h2>{q.name}</h2>
                  <p>{q.description}</p>
                </div>
                <div className="query-body">
                  <div className="query-params">
                    {q.params.length === 0 ? (
                      <span className="param-chip">no parameters</span>
                    ) : (
                      q.params.map((p) => (
                        <span key={p} className="param-chip">
                          ${p}
                        </span>
                      ))
                    )}
                  </div>
                  <pre className="query-cypher">{q.cypher}</pre>
                  <CopyButton text={q.cypher} />
                </div>
              </article>
            ))}
          </div>
        ))}
    </>
  )
}