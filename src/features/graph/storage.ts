import "server-only";
import { store } from "@/lib/store";
import { EDGE_CHUNK, NODE_CHUNK, chunk } from "./chunk";
import type { GEdge, GNode, Graph } from "./schema";
import type { WorkspaceDoc } from "@/features/workspace/model";

interface GraphMeta {
  name: string; status: "ready"; createdAt: number; createdBy: string;
  nodeCount: number; edgeCount: number; nodeChunks: number; edgeChunks: number;
  meta: Pick<Graph, "schemaVersion" | "generatedAt" | "repo" | "note">;
  modules: Graph["modules"]; moduleEdges: Graph["moduleEdges"];
}

const base = (wid: string, gid: string) => `workspaces/${wid}/graphs/${gid}`;

/** Stores a graph as a small meta doc plus chunked node/edge docs, then makes it the active graph. */
export function saveGraph(wid: string, graph: Graph, uid: string, ws: WorkspaceDoc) {
  const gid = store.newId();
  const nodeChunks = chunk(graph.nodes, NODE_CHUNK);
  const edgeChunks = chunk(graph.edges, EDGE_CHUNK);
  const { modules, moduleEdges, nodes: _n, edges: _e, ...meta } = graph;
  const doc: GraphMeta = {
    name: graph.repo ?? "graph", status: "ready", createdAt: Date.now(), createdBy: uid,
    nodeCount: graph.nodes.length, edgeCount: graph.edges.length,
    nodeChunks: nodeChunks.length, edgeChunks: edgeChunks.length, meta, modules, moduleEdges,
  };
  if (ws.activeGraphId) store.deletePrefix(base(wid, ws.activeGraphId)); // replace previous graph
  store.setMany([
    [base(wid, gid), doc],
    ...nodeChunks.map((items, i): [string, unknown] => [`${base(wid, gid)}/nodeChunks/${i}`, { items }]),
    ...edgeChunks.map((items, i): [string, unknown] => [`${base(wid, gid)}/edgeChunks/${i}`, { items }]),
    [`workspaces/${wid}`, { ...ws, activeGraphId: gid }],
  ]);
  return { graphId: gid, nodeCount: doc.nodeCount, edgeCount: doc.edgeCount, chunks: nodeChunks.length + edgeChunks.length };
}

export function loadActiveGraph(wid: string, ws: WorkspaceDoc): (Graph & { graphId: string }) | null {
  if (!ws.activeGraphId) return null;
  const gid = ws.activeGraphId;
  const doc = store.get<GraphMeta>(base(wid, gid));
  if (!doc) return null;
  const read = <T,>(sub: string, n: number) =>
    Array.from({ length: n }, (_, i) => store.get<{ items: T[] }>(`${base(wid, gid)}/${sub}/${i}`)?.items ?? []).flat();
  return {
    graphId: gid, ...doc.meta, modules: doc.modules, moduleEdges: doc.moduleEdges,
    nodes: read<GNode>("nodeChunks", doc.nodeChunks), edges: read<GEdge>("edgeChunks", doc.edgeChunks),
  };
}
