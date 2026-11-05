"use client";
import type { GraphIndex } from "./graphIndex";
import type { ImpactResult } from "@/features/impact/engine";
import { useCanvas } from "@/stores/canvas";

/** Mobile-friendly alternative to the canvas: modules as a list with impact counts. */
export function ModuleList({ index, impact }: { index: GraphIndex; impact: ImpactResult | null }) {
  const select = useCanvas((s) => s.select);
  const rows = [...index.graph.modules.map((m) => m.id), ...["API", "EXT"].filter((m) => index.byModule.has(m))];
  return (
    <ul className="mx-auto max-w-2xl space-y-2 p-2" aria-label="Modules">
      {rows.map((id) => {
        const members = index.byModule.get(id) ?? [];
        let src = 0, dir = 0, ind = 0;
        for (const n of members) { const r = impact?.roles.get(n); if (r === "source") src++; else if (r === "direct") dir++; else if (r === "indirect") ind++; }
        const hot = src + dir + ind > 0;
        return (
          <li key={id}>
            <button onClick={() => select(`mod:${id}`)} className="glass flex w-full items-center justify-between rounded-xl p-4 text-left"
              style={hot ? { opacity: 1 } : impact ? { opacity: 0.5 } : undefined}>
              <span>
                <span className="block text-[length:calc(15px*var(--fs-scale))] font-semibold">{id}</span>
                <span className="text-[length:calc(12px*var(--fs-scale))] text-[var(--text-2)]">{members.length} items</span>
              </span>
              {hot && (
                <span className="flex gap-2 text-[length:calc(12px*var(--fs-scale))]">
                  {src > 0 && <span style={{ color: "var(--ios-blue)" }}>● {src}</span>}
                  {dir > 0 && <span style={{ color: "var(--ios-orange)" }}>● {dir}</span>}
                  {ind > 0 && <span style={{ color: "var(--ios-yellow)" }}>● {ind}</span>}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
