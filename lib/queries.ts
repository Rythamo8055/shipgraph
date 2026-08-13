import { LABELS, PATH_WHITELIST, RELS } from '@/lib/schema';

/**
 * All ShipGraph Cypher. HARD RULES:
 * - No string interpolation except relationship-type constants from lib/schema.ts
 *   (single ${} site: PATH_PATTERN, built from PATH_WHITELIST.join('|')).
 * - Relationship type names only from lib/schema.ts (or the contract-verbatim
 *   flagship query that must exist exactly as written).
 * - No CALL / UNION / subqueries — plain MATCH/WHERE/RETURN/ORDER/LIMIT/
 *   aggregation/shortestPath only (CognoDB openCypher safety).
 * - No Cypher keyword ever shares a line with a ${} interpolation.
 */

// ---------------------------------------------------------------------------
// Flagship (CONTRACT.md, verbatim, parameterised)
// ---------------------------------------------------------------------------

export const FLAGSHIP_INCIDENT_CHAIN = `
MATCH (i:Incident {key:$incidentKey})-[:AFFECTED]->(s:Service)<-[:DEPLOYED]-(rel:Release)
MATCH (rel)-[:SHIPPED]->(pr:PullRequest)-[:INCLUDED]->(c:Commit)<-[:AUTHORED]-(e:Engineer)
RETURN i.key AS incident, rel.tagName AS release, pr.number AS pr, e.login AS engineer, c.key AS commit
ORDER BY c.authoredAt LIMIT 20
`;

// ---------------------------------------------------------------------------
// Health / stats
// ---------------------------------------------------------------------------

/** Node counts per label. */
export const STATS_NODES = `
MATCH (n)
RETURN labels(n)[0] AS label, count(*) AS count
ORDER BY label
`;

/** Edge counts per relationship type. */
export const STATS_EDGES = `
MATCH ()-[r]->()
RETURN type(r) AS rel, count(*) AS count
ORDER BY rel
`;

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export const SEARCH = `
MATCH (n)
WHERE toLower(labels(n)[0]) CONTAINS $q
   OR toLower(n.login) CONTAINS $q
   OR toLower(n.name) CONTAINS $q
   OR toLower(n.key) CONTAINS $q
   OR toLower(n.title) CONTAINS $q
RETURN labels(n)[0] AS kind,
       n.login AS login, n.name AS name, n.key AS key, n.title AS title,
       n.language AS language, n.owner AS owner, n.source AS source
ORDER BY n.createdAt DESC, n.stars DESC, n.publishedAt DESC
LIMIT $limit
`;

// ---------------------------------------------------------------------------
// Engineers
// ---------------------------------------------------------------------------

/** Base engineer list (keys + display props). */
export const ENGINEERS_LIST = `
MATCH (e:Engineer)
RETURN e.login AS login, e.name AS name, e.avatarUrl AS avatarUrl
ORDER BY e.login
LIMIT $limit
`;

/** Per-engineer repo count via WORKED_ON. */
export const ENGINEER_REPO_COUNTS = `
MATCH (e:Engineer)-[:WORKED_ON]->(r:Repo)
RETURN e.login AS login, count(r) AS count
`;

/** Per-engineer PR count via OPENED. */
export const ENGINEER_PR_COUNTS = `
MATCH (e:Engineer)-[:OPENED]->(p:PullRequest)
RETURN e.login AS login, count(p) AS count
`;

/** Per-engineer commit count via AUTHORED. */
export const ENGINEER_COMMIT_COUNTS = `
MATCH (e:Engineer)-[:AUTHORED]->(c:Commit)
RETURN e.login AS login, count(c) AS count
`;

/** Per-engineer incident count via RESOLVED_BY. */
export const ENGINEER_INCIDENT_COUNTS = `
MATCH (e:Engineer)-[:RESOLVED_BY]->(i:Incident)
RETURN e.login AS login, count(i) AS count
`;

/** Single engineer. */
export const ENGINEER_BY_LOGIN = `
MATCH (e:Engineer {login:$login})
RETURN e
`;

/** Repos an engineer worked on (name + contribution weight). */
export const ENGINEER_REPOS = `
MATCH (e:Engineer {login:$login})-[:WORKED_ON]->(r:Repo)
RETURN r.name AS name
ORDER BY r.name
`;

/** Pull requests an engineer opened. */
export const ENGINEER_PRS = `
MATCH (e:Engineer {login:$login})-[:OPENED]->(p:PullRequest)
RETURN p.key AS key, p.title AS title, p.state AS state, p.mergedAt AS mergedAt
ORDER BY p.createdAt DESC
LIMIT $limit
`;

/** Incidents an engineer resolved (RESOLVED_BY heuristic edge). */
export const ENGINEER_INCIDENTS = `
MATCH (e:Engineer {login:$login})-[:RESOLVED_BY]->(i:Incident)
RETURN i.key AS key, i.name AS name, i.impact AS impact,
       i.createdAt AS createdAt, i.resolvedAt AS resolvedAt
ORDER BY i.createdAt DESC
LIMIT $limit
`;

