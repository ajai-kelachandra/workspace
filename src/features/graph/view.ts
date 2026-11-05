import type { Edge, Node } from "@xyflow/react";
import type { ImpactResult } from "@/features/impact/engine";
import { API_MODULE, EXT_MODULE, moduleOf, type GraphIndex } from "./graphIndex";

export type Role = "source" | "direct" | "indirect" | "safe" | "none";
const RANK: Record<Role, number> = { source: 4, direct: 3, indirect: 2, safe: 1, none: 0 };

export const ROLE_COLOR: Record<Role, string> = {
  source: "var(--ios-blue)", direct: "var(--ios-orange)", indirect: "var(--ios-yellow)",
  safe: "var(--ios-green)", none: "var(--ios-gray)",
};

export interface ViewFilters { modules: string[]; types: string[]; verifiedOnly: boolean }
export interface ViewOptions { focus?: boolean; expanded: string[]; impact: ImpactResult | null; filters: ViewFilters; safe: string[] }

export interface ModuleNodeData extends Record<string, unknown> {
  moduleId: string; label: string; description: string; fileCount: number; expanded: boolean;
  role: Role; direct: number; indirect: number;
}
export interface FileNodeData extends Record<string, unknown> { label: string; nodeType: string; role: Role; lines?: number }

const FILE_W = 210, FILE_H = 44, GAP = 14, PAD = 22, HEADER = 56;
const MOD_W = 240, MOD_H = 96, BLOCK_GAP = 56, ROW_MAX = 3000;

interface FlowResult { pos: Map<string, { x: number; y: number }>; w: number; h: number }
const flowCache = new WeakMap<GraphIndex, Map<string, FlowResult>>();
const MAX_ROWS = 40, COL_GAP = 96, ROW_GAP = 16;

/**
 * Mixed flow inside an expanded module: files that import each other flow left (dependents) to
 * right (dependencies) along their real edges; files with no links inside the module sit in a
 * compact tray underneath instead of padding out a grid.
 */
