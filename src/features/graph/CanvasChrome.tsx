"use client";
import Link from "next/link";
import clsx from "clsx";
import { useState } from "react";
import type { GraphIndex } from "./graphIndex";
import { resolveStart } from "@/features/impact/resolve";
import { Icon } from "@/features/ui/icons";
import { useSettings } from "@/stores/settings";
import { useCanvas } from "@/stores/canvas";

const fs = (n: number) => `text-[length:calc(${n}px*var(--fs-scale))]`;

/** Top bar: breadcrumb on the left, quick actions on the right. */
export function TopBar({ workspaceName, onImport }: { workspaceName: string; onImport: () => void }) {
  const viewMode = useCanvas((s) => s.viewMode);
  const { theme, setTheme } = useSettings();
  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[var(--sep)] bg-[var(--surface-solid)] pl-16 pr-4 md:px-7">
      <nav aria-label="Breadcrumb" className={clsx("flex min-w-0 items-center gap-2 text-[var(--text-2)]", fs(15))}>
        <Link href="/" className="hover:text-[var(--text)]">Workspaces</Link>
        <span aria-hidden>/</span>
        <span className="hidden truncate sm:inline">{workspaceName}</span>
        <span aria-hidden className="hidden sm:inline">/</span>
        <span className="font-semibold text-[var(--text)]">{viewMode === "canvas" ? "Impact canvas" : viewMode === "tasks" ? "Tasks" : "Module list"}</span>
      </nav>
      <div className="flex items-center gap-2.5">
        <button onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} aria-pressed={theme === "dark"}
          className="grid size-9 place-items-center rounded-full border border-[var(--sep)] hover:bg-[var(--chip)]"><Icon name={dark ? "sun" : "moon"} size={16} /></button>
        <button onClick={onImport}
          className={clsx("flex items-center gap-1.5 rounded-full border border-[var(--accent)] px-4 py-1.5 font-medium text-[var(--brand-text)] hover:bg-[var(--brand-tint)]", fs(13))}>
          Import graph <Icon name="sparkle" size={14} />
        </button>
        <span aria-label="Local user" className="grid size-9 place-items-center rounded-full bg-[var(--brand-tint)] font-semibold text-[var(--brand-text)]" style={{ fontSize: 12 }}>LU</span>
      </div>
    </header>
  );
}

/** Floating card over the canvas: title, impact query, status and primary actions. */
export function HeaderCard({ index, title, stats }: { index: GraphIndex; title: string; stats: string }) {
  const { startIds, setStart, clearStart } = useCanvas();
  const [q, setQ] = useState("");
  const [miss, setMiss] = useState(false);

  function run(e: React.FormEvent) {
    e.preventDefault();
    const r = resolveStart(index, q);
    if (!r) { setMiss(true); return; }
    setMiss(false);
    setStart(r.nodeIds, q.trim(), `${r.explain} · ${r.nodeIds.length} start file${r.nodeIds.length === 1 ? "" : "s"} · ${Math.round(r.confidence * 100)}% confident`);
  }

  return (
    <div className="glass flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-2.5">
      <Link href="/" aria-label="Back to workspaces" className="grid size-8 place-items-center rounded-full hover:bg-[var(--chip)]"><Icon name="back" size={17} /></Link>
      <h1 className={clsx("max-w-[14rem] truncate font-semibold", fs(16))}>{title}</h1>
      <span className={clsx("rounded-md bg-[var(--chip)] px-2 py-0.5 font-medium uppercase tracking-wide text-[var(--text-2)]", fs(10))}>Graph</span>

      <form role="search" onSubmit={run} className="order-last flex min-w-[240px] flex-1 items-center gap-2 md:order-none">
        <label className="sr-only" htmlFor="impact-q">File path, module or keyword</label>
        <div className="relative flex-1">
          <Icon name="search" size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-2)]" />
          <input id="impact-q" value={q} onChange={(e) => { setQ(e.target.value); setMiss(false); }} aria-invalid={miss}
            placeholder={miss ? "No match — try different words, a file path or a module id" : "Paste a task, e.g. “Edit event form: speakers added”"}
            className={clsx("w-full rounded-full border bg-[var(--bg)] py-2 pl-9 pr-4", fs(13), miss ? "border-[var(--ios-red)]" : "border-[var(--sep)]")} />
        </div>
        <button type="submit" className={clsx("rounded-full bg-[var(--accent)] px-5 py-2 font-semibold text-[var(--accent-fg)] hover:opacity-90", fs(13))}>Analyze</button>
      </form>

      <span className={clsx("ml-auto flex items-center gap-1.5 font-medium", fs(12))} style={{ color: "var(--teal)" }}>
        <Icon name="refresh" size={14} /> {stats}
      </span>
      {startIds.length > 0 && (
        <>
          <span aria-hidden className="h-5 w-px bg-[var(--sep)]" />
          <button onClick={() => { clearStart(); setQ(""); }}
            className={clsx("rounded-full border border-[var(--sep)] px-4 py-1.5 font-medium hover:bg-[var(--chip)]", fs(13))}>Clear</button>
        </>
      )}
    </div>
  );
}

