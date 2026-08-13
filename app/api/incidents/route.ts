import type { NextRequest } from 'next/server';

import { badRequest, dbError, json, parseLimit } from '@/lib/http';
import { runQuery } from '@/lib/neo4j';
import { INCIDENTS_LIST, INCIDENT_SERVICES } from '@/lib/queries';

export const dynamic = 'force-dynamic';

const IMPACTS = new Set(['', 'none', 'minor', 'major', 'critical']);

export async function GET(request: NextRequest): Promise<Response> {
  const impact = (request.nextUrl.searchParams.get('impact') ?? '').trim();
  if (!IMPACTS.has(impact)) {
    return badRequest(`invalid impact "${impact}": must be one of none, minor, major, critical`);
  }
  const limit = parseLimit(request.nextUrl.searchParams.get('limit'), 50);
  if (typeof limit !== 'number') return limit;

  try {
    const [incidents, services] = await Promise.all([
      runQuery<{
        key: string;
        name: string;
        source: string;
        impact: string;
        createdAt: string;
        resolvedAt: string | null;
      }>(INCIDENTS_LIST, { impact, limit }),
      runQuery<{ key: string; name: string }>(INCIDENT_SERVICES),
    ]);

    const servicesByKey = new Map<string, string[]>();
    for (const row of services) {
      const list = servicesByKey.get(row.key) ?? [];
      list.push(row.name);
      servicesByKey.set(row.key, list);
    }

    const out = incidents.map((row) => ({ ...row, services: servicesByKey.get(row.key) ?? [] }));
    return json({ incidents: out });
  } catch (err) {
    return dbError(err);
  }
}