"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { moduleOf } from "@/features/graph/graphIndex";
import { BottomBar, HeaderCard, TopBar } from "@/features/graph/CanvasChrome";
import { GraphCanvas } from "@/features/graph/GraphCanvas";
import { GraphImport } from "@/features/graph/GraphImport";
import { ModuleList } from "@/features/graph/ModuleList";
import { SidePanel } from "@/features/graph/SidePanel";
import { TaskBoard } from "@/features/tasks/TaskBoard";
import { useGraph } from "@/features/graph/useGraph";
import { analyzeImpact } from "@/features/impact/engine";
import { ImpactSummary } from "@/features/impact/ImpactSummary";
import { Sidebar } from "@/features/ui/Sidebar";
import { PillButton } from "@/features/ui/primitives";
import type { WorkspaceDoc } from "@/features/workspace/model";
import { apiFetch } from "@/lib/api-client";
import { useCanvas } from "@/stores/canvas";

export default function WorkspaceHome() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [ws, setWs] = useState<WorkspaceDoc | null | undefined>(undefined);
  const { graph, index, error, reload } = useGraph(workspaceId);
  const [showImport, setShowImport] = useState(false);
  const { startIds, depth, verifiedOnly, viewMode, selectedId } = useCanvas();

  useEffect(() => {
    apiFetch<{ ws: WorkspaceDoc }>(`/api/workspaces/${workspaceId}`).then((r) => setWs(r.ws)).catch(() => setWs(null));
  }, [workspaceId]);

  const impact = useMemo(
    () => (index && startIds.length ? analyzeImpact(index, { startNodeIds: startIds, depth, verifiedOnly }) : null),
    [index, startIds, depth, verifiedOnly],
  );

  // After a new analysis, open just the modules that hold the matched files and the affected files,
  // so the form and the pages using it are visible without hunting. Whole-module starts stay collapsed.
  const setExpanded = useCanvas((s) => s.setExpanded);
  useEffect(() => {
    if (!index || !impact) return;
    if (startIds.length > 40) { setExpanded([]); return; }
    const all = new Set<string>(), src = new Set<string>();
    for (const [id, role] of impact.roles) {
      const n = index.nodes.get(id);
      if (!n) continue;
      const m = moduleOf(n);
      all.add(m);
      if (role === "source") src.add(m);
    }
    setExpanded([...(impact.roles.size <= 60 ? all : src)].filter((m) => m !== "API" && m !== "EXT"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per new analysis, not on depth changes
  }, [index, startIds]);

  if (ws === undefined || graph === undefined) return <p className="p-8" role="status">Loading…</p>;
  if (ws === null) return <p className="p-8" role="alert">Workspace not found.</p>;

  if (!index || showImport) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-4 sm:p-8">
        <Link href="/" className="text-[var(--brand-text)]">‹ Workspaces</Link>
        <h1 className="text-[length:calc(32px*var(--fs-scale))] font-bold">{ws.name}</h1>
        {error && <p role="alert" className="text-[var(--ios-red)]">{error}</p>}
        <GraphImport workspaceId={workspaceId} onDone={() => { void reload(); setShowImport(false); }} />
        {index && <PillButton variant="plain" onClick={() => setShowImport(false)}>Back to canvas</PillButton>}
      </main>
    );
  }

  const stats = `${index.nodes.size.toLocaleString()} nodes · ${(graph?.edges.length ?? 0).toLocaleString()} edges`;
  return (
    <div className="h-dvh bg-[var(--page)] md:p-4">
      <div className="flex h-full overflow-hidden bg-[var(--surface-solid)] md:rounded-[28px] md:shadow-[var(--frame-shadow)]">
        <Sidebar workspaceId={workspaceId} workspaceName={ws.name} index={index} onImport={() => setShowImport(true)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar workspaceName={ws.name} onImport={() => setShowImport(true)} />
          <div className="relative min-h-0 flex-1 bg-[var(--bg)]">
            <div className="absolute inset-0">
              {viewMode === "canvas" && <GraphCanvas index={index} impact={impact} />}
              {viewMode === "list" && <div className="h-full overflow-auto pt-[84px]"><ModuleList index={index} impact={impact} /></div>}
              {viewMode === "tasks" && <TaskBoard index={index} workspaceId={workspaceId} />}
            </div>

            {/* floating UI over the canvas */}
            <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex flex-col gap-2 [&>*]:pointer-events-auto">
              <HeaderCard index={index} title={graph?.repo ?? ws.name} stats={stats} />
              {impact && <div className={selectedId ? "md:mr-[346px]" : ""}><ImpactSummary impact={impact} /></div>}
            </div>
            {viewMode === "canvas" && (
              <div className={`pointer-events-none absolute inset-x-3 bottom-4 z-10 flex justify-center md:pl-48 [&>*]:pointer-events-auto ${selectedId ? "md:pr-[346px]" : ""}`}>
                <BottomBar index={index} />
              </div>
            )}
            <SidePanel index={index} impact={impact} />
          </div>
        </div>
      </div>
    </div>
  );
}
