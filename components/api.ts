import { useCallback, useEffect, useRef, useState } from 'react'
import { EXPLICIT_MOCK, getMock, mockDelay } from '@/fixtures/mock'

export type Mode = 'checking' | 'live' | 'sample'

let healthPromise: Promise<boolean> | null = null

function pingHealth(): Promise<boolean> {
  if (EXPLICIT_MOCK) return Promise.resolve(false)
  if (!healthPromise) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    healthPromise = fetch('/api/health', { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) return false
        try {
          const body = (await r.json()) as { db?: boolean }
          return body.db !== false
        } catch {
          return true
        }
      })
      .catch(() => false)
      .finally(() => clearTimeout(timer))
  }
  return healthPromise
}

export async function dbMode(): Promise<Mode> {
  const up = await pingHealth()
  return up ? 'live' : 'sample'
}

export type Result<T> =
  | { status: 'loading'; sample: boolean }
  | { status: 'ok'; data: T; sample: boolean }
  | { status: 'error'; message: string; code: number | null; sample: boolean }

function withApiPrefix(path: string): string {
  return path.startsWith('/api/') ? path : `/api${path}`
}

export function useApi<T>(path: string | null): { result: Result<T>; reload: () => void } {
  const [tick, setTick] = useState(0)
  const [result, setResult] = useState<Result<T>>({ status: 'loading', sample: false })
  const pathRef = useRef(path)

  useEffect(() => {
    pathRef.current = path
  }, [path])

  useEffect(() => {
    if (!path) return
    const ctrl = new AbortController()
    setResult({ status: 'loading', sample: false })
    const apiPath = withApiPrefix(path)

    void (async () => {
      try {
        if (await pingHealth()) {
          const res = await fetch(apiPath, { signal: ctrl.signal })
          if (ctrl.signal.aborted) return
          if (!res.ok) {
            let message = 'Request failed (HTTP ' + res.status + ').'
            if (res.status === 503) message = 'Graph database unreachable — check the server, then retry.'
            if (res.status === 404) message = 'Not found — this may have changed in the database.'
            if (res.status === 400) message = 'The request was not valid.'
            setResult({ status: 'error', message, code: res.status, sample: false })
            return
          }
          setResult({ status: 'ok', data: (await res.json()) as T, sample: false })
          return
        }

        await mockDelay()
        if (ctrl.signal.aborted) return
        const entry = getMock(apiPath, null)
        if (!entry) {
          setResult({ status: 'error', message: 'No sample data for this endpoint.', code: 404, sample: true })
          return
        }
        if (entry.status !== 200) {
          setResult({ status: 'error', message: 'Sample data missing.', code: entry.status, sample: true })
          return
        }
        setResult({ status: 'ok', data: entry.body as T, sample: true })
      } catch (err) {
        if (ctrl.signal.aborted) return
        const message = err instanceof Error && err.name === 'AbortError' ? 'Request timed out.' : 'Could not reach the API.'
        setResult({ status: 'error', message, code: null, sample: false })
      }
    })()

    return () => ctrl.abort()
  }, [path, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  return { result, reload }
}

export function useMode(): Mode {
  const [mode, setMode] = useState<Mode>('checking')
  useEffect(() => {
    let alive = true
    void dbMode().then((m) => {
      if (alive) setMode(m)
    })
    return () => {
      alive = false
    }
  }, [])
  return mode
}

export function searchApi(q: string, signal?: AbortSignal): Promise<import('@/components/types').SearchResults> {
  void signal
  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        if (await pingHealth()) {
          const ctrl = signal ? { signal } : {}
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, ctrl)
          if (!res.ok) {
            if (res.status === 503) reject(new Error('Graph database unreachable — check the server, then retry.'))
            else reject(new Error('Search failed (HTTP ' + res.status + ').'))
            return
          }
          resolve((await res.json()) as import('@/components/types').SearchResults)
          return
        }
        await mockDelay()
        const entry = getMock('/api/search', `q=${encodeURIComponent(q)}`)
        resolve((entry?.body ?? { results: [] }) as import('@/components/types').SearchResults)
      } catch (err) {
        reject(err)
      }
    })()
  })
}