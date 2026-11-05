"use client";
import Link from "next/link";
import clsx from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GraphIndex } from "@/features/graph/graphIndex";
import { moduleOf } from "@/features/graph/graphIndex";
import { ROLE_COLOR } from "@/features/graph/view";
import { tint } from "@/features/graph/nodes";
import type { WorkspaceDoc } from "@/features/workspace/model";
import { apiFetch } from "@/lib/api-client";
import { useCanvas } from "@/stores/canvas";
import { FONTS, useSettings, type FontSize, type Theme } from "@/stores/settings";
import { Icon, Logo, type IconName } from "./icons";

const fs = (n: number) => `text-[length:calc(${n}px*var(--fs-scale))]`;

function Label({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-1 flex items-center justify-between px-3">
      <h3 className={clsx(fs(11), "font-medium uppercase tracking-wider text-[var(--text-2)]")}>{children}</h3>
      {action}
    </div>
  );
}

function Item({ icon, label, active, collapsed, onClick, href, trailing }: {
  icon: IconName; label: string; active?: boolean; collapsed: boolean; onClick?: () => void; href?: string; trailing?: ReactNode;
}) {
  const cls = clsx("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left", fs(14),
    active ? "bg-[var(--chip)] font-semibold" : "text-[var(--text)] hover:bg-[var(--chip)]", collapsed && "justify-center px-0");
  const inner = (<><Icon name={icon} size={18} />{!collapsed && <span className="truncate">{label}</span>}{!collapsed && trailing}</>);
  return href
    ? <Link href={href} title={label} aria-current={active ? "page" : undefined} className={cls}>{inner}</Link>
    : <button title={label} aria-current={active ? "page" : undefined} onClick={onClick} className={cls}>{inner}</button>;
}

