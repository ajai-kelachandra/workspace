import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/**
 * Auth is not configured yet: every request is the single local user.
 * Every route already calls this, so real auth only needs to change this function.
 */
export const LOCAL_USER = { uid: "local-user" };
export async function requireUser(_req: Request): Promise<{ uid: string }> {
  return LOCAL_USER;
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try { raw = await req.json(); } catch { throw new HttpError(400, "Invalid JSON"); }
  return schema.parse(raw);
}

/** Wraps a handler with uniform error handling. */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e) => {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof ZodError) return NextResponse.json({ error: "Validation failed", issues: e.issues }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  });
}
