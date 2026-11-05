import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { upsertTasks, type TaskDoc } from "./model";
import { parseTasks, splitRecords } from "./parse";

const example = readFileSync("fixtures/tasks.example.txt", "utf8");

describe("parseTasks on the real example list", () => {
  const tasks = parseTasks(example);

  it("finds all 9 tasks: plain bullets, multi-line quoted, and quoted without bullets", () => {
    expect(tasks).toHaveLength(9);
  });

  it("extracts the trailing type tag and removes it from the text", () => {
    expect(tasks.map((t) => t.kind)).toEqual(["bug", null, "bug", "requirement", "requirement", "requirement", "modification", null, null]);
    expect(tasks[0].text).not.toMatch(/- bug/);
    expect(tasks[2].text).toBe("Missing mandatory details : opens for users with no mobile number, and the asterisks are orange.");
  });

  it("splits 'Title: description' and handles a space before the colon", () => {
    expect(tasks[0]).toMatchObject({ title: "Event Saved", description: "Availability now sent as a boolean (online and offline pages)." });
    expect(tasks[2].title).toBe("Missing mandatory details");
    expect(tasks[6]).toMatchObject({ title: "Edit event form", description: "saved speakers added in form" });
  });

  it("uses the first sentence as title when there is no colon", () => {
    expect(tasks[1]).toMatchObject({ title: "CSAT and NPS modals to live build", description: "" });
    expect(tasks[7].title).toBe("Locked down the Event Dashboard");
    expect(tasks[7].description).toContain("Only users flagged as PIC");
  });

  it("joins multi-line quoted items and unescapes doubled quotes", () => {
    expect(tasks[8].text).toContain('"Event Dashboard" option in their profile menu');
    expect(tasks[8].text).toContain('under "View Profile".');
    expect(tasks[8].text).not.toContain("\n");
  });
});

describe("splitRecords edge cases", () => {
  it("handles CRLF, blank lines, numbered bullets and indented continuations", () => {
    const r = parseTasks("1. First task here\r\n   continues on next line\r\n\r\n2) Second task here");
    expect(r.map((t) => t.text)).toEqual(["First task here continues on next line", "Second task here"]);
  });
  it("does not swallow the rest of the paste when a quote is never closed", () => {
    expect(splitRecords('"- broken\n- good one\n- another').length).toBe(3);
  });
  it("de-duplicates repeated lines", () => {
    expect(parseTasks("- Same thing\n- same thing\n")).toHaveLength(1);
  });
  it("ignores empty input", () => {
    expect(parseTasks("  \n\n")).toEqual([]);
  });
});

describe("upsertTasks is idempotent", () => {
  const parsed = parseTasks(example);
  const first = upsertTasks([], parsed, 1);

  it("adds everything the first time", () => {
    expect(first).toMatchObject({ added: 9, updated: 0, unchanged: 0 });
    expect(first.tasks.every((t) => t.status === "todo")).toBe(true);
  });

  it("changes nothing when the same list is imported again", () => {
    const again = upsertTasks(first.tasks, parsed, 2);
    expect(again).toMatchObject({ added: 0, updated: 0, unchanged: 9, tasks: [] });
  });

  it("updates a changed tag but keeps the user's status and manual mapping", () => {
    const edited: TaskDoc[] = first.tasks.map((t, i) => (i === 3 ? { ...t, status: "done", manualNodeIds: ["x"] } : t));
    const changed = parsed.map((p, i) => (i === 3 ? { ...p, kind: "bug" as const } : p));
    const r = upsertTasks(edited, changed, 3);
    expect(r).toMatchObject({ added: 0, updated: 1, unchanged: 8 });
    expect(r.tasks[0]).toMatchObject({ kind: "bug", status: "done", manualNodeIds: ["x"], updatedAt: 3 });
  });
});

describe("task order", () => {
  it("keeps the pasted order via createdAt", () => {
    const r = upsertTasks([], parseTasks("- Third? no\n- Alpha thing\n- Beta thing"), 100);
    expect(r.tasks.map((t) => t.createdAt)).toEqual([100, 101, 102]);
    expect(r.tasks.map((t) => t.title)).toEqual(["Third? no", "Alpha thing", "Beta thing"]);
  });
});
