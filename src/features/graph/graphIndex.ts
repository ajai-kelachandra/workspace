import type { GEdge, GNode, Graph } from "./schema";

export interface GraphIndex {
  graph: Graph;
  nodes: Map<string, GNode>;
  /** edges grouped by target: who depends on X */
  rev: Map<string, GEdge[]>;
  /** edges grouped by source: what X depends on */
  fwd: Map<string, GEdge[]>;
  /** number of distinct importers per node (imports edges only) */
  fanIn: Map<string, number>;
  byModule: Map<string, string[]>;
  /** nodes with fan-in >= this are "highly connected" */
  fanInThreshold: number;
}

export const API_MODULE = "API";
export const EXT_MODULE = "EXT";

export function moduleOf(n: GNode): string {
  return n.module ?? (n.kind === "api" ? API_MODULE : n.kind === "external" ? EXT_MODULE : "unassigned");
}

export function buildIndex(graph: Graph, opts: { fanInThreshold?: number } = {}): GraphIndex {
  const nodes = new Map<string, GNode>();
  const byModule = new Map<string, string[]>();
  for (const n of graph.nodes) {
    nodes.set(n.id, n);
    const m = moduleOf(n);
    (byModule.get(m) ?? byModule.set(m, []).get(m)!).push(n.id);
  }
  const rev = new Map<string, GEdge[]>();
  const fwd = new Map<string, GEdge[]>();
  const importers = new Map<string, Set<string>>();
  for (const e of graph.edges) {
    (rev.get(e.to) ?? rev.set(e.to, []).get(e.to)!).push(e);
    (fwd.get(e.from) ?? fwd.set(e.from, []).get(e.from)!).push(e);
    if (e.kind === "imports") (importers.get(e.to) ?? importers.set(e.to, new Set()).get(e.to)!).add(e.from);
  }
  const fanIn = new Map<string, number>();
  for (const [id, s] of importers) fanIn.set(id, s.size);

  let fanInThreshold = opts.fanInThreshold;
  if (fanInThreshold === undefined) {
    // top ~5% of file nodes, but never below 8 importers
    const vals = graph.nodes.filter((n) => n.kind === "file").map((n) => fanIn.get(n.id) ?? 0).sort((a, b) => a - b);
    fanInThreshold = Math.max(8, vals[Math.floor(vals.length * 0.95)] ?? 0);
  }
  return { graph, nodes, rev, fwd, fanIn, byModule, fanInThreshold };
}
