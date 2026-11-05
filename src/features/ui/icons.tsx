import type { SVGProps } from "react";

const P: Record<string, string> = {
  home: "M3 11.5 12 4l9 7.5M5 10v10h5v-6h4v6h5V10",
  canvas: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  upload: "M12 16V4m-5 5 5-5 5 5M4 20h16",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  chevD: "m6 9 6 6 6-6",
  chevUD: "m8 9 4-4 4 4M8 15l4 4 4-4",
  sidebar: "M4 5h16v14H4zM9 5v14",
  back: "M19 12H5m6-6-6 6 6 6",
  x: "M18 6 6 18M6 6l12 12",
  check: "m5 12 5 5 9-10",
  filter: "M3 5h18l-7 8v6l-4-2v-4z",
  fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  layers: "m12 3 9 5-9 5-9-5zM3 13l9 5 9-5",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  sun: "M12 3v2M12 19v2M5 12H3M21 12h-2M6 6 4.6 4.6M19.4 19.4 18 18M6 18l-1.4 1.4M19.4 4.6 18 6M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  moon: "M20 14a8 8 0 1 1-10-10 6 6 0 0 0 10 10z",
  type: "M5 6V4h14v2M12 4v16M9 20h6",
  refresh: "M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5",
  box: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  tasks: "m9 11 3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
};

export type IconName = keyof typeof P | "dots" | "grip";

export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true, ...rest };
  if (name === "dots") return <svg {...common} fill="currentColor"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>;
  if (name === "grip") return <svg {...common} fill="currentColor"><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg>;
  return <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={P[name]} /></svg>;
}

/** The product logomark (four rounded petals). */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="16" fill="var(--accent)" />
      <path d="M16 6c3 3 3 7 0 10-3-3-3-7 0-10zM26 16c-3 3-7 3-10 0 3-3 7-3 10 0zM16 26c-3-3-3-7 0-10 3 3 3 7 0 10zM6 16c3-3 7-3 10 0-3 3-7 3-10 0z" fill="var(--accent-fg)" opacity=".92" />
    </svg>
  );
}
