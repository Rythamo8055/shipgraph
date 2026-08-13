import type { NextRequest } from 'next/server';

import { dbError, json, parseLimit } from '@/lib/http';
import { runQuery } from '@/lib/neo4j';
import { REPO_CONTRIBUTORS, REPOS_LIST } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  const limit = parseLimit(request.nextUrl.searchParams.get('limit'), 20);
  if (typeof limit !== 'number') return limit;

  try {
    const [repos, contributors] = await Promise.all([
      runQuery<{ name: string; language: string | null; stars: number; pushedAt: string }>(
        REPOS_LIST,
        { limit },
      ),
      runQuery<{ repo: string; login: string }>(REPO_CONTRIBUTORS),
    ]);

    const ownersByRepo = new Map<string, string[]>();
    for (const row of contributors) {
      const owners = ownersByRepo.get(row.repo) ?? [];
      owners.push(row.login);
      ownersByRepo.set(row.repo, owners);
    }

    const out = repos.map((row) => ({
      name: row.name,
      language: row.language,
      stars: row.stars,
      pushedAt: row.pushedAt,
      owners: ownersByRepo.get(row.name) ?? [],
    }));
    return json({ repos: out });
  } catch (err) {
    return dbError(err);
  }
}