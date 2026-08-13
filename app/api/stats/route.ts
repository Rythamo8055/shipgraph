import { dbError, json } from '@/lib/http';
import { runQuery } from '@/lib/neo4j';
import { STATS_EDGES, STATS_NODES } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const [nodes, edges] = await Promise.all([
      runQuery<{ label: string; count: number }>(STATS_NODES),
      runQuery<{ rel: string; count: number }>(STATS_EDGES),
    ]);
    const nodesObj: Record<string, number> = {};
    let totalNodes = 0;
    for (const row of nodes) {
      nodesObj[row.label] = row.count;
      totalNodes += row.count;
    }
    const edgesObj: Record<string, number> = {};
    let totalEdges = 0;
    for (const row of edges) {
      edgesObj[row.rel] = row.count;
      totalEdges += row.count;
    }
    return json({ nodes: nodesObj, edges: edgesObj, totalNodes, totalEdges });
  } catch (err) {
    return dbError(err);
  }
}