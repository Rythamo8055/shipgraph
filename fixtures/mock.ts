import type { Stats, SearchResults, Engineers, EngineerDetail, Repos, RepoDetail, Incidents, IncidentDetail, Blast, Path, About } from '@/components/types'
import health from './health.json'
import stats from './stats.json'
import search from './search.json'
import engineers from './engineers.json'
import repos from './repos.json'
import incidents from './incidents.json'
import about from './about.json'
import pathDefault from './path.json'
import pathMultiHop from './path-tj-mitchellh.json'
import blastExpress from './blast-express.json'
import blastConsul from './blast-consul.json'
import engineerTj from './engineers/tj.json'
import engineerDoug from './engineers/dougwilson.json'
import engineerMitchell from './engineers/mitchellh.json'
import repoExpress from './repos/express.json'
import repoVite from './repos/vite.json'
import repoTerraform from './repos/terraform.json'
import incidentApi from './incidents/y3b4qlwp28jy.json'
import incidentGit from './incidents/jq9l5zqcdb9v.json'

export type MockEntry = { status: number; body: unknown }

const SAMPLE_DELAY_MS = 220

export function mockDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, SAMPLE_DELAY_MS))
}

const engineerDetails: Record<string, EngineerDetail> = {
  tj: engineerTj as unknown as EngineerDetail,
  dougwilson: engineerDoug as unknown as EngineerDetail,
  mitchellh: engineerMitchell as unknown as EngineerDetail,
}

const repoDetails: Record<string, RepoDetail> = {
  express: repoExpress as unknown as RepoDetail,
  vite: repoVite as unknown as RepoDetail,
  terraform: repoTerraform as unknown as RepoDetail,
}

const incidentDetails: Record<string, IncidentDetail> = {
  y3b4qlwp28jy: incidentApi as unknown as IncidentDetail,
  jq9l5zqcdb9v: incidentGit as unknown as IncidentDetail,
}

const blasts: Record<string, Blast> = {
  express: blastExpress as unknown as Blast,
  body_parser: blastConsul as unknown as Blast,
  morgan: blastExpress as unknown as Blast,
  vite: blastExpress as unknown as Blast,
  terraform: blastConsul as unknown as Blast,
  vault: blastConsul as unknown as Blast,
  consul: blastConsul as unknown as Blast,
  nomad: blastConsul as unknown as Blast,
}

export function getMock(pathname: string, searchParams: string | null): MockEntry | null {
  const params = new URLSearchParams(searchParams ?? '')
  const segments = pathname.split('/').filter(Boolean)

  if (pathname === '/api/health') return { status: 200, body: health }

  if (pathname === '/api/stats') return { status: 200, body: stats }

  if (pathname === '/api/search') {
    const q = (params.get('q') ?? '').toLowerCase().trim()
    const all = (search as SearchResults).results
    const filtered = q
      ? all.filter((r) => r.label.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q) || r.kind.toLowerCase().includes(q))
      : all.slice(0, 8)
    return { status: 200, body: { results: filtered.slice(0, 12) } }
  }

  if (pathname === '/api/engineers') {
    const limit = Number(params.get('limit') ?? 25)
    const list = (engineers as Engineers).engineers.slice(0, limit)
    return { status: 200, body: { engineers: list } }
  }

  if (segments.length === 3 && segments[1] === 'engineers') {
    const login = decodeURIComponent(segments[2])
    const detail = engineerDetails[login]
    if (detail) return { status: 200, body: detail }
    const row = (engineers as Engineers).engineers.find((e) => e.login === login)
    if (row)
      return {
        status: 200,
        body: {
          engineer: { login: row.login, name: row.name, avatarUrl: row.avatarUrl },
          repos: [],
          pullRequests: [],
          incidents: [],
        } satisfies EngineerDetail,
      }
    return { status: 404, body: { detail: 'Engineer not found' } }
  }

  if (pathname === '/api/repos') {
    const limit = Number(params.get('limit') ?? 25)
    return { status: 200, body: { repos: (repos as Repos).repos.slice(0, limit) } }
  }

  if (segments.length === 3 && segments[1] === 'repos') {
    const name = decodeURIComponent(segments[2])
    const detail = repoDetails[name]
    if (detail) return { status: 200, body: detail }
    const row = (repos as Repos).repos.find((r) => r.name === name)
    if (row)
      return {
        status: 200,
        body: { repo: { ...row, owner: 'unknown', createdAt: null, defaultBranch: 'main' }, contributors: [], releases: [], prs: 0 } satisfies RepoDetail,
      }
    return { status: 404, body: { detail: 'Repo not found' } }
  }

  if (pathname === '/api/incidents') {
    const impact = params.get('impact') ?? 'all'
    const list = (incidents as Incidents).incidents
    const filtered = impact === 'all' ? list : list.filter((i) => i.impact === impact)
    return { status: 200, body: { incidents: filtered } }
  }

  if (segments.length === 3 && segments[1] === 'incidents') {
    const key = decodeURIComponent(segments[2])
    const detail = incidentDetails[key]
    if (detail) return { status: 200, body: detail }
    const row = (incidents as Incidents).incidents.find((i) => i.key === key)
    if (row)
      return {
        status: 200,
        body: {
          incident: { key: row.key, source: row.source, name: row.name, status: row.resolvedAt ? 'resolved' : 'ongoing', impact: row.impact, createdAt: row.createdAt, resolvedAt: row.resolvedAt, url: null },
          services: row.services,
          chain: { releases: [], commits: [], engineers: [] },
        } satisfies IncidentDetail,
      }
    return { status: 404, body: { detail: 'Incident not found' } }
  }

  if (pathname === '/api/blast') {
    const repo = params.get('repo') ?? ''
    const blast = blasts[repo]
    if (blast) return { status: 200, body: blast }
    return {
      status: 200,
      body: { release: { tagName: 'HEAD', publishedAt: null }, services: [], incidents: [] } satisfies Blast,
    }
  }

  if (pathname === '/api/path') {
    const from = params.get('from') ?? ''
    const to = params.get('to') ?? ''
    if ((from === 'dougwilson' && to === 'tj') || (from === 'tj' && to === 'dougwilson')) return { status: 200, body: pathDefault }
    if ((from === 'tj' && to === 'mitchellh') || (from === 'mitchellh' && to === 'tj')) return { status: 200, body: pathMultiHop }
    return { status: 200, body: { found: false, hops: 0, steps: [] } satisfies Path }
  }

  if (pathname === '/api/about') return { status: 200, body: about }

  return null
}

export const EXPLICIT_MOCK = process.env.NEXT_PUBLIC_MOCK === '1'