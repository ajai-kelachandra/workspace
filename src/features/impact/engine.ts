import { moduleOf, type GraphIndex } from "@/features/graph/graphIndex";

export type RiskLevel = "low" | "medium" | "high";

export interface AffectedNode {
  id: string;
  /** hops from the nearest start node (1 = direct) */
  distance: number;
  /** from this node back to the start node: [id, ..., startId] */
  path: string[];
}

export interface ImpactOptions {
  startNodeIds: string[];
  /** 1-5, clamped */
  depth?: number;
  verifiedOnly?: boolean;
}

export interface ImpactResult {
  startNodeIds: string[];
  depth: number;
  direct: AffectedNode[];
  indirect: AffectedNode[];
  affected: AffectedNode[];
  /** module id -> affected node count (start nodes excluded) */
  modules: Record<string, number>;
  /** node type -> affected node count */
  byType: Record<string, number>;
  /** APIs called by the start nodes */
  apis: string[];
  /** start or affected nodes with high fan-in */
  highFanIn: { id: string; fanIn: number }[];
  risk: RiskLevel;
  /** id -> role, for rendering */
  roles: Map<string, "source" | "direct" | "indirect">;
}

export const clampDepth = (d: number | undefined) => Math.min(5, Math.max(1, Math.round(d ?? 3)));

/**
 * Risk heuristic (documented so it can be tuned):
 * high   - a start node is highly connected, or 5+ modules / 100+ nodes are affected
 * medium - 3+ modules, 20+ nodes, or any highly connected node is affected
 * low    - otherwise
 */
export function riskLevel(p: { startHighFanIn: boolean; anyHighFanIn: boolean; modules: number; affected: number }): RiskLevel {
  if (p.startHighFanIn || p.modules >= 5 || p.affected >= 100) return "high";
  if (p.modules >= 3 || p.affected >= 20 || p.anyHighFanIn) return "medium";
  return "low";
}

/** Reverse-edge BFS: finds everything that depends (transitively) on the start nodes. */
export function analyzeImpact(index: GraphIndex, opts: ImpactOptions): ImpactResult {
  const depth = clampDepth(opts.depth);
  const start = [...new Set(opts.startNodeIds)].filter((id) => index.nodes.has(id));
  const startSet = new Set(start);
  const dist = new Map<string, number>(start.map((s) => [s, 0]));
  const toward = new Map<string, string>(); // node -> next hop towards start
  let frontier = start;
  for (let d = 1; d <= depth; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of index.rev.get(id) ?? []) {
        if (opts.verifiedOnly && !e.verified) continue;
        if (dist.has(e.from)) continue;
        dist.set(e.from, d);
        toward.set(e.from, id);
        next.push(e.from);
      }
    }
    frontier = next;
  }

  const pathOf = (id: string) => {
    const p = [id];
    for (let cur = toward.get(id); cur; cur = toward.get(cur)) p.push(cur);
    return p;
  };
  const affected: AffectedNode[] = [];
  for (const [id, distance] of dist) if (!startSet.has(id)) affected.push({ id, distance, path: pathOf(id) });
  affected.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));

  const modules: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const a of affected) {
    const n = index.nodes.get(a.id)!;
    const m = moduleOf(n);
    modules[m] = (modules[m] ?? 0) + 1;
    byType[n.type] = (byType[n.type] ?? 0) + 1;
  }

  const apis = new Set<string>();
  for (const s of start) for (const e of index.fwd.get(s) ?? []) {
    if (e.kind === "calls" && (!opts.verifiedOnly || e.verified)) apis.add(e.to);
  }

  const highFanIn = [...start, ...affected.map((a) => a.id)]
    .map((id) => ({ id, fanIn: index.fanIn.get(id) ?? 0 }))
    .filter((x) => x.fanIn >= index.fanInThreshold)
    .sort((a, b) => b.fanIn - a.fanIn);

  const roles = new Map<string, "source" | "direct" | "indirect">();
  for (const s of start) roles.set(s, "source");
  for (const a of affected) roles.set(a.id, a.distance === 1 ? "direct" : "indirect");

  return {
    startNodeIds: start, depth,
    direct: affected.filter((a) => a.distance === 1),
    indirect: affected.filter((a) => a.distance > 1),
    affected, modules, byType,
    apis: [...apis].sort(),
    highFanIn,
    risk: riskLevel({
      startHighFanIn: start.some((s) => (index.fanIn.get(s) ?? 0) >= index.fanInThreshold),
      anyHighFanIn: highFanIn.length > 0,
      modules: Object.keys(modules).length,
      affected: affected.length,
    }),
    roles,
  };
}
