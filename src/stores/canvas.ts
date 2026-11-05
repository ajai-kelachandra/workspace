import { create } from "zustand";

export type ViewMode = "canvas" | "list" | "tasks";

interface CanvasState {
  selectedId: string | null;
  expanded: string[];
  depth: number;
  verifiedOnly: boolean;
  moduleFilter: string[];
  typeFilter: string[];
  startIds: string[];
  startLabel: string;
  startNote: string;
  /** nodes the user has manually confirmed as safe (green) */
  safe: string[];
  viewMode: ViewMode;
  /** when analysing, show only impacted files inside expanded modules */
  focusImpact: boolean;
  select: (id: string | null) => void;
  toggleExpanded: (moduleId: string) => void;
  setExpanded: (moduleIds: string[]) => void;
  setFocusImpact: (v: boolean) => void;
  setDepth: (d: number) => void;
  setVerifiedOnly: (v: boolean) => void;
  setModuleFilter: (m: string[]) => void;
  setTypeFilter: (t: string[]) => void;
  setStart: (ids: string[], label: string, note?: string) => void;
  clearStart: () => void;
  toggleSafe: (id: string) => void;
  setViewMode: (m: ViewMode) => void;
}

export const useCanvas = create<CanvasState>((set) => ({
  selectedId: null, expanded: [], depth: 3, verifiedOnly: false, moduleFilter: [], typeFilter: [],
  startIds: [], startLabel: "", startNote: "", safe: [], viewMode: "canvas", focusImpact: true,
  select: (selectedId) => set({ selectedId }),
  toggleExpanded: (m) => set((s) => ({ expanded: s.expanded.includes(m) ? s.expanded.filter((x) => x !== m) : [...s.expanded, m] })),
  setExpanded: (expanded) => set({ expanded }),
  setFocusImpact: (focusImpact) => set({ focusImpact }),
  setDepth: (depth) => set({ depth }),
  setVerifiedOnly: (verifiedOnly) => set({ verifiedOnly }),
  setModuleFilter: (moduleFilter) => set({ moduleFilter }),
  setTypeFilter: (typeFilter) => set({ typeFilter }),
  setStart: (startIds, startLabel, startNote = "") => set({ startIds, startLabel, startNote }),
  clearStart: () => set({ startIds: [], startLabel: "", startNote: "" }),
  toggleSafe: (id) => set((s) => ({ safe: s.safe.includes(id) ? s.safe.filter((x) => x !== id) : [...s.safe, id] })),
  setViewMode: (viewMode) => set({ viewMode }),
}));
