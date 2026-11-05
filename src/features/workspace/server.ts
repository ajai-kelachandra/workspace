import "server-only";
import { HttpError } from "@/lib/api";
import { store } from "@/lib/store";
import { canEdit, roleOf, type Role, type WorkspaceDoc } from "./model";

/** Loads the workspace and enforces membership. Use in EVERY workspace-scoped route. */
export async function requireWorkspaceAccess(
  wid: string, uid: string, need: "member" | "editor" | "owner" = "member",
): Promise<{ ws: WorkspaceDoc; role: Role }> {
  const ws = store.get<WorkspaceDoc>(`workspaces/${wid}`);
  // 404 for non-members too, so workspace ids cannot be probed.
  if (!ws) throw new HttpError(404, "Workspace not found");
  const role = roleOf(ws, uid);
  if (!role) throw new HttpError(404, "Workspace not found");
  if (need === "editor" && !canEdit(role)) throw new HttpError(403, "Editor role required");
  if (need === "owner" && role !== "owner") throw new HttpError(403, "Owner role required");
  return { ws, role };
}
