import { NextResponse } from 'next/server';

import { DbUnreachableError } from '@/lib/neo4j';

export function json<T>(body: T, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

export function badRequest(detail: string): NextResponse {
  return NextResponse.json({ detail }, { status: 400 });
}

export function notFound(detail: string): NextResponse {
  return NextResponse.json({ detail }, { status: 404 });
}

/** 503 {"detail": str} on any DB failure (CONTRACT error semantics). */
export function dbError(err: unknown): NextResponse {
  if (err instanceof DbUnreachableError) {
    const detail = err.message.length > 200 ? `${err.message.slice(0, 197)}...` : err.message;
    return NextResponse.json({ detail }, { status: 503 });
  }
  const msg = err instanceof Error ? err.message : String(err);
  return NextResponse.json(
    { detail: `internal server error: ${msg.slice(0, 120)}` },
    { status: 500 },
  );
}

export function dbUnreachable(reason: string): NextResponse {
  return NextResponse.json(
    { detail: `graph database unreachable: ${reason.slice(0, 120)}` },
    { status: 503 },
  );
}

const LIMIT_MAX = 500;

/** Parse ?limit= as positive int within [1, 500]; null when absent. */
export function parseLimit(raw: string | null, fallback: number): number | NextResponse {
  if (raw === null || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) return badRequest(`invalid limit "${raw}": must be a positive integer`);
  const n = Number(raw);
  if (n < 1 || n > LIMIT_MAX) {
    return badRequest(`invalid limit "${raw}": must be between 1 and ${LIMIT_MAX}`);
  }
  return n;
}