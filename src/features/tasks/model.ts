import { z } from "zod";
import { TASK_KINDS, type ParsedTask } from "./parse";

export const TASK_STATUSES = ["todo", "in-progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const importTasksInput = z.object({ text: z.string().min(1).max(200_000) });
export const patchTaskInput = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  /** user-corrected mapping; null clears it and returns to automatic mapping */
  manualNodeIds: z.array(z.string()).max(500).nullable().optional(),
});

export interface TaskDoc {
  id: string;
  source: "paste" | "sheet";
  title: string;
  description: string;
  text: string;
  kind: (typeof TASK_KINDS)[number] | null;
  status: TaskStatus;
  manualNodeIds: string[] | null;
  syncState: "active" | "deleted";
  createdAt: number;
  updatedAt: number;
}

export interface UpsertResult { tasks: TaskDoc[]; added: number; updated: number; unchanged: number }

/**
 * Idempotent upsert keyed by task id (hash of the text). Re-importing the same list changes nothing;
 * a task whose tag changed is updated; status and manual mapping the user set are never overwritten.
 */
export function upsertTasks(existing: TaskDoc[], parsed: ParsedTask[], now = Date.now()): UpsertResult {
  const byId = new Map(existing.map((t) => [t.id, t]));
  const out: TaskDoc[] = [];
  let added = 0, updated = 0, unchanged = 0;
  for (const [i, p] of parsed.entries()) {
    const cur = byId.get(p.id);
    if (!cur) {
      added++;
      out.push({ id: p.id, source: "paste", title: p.title, description: p.description, text: p.text, kind: p.kind,
        status: "todo", manualNodeIds: null, syncState: "active",
        createdAt: now + i, /* +i keeps the order the user pasted them in */ updatedAt: now });
    } else if (cur.kind !== p.kind || cur.title !== p.title || cur.description !== p.description || cur.syncState !== "active") {
      updated++;
      out.push({ ...cur, title: p.title, description: p.description, kind: p.kind, syncState: "active", updatedAt: now });
    } else {
      unchanged++;
    }
  }
  return { tasks: out, added, updated, unchanged };
}
