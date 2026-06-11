import type { StatOption } from "./types";
import { getStats } from "./api";

// The stat catalogue is large and static; serve from cache instantly and
// refresh in the background after MAX_AGE so new league/patch mods appear.
const KEY = "poe-stats.v2";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
let memo: StatOption[] | null = null;

interface Cached {
  ts: number;
  data: StatOption[];
}

async function fetchAndStore(): Promise<StatOption[]> {
  const stats = await getStats();
  memo = stats;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ts: Date.now(), data: stats } as Cached));
  } catch {
    /* quota: keep in-memory only */
  }
  return stats;
}

export async function loadStats(): Promise<StatOption[]> {
  if (memo) return memo;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Cached;
      if (parsed && Array.isArray(parsed.data)) {
        memo = parsed.data;
        // Stale-while-revalidate: return cache now, refresh in the background.
        if (Date.now() - (parsed.ts ?? 0) > MAX_AGE_MS) {
          void fetchAndStore().catch(() => {});
        }
        return memo;
      }
    }
  } catch {
    /* fall through to network */
  }
  return fetchAndStore();
}

/** Drop the cached catalogue (e.g. after switching region/language). */
export function clearStatsCache(): void {
  memo = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
