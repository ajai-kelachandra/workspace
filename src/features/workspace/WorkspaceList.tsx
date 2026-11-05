"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { GlassPanel, PillButton, TextField } from "@/features/ui/primitives";
import { apiFetch } from "@/lib/api-client";
import type { WorkspaceDoc } from "./model";

export function WorkspaceList() {
  const router = useRouter();
  const [items, setItems] = useState<(WorkspaceDoc & { id: string })[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() =>
    apiFetch<{ items: (WorkspaceDoc & { id: string })[] }>("/api/workspaces")
      .then((r) => setItems(r.items)).catch((e) => setError(e.message)), []);
  useEffect(() => { void load(); }, [load]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "");
    try {
      const { id } = await apiFetch<{ id: string }>("/api/workspaces", { body: { name } });
      router.push(`/w/${id}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
      <h1 className="text-[length:calc(34px*var(--fs-scale))] font-bold">Workspaces</h1>
      {error && <p role="alert" className="text-[var(--ios-red)]">{error}</p>}
      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {items.map((w) => (
            <motion.li key={w.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Link href={`/w/${w.id}`} className="glass block rounded-2xl p-5 text-[length:calc(17px*var(--fs-scale))] font-semibold">{w.name}</Link>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <GlassPanel>
        <form onSubmit={create} className="flex items-end gap-3">
          <TextField label="New workspace" name="name" required maxLength={80} className="flex-1" />
          <PillButton type="submit">Create</PillButton>
        </form>
      </GlassPanel>
    </main>
  );
}
