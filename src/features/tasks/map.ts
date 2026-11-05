import type { GraphIndex } from "@/features/graph/graphIndex";
import { resolveStart, type StartResolution } from "@/features/impact/resolve";

export interface TaskMapping {
  nodeIds: string[];
  matchedBy: StartResolution["matchedBy"] | "manual" | "none";
  confidence: number;
  explain: string;
}

/**
 * Maps one task to graph nodes. Priority: manual correction, then the title (usually the most precise
 * part of a task), then the full text. The title wins unless the full text is clearly more confident.
 */
export function mapTask(
  index: GraphIndex,
  task: { title: string; description: string; manualNodeIds?: string[] | null },
): TaskMapping {
  if (task.manualNodeIds?.length) {
    const ids = task.manualNodeIds.filter((id) => index.nodes.has(id));
    if (ids.length) return { nodeIds: ids, matchedBy: "manual", confidence: 1, explain: "Set manually" };
  }
  const byTitle = resolveStart(index, task.title);
  const full = task.description ? resolveStart(index, `${task.title}. ${task.description}`) : null;
  const best = byTitle && (!full || byTitle.confidence >= full.confidence - 0.05) ? byTitle : full ?? byTitle;
  if (!best) return { nodeIds: [], matchedBy: "none", confidence: 0, explain: "No matching files found" };
  return { nodeIds: best.nodeIds, matchedBy: best.matchedBy, confidence: best.confidence, explain: best.explain };
}
