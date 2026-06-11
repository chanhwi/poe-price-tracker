import type { HistoryEntry, PricePoint } from "./types";

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Display a price point as "12.5 divine" (native currency; cross-currency
 * normalization is a later refinement — see DESIGN.md §9). */
export function formatPrice(p: PricePoint | null): string {
  if (!p) return "—";
  return `${round(p.amount)} ${p.currency}`;
}

export function formatEntry(e: HistoryEntry | null): string {
  if (!e) return "—";
  return `${round(e.amount)} ${e.currency}`;
}

export type TrendDir = "up" | "down" | "flat" | "none";
export interface Trend {
  dir: TrendDir;
  pct: number | null;
}

/** Trend vs the most recent prior reading in the SAME currency (so we don't
 * compare across currencies without normalization). */
export function trend(history: HistoryEntry[]): Trend {
  if (history.length < 2) return { dir: "none", pct: null };
  const last = history[history.length - 1];
  for (let i = history.length - 2; i >= 0; i--) {
    const prev = history[i];
    if (prev.currency === last.currency && prev.amount > 0) {
      const pct = ((last.amount - prev.amount) / prev.amount) * 100;
      const dir: TrendDir = pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat";
      return { dir, pct: Math.round(pct * 10) / 10 };
    }
  }
  return { dir: "none", pct: null };
}

export function trendSymbol(t: Trend): string {
  switch (t.dir) {
    case "up":
      return "▲";
    case "down":
      return "▼";
    case "flat":
      return "→";
    default:
      return "";
  }
}
