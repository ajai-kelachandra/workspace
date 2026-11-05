"use client";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { moduleOf, type GraphIndex } from "@/features/graph/graphIndex";
import { analyzeImpact, type RiskLevel } from "@/features/impact/engine";
import { Icon } from "@/features/ui/icons";
import { useCanvas } from "@/stores/canvas";
import { mapTask } from "./map";
import { TASK_STATUSES, type TaskDoc, type TaskStatus } from "./model";
import { TASK_KINDS } from "./parse";
import { useTasks } from "./useTasks";

const fs = (n: number) => `text-[length:calc(${n}px*var(--fs-scale))]`;
const soft = (c: string) => `color-mix(in srgb, ${c} 14%, transparent)`;
const KIND_COLOR: Record<string, string> = {
  bug: "var(--ios-red)", requirement: "var(--ios-blue)", modification: "var(--ios-yellow)",
  enhancement: "var(--ios-green)", feature: "var(--ios-green)", improvement: "var(--ios-green)", task: "var(--ios-gray)", chore: "var(--ios-gray)",
};
const RISK_COLOR: Record<RiskLevel, string> = { low: "var(--ios-green)", medium: "var(--ios-orange)", high: "var(--ios-red)" };
const STATUS_LABEL: Record<TaskStatus, string> = { todo: "To do", "in-progress": "In progress", done: "Done" };

function Pill({ color, children, title }: { color: string; children: React.ReactNode; title?: string }) {
  return <span title={title} className={clsx("rounded-md px-2 py-0.5 font-semibold", fs(11))} style={{ background: soft(color), color }}>{children}</span>;
}

/** Lets the user pick the exact files a task touches. Saved corrections override automatic mapping. */
function MappingEditor({ index, current, onSave, onReset, onClose, hasManual }: {
  index: GraphIndex; current: string[]; hasManual: boolean; onSave: (ids: string[]) => void; onReset: () => void; onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(current);
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return [...index.nodes.values()]
      .filter((n) => n.kind === "file" && words.every((w) => (n.path ?? n.id).toLowerCase().includes(w)))
      .slice(0, 8).map((n) => n.id);
  }, [q, index]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const row = "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--chip)]";
  return (
    <div className="mt-3 rounded-xl border border-[var(--sep)] bg-[var(--bg)] p-3">
      <label className="sr-only" htmlFor="map-q">Search files</label>
      <input id="map-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files to add, e.g. NavBar or event form"
        className={clsx("w-full rounded-full border border-[var(--sep)] bg-[var(--surface-solid)] px-4 py-2", fs(13))} />
      {results.length > 0 && (
        <ul className="mt-2" aria-label="Search results">
          {results.map((id) => (
            <li key={id}><button className={clsx(row, fs(12))} onClick={() => toggle(id)} aria-pressed={picked.includes(id)}>
              <span className={clsx("grid size-4 place-items-center rounded border", picked.includes(id) ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--sep)]")}>
                {picked.includes(id) && <Icon name="check" size={11} />}
              </span><span className="truncate">{id}</span></button></li>
          ))}
        </ul>
      )}
      <p className={clsx("mb-1 mt-3 text-[var(--text-2)]", fs(11))}>Selected ({picked.length})</p>
      <ul className="max-h-36 overflow-auto">
        {picked.map((id) => (
          <li key={id}><button className={clsx(row, fs(12))} onClick={() => toggle(id)} aria-label={`Remove ${id}`}>
            <Icon name="x" size={12} className="text-[var(--text-2)]" /><span className="truncate">{id}</span></button></li>
        ))}
        {picked.length === 0 && <li className={clsx("px-2.5 text-[var(--text-2)]", fs(12))}>Nothing selected.</li>}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={!picked.length} onClick={() => onSave(picked)} className={clsx("rounded-full bg-[var(--accent)] px-4 py-1.5 font-semibold text-[var(--accent-fg)] disabled:opacity-40", fs(12))}>Save mapping</button>
        {hasManual && <button onClick={onReset} className={clsx("rounded-full border border-[var(--sep)] px-4 py-1.5 font-medium hover:bg-[var(--chip)]", fs(12))}>Back to automatic</button>}
        <button onClick={onClose} className={clsx("rounded-full px-3 py-1.5 text-[var(--text-2)] hover:bg-[var(--chip)]", fs(12))}>Cancel</button>
      </div>
    </div>
  );
}

