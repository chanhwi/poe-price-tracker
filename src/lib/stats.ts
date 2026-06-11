import type { StatOption } from "./types";
import { getStats } from "./api";

// The stat catalogue is large and static; fetch once, cache in memory +
// localStorage so the filter builder is instant after the first open.
const KEY = "poe-stats.v1";
let memo: StatOption[] | null = null;

export async function loadStats(): Promise<StatOption[]> {
  if (memo) return memo;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      memo = JSON.parse(raw) as StatOption[];
      return memo;
    }
  } catch {
    /* fall through to network */
  }
  const stats = await getStats();
  memo = stats;
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    /* quota: keep in-memory only */
  }
  return stats;
}
