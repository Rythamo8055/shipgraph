import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const fetchMock = vi.fn()
const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response
const failResponse = (status: number) =>
  ({ ok: status < 400, status, json: async () => ({ detail: 'down' }) }) as Response

vi.mock('@/fixtures/mock', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/fixtures/mock')>()
  return { ...actual, mockDelay: () => Promise.resolve() }
})

async function loadApi() {
  vi.resetModules()
  vi.stubGlobal('fetch', fetchMock)
  return await import('../../components/api')
}

function HookHarness({ api }: { api: Awaited<ReturnType<typeof loadApi>> }) {
  const { result, reload } = api.useApi('/engineers')
  return (
    <div data-status={result.status} data-sample={String(result.sample)} data-testid="root">
      <span data-testid="status-text">{result.status === 'ok' ? JSON.stringify(result.data) : String(result.message ?? '')}</span>
      <button type="button" onClick={reload}>
        reload
      </button>
    </div>
  )
}

async function renderHarness() {
  const api = await loadApi()
  render(<HookHarness api={api} />)
  return api
}

describe('api module', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('dbMode resolves live when /api/health reports db up', async () => {
    fetchMock.mockResolvedValue(okResponse({ status: 'ok', db: true, mode: 'live' }))
    const { dbMode } = await loadApi()
    await expect(dbMode()).resolves.toBe('live')
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.anything())
  })

  it('dbMode resolves sample when health reports db down', async () => {
    fetchMock.mockResolvedValue(failResponse(503))
    const { dbMode } = await loadApi()
    await expect(dbMode()).resolves.toBe('sample')
  })

  it('caches the health check across calls', async () => {
    fetchMock.mockResolvedValue(okResponse({ status: 'ok', db: true, mode: 'live' }))
    const { dbMode } = await loadApi()
    await dbMode()
    await dbMode()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('useApi returns live data with sample: false on a 200', async () => {
    fetchMock.mockImplementation((url: string) =>
      url === '/api/health' ? Promise.resolve(okResponse({ db: true })) : Promise.resolve(okResponse({ engineers: [] })),
    )
    await renderHarness()
    await waitFor(() => expect(screen.getByTestId('status-text')).toHaveTextContent('{"engineers":[]}'))
    expect(screen.getByTestId('root')).toHaveAttribute('data-status', 'ok')
    expect(screen.getByTestId('root')).toHaveAttribute('data-sample', 'false')
  })

  it('useApi maps 503 to the db-unreachable message', async () => {
    fetchMock.mockImplementation((url: string) =>
      url === '/api/health' ? Promise.resolve(okResponse({ db: true })) : Promise.resolve(failResponse(503)),
    )
    await renderHarness()
    await waitFor(() => expect(screen.getByTestId('status-text')).toHaveTextContent('Graph database unreachable'))
  })

  it.each([
    [404, 'Not found'],
    [400, 'not valid'],
  ] as const)('useApi maps HTTP %i to a specific message', async (status, expected) => {
    fetchMock.mockImplementation((url: string) =>
      url === '/api/health' ? Promise.resolve(okResponse({ db: true })) : Promise.resolve(failResponse(status)),
    )
    await renderHarness()
    await waitFor(() => expect(screen.getByTestId('status-text')).toHaveTextContent(expected))
  })

  it('falls back to sample data with sample: true when db is down', async () => {
    fetchMock.mockResolvedValue(failResponse(503))
    await renderHarness()
    await waitFor(() => expect(screen.getByTestId('status-text')).toHaveTextContent('"engineers"'))
    expect(screen.getByTestId('root')).toHaveAttribute('data-sample', 'true')
  })

  it('reload re-runs the fetch for the same path', async () => {
    let n = 0
    fetchMock.mockImplementation((url: string) =>
      url === '/api/health'
        ? Promise.resolve(okResponse({ db: true }))
        : Promise.resolve(okResponse({ engineers: n++ === 0 ? [] : ['cached'] })),
    )
    await renderHarness()
    await waitFor(() => expect(screen.getByTestId('status-text')).toHaveTextContent('{"engineers":[]}'))
    const apiCalls = () => fetchMock.mock.calls.filter(([u]) => u === '/api/engineers').length
    const before = apiCalls()
    screen.getByRole('button', { name: 'reload' }).click()
    await waitFor(() => expect(screen.getByTestId('status-text')).toHaveTextContent('"engineers":["cached"]'))
    expect(apiCalls()).toBeGreaterThan(before)
    expect(screen.getByTestId('root')).toHaveAttribute('data-sample', 'false')
  })

  it('searchApi rejects with the db-unreachable message on 503', async () => {
    fetchMock.mockImplementation((url: string) =>
      url === '/api/health' ? Promise.resolve(okResponse({ db: true })) : Promise.resolve(failResponse(503)),
    )
    const { searchApi } = await loadApi()
    await expect(searchApi('tj')).rejects.toThrow('Graph database unreachable')
  })

  it('searchApi returns bundled sample results when db is down', async () => {
    fetchMock.mockResolvedValue(failResponse(503))
    const { searchApi } = await loadApi()
    await expect(searchApi('tj')).resolves.toMatchObject({ results: expect.any(Array) })
  })
})