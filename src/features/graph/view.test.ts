import { describe, expect, it } from "vitest";
import { analyzeImpact } from "@/features/impact/engine";
import { resolveStart } from "@/features/impact/resolve";
import sample from "../../../fixtures/architecture.graph.sample.json";
import { buildIndex } from "./graphIndex";
import { graphSchema } from "./schema";
import { buildView } from "./view";

const index = buildIndex(graphSchema.parse(sample));
const none = { modules: [], types: [], verifiedOnly: false };

describe("buildView", () => {
  it("starts at module level: one node per module plus API and external groups", () => {
    const v = buildView(index, { expanded: [], impact: null, filters: none, safe: [] });
    expect(v.nodes).toHaveLength(14);
    expect(v.nodes.every((n) => n.type === "module")).toBe(true);
    expect(v.edges.length).toBeGreaterThan(20);
    expect(v.edges.every((e) => e.source !== e.target)).toBe(true);
  });

  it("expands a module into a group with its files as children, parent first", () => {
    const v = buildView(index, { expanded: ["M9-feedback"], impact: null, filters: none, safe: [] });
    const gi = v.nodes.findIndex((n) => n.id === "mod:M9-feedback");
    expect(v.nodes[gi].type).toBe("group");
    const kids = v.nodes.filter((n) => n.parentId === "mod:M9-feedback");
    expect(kids.length).toBe(index.byModule.get("M9-feedback")!.length);
    expect(v.nodes.findIndex((n) => n.parentId === "mod:M9-feedback")).toBeGreaterThan(gi);
  });

  it("handles every module expanded (all ~836 nodes) quickly with no overlapping blocks", () => {
    const all = [...index.byModule.keys()];
    const t = performance.now();
    const v = buildView(index, { expanded: all, impact: null, filters: none, safe: [] });
    expect(performance.now() - t).toBeLessThan(2000);
    expect(v.nodes.length).toBe(index.nodes.size + all.length);
    const groups = v.nodes.filter((n) => n.type === "group");
    for (const a of groups) for (const b of groups) {
      if (a === b) continue;
      const aw = a.style!.width as number, ah = a.style!.height as number;
      const overlap = a.position.x < b.position.x + (b.style!.width as number) && b.position.x < a.position.x + aw
        && a.position.y < b.position.y + (b.style!.height as number) && b.position.y < a.position.y + ah;
      expect(overlap).toBe(false);
    }
  });

  it("marks roles and animates only edges between affected elements", () => {
    const r = resolveStart(index, "M9-feedback")!;
    const impact = analyzeImpact(index, { startNodeIds: r.nodeIds, depth: 3 });
    const v = buildView(index, { expanded: [], impact, filters: none, safe: [] });
    const roles = Object.fromEntries(v.nodes.map((n) => [n.id, (n.data as { role: string }).role]));
    expect(roles["mod:M9-feedback"]).toBe("source");
    const hot = v.edges.filter((e) => e.animated);
    expect(hot.length).toBeGreaterThan(0);
    expect(hot.every((e) => roles[e.source] !== "none" && roles[e.target] !== "none")).toBe(true);
  });

  it("applies module and verified-only filters", () => {
    const v = buildView(index, { expanded: [], impact: null, filters: { ...none, modules: ["M1-foundation", "M2-auth"] }, safe: [] });
    expect(v.nodes.map((n) => n.id).sort()).toEqual(["mod:M1-foundation", "mod:M2-auth"]);
  });
});
