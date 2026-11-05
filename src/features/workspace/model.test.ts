import { describe, expect, it } from "vitest";
import { canEdit, createWorkspaceInput, newWorkspaceDoc, roleOf, withMember } from "./model";

describe("workspace model", () => {
  it("creates a doc owned by the creator", () => {
    const d = newWorkspaceDoc("u1", "Acme", 1);
    expect(d.members).toEqual(["u1"]);
    expect(roleOf(d, "u1")).toBe("owner");
    expect(roleOf(d, "u2")).toBeNull();
  });
  it("adds members without demoting the owner or duplicating", () => {
    let d = newWorkspaceDoc("u1", "A", 1);
    d = withMember(d, "u2", "viewer");
    d = withMember(d, "u2", "editor");
    d = withMember(d, "u1", "viewer");
    expect(d.members).toEqual(["u1", "u2"]);
    expect(d.memberRoles).toEqual({ u1: "owner", u2: "editor" });
  });
  it("only owner/editor can edit", () => {
    expect(canEdit("viewer")).toBe(false);
    expect(canEdit(null)).toBe(false);
    expect(canEdit("editor")).toBe(true);
  });
  it("validates names", () => {
    expect(createWorkspaceInput.safeParse({ name: "  " }).success).toBe(false);
    expect(createWorkspaceInput.parse({ name: " X " }).name).toBe("X");
  });
});
