import type { IncidentRow } from '../../components/types'

export const searchFixtures = [
  { kind: 'Engineer' as const, label: 'tj', sub: 'TJ Holowaychuk — 47 repos' },
  { kind: 'Repo' as const, label: 'expressjs/express', sub: 'Express — 66k stars' },
  { kind: 'Incident' as const, label: 'github|abcd1234', sub: 'API latency spike' },
]

export const incidentFixture = {
  key: 'github|abcd1234',
  name: 'API latency spike',
  status: 'RESOLVED',
  impact: 'major',
  source: 'api.statuspage.com',
  createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  resolvedAt: new Date(Date.now() - 86_400_000).toISOString(),
  services: ['api', 'graphql'],
}

export const incidentSnapshot: IncidentRow = {
  key: incidentFixture.key,
  name: incidentFixture.name,
  impact: incidentFixture.impact as IncidentRow['impact'],
  createdAt: incidentFixture.createdAt,
  resolvedAt: incidentFixture.resolvedAt,
  source: incidentFixture.source,
  services: incidentFixture.services,
}