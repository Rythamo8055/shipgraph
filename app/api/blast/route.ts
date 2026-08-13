import type { NextRequest } from 'next/server';

import { badRequest, dbError, json, notFound } from '@/lib/http';
import { runQuery } from '@/lib/neo4j';
import { BLAST_INCIDENTS, BLAST_RELEASE, BLAST_SERVICES } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  const repo = (request.nextUrl.searchParams.get('repo') ?? '').trim();
  if (repo === '') return badRequest('missing required query parameter "repo"');

  try {
    const [releaseRows] = await Promise.all([
      runQuery<{ key: string; tagName: string; publishedAt: string }>(BLAST_RELEASE, { name: repo }),
    ]);
    if (releaseRows.length === 0) return notFound(`no release found for repo "${repo}"`);

    const release = releaseRows[0];
    const [services, incidents] = await Promise.all([
      runQuery<{ name: string }>(BLAST_SERVICES, { key: release.key }),
      runQuery<{ key: string }>(BLAST_INCIDENTS, { key: release.key }),
    ]);

    return json({
      release: { tagName: release.tagName, publishedAt: release.publishedAt },
      services: services.map((s) => s.name),
      incidents: incidents.map((i) => i.key),
    });
  } catch (err) {
    return dbError(err);
  }
}