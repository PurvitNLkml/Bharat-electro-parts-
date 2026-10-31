import type { ReactNode } from "react";

export const primaryBtn =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-copper px-4 py-2 text-sm font-semibold text-white hover:bg-copper-dark disabled:opacity-60";
export const ghostBtn =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-copper";
export const fieldClass =
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-copper";
export const labelClass = "mb-1 block text-sm font-semibold text-ink";

export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>;
}

export function Pill({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "good" | "warn" | "bad" | "teal" }) {
  const tones = {
    ink: "bg-ink/5 text-ink",
    good: "bg-good/10 text-good",
    warn: "bg-warn/10 text-warn",
    bad: "bg-bad/10 text-bad",
    teal: "bg-teal/10 text-teal",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
