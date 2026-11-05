"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { buildIndex } from "./graphIndex";
import type { Graph } from "./schema";

export function useGraph(workspaceId: string) {
  const [graph, setGraph] = useState<Graph | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() =>
    apiFetch<{ graph: Graph | null }>(`/api/workspaces/${workspaceId}/graph`)
      .then((r) => { setGraph(r.graph); setError(null); })
      .catch((e: Error) => { setError(e.message); setGraph(null); }), [workspaceId]);
  useEffect(() => { void reload(); }, [reload]);

  const index = useMemo(() => (graph ? buildIndex(graph) : null), [graph]);
  return { graph, index, error, reload };
}
