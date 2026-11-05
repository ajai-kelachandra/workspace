"use client";
import clsx from "clsx";
import type { ImpactResult } from "./engine";
import { ROLE_COLOR } from "@/features/graph/view";
import { useCanvas } from "@/stores/canvas";

const RISK = { low: "var(--ios-green)", medium: "var(--ios-orange)", high: "var(--ios-red)" } as const;
const fs = (n: number) => `text-[length:calc(${n}px*var(--fs-scale))]`;
const soft = (c: string) => `color-mix(in srgb, ${c} 14%, transparent)`;

export function ImpactSummary({ impact }: { impact: ImpactResult }) {
  const label = useCanvas((s) => s.startLabel);
  const note = useCanvas((s) => s.startNote);
  const select = useCanvas((s) => s.select);
  const mods = Object.entries(impact.modules).sort((a, b) => b[1] - a[1]);
  const chip = (color: string, text: string) => (
    <span className={clsx("rounded-md px-2 py-0.5 font-semibold", fs(11))} style={{ background: soft(color), color }}>{text}</span>
  );
  return (
    <section aria-label="Impact summary" className={clsx("glass flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-2.5", fs(12))}>
      {chip(RISK[impact.risk], `${impact.risk.toUpperCase()} RISK`)}
      <span className="max-w-[14rem] truncate font-semibold" title={label}>{label}</span>
      {chip(ROLE_COLOR.source, `${impact.startNodeIds.length} source`)}
      {chip(ROLE_COLOR.direct, `${impact.direct.length} direct`)}
      {chip(ROLE_COLOR.indirect, `${impact.indirect.length} indirect`)}
      <span className="text-[var(--text-2)]">{impact.apis.length} APIs · {impact.highFanIn.length} high fan-in</span>
      {note && <span className="text-[var(--text-2)]">· {note}</span>}
      <ul className="flex flex-wrap gap-1.5" aria-label="Affected modules">
        {mods.map(([m, c]) => (
          <li key={m}><button onClick={() => select(`mod:${m}`)} className="rounded-full border border-[var(--sep)] px-2.5 py-0.5 hover:bg-[var(--chip)]">{m} · {c}</button></li>
        ))}
      </ul>
    </section>
  );
}