/** Floating pill toolbar at the bottom of the canvas (depth, filters, view). */
export function BottomBar({ index }: { index: GraphIndex }) {
  const s = useCanvas();
  const types = [...new Set([...index.nodes.values()].filter((n) => n.kind === "file").map((n) => n.type))].sort();
  const sel = clsx("rounded-full bg-transparent py-1.5 pl-3 pr-2 hover:bg-[var(--chip)]", fs(12));
  return (
    <div role="toolbar" aria-label="Canvas controls"
      className="glass flex max-w-full items-center gap-1 overflow-x-auto rounded-full p-1.5">
      <span className={clsx("flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 font-semibold text-[var(--accent-fg)]", fs(13))}>
        <Icon name="sparkle" size={15} /> Impact
      </span>

      <div role="radiogroup" aria-label="Depth" className="flex shrink-0 items-center gap-0.5 px-1">
        <Icon name="layers" size={15} className="mr-1 text-[var(--text-2)]" />
        {[1, 2, 3, 4, 5].map((d) => (
          <button key={d} role="radio" aria-checked={s.depth === d} aria-label={`Depth ${d}`} onClick={() => s.setDepth(d)}
            className={clsx("grid size-7 place-items-center rounded-full", fs(12), s.depth === d ? "bg-[var(--brand-tint)] font-semibold text-[var(--brand-text)]" : "text-[var(--text-2)] hover:bg-[var(--chip)]")}>{d}</button>
        ))}
      </div>
      <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-[var(--sep)]" />

      <button aria-pressed={s.verifiedOnly} onClick={() => s.setVerifiedOnly(!s.verifiedOnly)}
        className={clsx("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5", fs(12), s.verifiedOnly ? "bg-[var(--brand-tint)] font-semibold text-[var(--brand-text)]" : "hover:bg-[var(--chip)]")}>
        <Icon name="check" size={14} /> Verified only
      </button>

      <button aria-pressed={s.focusImpact} onClick={() => s.setFocusImpact(!s.focusImpact)} title="Show only impacted files inside expanded modules"
        className={clsx("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5", fs(12), s.focusImpact ? "bg-[var(--brand-tint)] font-semibold text-[var(--brand-text)]" : "hover:bg-[var(--chip)]")}>
        <Icon name="filter" size={14} /> Focus
      </button>

      <label className="sr-only" htmlFor="f-mod">Filter by module</label>
      <select id="f-mod" className={sel} value={s.moduleFilter[0] ?? ""} onChange={(e) => s.setModuleFilter(e.target.value ? [e.target.value] : [])}>
        <option value="">All modules</option>
        {index.graph.modules.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
      </select>
      <label className="sr-only" htmlFor="f-type">Filter by node type</label>
      <select id="f-type" className={sel} value={s.typeFilter[0] ?? ""} onChange={(e) => s.setTypeFilter(e.target.value ? [e.target.value] : [])}>
        <option value="">All types</option>
        {types.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-[var(--sep)]" />

      <div role="radiogroup" aria-label="View" className="flex shrink-0 rounded-full bg-[var(--chip)] p-0.5">
        {(["canvas", "list"] as const).map((v) => (
          <button key={v} role="radio" aria-checked={s.viewMode === v} onClick={() => s.setViewMode(v)}
            className={clsx("rounded-full px-3.5 py-1.5 font-medium", fs(12), s.viewMode === v ? "bg-[var(--surface-solid)] shadow-sm" : "text-[var(--text-2)]")}>
            {v === "canvas" ? "Canvas" : "List"}
          </button>
        ))}
      </div>
    </div>
  );
}