function flowLayout(index: GraphIndex, files: string[], cacheKey: string): FlowResult {
  const hit = flowCache.get(index)?.get(cacheKey);
  if (hit) return hit;
  const set = new Set(files);
  const adj = new Map<string, Set<string>>(files.map((f) => [f, new Set<string>()]));
  const preds = new Map<string, Set<string>>(files.map((f) => [f, new Set<string>()]));
  for (const e of index.graph.edges) {
    if (e.from !== e.to && set.has(e.from) && set.has(e.to)) { adj.get(e.from)!.add(e.to); preds.get(e.to)!.add(e.from); }
  }
  const linked = files.filter((f) => adj.get(f)!.size || preds.get(f)!.size);
  const orphans = files.filter((f) => !adj.get(f)!.size && !preds.get(f)!.size);

  // break cycles via DFS back edges, then longest-path layering
  const state = new Map<string, number>();
  const back = new Set<string>();
  const order: string[] = [];
  const dfs = (u: string) => {
    state.set(u, 1);
    for (const v of adj.get(u)!) {
      if (state.get(v) === 1) { back.add(u + ">" + v); continue; }
      if (!state.get(v)) dfs(v);
    }
    state.set(u, 2); order.push(u);
  };
  [...linked].sort((a, b) => preds.get(a)!.size - preds.get(b)!.size || a.localeCompare(b)).forEach((r) => { if (!state.get(r)) dfs(r); });
  order.reverse();
  const layer = new Map<string, number>(linked.map((f) => [f, 0]));
  for (const u of order) for (const v of adj.get(u)!) if (!back.has(u + ">" + v)) layer.set(v, Math.max(layer.get(v)!, layer.get(u)! + 1));
  let layers: string[][] = [];
  for (const f of linked) (layers[layer.get(f)!] ??= []).push(f);
  // Deep import chains would make the flow absurdly wide: fold them into roughly area-balanced
  // columns (still in topological order, so edges keep running left to right).
  const targetCols = Math.max(2, Math.ceil(Math.sqrt(linked.length / 3.5)));
  const dense = layers.filter(Boolean);
  if (dense.length > targetCols) {
    const flat = dense.flat();
    const per = Math.ceil(flat.length / targetCols);
    layers = Array.from({ length: Math.ceil(flat.length / per) }, (_, i) => flat.slice(i * per, (i + 1) * per));
  }

  // order rows by the average row of their dependents, to cut edge crossings
  const row = new Map<string, number>();
  const bary = (f: string) => {
    const ps = [...preds.get(f)!].filter((p) => row.has(p));
    return ps.length ? ps.reduce((sum, p) => sum + row.get(p)!, 0) / ps.length : 1e6;
  };
  layers.forEach((col) => {
    if (!col) return;
    col.sort((a, b) => bary(a) - bary(b) || a.localeCompare(b));
    col.forEach((f, i) => row.set(f, i));
  });

  const pos = new Map<string, { x: number; y: number }>();
  let colX = 0, flowH = 0;
  const tallest = Math.max(0, ...layers.filter(Boolean).map((c) => Math.min(c.length, MAX_ROWS)));
  layers.forEach((col) => {
    if (!col) return;
    const subCols = Math.ceil(col.length / MAX_ROWS); // tall layers wrap into neighbouring columns
    const per = Math.ceil(col.length / subCols);
    for (let sc = 0; sc < subCols; sc++) {
      const slice = col.slice(sc * per, (sc + 1) * per);
      const offset = ((tallest - slice.length) * (FILE_H + ROW_GAP)) / 2; // centre each column vertically
      slice.forEach((f, i) => {
        pos.set(f, { x: colX, y: offset + i * (FILE_H + ROW_GAP) });
        flowH = Math.max(flowH, offset + (i + 1) * (FILE_H + ROW_GAP) - ROW_GAP);
      });
      colX += FILE_W + COL_GAP;
    }
  });
  const flowW = linked.length ? colX - COL_GAP : 0;

  let w = flowW, h = flowH;
  if (orphans.length) {
    const cols = Math.max(1, Math.floor((Math.max(flowW, 3 * (FILE_W + GAP)) + GAP) / (FILE_W + GAP)));
    const top = linked.length ? flowH + 56 : 0;
    orphans.forEach((f, i) => pos.set(f, { x: (i % cols) * (FILE_W + GAP), y: top + Math.floor(i / cols) * (FILE_H + GAP) }));
    w = Math.max(w, Math.min(cols, orphans.length) * (FILE_W + GAP) - GAP);
    h = top + Math.ceil(orphans.length / cols) * (FILE_H + GAP) - GAP;
  }
  const out = { pos, w, h };
  (flowCache.get(index) ?? flowCache.set(index, new Map()).get(index)!).set(cacheKey, out);
  return out;
}

const layoutCache = new WeakMap<GraphIndex, Map<string, Map<string, { x: number; y: number }>>>();

