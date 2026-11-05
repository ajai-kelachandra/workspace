import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FontKey = "elms-sans" | "montserrat" | "system";
export type FontSize = "sm" | "md" | "lg";
export type Theme = "system" | "light" | "dark";

export const FONTS: { key: FontKey; label: string; stack: string }[] = [
  { key: "elms-sans", label: "Elms Sans", stack: '"Elms Sans", system-ui, sans-serif' },
  { key: "montserrat", label: "Montserrat", stack: 'Montserrat, system-ui, sans-serif' },
  { key: "system", label: "System", stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' },
];
export const FONT_SCALE: Record<FontSize, number> = { sm: 0.9, md: 1, lg: 1.15 };

interface SettingsState {
  font: FontKey;
  fontSize: FontSize;
  theme: Theme;
  sidebarOpen: boolean;
  setFont: (f: FontKey) => void;
  setFontSize: (s: FontSize) => void;
  setTheme: (t: Theme) => void;
  setSidebarOpen: (o: boolean) => void;
  reset: () => void;
}

const defaults = { font: "elms-sans" as FontKey, fontSize: "md" as FontSize, theme: "system" as Theme, sidebarOpen: true };

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      setFont: (font) => set({ font }),
      setFontSize: (fontSize) => set({ fontSize }),
      setTheme: (theme) => set({ theme }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      reset: () => set(defaults),
    }),
    { name: "workspace-settings-v2" },
  ),
);
