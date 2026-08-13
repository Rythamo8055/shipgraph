import type { NextRequest } from 'next/server';

import { badRequest, dbError, json, notFound } from '@/lib/http';
import { runQuery } from '@/lib/neo4j';
import { NODE_BY_ANY_KEY, PATH_QUERY } from '@/lib/queries';

export const dynamic = 'force-dynamic';

interface GraphSegment {
  start: Record<string, unknown>;
  relationship: Record<string, unknown> & { type?: string };
  end: Record<string, unknown>;
}

function nodeKey(n: Record<string, unknown>): string {
  const v = (n.login ?? n.name ?? n.key) as string | undefined;
  return v ?? '<unknown>';
}

export async function GET(request: NextRequest): Promise<Response> {
  const from = (request.nextUrl.searchParams.get('from') ?? '').trim();
  const to = (request.nextUrl.searchParams.get('to') ?? '').trim();
  if (from === '') return badRequest('missing required query parameter "from"');
  if (to === '') return badRequest('missing required query parameter "to"');

  try {
    const [fromRows, toRows] = await Promise.all([
      runQuery(NODE_BY_ANY_KEY, { id: from }),
      runQuery(NODE_BY_ANY_KEY, { id: to }),
    ]);
    if (fromRows.length === 0) return notFound(`start node "${from}" not found`);
    if (toRows.length === 0) return notFound(`end node "${to}" not found`);

    const pathRows = await runQuery<{ p: GraphSegment[]; hops: number }>(PATH_QUERY, {
      from,
      to,
    });
    if (pathRows.length === 0) {
      return json({ found: false, hops: 0, steps: [] });
    }

    const row = pathRows[0];
    const steps = row.p.map((seg) => ({
      from: nodeKey(seg.start),
      rel: seg.relationship.type ?? '?',
      to: nodeKey(seg.end),
      props: seg.relationship,
    }));
    return json({ found: true, hops: row.hops, steps });
  } catch (err) {
    return dbError(err);
  }
}