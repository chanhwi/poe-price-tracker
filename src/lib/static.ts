import type { CurrencyOption } from "./types";
import { getStatic } from "./api";

// Currency/static icons + localized names (id -> option); static per region.
const KEY = "poe-static.v1";

export type CurrencyMap = Record<string, CurrencyOption>;

let memo: CurrencyMap | null = null;

export async function loadStatic(): Promise<CurrencyMap> {
  if (memo) return memo;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === "object" && !Array.isArray(p)) {
        memo = p as CurrencyMap;
        return memo;
      }
    }
  } catch {
    /* fall through to network */
  }
  const list = await getStatic();
  const map: CurrencyMap = {};
  for (const c of list) map[c.id] = c;
  memo = map;
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* quota: in-memory only */
  }
  return memo;
}

export function clearStaticCache(): void {
  memo = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