/** Left-to-right layered layout of modules: dependents on the left, what they depend on to the right. */
function layerLayout(index: GraphIndex, ids: string[]) {
  const key = ids.join("|");
  const cached = layoutCache.get(index)?.get(key);
  if (cached) return cached;
  const set = new Set(ids);
  const adj = new Map<string, Set<string>>(ids.map((i) => [i, new Set<string>()]));
  const indeg = new Map<string, number>(ids.map((i) => [i, 0]));
  for (const e of index.graph.edges) {
    const a = moduleOf(index.nodes.get(e.from)!), b = moduleOf(index.nodes.get(e.to)!);
    if (a !== b && set.has(a) && set.has(b) && !adj.get(a)!.has(b)) { adj.get(a)!.add(b); indeg.set(b, indeg.get(b)! + 1); }
  }
  // DFS: drop back edges so cycles don't break layering, then longest-path layers
  const state = new Map<string, number>();
  const back = new Set<string>();
  const order: string[] = [];
  const dfs = (u: string) => {
    state.set(u, 1);
    for (const v of adj.get(u)!) {
      if (state.get(v) === 1) { back.add(u + ">" + v); continue; }
      if (!state.get(v)) dfs(v);
    }
    state.set(u, 2); order.push(u);
  };
  [...ids].sort((a, b) => indeg.get(a)! - indeg.get(b)! || a.localeCompare(b)).forEach((r) => { if (!state.get(r)) dfs(r); });
  order.reverse();
  // Dense, cyclic module graphs give very deep strict layers, so fold the topological order into a
  // few columns instead: dependents on the left, what they depend on to the right.
  const nCols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(order.length))));
  const perCol = Math.ceil(order.length / nCols);
  const layer = new Map<string, number>(order.map((id, i) => [id, Math.floor(i / perCol)]));

  const cols = new Map<number, string[]>();
  for (const id of ids) (cols.get(layer.get(id)!) ?? cols.set(layer.get(id)!, []).get(layer.get(id)!)!).push(id);
  const tallest = Math.max(...[...cols.values()].map((c) => c.length));
  const pos = new Map<string, { x: number; y: number }>();
  for (const [l, col] of cols) {
    const offset = ((tallest - col.length) * (MOD_H + 48)) / 2;
    col.forEach((id, i) => pos.set(id, { x: l * (MOD_W + 130), y: offset + i * (MOD_H + 48) }));
  }
  (layoutCache.get(index) ?? layoutCache.set(index, new Map()).get(index)!).set(key, pos);
  return pos;
}

/**
 * Builds the React Flow graph. Collapsed modules are one node; expanded modules are a group
 * containing their file nodes. Edges are aggregated between whatever is visible.
 * Layout is deterministic shelf-packing, so blocks never overlap however large a module is.
 */
