import { describe, expect, it } from "vitest";
import { buildIndex } from "@/features/graph/graphIndex";
import { graphSchema } from "@/features/graph/schema";
import sample from "../../../fixtures/architecture.graph.sample.json";
import { analyzeImpact } from "./engine";
import { resolveStart, tokenize } from "./resolve";

const file = (path: string, module: string, type = "component") => ({ id: path, kind: "file" as const, type, module, path });
const imp = (from: string, to: string) => ({ from, to, kind: "imports" as const, verified: true });

const small = buildIndex(graphSchema.parse({
  modules: [
    { id: "M3-profile", description: "", keywords: ["profile"], files: 2 },
    { id: "M5-event-dashboard", description: "", keywords: ["dashboard", "event"], files: 4 },
  ],
  nodes: [
    file("components/EventDashboard/CreateEventForm.tsx", "M5-event-dashboard"),
    file("components/EventDashboard/EventDashboardComponent.tsx", "M5-event-dashboard"),
    file("app/[locale]/event-dashboard/page.tsx", "M5-event-dashboard", "page"),
    file("components/EventDashboard/formatTimeAgo.ts", "M5-event-dashboard", "util"),
    file("components/Profile/ProfileForm.tsx", "M3-profile"),
    file("components/Profile/ProfileCard.tsx", "M3-profile"),
  ],
  edges: [
    imp("components/EventDashboard/EventDashboardComponent.tsx", "components/EventDashboard/CreateEventForm.tsx"),
    imp("app/[locale]/event-dashboard/page.tsx", "components/EventDashboard/EventDashboardComponent.tsx"),
  ],
}));

describe("tokenize", () => {
  it("splits camelCase, drops noise and stems plurals", () => {
    expect(tokenize("components/EventDashboard/CreateEventForm.tsx", (t) => t === "component" || t === "tsx"))
      .toEqual(["event", "dashboard", "create", "event", "form"]);
    expect(tokenize("speakers", () => false)).toEqual(["speaker"]);
  });
});

describe("resolveStart with task sentences", () => {
  it("marks only the form a task is about, not the whole module or look-alike words", () => {
    const r = resolveStart(small, "Edit event form saved speakers added in form")!;
    expect(r.matchedBy).toBe("keyword");
    expect(r.nodeIds).toEqual(["components/EventDashboard/CreateEventForm.tsx"]);
    expect(r.explain).toContain("event form");
    expect(r.explain).toContain("speaker"); // reported as having no file of its own
  });

  it("does not confuse 'form' with 'format'", () => {
    const r = resolveStart(small, "form validation")!;
    expect(r.nodeIds).not.toContain("components/EventDashboard/formatTimeAgo.ts");
  });

  it("picks the profile form for a profile sentence", () => {
    expect(resolveStart(small, "Profile form not saving")!.nodeIds).toEqual(["components/Profile/ProfileForm.tsx"]);
  });

  it("resolves a file path written inside a sentence", () => {
    const r = resolveStart(small, "Bug in components/Profile/ProfileCard.tsx when saving")!;
    expect(r).toMatchObject({ matchedBy: "file", nodeIds: ["components/Profile/ProfileCard.tsx"] });
  });

  it("matches on the words that exist in paths and reports the rest", () => {
    const r = resolveStart(small, "dashboard colours")!;
    expect(r.matchedBy).toBe("keyword"); // 'dashboard' is in paths; 'colours' has no file and is reported
    expect(r.nodeIds.length).toBeGreaterThan(0);
    expect(r.nodeIds.length).toBeLessThanOrEqual(10);
    expect(resolveStart(small, "colours")).toBeNull();
  });

  it("returns null for gibberish", () => {
    expect(resolveStart(small, "zzzz qqqq")).toBeNull();
  });
});

describe("end to end on the real sample graph", () => {
  const index = buildIndex(graphSchema.parse(sample));

  it("'Edit event form saved speakers added in form' marks the form and the page that shows it", () => {
    const r = resolveStart(index, "Edit event form saved speakers added in form")!;
    expect(r.nodeIds).toEqual(["components/EventDashboard/CreateEventForm.tsx"]);
    const impact = analyzeImpact(index, { startNodeIds: r.nodeIds, depth: 3 });
    expect(impact.direct.map((d) => d.id)).toEqual(["components/EventDashboard/EventDashboardComponent.tsx"]);
    expect(impact.indirect.map((d) => d.id)).toEqual(["app/[locale]/event-dashboard/page.tsx"]);
    expect(impact.affected.length).toBeLessThan(5);
  });
});
