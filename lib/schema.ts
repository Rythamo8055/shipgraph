/**
 * ShipGraph schema constants.
 * Single source of truth per CONTRACT.md. Relationship type names appear
 * in Cypher ONLY via these constants (hard rule 1 & 2). No string literals
 * for labels/relationship types anywhere else in lib/ or app/api/.
 */

export const LABELS = {
  Engineer: 'Engineer',
  Repo: 'Repo',
  PullRequest: 'PullRequest',
  Commit: 'Commit',
  Release: 'Release',
  Incident: 'Incident',
  Service: 'Service',
} as const;

export type NodeLabel = (typeof LABELS)[keyof typeof LABELS];

/** Node key properties (unique constraint targets, CONTRACT.md node table). */
export const KEYS = {
  Engineer: 'login',
  Repo: 'name',
  PullRequest: 'key',
  Commit: 'key',
  Release: 'key',
  Incident: 'key',
  Service: 'key',
} as const;

export const RELS = {
  AUTHORED: 'AUTHORED',
  COMMITTED: 'COMMITTED',
  OPENED: 'OPENED',
  MERGED_BY: 'MERGED_BY',
  IMPROVED: 'IMPROVED',
  INCLUDED: 'INCLUDED',
  SHIPPED: 'SHIPPED',
  DEPLOYED: 'DEPLOYED',
  AFFECTED: 'AFFECTED',
  RESOLVED_BY: 'RESOLVED_BY',
  WORKED_ON: 'WORKED_ON',
} as const;

export type RelType = (typeof RELS)[keyof typeof RELS];

/** Relationship types allowed inside the shortestPath whitelist (CONTRACT path endpoint). */
export const PATH_WHITELIST: readonly RelType[] = [
  RELS.AUTHORED,
  RELS.COMMITTED,
  RELS.OPENED,
  RELS.MERGED_BY,
  RELS.IMPROVED,
  RELS.INCLUDED,
  RELS.SHIPPED,
  RELS.DEPLOYED,
  RELS.AFFECTED,
  RELS.RESOLVED_BY,
  RELS.WORKED_ON,
];

/** Heuristic (derived) relationship types — carry heuristic:true per CONTRACT. */
export const HEURISTIC_RELS: ReadonlySet<RelType> = new Set<RelType>([
  RELS.SHIPPED,
  RELS.DEPLOYED,
  RELS.RESOLVED_BY,
  RELS.WORKED_ON,
]);

/** Service mapping direction is owned by Agent A (scripts/acquire/mapping.py). */
export const MAPPING_OWNER = 'scripts/acquire/mapping.py';

/** Canonical names per mission spec (aliases of the single source of truth). */
export const NODE_LABELS = LABELS;
export const REL_TYPES = RELS;