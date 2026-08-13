import { json } from '@/lib/http';
import { ABOUT_QUERIES } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return json({ queries: ABOUT_QUERIES });
}