import type { NextRequest } from 'next/server';

import { badRequest, dbError, json } from '@/lib/http';
import { runQuery } from '@/lib/neo4j';
import { SEARCH } from '@/lib/queries';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, (row: Record<string, unknown>) => { label: string; sub: string }> = {
  Engineer: (r) => ({ label: String(r.login ?? ''), sub: String(r.name ?? '') }),
  Repo: (r) => ({
    label: String(r.name ?? ''),
    sub: String(r.language ?? r.owner ?? ''),
  }),
  PullRequest: (r) => ({ label: String(r.key ?? ''), sub: String(r.title ?? '') }),
  Incident: (r) => ({ label: String(r.key ?? ''), sub: String(r.name ?? '') }),
  Service: (r) => ({ label: String(r.name ?? ''), sub: String(r.source ?? '') }),
};

export async function GET(request: NextRequest): Promise<Response> {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim();
  if (q === '') return badRequest('missing required query parameter "q"');

  try {
    const rows = await runQuery(
      SEARCH,
      { q: q.toLowerCase(), limit: 25 },
    );
    const results = rows.map((row) => {
      const kind = String(row.kind ?? '');
      const resolve = KIND_LABEL[kind];
      const { label, sub } = resolve ? resolve(row) : { label: '', sub: '' };
      return { kind, label, sub };
    });
    return json({ results });
  } catch (err) {
    return dbError(err);
  }
}