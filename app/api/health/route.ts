import { json } from '@/lib/http';
import { runQuery } from '@/lib/neo4j';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    await runQuery('RETURN 1 AS ok');
    return json({ status: 'ok', db: true, mode: 'live' });
  } catch {
    return json({ status: 'ok', db: false, mode: 'live' });
  }
}