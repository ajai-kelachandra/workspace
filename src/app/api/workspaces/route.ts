import { NextResponse } from "next/server";
import { handle, parseBody, requireUser } from "@/lib/api";
import { store } from "@/lib/store";
import { createWorkspaceInput, newWorkspaceDoc, type WorkspaceDoc } from "@/features/workspace/model";

export const runtime = "nodejs";

export const GET = (req: Request) => handle(async () => {
  const { uid } = await requireUser(req);
  const items = store.list<WorkspaceDoc>("workspaces")
    .filter((w) => w.members.includes(uid))
    .sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ items });
});

export const POST = (req: Request) => handle(async () => {
  const { uid } = await requireUser(req);
  const { name } = await parseBody(req, createWorkspaceInput);
  const id = store.newId();
  store.set(`workspaces/${id}`, newWorkspaceDoc(uid, name));
  return NextResponse.json({ id }, { status: 201 });
});
