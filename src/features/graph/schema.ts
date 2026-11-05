import { z } from "zod";

/**
 * Matches the output of generate-graph.js. Deliberately lenient where the real data is:
 * - module.files is a COUNT (number) in generated files; an array of paths is also accepted
 * - api/external nodes have no module/path/lines
 */
export const moduleSchema = z.object({
  id: z.string().min(1),
  description: z.string().default(""),
  keywords: z.array(z.string()).default([]),
  files: z.union([z.number(), z.array(z.string())]).default(0),
});

export const moduleEdgeSchema = z.object({
  from: z.string(), to: z.string(), kind: z.string(), weight: z.number(),
});

export const nodeSchema = z.object({
  id: z.string().min(1),
  // Laravel generators emit "route" nodes; they behave like API endpoints.
  kind: z.preprocess((k) => (k === "route" ? "api" : k), z.enum(["file", "api", "external"])),
  type: z.string().default("unknown"),
  module: z.string().optional(),
  path: z.string().optional(),
  lines: z.number().optional(),
  usesAuthToken: z.boolean().optional(),
  client: z.boolean().optional(),
}).passthrough();

export const edgeSchema = z.object({
  from: z.string(), to: z.string(),
  kind: z.string().min(1), // imports | calls | uses | renders | extends | loads | includes | handled_by | ...
  verified: z.boolean().default(true),
});

export const graphSchema = z.object({
  schemaVersion: z.string().optional(),
  generatedAt: z.string().optional(),
  repo: z.string().optional(),
  note: z.string().optional(),
  modules: z.array(moduleSchema).min(1),
  moduleEdges: z.array(moduleEdgeSchema).default([]),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
}).superRefine((g, ctx) => {
  const ids = new Set<string>();
  for (const n of g.nodes) {
    if (ids.has(n.id)) ctx.addIssue({ code: "custom", message: `Duplicate node id: ${n.id}` });
    ids.add(n.id);
  }
  const mods = new Set(g.modules.map((m) => m.id));
  let bad = 0;
  for (const n of g.nodes) {
    if (n.module && !mods.has(n.module) && bad++ < 5) ctx.addIssue({ code: "custom", message: `Node ${n.id} references unknown module ${n.module}` });
  }
  for (const e of g.edges) {
    if ((!ids.has(e.from) || !ids.has(e.to)) && bad++ < 10)
      ctx.addIssue({ code: "custom", message: `Edge ${e.from} -> ${e.to} references an unknown node` });
  }
});

export type Graph = z.infer<typeof graphSchema>;
export type GNode = z.infer<typeof nodeSchema>;
export type GEdge = z.infer<typeof edgeSchema>;
export type GModule = z.infer<typeof moduleSchema>;
