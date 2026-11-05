import { NextResponse } from "next/server";
import { HttpError, handle, parseBody, requireUser } from "@/lib/api";
import { store } from "@/lib/store";
import { patchTaskInput, type TaskDoc } from "@/features/tasks/model";
import { requireWorkspaceAccess } from "@/features/workspace/server";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ workspaceId: string; taskId: string }> };

const key = (wid: string, id: string) => `workspaces/${wid}/tasks/${id}`;

/** Update status or the user's manual file mapping (persisted, and never overwritten by re-imports). */
export const PATCH = (req: Request, ctx: Ctx) => handle(async () => {
  const { workspaceId, taskId } = await ctx.params;
  const { uid } = await requireUser(req);
  await requireWorkspaceAccess(workspaceId, uid, "editor");
  const cur = store.get<Omit<TaskDoc, "id">>(key(workspaceId, taskId));
  if (!cur || cur.syncState === "deleted") throw new HttpError(404, "Task not found");
  const patch = await parseBody(req, patchTaskInput);
  const next = {
    ...cur,
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.manualNodeIds !== undefined ? { manualNodeIds: patch.manualNodeIds?.length ? patch.manualNodeIds : null } : {}),
    updatedAt: Date.now(),
  };
  store.set(key(workspaceId, taskId), next);
  return NextResponse.json({ task: { id: taskId, ...next } });
});

export const DELETE = (req: Request, ctx: Ctx) => handle(async () => {
  const { workspaceId, taskId } = await ctx.params;
  const { uid } = await requireUser(req);
  await requireWorkspaceAccess(workspaceId, uid, "editor");
  if (!store.get(key(workspaceId, taskId))) throw new HttpError(404, "Task not found");
  store.delete(key(workspaceId, taskId));
  return NextResponse.json({ ok: true });
});
