import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/api";
import { requireWorkspaceAccess } from "@/features/workspace/server";

export const runtime = "nodejs";

export const GET = (req: Request, ctx: { params: Promise<{ workspaceId: string }> }) => handle(async () => {
  const { workspaceId } = await ctx.params;
  const { uid } = await requireUser(req);
  const { ws } = await requireWorkspaceAccess(workspaceId, uid);
  return NextResponse.json({ ws });
});