export function buildView(index: GraphIndex, opts: ViewOptions): { nodes: Node[]; edges: Edge[]; hidden: number } {
  const { graph } = index;
  const { impact, filters } = opts;
  const focusOnly = !!opts.focus && !!impact;
  const expanded = new Set(opts.expanded);
  const safe = new Set(opts.safe);
  const typeSet = new Set(filters.types);

  const mods = graph.modules.map((m) => ({ id: m.id, description: m.description }));
  if (index.byModule.has(API_MODULE)) mods.push({ id: API_MODULE, description: "API endpoints called by the code" });
  if (index.byModule.has(EXT_MODULE)) mods.push({ id: EXT_MODULE, description: "External services and libraries" });
  const visibleMods = filters.modules.length ? mods.filter((m) => filters.modules.includes(m.id)) : mods;

  const fileRole = (id: string): Role => {
    const r = impact?.roles.get(id);
    if (!r) return "none";
    return safe.has(id) && r !== "source" ? "safe" : r;
  };

  // graph node id -> id of the visible element that represents it
  const visId = new Map<string, string>();
  const shownFiles = new Map<string, string[]>();
  let hidden = 0;
  for (const m of visibleMods) {
    const members = index.byModule.get(m.id) ?? [];
    if (expanded.has(m.id)) {
      const shown = members
        .filter((id) => !typeSet.size || typeSet.has(index.nodes.get(id)!.type))
        .filter((id) => !focusOnly || impact!.roles.has(id))
        .sort((a, b) => a.localeCompare(b));
      hidden += members.length - shown.length;
      shown.forEach((id) => visId.set(id, id));
      shownFiles.set(m.id, shown);
    } else {
      members.forEach((id) => visId.set(id, `mod:${m.id}`));
    }
  }

  // ---- nodes: layered layout at module level, shelf packing once modules are expanded
  const layered = expanded.size === 0 ? layerLayout(index, visibleMods.map((m) => m.id)) : null;
  const nodes: Node[] = [];
  let x = 0, y = 0, rowH = 0;
  for (const m of visibleMods) {
    const members = index.byModule.get(m.id) ?? [];
    const isOpen = expanded.has(m.id);
    let w = MOD_W, h = MOD_H;
    const files = shownFiles.get(m.id) ?? [];
    let fl: FlowResult | null = null;
    if (isOpen) {
      fl = flowLayout(index, files, `${m.id}#${[...typeSet].sort().join(",")}`);
      w = PAD * 2 + Math.max(fl.w, FILE_W * 2);
      h = HEADER + fl.h + PAD;
    }
    if (!layered && x > 0 && (x + w > ROW_MAX || isOpen)) { x = 0; y += rowH + BLOCK_GAP; rowH = 0; }

    let direct = 0, indirect = 0, role: Role = "none";
    for (const id of members) {
      const r = impact?.roles.get(id);
      if (!r) continue;
      if (r === "direct") direct++; else if (r === "indirect") indirect++;
      if (RANK[r] > RANK[role]) role = r;
    }
    const data: ModuleNodeData = {
      moduleId: m.id, label: m.id, description: m.description, fileCount: members.length,
      expanded: isOpen, role, direct, indirect,
    };
    nodes.push({
      id: `mod:${m.id}`, type: isOpen ? "group" : "module", position: layered?.get(m.id) ?? { x, y }, data,
      ...(isOpen ? { style: { width: w, height: h }, zIndex: 0 } : { zIndex: 1 }),
    });
    files.forEach((id) => {
      const n = index.nodes.get(id)!;
      const fd: FileNodeData = { label: n.path ?? n.id, nodeType: n.type, role: fileRole(id), lines: n.lines };
      nodes.push({
        id, type: "file", parentId: `mod:${m.id}`, extent: "parent", zIndex: 2,
        position: { x: PAD + (fl?.pos.get(id)?.x ?? 0), y: HEADER + (fl?.pos.get(id)?.y ?? 0) },
        data: fd, style: { width: FILE_W, height: FILE_H },
      });
    });
    x += w + BLOCK_GAP; rowH = Math.max(rowH, h);
    if (isOpen) x = ROW_MAX; // next block starts a new row
  }

  // ---- aggregated edges
  const agg = new Map<string, { a: string; b: string; count: number; verified: boolean }>();
  for (const e of graph.edges) {
    if (filters.verifiedOnly && !e.verified) continue;
    const a = visId.get(e.from), b = visId.get(e.to);
    if (!a || !b || a === b) continue;
    const k = `${a}\u0000${b}`;
    const cur = agg.get(k);
    if (cur) { cur.count++; cur.verified &&= e.verified; } else agg.set(k, { a, b, count: 1, verified: e.verified });
  }
  const viewRole = (id: string): Role => {
    if (!id.startsWith("mod:")) return fileRole(id);
    return (nodes.find((n) => n.id === id)?.data as ModuleNodeData | undefined)?.role ?? "none";
  };
  const roleCache = new Map<string, Role>();
  const roleOf = (id: string) => roleCache.get(id) ?? (roleCache.set(id, viewRole(id)), roleCache.get(id)!);
  const blockToBlock = (a: string, b: string) => a.startsWith("mod:") && b.startsWith("mod:");

  const edges: Edge[] = [];
  for (const { a, b, count, verified } of agg.values()) {
    const ra = roleOf(a), rb = roleOf(b);
    const hot = !!impact && ra !== "none" && rb !== "none";
    const stroke = hot ? ROLE_COLOR[ra === "safe" ? rb : ra] : "var(--edge)";
    edges.push({
      id: `${a}>${b}`, source: a, target: b, type: "smoothstep", animated: hot, ...({ pathOptions: { borderRadius: 18 } } as object), selectable: false, focusable: false,
      label: blockToBlock(a, b) && count > 1 ? String(count) : undefined,
      style: {
        stroke, strokeWidth: hot ? 2 : 1.5,
        strokeDasharray: verified ? undefined : "5 4",
        opacity: impact && !hot ? 0.35 : 1,
      },
      labelStyle: { fontSize: 10, fill: "var(--text-2)" },
      labelBgStyle: { fill: "var(--chip)" }, labelBgPadding: [7, 4], labelBgBorderRadius: 10,
    });
  }
  return { nodes, edges, hidden };
}
