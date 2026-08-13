import type { NextRequest } from 'next/server';

import { dbError, json, notFound, parseLimit } from '@/lib/http';
import { runQuery } from '@/lib/neo4j';
import {
  ENGINEER_BY_LOGIN,
  ENGINEER_INCIDENTS,
  ENGINEER_PRS,
  ENGINEER_REPOS,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ login: string }> },
): Promise<Response> {
  const { login } = await context.params;
  const limit = parseLimit(request.nextUrl.searchParams.get('limit'), 100);
  if (typeof limit !== 'number') return limit;

  try {
    const [engineerRows] = await Promise.all([
      runQuery<Record<string, unknown>>(ENGINEER_BY_LOGIN, { login }),
    ]);
    if (engineerRows.length === 0) return notFound(`engineer "${login}" not found`);

    const [repos, pullRequests, incidents] = await Promise.all([
      runQuery<{ name: string }>(ENGINEER_REPOS, { login }),
      runQuery<{ key: string; title: string; state: string; mergedAt: string | null }>(
        ENGINEER_PRS,
        { login, limit },
      ),
      runQuery<{
        key: string;
        name: string;
        impact: string;
        createdAt: string;
        resolvedAt: string | null;
      }>(ENGINEER_INCIDENTS, { login, limit }),
    ]);

    return json({
      engineer: (engineerRows[0] as Record<string, unknown>).e,
      repos: repos.map((r) => r.name),
      pullRequests,
      incidents,
    });
  } catch (err) {
    return dbError(err);
  }
}