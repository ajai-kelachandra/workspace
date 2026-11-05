import { NextResponse } from "next/server";
import { handle, parseBody, requireUser } from "@/lib/api";
import { graphSchema } from "@/features/graph/schema";
import { loadActiveGraph, saveGraph } from "@/features/graph/storage";
import { requireWorkspaceAccess } from "@/features/workspace/server";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ workspaceId: string }> };

export const GET = (req: Request, ctx: Ctx) => handle(async () => {
  const { workspaceId } = await ctx.params;
  const { uid } = await requireUser(req);
  const { ws } = await requireWorkspaceAccess(workspaceId, uid);
  return NextResponse.json({ graph: loadActiveGraph(workspaceId, ws) });
});

export const POST = (req: Request, ctx: Ctx) => handle(async () => {
  const { workspaceId } = await ctx.params;
  const { uid } = await requireUser(req);
  const { ws } = await requireWorkspaceAccess(workspaceId, uid, "editor");
  const graph = await parseBody(req, graphSchema);
  return NextResponse.json(saveGraph(workspaceId, graph, uid, ws), { status: 201 });
});
