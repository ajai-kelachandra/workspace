import { z } from "zod";

export const ROLES = ["owner", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const createWorkspaceInput = z.object({ name: z.string().trim().min(1).max(80) });
export const addMemberInput = z.object({ email: z.string().email(), role: z.enum(["editor", "viewer"]) });

export interface WorkspaceDoc {
  name: string;
  ownerId: string;
  members: string[];
  memberRoles: Record<string, Role>;
  activeGraphId: string | null;
  createdAt: number;
}

export function newWorkspaceDoc(ownerId: string, name: string, now = Date.now()): WorkspaceDoc {
  return { name, ownerId, members: [ownerId], memberRoles: { [ownerId]: "owner" }, activeGraphId: null, createdAt: now };
}

export function roleOf(ws: Pick<WorkspaceDoc, "memberRoles">, uid: string): Role | null {
  return ws.memberRoles[uid] ?? null;
}

export const canEdit = (r: Role | null) => r === "owner" || r === "editor";

export function withMember(ws: WorkspaceDoc, uid: string, role: Exclude<Role, "owner">): WorkspaceDoc {
  if (ws.memberRoles[uid] === "owner") return ws;
  return {
    ...ws,
    members: ws.members.includes(uid) ? ws.members : [...ws.members, uid],
    memberRoles: { ...ws.memberRoles, [uid]: role },
  };
}
