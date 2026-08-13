import type { NextRequest } from 'next/server';

import { dbError, json, notFound, parseLimit } from '@/lib/http';
import { runQuery } from '@/lib/neo4j';
import {
  INCIDENT_BY_KEY,
  INCIDENT_CHAIN_COMMITS,
  INCIDENT_CHAIN_ENGINEERS,
  INCIDENT_CHAIN_RELEASES,
  INCIDENT_SERVICES,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

const WINDOW_HOURS = 6;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ key: string }> },
): Promise<Response> {
  const { key } = await context.params;
  const limit = parseLimit(request.nextUrl.searchParams.get('limit'), 100);
  if (typeof limit !== 'number') return limit;

  try {
    const [incidentRows] = await Promise.all([
      runQuery<Record<string, unknown>>(INCIDENT_BY_KEY, { key }),
    ]);
    if (incidentRows.length === 0) return notFound(`incident "${key}" not found`);

    const incident = (incidentRows[0] as Record<string, unknown>).i as Record<string, unknown>;
    const startedAt = String(incident.createdAt ?? '');
    const resolvedAtProp = (incident.resolvedAt ?? null) as string | null;

    const windowStart = iso(Date.parse(startedAt) - WINDOW_HOURS * 3_600_000);
    const windowEnd =
      resolvedAtProp && !Number.isNaN(Date.parse(resolvedAtProp))
        ? iso(Date.parse(resolvedAtProp) + WINDOW_HOURS * 3_600_000)
        : ''; // open incident: unbounded upper window

    const [services, releases, commits] = await Promise.all([
      runQuery<{ key: string; name: string }>(INCIDENT_SERVICES, { key }),
      runQuery<{ tagName: string; repo: string; publishedAt: string }>(
        INCIDENT_CHAIN_RELEASES,
        { windowStart, windowEnd },
      ),
      runQuery<{ sha: string; message: string; authoredAt: string }>(
        INCIDENT_CHAIN_COMMITS,
        { windowStart, windowEnd, limit },
      ),
    ]);

    const shas = commits.map((c) => c.sha);
    let engineers: { login: string }[] = [];
    if (shas.length > 0) {
      engineers = await runQuery<{ login: string }>(INCIDENT_CHAIN_ENGINEERS, { shas });
    }

    return json({
      incident,
      services: services.filter((s) => s.key === key).map((s) => s.name),
      chain: {
        releases,
        commits,
        engineers: engineers.map((e) => e.login),
      },
    });
  } catch (err) {
    return dbError(err);
  }
}