export function TaskBoard({ index, workspaceId }: { index: GraphIndex; workspaceId: string }) {
  const { tasks, error, importText, patch, remove } = useTasks(workspaceId);
  const { depth, verifiedOnly, setStart, setViewMode } = useCanvas();
  const [showImport, setShowImport] = useState(false);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<string>("all");
  const [editing, setEditing] = useState<string | null>(null);

  // mapping and impact are derived live from the graph, so re-importing the graph re-maps everything
  const rows = useMemo(() => (tasks ?? []).map((t) => {
    const mapping = mapTask(index, t);
    const impact = mapping.nodeIds.length ? analyzeImpact(index, { startNodeIds: mapping.nodeIds, depth, verifiedOnly }) : null;
    return { t, mapping, impact };
  }), [tasks, index, depth, verifiedOnly]);
  const shown = rows.filter((r) => kind === "all" || r.t.kind === kind || (kind === "untagged" && !r.t.kind));

  async function doImport() {
    setBusy(true); setMsg(null);
    try {
      const r = await importText(text);
      setMsg({ ok: true, text: `Found ${r.parsed} tasks: ${r.added} added, ${r.updated} updated, ${r.unchanged} unchanged.` });
      if (r.added || r.updated) setText("");
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Import failed" }); }
    finally { setBusy(false); }
  }

  function open(t: TaskDoc, ids: string[], explain: string) {
    setStart(ids, t.title, explain);
    setViewMode("canvas");
  }

  const chip = (active: boolean) => clsx("rounded-full px-3 py-1 font-medium", fs(12), active ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "border border-[var(--sep)] hover:bg-[var(--chip)]");
  return (
    <div className="mx-auto h-full max-w-4xl overflow-auto px-4 pb-24 pt-[84px]">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className={clsx("mr-2 font-semibold", fs(20))}>Tasks <span className={clsx("font-normal text-[var(--text-2)]", fs(14))}>{tasks?.length ?? "…"}</span></h2>
        {["all", ...TASK_KINDS.filter((k) => rows.some((r) => r.t.kind === k)), ...(rows.some((r) => !r.t.kind) ? ["untagged"] : [])].map((k) => (
          <button key={k} className={chip(kind === k)} aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>
        ))}
        <button onClick={() => setShowImport((v) => !v)} aria-expanded={showImport}
          className={clsx("ml-auto flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 font-semibold text-[var(--accent-fg)]", fs(13))}>
          <Icon name="plus" size={14} /> Import tasks
        </button>
      </div>

      {showImport && (
        <section className="glass mb-4 rounded-2xl p-4" aria-label="Import tasks">
          <p className={clsx("mb-2 text-[var(--text-2)]", fs(12))}>
            Paste your list: one task per line starting with “- ”, or quoted multi-line items. Add a trailing “- bug”, “- requirement” or “- modification” to tag it. Re-pasting the same list changes nothing.
          </p>
          <label className="sr-only" htmlFor="tasks-text">Task list</label>
          <textarea id="tasks-text" value={text} onChange={(e) => setText(e.target.value)} rows={8}
            placeholder={'- Edit event form: saved speakers added in form - modification\n"- Missing mandatory details: opens for users with no mobile number\n - bug"'}
            className={clsx("w-full rounded-xl border border-[var(--sep)] bg-[var(--surface-solid)] p-3 font-mono", fs(12))} />
          {msg && <p role={msg.ok ? "status" : "alert"} className={clsx("mt-2", fs(12), msg.ok ? "text-[var(--ios-green)]" : "text-[var(--ios-red)]")}>{msg.text}</p>}
          <button onClick={doImport} disabled={busy || !text.trim()} className={clsx("mt-3 rounded-full bg-[var(--accent)] px-5 py-2 font-semibold text-[var(--accent-fg)] disabled:opacity-40", fs(13))}>{busy ? "Importing…" : "Import"}</button>
        </section>
      )}

      {error && <p role="alert" className="mb-3 text-[var(--ios-red)]">{error}</p>}
      {tasks && tasks.length === 0 && !showImport && (
        <div className="glass rounded-2xl p-8 text-center text-[var(--text-2)]">No tasks yet. Use “Import tasks” to paste your list.</div>
      )}

      <ul className="space-y-3" aria-label="Tasks">
        {shown.map(({ t, mapping, impact }) => {
          const pct = Math.round(mapping.confidence * 100);
          const low = mapping.matchedBy !== "manual" && mapping.confidence < 0.5;
          const mods = impact ? Object.entries(impact.modules).sort((a, b) => b[1] - a[1]) : [];
          return (
            <li key={t.id} className="glass rounded-2xl p-4">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                {t.kind && <Pill color={KIND_COLOR[t.kind]}>{t.kind}</Pill>}
                <h3 className={clsx("min-w-0 flex-1 font-semibold", fs(15))}>{t.title}</h3>
                {impact && <Pill color={RISK_COLOR[impact.risk]} title="Risk from the impact analysis">{impact.risk.toUpperCase()} RISK</Pill>}
                <label className="sr-only" htmlFor={`st-${t.id}`}>Status</label>
                <select id={`st-${t.id}`} value={t.status} onChange={(e) => void patch(t.id, { status: e.target.value as TaskStatus })}
                  className={clsx("rounded-full border border-[var(--sep)] bg-transparent px-2.5 py-1", fs(12))}>
                  {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
                <button aria-label={`Delete task ${t.title}`} onClick={() => void remove(t.id)} className="grid size-7 place-items-center rounded-full text-[var(--text-2)] hover:bg-[var(--chip)]"><Icon name="x" size={14} /></button>
              </div>
              {t.description && <p className={clsx("mt-1 line-clamp-2 text-[var(--text-2)]", fs(13))}>{t.description}</p>}

              <div className={clsx("mt-3 flex flex-wrap items-center gap-1.5", fs(12))}>
                <Pill color={low ? "var(--ios-red)" : pct >= 70 ? "var(--ios-green)" : "var(--ios-orange)"} title={mapping.explain}>
                  {mapping.matchedBy === "manual" ? "Manual mapping" : mapping.matchedBy === "none" ? "No match" : `${pct}% match`}
                </Pill>
                {low && <span className="font-medium text-[var(--ios-red)]">Check mapping</span>}
                {mapping.nodeIds.slice(0, 3).map((id) => (
                  <span key={id} title={id} className="max-w-[16rem] truncate rounded-md bg-[var(--chip)] px-2 py-0.5">{id.split("/").pop()}</span>
                ))}
                {mapping.nodeIds.length > 3 && <span className="text-[var(--text-2)]">+{mapping.nodeIds.length - 3} more</span>}
              </div>
              {mods.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Affected modules">
                  {mods.slice(0, 5).map(([m, c]) => (
                    <li key={m} className={clsx("rounded-full border border-[var(--sep)] px-2.5 py-0.5", fs(11))}>{m} · {c}</li>
                  ))}
                  {mods.length > 5 && <li className={clsx("px-1 text-[var(--text-2)]", fs(11))}>+{mods.length - 5} modules</li>}
                </ul>
              )}
              {!mapping.nodeIds.length && <p className={clsx("mt-2 text-[var(--text-2)]", fs(12))}>{mapping.explain}</p>}

              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={!mapping.nodeIds.length} onClick={() => open(t, mapping.nodeIds, mapping.explain)}
                  className={clsx("rounded-full bg-[var(--accent)] px-4 py-1.5 font-semibold text-[var(--accent-fg)] disabled:opacity-40", fs(12))}>Open on canvas</button>
                <button onClick={() => setEditing(editing === t.id ? null : t.id)} aria-expanded={editing === t.id}
                  className={clsx("rounded-full border border-[var(--sep)] px-4 py-1.5 font-medium hover:bg-[var(--chip)]", fs(12))}>Edit mapping</button>
              </div>
              {editing === t.id && (
                <MappingEditor index={index} current={mapping.nodeIds} hasManual={!!t.manualNodeIds}
                  onSave={(ids) => { void patch(t.id, { manualNodeIds: ids }); setEditing(null); }}
                  onReset={() => { void patch(t.id, { manualNodeIds: null }); setEditing(null); }}
                  onClose={() => setEditing(null)} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
