import type { NextRequest } from 'next/server';

import { dbError, json, parseLimit } from '@/lib/http';
import { runQuery } from '@/lib/neo4j';
import {
  ENGINEER_COMMIT_COUNTS,
  ENGINEER_INCIDENT_COUNTS,
  ENGINEER_PR_COUNTS,
  ENGINEER_REPO_COUNTS,
  ENGINEERS_LIST,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  const limit = parseLimit(request.nextUrl.searchParams.get('limit'), 40);
  if (typeof limit !== 'number') return limit;

  try {
    const [list, repos, prs, commits, incidents] = await Promise.all([
      runQuery<{ login: string; name: string | null; avatarUrl: string | null }>(
        ENGINEERS_LIST,
        { limit },
      ),
      runQuery<{ login: string; count: number }>(ENGINEER_REPO_COUNTS),
      runQuery<{ login: string; count: number }>(ENGINEER_PR_COUNTS),
      runQuery<{ login: string; count: number }>(ENGINEER_COMMIT_COUNTS),
      runQuery<{ login: string; count: number }>(ENGINEER_INCIDENT_COUNTS),
    ]);

    const countBy = (rows: { login: string; count: number }[], lookup: Set<string>) => {
      const map = new Map<string, number>();
      for (const row of rows) if (lookup.has(row.login)) map.set(row.login, row.count);
      return map;
    };
    const logins = new Set(list.map((r) => r.login));
    const repoMap = countBy(repos, logins);
    const prMap = countBy(prs, logins);
    const commitMap = countBy(commits, logins);
    const incidentMap = countBy(incidents, logins);

    const engineers = list.map((row) => {
      const out: Record<string, unknown> = {
        login: row.login,
        repos: repoMap.get(row.login) ?? 0,
        prs: prMap.get(row.login) ?? 0,
        commits: commitMap.get(row.login) ?? 0,
        incidents: incidentMap.get(row.login) ?? 0,
      };
      if (row.name !== null && row.name !== undefined) out.name = row.name;
      if (row.avatarUrl !== null && row.avatarUrl !== undefined) out.avatarUrl = row.avatarUrl;
      return out;
    });

    return json({ engineers });
  } catch (err) {
    return dbError(err);
  }
}