import { describe, expect, it } from "vitest";
import { buildIndex } from "@/features/graph/graphIndex";
import { graphSchema, type Graph } from "@/features/graph/schema";
import sample from "../../../fixtures/architecture.graph.sample.json";
import { analyzeImpact } from "./engine";
import { resolveStart } from "./resolve";

const n = (id: string, module: string, kind: "file" | "api" = "file", type = "component") =>
  ({ id, kind, type, module: kind === "api" ? undefined : module, path: id });
const e = (from: string, to: string, kind: "imports" | "calls" = "imports", verified = true) => ({ from, to, kind, verified });

// a -> b -> c <- d ; e calls api:x ; c calls api:y
const graph: Graph = graphSchema.parse({
  modules: [{ id: "M1", description: "", keywords: ["alpha"], files: 3 }, { id: "M2", description: "", keywords: ["beta"], files: 2 }],
  moduleEdges: [],
  nodes: [n("a", "M1"), n("b", "M1"), n("c", "M2", "file", "util"), n("d", "M2"), n("e", "M2"), n("api:x", "", "api"), n("api:y", "", "api")],
  edges: [e("a", "b"), e("b", "c"), e("d", "c"), e("e", "api:x", "calls"), e("c", "api:y", "calls")],
});

describe("analyzeImpact", () => {
  const idx = buildIndex(graph, { fanInThreshold: 99 });

  it("finds dependents by reverse traversal with distance and path", () => {
    const r = analyzeImpact(idx, { startNodeIds: ["c"], depth: 3 });
    expect(r.direct.map((x) => x.id).sort()).toEqual(["b", "d"]);
    expect(r.indirect.map((x) => x.id)).toEqual(["a"]);
    expect(r.affected.find((x) => x.id === "a")).toMatchObject({ distance: 2, path: ["a", "b", "c"] });
    expect(r.roles.get("c")).toBe("source");
  });

  it("respects depth and clamps it to 1-5", () => {
    expect(analyzeImpact(idx, { startNodeIds: ["c"], depth: 1 }).affected).toHaveLength(2);
    expect(analyzeImpact(idx, { startNodeIds: ["c"], depth: 0 }).depth).toBe(1);
    expect(analyzeImpact(idx, { startNodeIds: ["c"], depth: 99 }).depth).toBe(5);
  });

  it("aggregates by module and node type, and lists APIs of start nodes", () => {
    const r = analyzeImpact(idx, { startNodeIds: ["c"] });
    expect(r.modules).toEqual({ M1: 2, M2: 1 });
    expect(r.byType).toEqual({ component: 3 });
    expect(r.apis).toEqual(["api:y"]);
  });

  it("ignores unverified edges when verifiedOnly is set", () => {
    const g2 = graphSchema.parse({ ...graph, edges: [e("a", "b", "imports", false), e("b", "c")] });
    const i2 = buildIndex(g2, { fanInThreshold: 99 });
    expect(analyzeImpact(i2, { startNodeIds: ["c"] }).affected.map((x) => x.id)).toEqual(["b", "a"]);
    expect(analyzeImpact(i2, { startNodeIds: ["c"], verifiedOnly: true }).affected.map((x) => x.id)).toEqual(["b"]);
  });

  it("handles cycles, unknown ids and multiple start nodes", () => {
    const g3 = graphSchema.parse({ ...graph, edges: [e("a", "b"), e("b", "a")] });
    const r = analyzeImpact(buildIndex(g3), { startNodeIds: ["a", "nope"] });
    expect(r.startNodeIds).toEqual(["a"]);
    expect(r.affected.map((x) => x.id)).toEqual(["b"]);
  });

  it("flags high fan-in nodes and raises risk", () => {
    const low = analyzeImpact(buildIndex(graph, { fanInThreshold: 99 }), { startNodeIds: ["c"] });
    expect(low.highFanIn).toEqual([]);
    expect(low.risk).toBe("low");
    const hi = analyzeImpact(buildIndex(graph, { fanInThreshold: 2 }), { startNodeIds: ["c"] });
    expect(hi.highFanIn).toEqual([{ id: "c", fanIn: 2 }]);
    expect(hi.risk).toBe("high");
  });
});

describe("resolveStart", () => {
  const idx = buildIndex(graph);
  it("prefers explicit file, then module, then keyword", () => {
    expect(resolveStart(idx, "c")).toMatchObject({ matchedBy: "file", nodeIds: ["c"], confidence: 1 });
    expect(resolveStart(idx, "m1")).toMatchObject({ matchedBy: "module", nodeIds: ["a", "b"] });
    const k = resolveStart(idx, "fix the beta flow");
    expect(k?.matchedBy).toBe("keyword");
    expect(k!.confidence).toBeLessThanOrEqual(0.6);
    expect(resolveStart(idx, "zzzz nothing")).toBeNull();
  });
});

describe("real sample graph (architecture.graph.json)", () => {
  it("validates and produces sane impact", () => {
    const g = graphSchema.parse(sample);
    expect(g.nodes.length).toBeGreaterThan(700);
    const idx = buildIndex(g);
    const r = resolveStart(idx, "M9-feedback")!;
    const res = analyzeImpact(idx, { startNodeIds: r.nodeIds, depth: 3 });
    expect(res.affected.length).toBeGreaterThan(0);
    expect(res.apis.every((a) => a.startsWith("api:"))).toBe(true);
  });

  it("rejects a graph with dangling edges", () => {
    expect(graphSchema.safeParse({ ...graph, edges: [e("a", "ghost")] }).success).toBe(false);
  });
});
