"use client";
import { useEffect } from "react";
import { FONTS, FONT_SCALE, useSettings } from "@/stores/settings";

/** Applies persisted appearance settings to <html>. Renders nothing. */
export function SettingsApplier() {
  const { font, fontSize, theme } = useSettings();

  useEffect(() => {
    const stack = FONTS.find((f) => f.key === font)?.stack ?? FONTS[0].stack;
    const root = document.documentElement;
    root.style.setProperty("--app-font", stack);
    root.style.setProperty("--fs-scale", String(FONT_SCALE[fontSize]));
  }, [font, fontSize]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && mq.matches));
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  return null;
}

/** Runs before first paint so the saved theme/font don't flash. */
export const noFlashScript = `try{var s=JSON.parse(localStorage.getItem("workspace-settings-v2")||"{}").state||{};
var r=document.documentElement;
if(s.theme==="dark"||((!s.theme||s.theme==="system")&&matchMedia("(prefers-color-scheme: dark)").matches))r.classList.add("dark");
r.style.setProperty("--fs-scale",({sm:.9,md:1,lg:1.15})[s.fontSize]||1);}catch(e){}`;
