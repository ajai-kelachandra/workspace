"use client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import clsx from "clsx";
import { Icon, type IconName } from "@/features/ui/icons";
import { useCanvas } from "@/stores/canvas";
import { ROLE_COLOR, type FileNodeData, type ModuleNodeData, type Role } from "./view";

export const ROLE_LABEL: Record<Role, string> = {
  source: "Source", direct: "Direct", indirect: "Indirect", safe: "Verified safe", none: "Unaffected",
};

/** Hues taken from the reference design: purple, orange, pink, teal, slate. */
const HUES = ["#7a3fc4", "#e5791f", "#c2358f", "#14958a", "#5f6b8a"];
export function tint(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 997;
  return HUES[h % HUES.length];
}
const soft = (c: string, pct = 13) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

function useDim(role: Role) {
  const active = useCanvas((s) => s.startIds.length > 0);
  return active && role === "none";
}

const handleStyle = { width: 7, height: 7, background: "var(--surface-solid)", border: "1.5px solid var(--edge)" };
const hidden = { opacity: 0, pointerEvents: "none" as const, width: 1, height: 1 };

/** Round glyph badge used in node headers and the detail panel. */
export function GlyphBadge({ icon, color, size = 20 }: { icon: IconName; color: string; size?: number }) {
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full text-white" style={{ width: size, height: size, background: color }}>
      <Icon name={icon} size={size * 0.58} />
    </span>
  );
}

/** Kept for existing imports: pastel letter tile. */
export function IconTile({ text, color, size }: { text: string; color: string; size: number }) {
  return (
    <div aria-hidden className="grid shrink-0 place-items-center rounded-xl font-bold"
      style={{ width: size, height: size, background: soft(color, 15), color, fontSize: size * 0.4 }}>{text}</div>
  );
}

function ring(role: Role, selected: boolean) {
  const c = selected ? "var(--orange)" : role === "none" ? null : ROLE_COLOR[role];
  return { boxShadow: c ? `0 0 0 1.5px ${c}, var(--shadow)` : "var(--shadow)" };
}

export const ModuleNode = memo(function ModuleNode({ id, data }: NodeProps) {
  const d = data as ModuleNodeData;
  const selected = useCanvas((s) => s.selectedId === id);
  const toggle = useCanvas((s) => s.toggleExpanded);
  const dim = useDim(d.role);
  const band = d.role === "none" ? "#5f6b8a" : ROLE_COLOR[d.role];
  return (
    <div
      aria-label={`${d.label}, ${d.fileCount} items, ${ROLE_LABEL[d.role]}`}
      className={clsx("w-60 rounded-2xl bg-[var(--surface-solid)] p-1.5 transition-opacity", dim && "opacity-45")}
      style={ring(d.role, selected)}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <div className="flex items-center gap-2 rounded-xl px-2.5 py-1.5" style={{ background: soft(band) }}>
        <GlyphBadge icon={d.moduleId === "API" ? "bolt" : d.moduleId === "EXT" ? "link" : "box"} color={band} />
        <span className="text-[length:calc(12px*var(--fs-scale))] font-semibold" style={{ color: band }}>
          {d.role === "none" ? "Module" : ROLE_LABEL[d.role]}
        </span>
        <span className="ml-auto text-[length:calc(11px*var(--fs-scale))] text-[var(--text-2)]">{d.fileCount}</span>
      </div>
      <div className="px-2.5 pb-1.5 pt-2.5">
        <div className="truncate text-[length:calc(13px*var(--fs-scale))] font-medium">{d.label}</div>
        <div className="mt-0.5 line-clamp-2 text-[length:calc(11px*var(--fs-scale))] leading-snug text-[var(--text-2)]">{d.description}</div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="rounded-md bg-[var(--chip)] px-1.5 py-0.5 text-[length:calc(10px*var(--fs-scale))] text-[var(--text-2)]">{d.fileCount} items</span>
          {d.direct > 0 && <span className="rounded-md px-1.5 py-0.5 text-[length:calc(10px*var(--fs-scale))] font-medium" style={{ background: soft(ROLE_COLOR.direct), color: ROLE_COLOR.direct }}>{d.direct} direct</span>}
          {d.indirect > 0 && <span className="rounded-md px-1.5 py-0.5 text-[length:calc(10px*var(--fs-scale))] font-medium" style={{ background: soft(ROLE_COLOR.indirect), color: ROLE_COLOR.indirect }}>{d.indirect} indirect</span>}
          <button
            className="nodrag ml-auto rounded-full border border-[var(--sep)] px-2.5 py-0.5 text-[length:calc(10px*var(--fs-scale))] font-medium hover:bg-[var(--chip)]"
            aria-label={`Expand ${d.label} into its ${d.fileCount} items`}
            onClick={(e) => { e.stopPropagation(); toggle(d.moduleId); }}
          >Expand</button>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  );
});

export const GroupNode = memo(function GroupNode({ data }: NodeProps) {
  const d = data as ModuleNodeData;
  const toggle = useCanvas((s) => s.toggleExpanded);
  const dim = useDim(d.role);
  const band = d.role === "none" ? "#5f6b8a" : ROLE_COLOR[d.role];
  return (
    <div className={clsx("size-full rounded-3xl border border-dashed bg-[color-mix(in_srgb,var(--surface-solid)_60%,transparent)]", dim && "opacity-60")}
      style={{ borderColor: d.role !== "none" ? ROLE_COLOR[d.role] : "var(--edge)" }}>
      <Handle type="target" position={Position.Left} style={hidden} />
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="flex items-center gap-2 text-[length:calc(13px*var(--fs-scale))] font-semibold">
          <GlyphBadge icon="box" color={band} size={22} />{d.label}
          <span className="rounded-md bg-[var(--chip)] px-1.5 py-0.5 text-[length:calc(10px*var(--fs-scale))] font-normal text-[var(--text-2)]">{d.fileCount}</span>
        </span>
        <button
          className="nodrag rounded-full border border-[var(--sep)] bg-[var(--surface-solid)] px-3 py-1 text-[length:calc(11px*var(--fs-scale))] font-medium hover:bg-[var(--chip)]"
          aria-label={`Collapse ${d.label}`}
          onClick={(e) => { e.stopPropagation(); toggle(d.moduleId); }}
        >Collapse</button>
      </div>
      <Handle type="source" position={Position.Right} style={hidden} />
    </div>
  );
});

export const FileNode = memo(function FileNode({ id, data }: NodeProps) {
  const d = data as FileNodeData;
  const selected = useCanvas((s) => s.selectedId === id);
  const dim = useDim(d.role);
  const name = d.label.split("/").slice(-2).join("/");
  const c = d.role === "none" ? tint(d.nodeType) : ROLE_COLOR[d.role];
  return (
    <div
      title={d.label}
      aria-label={`${d.label}, ${ROLE_LABEL[d.role]}`}
      className={clsx("flex size-full items-center gap-2.5 rounded-xl bg-[var(--surface-solid)] px-2 transition-opacity", dim && "opacity-45")}
      style={ring(d.role, selected)}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ background: soft(c, 15), color: c }}>
        <Icon name="file" size={14} />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[length:calc(12px*var(--fs-scale))] font-medium">{name}</div>
        <div className="truncate text-[length:calc(10px*var(--fs-scale))] text-[var(--text-2)]">{d.nodeType}{d.lines ? ` · ${d.lines} lines` : ""}</div>
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  );
});
