import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Temporary local document store. Paths mirror the planned Firestore layout
 * (e.g. "workspaces/abc/tasks/t1"), so a Firestore-backed implementation of this
 * same interface can replace it later without touching callers.
 */
const FILE = path.join(process.cwd(), ".data", "db.json");
type Data = Record<string, unknown>;

const g = globalThis as unknown as { __store?: Data };
function load(): Data {
  if (g.__store) return g.__store;
  try { g.__store = JSON.parse(fs.readFileSync(FILE, "utf8")) as Data; } catch { g.__store = {}; }
  return g.__store;
}
function persist() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(g.__store));
}

export const store = {
  get<T>(p: string): T | null { return (load()[p] as T | undefined) ?? null; },
  set<T>(p: string, value: T) { load()[p] = value; persist(); },
  setMany(entries: [string, unknown][]) { const d = load(); for (const [k, v] of entries) d[k] = v; persist(); },
  deletePrefix(prefix: string) { const d = load(); for (const k of Object.keys(d)) if (k.startsWith(prefix)) delete d[k]; persist(); },
  delete(p: string) { delete load()[p]; persist(); },
  /** Direct children of a collection path, e.g. list("workspaces"). */
  list<T>(collection: string): (T & { id: string })[] {
    const prefix = `${collection}/`;
    return Object.entries(load())
      .filter(([k]) => k.startsWith(prefix) && !k.slice(prefix.length).includes("/"))
      .map(([k, v]) => ({ ...(v as T), id: k.slice(prefix.length) }));
  },
  newId: () => crypto.randomUUID().replace(/-/g, "").slice(0, 20),
};
