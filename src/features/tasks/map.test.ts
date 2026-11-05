import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildIndex } from "@/features/graph/graphIndex";
import { graphSchema } from "@/features/graph/schema";
import sample from "../../../fixtures/architecture.graph.sample.json";
import { mapTask } from "./map";
import { parseTasks } from "./parse";

const index = buildIndex(graphSchema.parse(sample));
const tasks = parseTasks(readFileSync("fixtures/tasks.example.txt", "utf8"));
const byTitle = (t: string) => mapTask(index, tasks.find((x) => x.title.startsWith(t))!);

describe("mapping the real task list onto the real graph", () => {
  it("Edit event form -> exactly the form, with high confidence", () => {
    const m = byTitle("Edit event form");
    expect(m.nodeIds).toEqual(["components/EventDashboard/CreateEventForm.tsx"]);
    expect(m.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("CSAT and NPS modals -> the two modal files", () => {
    expect(byTitle("CSAT and NPS").nodeIds.sort()).toEqual(["utils/CSATModal.tsx", "utils/NPSSurvayModal.tsx"]);
  });

  it("Event dashboard cards -> the card component and the dashboard", () => {
    const m = byTitle("Event dashboard cards");
    expect(m.nodeIds).toContain("components/EventDashboard/RecentlyUpdatedEventCard.tsx");
    expect(m.nodeIds.length).toBeLessThanOrEqual(3);
  });

  it("Event Saved (online and offline pages) -> the online and offline detail pages", () => {
    const m = byTitle("Event Saved");
    expect(m.nodeIds).toEqual(expect.arrayContaining([
      "components/EventDetailOnline/EventDetailOnline.tsx", "components/EventDetailOffline/EventDetailOffline.tsx",
    ]));
  });

  it("Missing mandatory details -> CompleteProfileModal, found through the 'mandatory' synonym", () => {
    expect(byTitle("Missing mandatory").nodeIds[0]).toBe("components/CommonComponents/CompleteProfileModal.tsx");
  });

  it("menu shortcut -> the NavBar first", () => {
    expect(byTitle("Added a menu shortcut").nodeIds[0]).toBe("app/NavBar.tsx");
  });

  it("is honest about weak matches: a feature with no file gets low confidence", () => {
    expect(byTitle("Event History popup").confidence).toBeLessThan(0.5);
    expect(byTitle("Locked down").confidence).toBeLessThan(0.5);
  });

  it("a manual correction always wins", () => {
    const m = mapTask(index, { title: "Edit event form", description: "", manualNodeIds: ["app/NavBar.tsx"] });
    expect(m).toMatchObject({ matchedBy: "manual", confidence: 1, nodeIds: ["app/NavBar.tsx"] });
  });

  it("every task maps without throwing and never returns a runaway match", () => {
    for (const t of tasks) expect(mapTask(index, t).nodeIds.length).toBeLessThanOrEqual(10);
  });
});