// ---------------------------------------------------------------------------
// Repos
// ---------------------------------------------------------------------------

/** Base repo list. */
export const REPOS_LIST = `
MATCH (r:Repo)
RETURN r.name AS name, r.language AS language, r.stars AS stars, r.pushedAt AS pushedAt
ORDER BY r.stars DESC, r.name
LIMIT $limit
`;

/** Owner (contributor) logins + contributions per repo, heaviest first. */
export const REPO_CONTRIBUTORS = `
MATCH (e:Engineer)-[c:WORKED_ON]->(r:Repo)
RETURN r.name AS repo, e.login AS login, c.contributions AS contributions
ORDER BY c.contributions DESC
`;

/** Single repo. */
export const REPO_BY_NAME = `
MATCH (r:Repo {name:$name})
RETURN r
`;

/** Releases shipped to a repo. */
export const REPO_RELEASES = `
MATCH (rel:Release)-[:SHIPPED]->(r:Repo {name:$name})
RETURN rel.tagName AS tagName, rel.publishedAt AS publishedAt
ORDER BY rel.publishedAt DESC
LIMIT $limit
`;

/** PR count for a repo via IMPROVED. */
export const REPO_PRS_COUNT = `
MATCH (p:PullRequest)-[:IMPROVED]->(r:Repo {name:$name})
RETURN count(p) AS n
`;

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------

/** Incident list, optional impact filter. */
export const INCIDENTS_LIST = `
MATCH (i:Incident)
WHERE $impact = '' OR i.impact = $impact
RETURN i.key AS key, i.name AS name, i.source AS source, i.impact AS impact,
       i.createdAt AS createdAt, i.resolvedAt AS resolvedAt
ORDER BY i.createdAt DESC
LIMIT $limit
`;

/** Service names affected per incident. */
export const INCIDENT_SERVICES = `
MATCH (i:Incident)-[:AFFECTED]->(s:Service)
RETURN i.key AS key, s.name AS name
ORDER BY s.name
`;

/** Single incident. */
export const INCIDENT_BY_KEY = `
MATCH (i:Incident {key:$key})
RETURN i
`;

/**
 * Releases inside the incident launch window [startedAt-6h, resolvedAt+6h]
 * that are linked into the commit graph via SHIPPED -> INCLUDED.
 * Window bounds are computed in JS and passed as params (ISO-8601 string
 * compare is safe per CONTRACT rule 4; $windowEnd may be null for open
 * incidents).
 */
export const INCIDENT_CHAIN_RELEASES = `
MATCH (rel:Release)-[:SHIPPED]->(pr:PullRequest)-[:INCLUDED]->(c:Commit)
WHERE rel.publishedAt >= $windowStart
  AND ($windowEnd = '' OR rel.publishedAt <= $windowEnd)
RETURN DISTINCT rel.tagName AS tagName, rel.repo AS repo, rel.publishedAt AS publishedAt
ORDER BY rel.publishedAt
`;

/** Commits reached through window releases (SHIPPED -> INCLUDED). */
export const INCIDENT_CHAIN_COMMITS = `
MATCH (rel:Release)-[:SHIPPED]->(pr:PullRequest)-[:INCLUDED]->(c:Commit)
WHERE rel.publishedAt >= $windowStart
  AND ($windowEnd = '' OR rel.publishedAt <= $windowEnd)
RETURN DISTINCT c.sha AS sha, c.message AS message, c.authoredAt AS authoredAt
ORDER BY c.authoredAt
LIMIT $limit
`;

/** Engineers who authored chain commits. */
export const INCIDENT_CHAIN_ENGINEERS = `
MATCH (c:Commit)<-[:AUTHORED]-(e:Engineer)
WHERE c.sha IN $shas
RETURN DISTINCT e.login AS login
ORDER BY e.login
`;

// ---------------------------------------------------------------------------
// Blast radius
// ---------------------------------------------------------------------------

/** Most recent release of a repo (blast anchor). */
export const BLAST_RELEASE = `
MATCH (rel:Release)-[:SHIPPED]->(r:Repo {name:$name})
RETURN rel.key AS key, rel.tagName AS tagName, rel.publishedAt AS publishedAt
ORDER BY rel.publishedAt DESC
LIMIT 1
`;

/** Services a release deployed to (DEPLOYED heuristic edges). */
export const BLAST_SERVICES = `
MATCH (rel:Release {key:$key})-[:DEPLOYED]->(s:Service)
RETURN s.name AS name
ORDER BY s.name
`;

/** Incidents touching those services (AFFECTED). */
export const BLAST_INCIDENTS = `
MATCH (rel:Release {key:$key})-[:DEPLOYED]->(s:Service)<-[:AFFECTED]-(i:Incident)
RETURN DISTINCT i.key AS key
ORDER BY i.key
`;

// ---------------------------------------------------------------------------
// Shortest path
// ---------------------------------------------------------------------------