function Seg<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full bg-[var(--chip)] p-0.5">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={clsx("flex-1 rounded-full px-2 py-1", fs(12), o.value === value ? "bg-[var(--surface-solid)] font-semibold shadow-sm" : "text-[var(--text-2)]")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sidebar({ workspaceId, workspaceName, index, onImport }: {
  workspaceId: string; workspaceName: string; index: GraphIndex | null; onImport: () => void;
}) {
  const { sidebarOpen, setSidebarOpen, font, setFont, fontSize, setFontSize, theme, setTheme, reset } = useSettings();
  const { viewMode, setViewMode, select, expanded, toggleExpanded } = useCanvas();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [projects, setProjects] = useState<(WorkspaceDoc & { id: string })[]>([]);
  const [q, setQ] = useState("");
  const [miss, setMiss] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const collapsed = !sidebarOpen;

  useEffect(() => {
    apiFetch<{ items: (WorkspaceDoc & { id: string })[] }>("/api/workspaces").then((r) => setProjects(r.items)).catch(() => {});
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSidebarOpen(true); searchRef.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSidebarOpen]);

  /** Find a file by path and jump to it: expands its module and selects the node. */
  function find(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim().toLowerCase();
    if (!index || !term) return;
    const hit = [...index.nodes.values()].find((n) => (n.path ?? n.id).toLowerCase().includes(term));
    if (!hit) { setMiss(true); return; }
    setMiss(false);
    const m = moduleOf(hit);
    if (!expanded.includes(m)) toggleExpanded(m);
    setViewMode("canvas");
    select(hit.id);
    setMobileOpen(false);
  }

  const body = (rail: boolean) => (
    <div className="flex h-full min-h-0 flex-col">
      <div className={clsx("flex items-center gap-2 px-4 pb-3 pt-5", rail && "flex-col px-2")}>
        <Logo size={30} />
        {!rail && <span className={clsx("flex-1 font-semibold", fs(19))}>workspace</span>}
        <button aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} aria-expanded={sidebarOpen}
          onClick={() => { setSidebarOpen(!sidebarOpen); setMobileOpen(false); }}
          className="grid size-8 place-items-center rounded-lg text-[var(--text-2)] hover:bg-[var(--chip)]"><Icon name="sidebar" size={18} /></button>
      </div>

      {!rail && (
        <form onSubmit={find} role="search" className="px-4 pb-3">
          <label className="sr-only" htmlFor="side-search">Find a file</label>
          <div className={clsx("flex items-center gap-2 rounded-xl border bg-[var(--surface-solid)] px-3 py-2", miss ? "border-[var(--ios-red)]" : "border-[var(--sep)]")}>
            <Icon name="search" size={15} className="text-[var(--text-2)]" />
            <input id="side-search" ref={searchRef} value={q} onChange={(e) => { setQ(e.target.value); setMiss(false); }}
              placeholder="Find file…" className={clsx("min-w-0 flex-1 bg-transparent outline-none", fs(13))} style={{ boxShadow: "none" }} />
            <kbd className={clsx("rounded-md border border-[var(--sep)] px-1.5 py-0.5 text-[var(--text-2)]", fs(10))}>Ctrl K</kbd>
          </div>
          {miss && <p role="alert" className={clsx("mt-1 px-1 text-[var(--ios-red)]", fs(11))}>No file matches “{q}”.</p>}
        </form>
      )}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-2">
        <nav aria-label="Overview">
          {!rail && <Label>Overview</Label>}
          <Item collapsed={rail} icon="home" label="All workspaces" href="/" />
          <Item collapsed={rail} icon="canvas" label="Canvas" active={viewMode === "canvas"} onClick={() => { setViewMode("canvas"); setMobileOpen(false); }} />
          <Item collapsed={rail} icon="tasks" label="Tasks" active={viewMode === "tasks"} onClick={() => { setViewMode("tasks"); setMobileOpen(false); }} />
          <Item collapsed={rail} icon="list" label="Module list" active={viewMode === "list"} onClick={() => { setViewMode("list"); setMobileOpen(false); }} />
        </nav>

        {!rail && (
          <nav aria-label="Projects">
            <Label action={<Link href="/" aria-label="New workspace" className="grid size-6 place-items-center rounded-full border border-[var(--sep)] text-[var(--text-2)] hover:bg-[var(--chip)]"><Icon name="plus" size={13} /></Link>}>Projects</Label>
            <ul>
              {projects.map((p) => {
                const active = p.id === workspaceId;
                return (
                  <li key={p.id} className="relative">
                    {active && <span aria-hidden className="absolute -left-2 top-1.5 h-6 w-1 rounded-r-full bg-[var(--accent)]" />}
                    <Link href={`/w/${p.id}`} aria-current={active ? "page" : undefined}
                      className={clsx("flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-[var(--chip)]", fs(14), active && "font-semibold")}>
                      <Icon name="grip" size={14} className="text-[var(--ios-gray)]" />
                      <span aria-hidden className="grid size-6 place-items-center rounded-md text-[11px] font-bold text-white" style={{ background: tint(p.name) }}>{p.name.slice(0, 1).toUpperCase()}</span>
                      <span className="truncate">{p.name}</span>
                      <Icon name="chevD" size={14} className="ml-auto text-[var(--text-2)]" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        <nav aria-label="Tools">
          {!rail && <Label>Tools</Label>}
          <Item collapsed={rail} icon="upload" label="Import graph" onClick={() => { onImport(); setMobileOpen(false); }} />
          <Item collapsed={rail} icon="type" label="Appearance" active={showAppearance && !rail}
            onClick={() => { if (rail) setSidebarOpen(true); setShowAppearance((v) => !v || rail); }}
            trailing={<Icon name="chevD" size={14} className={clsx("ml-auto text-[var(--text-2)] transition-transform", showAppearance && "rotate-180")} />} />
          {showAppearance && !rail && (
            <div className="mx-1 mt-1 space-y-3 rounded-2xl border border-[var(--sep)] p-3">
              <div role="radiogroup" aria-label="Font family" className="space-y-1">
                {FONTS.map((f) => (
                  <button key={f.key} role="radio" aria-checked={font === f.key} onClick={() => setFont(f.key)} style={{ fontFamily: f.stack }}
                    className={clsx("flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left", fs(13),
                      font === f.key ? "bg-[var(--brand-tint)] font-semibold text-[var(--brand-text)]" : "hover:bg-[var(--chip)]")}>
                    {f.label}{font === f.key && <Icon name="check" size={14} />}
                  </button>
                ))}
              </div>
              <Seg<FontSize> label="Text size" value={fontSize} onChange={setFontSize} options={[{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }]} />
              <Seg<Theme> label="Theme" value={theme} onChange={setTheme} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
              <button onClick={reset} className={clsx("text-[var(--text-2)] underline hover:text-[var(--accent)]", fs(11))}>Reset appearance</button>
            </div>
          )}
        </nav>

        {!rail && (
          <section aria-label="Legend" className="px-3">
            <h3 className={clsx("mb-1.5 font-medium uppercase tracking-wider text-[var(--text-2)]", fs(11))}>Legend</h3>
            <ul className={clsx("grid grid-cols-2 gap-x-2 gap-y-1", fs(12))}>
              {([["source", "Source"], ["direct", "Direct"], ["indirect", "Indirect"], ["safe", "Safe"], ["none", "Unaffected"]] as const).map(([k, l]) => (
                <li key={k} className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full" style={{ background: ROLE_COLOR[k] }} />{l}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="p-3">
        <Link href="/" title="Switch workspace" className={clsx("flex items-center gap-3 rounded-2xl bg-[var(--chip)] p-2.5 hover:brightness-95", rail && "justify-center p-1.5")}>
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-[var(--brand-text)]"><Icon name="box" size={18} /></span>
          {!rail && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className={clsx("block truncate font-semibold", fs(13))}>{workspaceName}</span>
                <span className={clsx("block truncate text-[var(--text-2)]", fs(11))}>Local workspace</span>
              </span>
              <Icon name="chevUD" size={16} className="text-[var(--text-2)]" />
            </>
          )}
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <button aria-label="Open menu" onClick={() => setMobileOpen(true)}
        className="glass fixed left-3 top-3 z-30 grid size-10 place-items-center rounded-full md:hidden"><Icon name="sidebar" /></button>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside aria-label="Sidebar" className="relative h-full w-72 max-w-[85vw] bg-[var(--surface-solid)] shadow-2xl">{body(false)}</aside>
        </div>
      )}
      <aside aria-label="Sidebar"
        className={clsx("hidden shrink-0 border-r border-[var(--sep)] bg-[var(--surface-solid)] transition-[width] duration-150 md:block", collapsed ? "w-[76px]" : "w-[264px]")}>
        {body(collapsed)}
      </aside>
    </>
  );
}
