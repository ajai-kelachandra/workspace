"use client";
import { useState } from "react";
import { GlassPanel, PillButton } from "@/features/ui/primitives";
import { apiFetch } from "@/lib/api-client";
import { graphSchema } from "./schema";

/** Upload or paste an architecture.graph.json. Validated here for fast feedback and again on the server. */
export function GraphImport({ workspaceId, onDone }: { workspaceId: string; onDone: () => void }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setMsg(null);
    let json: unknown;
    try { json = JSON.parse(text); } catch { return setMsg({ ok: false, text: "That is not valid JSON." }); }
    const parsed = graphSchema.safeParse(json);
    if (!parsed.success) {
      const i = parsed.error.issues.slice(0, 3).map((x) => `${x.path.join(".") || "graph"}: ${x.message}`).join("; ");
      return setMsg({ ok: false, text: `Invalid graph file. ${i}` });
    }
    setBusy(true);
    try {
      const r = await apiFetch<{ nodeCount: number; edgeCount: number; chunks: number }>(`/api/workspaces/${workspaceId}/graph`, { body: json });
      setMsg({ ok: true, text: `Imported ${r.nodeCount} nodes and ${r.edgeCount} edges in ${r.chunks} chunks.` });
      onDone();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Import failed" }); }
    finally { setBusy(false); }
  }

  return (
    <GlassPanel className="space-y-3">
      <h2 className="text-[length:calc(20px*var(--fs-scale))] font-semibold">Import architecture graph</h2>
      <p className="text-[length:calc(14px*var(--fs-scale))] text-[var(--text-2)]">Upload or paste an <code>architecture.graph.json</code> (modules, moduleEdges, nodes, edges).</p>
      <input
        type="file" accept=".json,application/json" aria-label="Upload architecture.graph.json"
        className="block w-full text-[length:calc(14px*var(--fs-scale))] file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:text-[var(--accent-fg)]"
        onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }}
      />
      <label className="sr-only" htmlFor="graph-json">Graph JSON</label>
      <textarea
        id="graph-json" value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="…or paste JSON here"
        className="w-full rounded-xl border border-[var(--sep)] bg-[var(--surface-solid)] p-3 font-mono text-[length:calc(12px*var(--fs-scale))]"
      />
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-[var(--ios-green)]" : "text-[var(--ios-red)]"}>{msg.text}</p>}
      <PillButton onClick={submit} disabled={busy || !text.trim()}>{busy ? "Importing…" : "Import"}</PillButton>
    </GlassPanel>
  );
}
