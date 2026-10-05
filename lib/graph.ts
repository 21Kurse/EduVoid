/**
 * Prerequisite-graph utilities for CurriculumSpec.concepts/edges.
 * Used by the pipeline (plan stage) and the mindmap layout.
 */

export type GraphNode = { id: string };
export type GraphEdge = { from: string; to: string };

/** True if the graph has no cycles (Kahn's algorithm). */
export function isAcyclic(nodes: string[], edges: GraphEdge[]): boolean {
  return topoSort(nodes, edges) !== null;
}

/** Kahn topological sort; null when a cycle exists. */
export function topoSort(
  nodes: string[],
  edges: GraphEdge[],
): string[] | null {
  const indegree = new Map<string, number>(nodes.map((n) => [n, 0]));
  const adj = new Map<string, string[]>(nodes.map((n) => [n, []]));
  for (const e of edges) {
    // edge from -> to means "from" must come before "to"
    adj.get(e.from)?.push(e.to);
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
  }
  const queue = nodes.filter((n) => (indegree.get(n) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length) {
    const n = queue.shift() as string;
    order.push(n);
    for (const m of adj.get(n) ?? []) {
      const d = (indegree.get(m) ?? 0) - 1;
      indegree.set(m, d);
      if (d === 0) queue.push(m);
    }
  }
  return order.length === nodes.length ? order : null;
}

/** Concepts that must be learned before `id` (direct prerequisites). */
export function prerequisitesOf(id: string, edges: GraphEdge[]): string[] {
  return edges.filter((e) => e.to === id).map((e) => e.from);
}

/** Concepts that depend on `id` (direct dependents). */
export function dependentsOf(id: string, edges: GraphEdge[]): string[] {
  return edges.filter((e) => e.from === id).map((e) => e.to);
}
