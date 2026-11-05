"use client";
import {
  Background, BackgroundVariant, MiniMap, Panel, ReactFlow, ReactFlowProvider, applyNodeChanges, useReactFlow, useStore,
  type Edge, type Node, type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GraphIndex } from "./graphIndex";
import type { ImpactResult } from "@/features/impact/engine";
import { Icon } from "@/features/ui/icons";
import { useCanvas } from "@/stores/canvas";
import { FileNode, GroupNode, ModuleNode } from "./nodes";
import { ROLE_COLOR, buildView, type ModuleNodeData } from "./view";

/** Leaves room for the floating header, toolbar and detail panel. */
const FIT = { padding: { top: "150px", bottom: "110px", left: "40px", right: "370px" } } as const;
const nodeTypes = { module: ModuleNode, group: GroupNode, file: FileNode };

/** Floating "− 80% +" pill from the reference design, plus fit-to-screen. */
function ZoomPill() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const btn = "grid size-8 place-items-center rounded-full hover:bg-[var(--chip)]";
  return (
    <div className="glass flex items-center gap-0.5 rounded-full p-1">
      <button className={btn} aria-label="Zoom out" onClick={() => zoomOut({ duration: 150 })}><Icon name="minus" size={15} /></button>
      <span className="w-11 text-center text-[length:calc(12px*var(--fs-scale))] font-medium tabular-nums" aria-live="polite">{Math.round(zoom * 100)}%</span>
      <button className={btn} aria-label="Zoom in" onClick={() => zoomIn({ duration: 150 })}><Icon name="plus" size={15} /></button>
      <span aria-hidden className="mx-1 h-4 w-px bg-[var(--sep)]" />
      <button className={btn} aria-label="Fit to screen" onClick={() => fitView({ ...FIT, duration: 250 })}><Icon name="fit" size={15} /></button>
    </div>
  );
}

function Inner({ index, impact }: { index: GraphIndex; impact: ImpactResult | null }) {
  const { expanded, moduleFilter, typeFilter, verifiedOnly, safe, focusImpact } = useCanvas();
  const select = useCanvas((s) => s.select);
  const toggleExpanded = useCanvas((s) => s.toggleExpanded);
  const setStart = useCanvas((s) => s.setStart);

  const view = useMemo(
    () => buildView(index, { focus: focusImpact, expanded, impact, safe, filters: { modules: moduleFilter, types: typeFilter, verifiedOnly } }),
    [index, expanded, impact, safe, moduleFilter, typeFilter, verifiedOnly, focusImpact],
  );

  // focus the module that was just expanded instead of fitting the whole graph
  const rf = useReactFlow();
  const prevExpanded = useRef<string[]>([]);
  useEffect(() => {
    const added = expanded.filter((m) => !prevExpanded.current.includes(m));
    prevExpanded.current = expanded;
    if (!added.length) return;
    const t = setTimeout(() => rf.fitView({ nodes: added.map((m) => ({ id: `mod:${m}` })), padding: { top: "150px", bottom: "110px", left: "40px", right: "40px" }, duration: 400, maxZoom: 1 }), 80);
    return () => clearTimeout(t);
  }, [expanded, rf]);

  // local node state so dragging works; dragged positions survive view rebuilds
  const dragged = useRef(new Map<string, { x: number; y: number }>());
  const [nodes, setNodes] = useState<Node[]>([]);
  useEffect(() => {
    setNodes(view.nodes.map((n) => (dragged.current.has(n.id) ? { ...n, position: dragged.current.get(n.id)! } : n)));
  }, [view]);
  const onNodesChange = useCallback((c: NodeChange[]) => setNodes((ns) => applyNodeChanges(c, ns)), []);

  const edges: Edge[] = view.edges;
  return (
    <ReactFlow
      nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
      onNodeClick={(_, n) => select(n.id)}
      onPaneClick={() => select(null)}
      onNodeDragStop={(_, n) => dragged.current.set(n.id, n.position)}
      onNodeDoubleClick={(_, n) => {
        if (n.type === "module" || n.type === "group") toggleExpanded((n.data as ModuleNodeData).moduleId);
        else setStart([n.id], n.id);
      }}
      zoomOnDoubleClick={false}
      onlyRenderVisibleElements
      fitView fitViewOptions={FIT} minZoom={0.05} maxZoom={2}
      proOptions={{ hideAttribution: true }}
      aria-label="Architecture graph canvas"
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1.2} color="var(--canvas-dot)" />
      <Panel position="bottom-left" className="!mb-4 !ml-4"><ZoomPill /></Panel>
      <MiniMap
        position="bottom-left" style={{ marginBottom: 64, marginLeft: 16, width: 150, height: 100 }}
        pannable zoomable ariaLabel="Mini map" maskColor="color-mix(in srgb, var(--bg) 70%, transparent)"
        nodeColor={(n) => ROLE_COLOR[((n.data as { role?: keyof typeof ROLE_COLOR })?.role) ?? "none"]}
      />
    </ReactFlow>
  );
}

export function GraphCanvas(props: { index: GraphIndex; impact: ImpactResult | null }) {
  return <ReactFlowProvider><Inner {...props} /></ReactFlowProvider>;
}
