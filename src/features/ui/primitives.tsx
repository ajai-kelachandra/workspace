"use client";
import { motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

const spring = { type: "spring", stiffness: 500, damping: 30 } as const;

export function GlassPanel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("glass rounded-2xl p-6", className)}>{children}</div>;
}

type BtnProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"> & {
  variant?: "primary" | "plain" | "danger";
};

/** Pill button with a spring press (a "haptic-feeling" scale-down). */
export function PillButton({ variant = "primary", className, ...rest }: BtnProps) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      whileTap={reduce ? undefined : { scale: 0.95 }}
      transition={spring}
      className={clsx(
        "min-h-11 rounded-full px-5 text-[length:calc(15px*var(--fs-scale))] font-semibold disabled:opacity-50",
        variant === "primary" && "bg-[var(--accent)] text-[var(--accent-fg)]",
        variant === "plain" && "bg-black/5 text-[var(--accent)] dark:bg-white/10",
        variant === "danger" && "bg-[var(--ios-red)] text-white",
        className,
      )}
      {...rest}
    />
  );
}

export function TextField({ label, className, id, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const fid = id ?? `f-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className={className}>
      <label htmlFor={fid} className="mb-1 block px-1 text-[length:calc(13px*var(--fs-scale))] text-[var(--text-2)]">{label}</label>
      <input
        id={fid}
        className="min-h-11 w-full rounded-xl border border-[var(--sep)] bg-[var(--surface-solid)] px-4 text-[length:calc(17px*var(--fs-scale))]"
        {...rest}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, label,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-black/5 p-1 dark:bg-white/10">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "min-h-9 rounded-full px-4 text-[length:calc(14px*var(--fs-scale))] font-medium transition-colors",
            o.value === value ? "bg-[var(--surface-solid)] shadow" : "text-[var(--text-2)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
