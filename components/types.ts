export type Impact = 'critical' | 'major' | 'minor' | 'none' | 'maintenance'

export interface Stats {
  nodes: Record<string, number>
  edges: Record<string, number>
  totalNodes: number
  totalEdges: number
}

export interface SearchResult {
  kind: 'Engineer' | 'Repo' | 'PullRequest' | 'Incident' | 'Service'
  label: string
  sub: string
}

export interface SearchResults {
  results: SearchResult[]
}

export interface EngineerRow {
  login: string
  name?: string
  avatarUrl?: string
  repos: number
  prs: number
  commits: number
  incidents: number
}

export interface Engineers {
  engineers: EngineerRow[]
}

export interface PullRequestSummary {
  key: string
  title: string
  state: string
  mergedAt: string | null
}

export interface EngineerIncidentSummary {
  key: string
  name: string
  impact: Impact
  createdAt: string
  resolvedAt: string | null
}

export interface EngineerDetail {
  engineer: { login: string; name?: string; avatarUrl?: string }
  repos: string[]
  pullRequests: PullRequestSummary[]
  incidents: EngineerIncidentSummary[]
}

export interface RepoRow {
  name: string
  language?: string
  stars: number
  pushedAt: string
  owners: string[]
}

export interface Repos {
  repos: RepoRow[]
}

export interface ContributorRow {
  login: string
  contributions: number
}

export interface RepoDetail {
  repo: {
    name: string
    owner?: string
    language?: string
    stars: number
    createdAt?: string | null
    pushedAt: string
    defaultBranch?: string
  }
  contributors: ContributorRow[]
  releases: Array<{ tagName: string; publishedAt: string }>
  prs: number
}

export interface IncidentRow {
  key: string
  name: string
  source: string
  impact: Impact
  createdAt: string
  resolvedAt: string | null
  services: string[]
}

export interface Incidents {
  incidents: IncidentRow[]
}

export interface ChainRelease {
  tagName: string
  repo: string
  publishedAt: string
}

export interface ChainCommit {
  sha: string
  message: string
  authoredAt: string
}

export interface IncidentDetail {
  incident: {
    key: string
    name: string
    source: string
    status: string
    impact: Impact
    createdAt: string
    resolvedAt: string | null
    url?: string | null
  }
  services: string[]
  chain: {
    releases: ChainRelease[]
    commits: ChainCommit[]
    engineers: string[]
  }
}

export interface Blast {
  release: { tagName: string; publishedAt: string | null }
  services: string[]
  incidents: string[]
}

export interface PathStep {
  from: string
  rel: string
  to: string
  props: Record<string, string | number | boolean>
}

export interface Path {
  found: boolean
  hops: number
  steps: PathStep[]
}

export interface AboutQuery {
  name: string
  description: string
  cypher: string
  params: string[]
}

export interface About {
  queries: AboutQuery[]
}