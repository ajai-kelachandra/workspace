"use client";
import { motion } from "framer-motion";
import clsx from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import { moduleOf, type GraphIndex } from "./graphIndex";
import type { ImpactResult } from "@/features/impact/engine";
import { Icon } from "@/features/ui/icons";
import { useCanvas } from "@/stores/canvas";
import { GlyphBadge, ROLE_LABEL, tint } from "./nodes";
import { ROLE_COLOR, type Role } from "./view";

const fs = (n: number) => `text-[length:calc(${n}px*var(--fs-scale))]`;
const soft = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

/** Collapsible section with a chevron, like "Next Step" / "Validation Rules" in the reference. */
function Section({ title, badge, defaultOpen = true, children }: { title: string; badge?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-[var(--sep)] py-3 last:border-0">
      <button aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <span className={clsx("flex items-center gap-2 font-semibold", fs(14))}>{title}{badge}</span>
        <Icon name="chevD" size={16} className={clsx("text-[var(--text-2)] transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}

const Count = ({ n }: { n: number }) => (
  <span className={clsx("rounded-md bg-[var(--chip)] px-1.5 py-0.5 font-normal text-[var(--text-2)]", fs(10))}>{n}</span>
);

/** Bordered field card: label row on top, value in a soft box (like the Full Name / Email cards). */
function Field({ icon, label, value }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; value: ReactNode }) {
  return (
    <div className="mb-2 rounded-xl border border-[var(--sep)] bg-[var(--surface-solid)] p-1.5 shadow-[var(--shadow)]">
      <div className={clsx("flex items-center gap-2 px-2 py-1.5 font-medium", fs(12))}>
        <Icon name={icon} size={14} className="text-[var(--text-2)]" />{label}
      </div>
      <div className={clsx("break-all rounded-lg bg-[var(--chip)] px-2.5 py-2 text-[var(--text-2)]", fs(12))}>{value}</div>
    </div>
  );
}

export function SidePanel({ index, impact }: { index: GraphIndex; impact: ImpactResult | null }) {
  const selectedId = useCanvas((s) => s.selectedId);
  const select = useCanvas((s) => s.select);
  const setStart = useCanvas((s) => s.setStart);
  const toggleSafe = useCanvas((s) => s.toggleSafe);
  const safe = useCanvas((s) => s.safe);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") select(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);
  if (!selectedId) return null;

  const modId = selectedId.startsWith("mod:") ? selectedId.slice(4) : null;
  const node = modId ? null : index.nodes.get(selectedId);
  const members = modId ? index.byModule.get(modId) ?? [] : [];
  const outs = node ? index.fwd.get(node.id) ?? [] : [];
  const ins = node ? index.rev.get(node.id) ?? [] : [];
  const affected = node ? impact?.affected.find((a) => a.id === node.id) : undefined;
  const mod = modId ? index.graph.modules.find((m) => m.id === modId) : null;

  const name = modId ?? node?.path ?? selectedId;
  const role: Role = (() => {
    if (!impact) return "none";
    if (node) { const r = impact.roles.get(node.id); return !r ? "none" : safe.includes(node.id) && r !== "source" ? "safe" : r; }
    const rank = { source: 3, direct: 2, indirect: 1, safe: 0, none: 0 } as const;
    let best: Role = "none";
    for (const id of members) { const r = impact.roles.get(id); if (r && rank[r] > rank[best]) best = r; }
    return best;
  })();
  const color = role !== "none" ? ROLE_COLOR[role] : tint(modId ?? node?.type ?? "x");
  const primary = clsx("w-full rounded-full bg-[var(--accent)] py-2.5 font-semibold text-[var(--accent-fg)] hover:opacity-90", fs(13));

  const Links = ({ items, dir }: { items: string[]; dir: "in" | "out" | "member" }) =>
    items.length === 0 ? <p className={clsx("text-[var(--text-2)]", fs(12))}>None</p> : (
      <ul className="space-y-1.5">
        {items.slice(0, 150).map((i) => (
          <li key={i}>
            <button onClick={() => select(i)} title={i}
              className={clsx("flex w-full items-center gap-2 rounded-xl border border-[var(--sep)] bg-[var(--surface-solid)] px-3 py-2 text-left shadow-[var(--shadow)] hover:bg-[var(--chip)]", fs(12))}>
              <Icon name={dir === "in" ? "back" : "file"} size={13} className="shrink-0 text-[var(--text-2)]" />
              <span className="truncate">{i}</span>
            </button>
          </li>
        ))}
        {items.length > 150 && <li className={clsx("px-1 text-[var(--text-2)]", fs(11))}>+{items.length - 150} more</li>}
      </ul>
    );

  return (
    <motion.aside
      aria-label={`Details for ${name}`}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }}
      className="glass absolute inset-x-2 bottom-2 z-20 flex max-h-[62%] flex-col overflow-hidden rounded-3xl md:inset-x-auto md:bottom-4 md:right-4 md:top-[84px] md:max-h-none md:w-[330px]"
    >
      <header className="flex items-center gap-2.5 px-4 pb-2 pt-4">
        <GlyphBadge icon={modId ? "box" : "file"} color={color} size={28} />
        <h2 className={clsx("min-w-0 flex-1 truncate font-semibold", fs(16))} title={name}>{modId ?? name.split("/").slice(-1)[0]}</h2>
        {impact && <span className={clsx("rounded-md px-2 py-0.5 font-semibold", fs(10))} style={{ background: soft(color), color }}>{ROLE_LABEL[role]}</span>}
        <button aria-label="Close details" onClick={() => select(null)}
          className="grid size-8 place-items-center rounded-full text-[var(--text-2)] hover:bg-[var(--chip)]"><Icon name="x" size={17} /></button>
      </header>

      <div className="px-4 pb-3">
        <div title={name} className={clsx("truncate rounded-xl border border-[var(--sep)] bg-[var(--surface-solid)] px-3.5 py-2.5", fs(13))}>{name}</div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {node && (
          <>
            <Section title="Details">
              <Field icon="file" label="Module" value={moduleOf(node)} />
              <Field icon="box" label="Kind / type" value={`${node.kind} / ${node.type}`} />
              {node.lines !== undefined && <Field icon="list" label="Lines" value={node.lines} />}
              <Field icon="link" label="Fan-in (importers)" value={
                <>{index.fanIn.get(node.id) ?? 0}{(index.fanIn.get(node.id) ?? 0) >= index.fanInThreshold && <span className="ml-2 font-semibold text-[var(--ios-red)]">High risk</span>}</>
              } />
              {node.client !== undefined && <Field icon="bolt" label="Client component" value={node.client ? "Yes" : "No"} />}
              {node.usesAuthToken !== undefined && <Field icon="check" label="Uses auth token" value={node.usesAuthToken ? "Yes" : "No"} />}
            </Section>

            <Section title="Impact" defaultOpen={!!impact}>
              {!impact && <p className={clsx("text-[var(--text-2)]", fs(12))}>No analysis running. Use “Analyze impact” below to see what depends on this node.</p>}
              {impact && role === "none" && <p className={clsx("text-[var(--text-2)]", fs(12))}>Not affected by the current analysis.</p>}
              {impact && role === "source" && <p className={fs(12)}>This node is a <b>source</b>: {impact.direct.length} direct and {impact.indirect.length} indirect dependents.</p>}
              {affected && (
                <>
                  <p className={clsx("mb-2", fs(12))}>Distance <b>{affected.distance}</b> from the change:</p>
                  <ol className="space-y-1.5">
                    {affected.path.map((p, i) => (
                      <li key={p} className="flex items-center gap-2">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--chip)] text-[10px] font-medium">{i + 1}</span>
                        <button className={clsx("truncate text-left hover:underline", fs(12))} onClick={() => select(p)}>{p}</button>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </Section>

            <Section title="Used by" defaultOpen={false} badge={<Count n={ins.length} />}><Links items={ins.map((e) => e.from)} dir="in" /></Section>
            <Section title="Depends on" defaultOpen={false} badge={<Count n={outs.length} />}><Links items={outs.map((e) => e.to)} dir="out" /></Section>
          </>
        )}

        {modId && (
          <>
            <Section title="Details">
              <Field icon="box" label="Module" value={modId} />
              <Field icon="list" label="Description" value={mod?.description || "—"} />
              <Field icon="file" label="Items" value={members.length} />
              <Field icon="search" label="Keywords" value={mod?.keywords.join(", ") || "—"} />
            </Section>
            <Section title="Items" defaultOpen={false} badge={<Count n={members.length} />}><Links items={members} dir="member" /></Section>
          </>
        )}
      </div>

      <footer className="space-y-2 border-t border-[var(--sep)] p-4">
        {node && <button onClick={() => setStart([node.id], node.id)} className={primary}>Analyze impact</button>}
        {modId && <button onClick={() => setStart(members, modId)} className={primary}>Analyze module impact</button>}
        {node && impact?.roles.has(node.id) && role !== "source" && (
          <button onClick={() => toggleSafe(node.id)}
            className={clsx("flex w-full items-center justify-center gap-1.5 rounded-full border border-[var(--sep)] py-2.5 font-medium shadow-[var(--shadow)] hover:bg-[var(--chip)]", fs(13))}>
            {safe.includes(node.id) ? "Unmark safe" : <>Mark verified safe <Icon name="check" size={14} /></>}
          </button>
        )}
      </footer>
    </motion.aside>
  );
}
