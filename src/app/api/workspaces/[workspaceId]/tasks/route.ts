import { NextResponse } from "next/server";
import { handle, parseBody, requireUser } from "@/lib/api";
import { store } from "@/lib/store";
import { importTasksInput, upsertTasks, type TaskDoc } from "@/features/tasks/model";
import { parseTasks } from "@/features/tasks/parse";
import { requireWorkspaceAccess } from "@/features/workspace/server";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ workspaceId: string }> };

const listTasks = (wid: string) =>
  store.list<Omit<TaskDoc, "id">>(`workspaces/${wid}/tasks`)
    .filter((t) => t.syncState !== "deleted")
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));

export const GET = (req: Request, ctx: Ctx) => handle(async () => {
  const { workspaceId } = await ctx.params;
  const { uid } = await requireUser(req);
  await requireWorkspaceAccess(workspaceId, uid);
  return NextResponse.json({ tasks: listTasks(workspaceId) });
});

/** Imports pasted task text. Idempotent: the same list again changes nothing. */
export const POST = (req: Request, ctx: Ctx) => handle(async () => {
  const { workspaceId } = await ctx.params;
  const { uid } = await requireUser(req);
  await requireWorkspaceAccess(workspaceId, uid, "editor");
  const { text } = await parseBody(req, importTasksInput);

  const parsed = parseTasks(text);
  const existing = listTasks(workspaceId) as TaskDoc[];
  const result = upsertTasks(existing, parsed);
  const base = `workspaces/${workspaceId}`;
  store.setMany([
    ...result.tasks.map(({ id, ...doc }): [string, unknown] => [`${base}/tasks/${id}`, doc]),
    // history: one record per import
    [`${base}/syncRuns/${store.newId()}`, {
      trigger: "paste", createdAt: Date.now(), createdBy: uid,
      parsed: parsed.length, added: result.added, updated: result.updated, unchanged: result.unchanged,
    }],
  ]);
  return NextResponse.json(
    { parsed: parsed.length, added: result.added, updated: result.updated, unchanged: result.unchanged, tasks: listTasks(workspaceId) },
    { status: 201 },
  );
});