/** One candidate start node by any key-style property. */
export const NODE_BY_ANY_KEY = `
MATCH (n)
WHERE n.login = $id OR n.name = $id OR n.key = $id
RETURN n
LIMIT 1
`;

/**
 * Relationship-type alternation for the path whitelist. The single ${}
 * interpolation in the codebase; built ONLY from lib/schema.ts constants
 * (PATH_WHITELIST), never from user input. The literal contains no Cypher
 * keyword, so no keyword ever shares a line with an interpolation.
 */
const PATH_PATTERN = `[:${PATH_WHITELIST.join('|')}*1..6]`;

/** shortestPath clause assembled from plain keyword line + schema-derived pattern. */
// Undirected: relationship direction varies per hop type (e.g. WORKED_ON
// Engineer->Repo then back Repo<-WORKED_ON Engineer), so the pattern must
// not impose a single traversal direction or Engineer pairs never connect.
const PATH_MATCH_LINE = ['MATCH p = shortestPath((a)-', PATH_PATTERN, '-(b))'].join('');

/**
 * shortestPath over the full whitelist, depth 1..6.
 * No ${} inside the array elements (PATH_PATTERN carries it); no '+' anywhere.
 */
export const PATH_QUERY = [
  'MATCH (a) WHERE a.login = $from OR a.name = $from OR a.key = $from',
  'MATCH (b) WHERE b.login = $to OR b.name = $to OR b.key = $to',
  PATH_MATCH_LINE,
  'RETURN p, length(p) AS hops',
  'LIMIT 1',
].join('\n');

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------

export interface AboutQuery {
  name: string;
  description: string;
  cypher: string;
  params: string[];
}

export const ABOUT_QUERIES: AboutQuery[] = [
  {
    name: 'stats',
    description: 'Node counts per label and edge counts per relationship type.',
    cypher: [STATS_NODES, STATS_EDGES].join('\n'),
    params: [],
  },
  {
    name: 'search',
    description: 'Case-insensitive prefix/contains search across all node kinds.',
    cypher: SEARCH,
    params: ['q', 'limit'],
  },
  {
    name: 'engineers',
    description: 'Engineer list plus per-engineer repo/PR/commit/incident counts.',
    cypher: [
      ENGINEERS_LIST,
      ENGINEER_REPO_COUNTS,
      ENGINEER_PR_COUNTS,
      ENGINEER_COMMIT_COUNTS,
      ENGINEER_INCIDENT_COUNTS,
    ].join('\n'),
    params: ['limit'],
  },
  {
    name: 'engineer',
    description: 'Engineer profile: node, repos, opened pull requests, resolved incidents.',
    cypher: [
      ENGINEER_BY_LOGIN,
      ENGINEER_REPOS,
      ENGINEER_PRS,
      ENGINEER_INCIDENTS,
    ].join('\n'),
    params: ['login', 'limit'],
  },
  {
    name: 'repos',
    description: 'Repo list with owner logins and contributions.',
    cypher: [REPOS_LIST, REPO_CONTRIBUTORS].join('\n'),
    params: ['limit'],
  },
  {
    name: 'repo',
    description: 'Repo detail: node, contributors, releases, PR count.',
    cypher: [REPO_BY_NAME, REPO_CONTRIBUTORS, REPO_RELEASES, REPO_PRS_COUNT].join('\n'),
    params: ['name', 'limit'],
  },
  {
    name: 'incidents',
    description: 'Incident list, optionally filtered by impact, with affected services.',
    cypher: [INCIDENTS_LIST, INCIDENT_SERVICES].join('\n'),
    params: ['impact', 'limit'],
  },
  {
    name: 'incident',
    description:
      'Incident detail with chain: launches in [startedAt-6h, resolvedAt+6h] window linked via SHIPPED -> INCLUDED -> AUTHORED.',
    cypher: [
      INCIDENT_BY_KEY,
      INCIDENT_SERVICES,
      INCIDENT_CHAIN_RELEASES,
      INCIDENT_CHAIN_COMMITS,
      INCIDENT_CHAIN_ENGINEERS,
    ].join('\n'),
    params: ['key', 'windowStart', 'windowEnd', 'shas', 'limit'],
  },
  {
    name: 'blast',
    description:
      'Blast radius: latest release -> DEPLOYED services -> AFFECTED incidents (multi-hop proof).',
    cypher: [BLAST_RELEASE, BLAST_SERVICES, BLAST_INCIDENTS].join('\n'),
    params: ['name', 'key'],
  },
  {
    name: 'challenge',
    description: 'Flagship: shortest cross-entity incident chain query.',
    cypher: FLAGSHIP_INCIDENT_CHAIN,
    params: ['incidentKey'],
  },
  {
    name: 'path',
    description: `shortestPath over ${PATH_WHITELIST.length} whitelisted relationship types, depth 1..6.`,
    cypher: PATH_QUERY,
    params: ['from', 'to'],
  },
];

export const LABEL_NAMES: readonly string[] = Object.values(LABELS);
export const REL_NAMES: readonly string[] = Object.values(RELS);