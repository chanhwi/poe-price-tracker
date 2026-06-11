import type { HistoryEntry, PricePoint } from "./types";

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatPrice(p: PricePoint | null): string {
  if (!p) return "—";
  return `${round(p.amount)} ${p.currency}`;
}

export function formatEntry(e: HistoryEntry | null): string {
  if (!e) return "—";
  return `${round(e.amount)} ${e.currency}`;
}

/** Strip PoE trade mod markup: "[Resistances|Cold Resistance]" -> "Cold
 * Resistance", "[Cold]" -> "Cold". Also flatten embedded newlines to " / ". */
export function cleanMod(s: string): string {
  return s
    .replace(/\[([^\]|]+)\|([^\]]+)\]/g, "$2")
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/\r?\n/g, " / ");
}

/** Relative time: "방금 전", "5분 전", "2시간 전", "3일 전", else a date. */
export function relativeTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 30) return "방금 전";
  if (sec < 60) return `${sec}초 전`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return new Date(ts).toLocaleDateString();
}
