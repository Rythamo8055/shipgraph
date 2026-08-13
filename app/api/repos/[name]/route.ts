import type { NextRequest } from 'next/server';

import { dbError, json, notFound, parseLimit } from '@/lib/http';
import { runQuery } from '@/lib/neo4j';
import { REPO_BY_NAME, REPO_CONTRIBUTORS, REPO_PRS_COUNT, REPO_RELEASES } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ name: string }> },
): Promise<Response> {
  const { name } = await context.params;
  const limit = parseLimit(request.nextUrl.searchParams.get('limit'), 50);
  if (typeof limit !== 'number') return limit;

  try {
    const [repoRows, contributors, releases, prs] = await Promise.all([
      runQuery<Record<string, unknown>>(REPO_BY_NAME, { name }),
      runQuery<{ repo: string; login: string; contributions: number }>(REPO_CONTRIBUTORS),
      runQuery<{ tagName: string; publishedAt: string }>(REPO_RELEASES, { name, limit }),
      runQuery<{ n: number }>(REPO_PRS_COUNT, { name }),
    ]);
    if (repoRows.length === 0) return notFound(`repo "${name}" not found`);

    return json({
      repo: (repoRows[0] as Record<string, unknown>).r,
      contributors: contributors
        .filter((row) => row.repo === name)
        .map(({ login, contributions }) => ({ login, contributions })),
      releases,
      prs: prs.length > 0 ? prs[0].n : 0,
    });
  } catch (err) {
    return dbError(err);
  }
}