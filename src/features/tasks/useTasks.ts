"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { TaskDoc, TaskStatus } from "./model";

export function useTasks(workspaceId: string) {
  const [tasks, setTasks] = useState<TaskDoc[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/workspaces/${workspaceId}/tasks`;

  const reload = useCallback(
    () => apiFetch<{ tasks: TaskDoc[] }>(base).then((r) => { setTasks(r.tasks); setError(null); })
      .catch((e: Error) => { setError(e.message); setTasks([]); }),
    [base],
  );
  useEffect(() => { void reload(); }, [reload]);

  const importText = useCallback(async (text: string) => {
    const r = await apiFetch<{ parsed: number; added: number; updated: number; unchanged: number; tasks: TaskDoc[] }>(base, { body: { text } });
    setTasks(r.tasks);
    return r;
  }, [base]);

  const patch = useCallback(async (id: string, body: { status?: TaskStatus; manualNodeIds?: string[] | null }) => {
    const r = await apiFetch<{ task: TaskDoc }>(`${base}/${id}`, { method: "PATCH", body });
    setTasks((ts) => ts?.map((t) => (t.id === id ? r.task : t)));
  }, [base]);

  const remove = useCallback(async (id: string) => {
    await apiFetch(`${base}/${id}`, { method: "DELETE" });
    setTasks((ts) => ts?.filter((t) => t.id !== id));
  }, [base]);

  return { tasks, error, reload, importText, patch, remove };
}
