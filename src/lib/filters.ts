import type { FilterGroupSchema } from "./types";
import { getFilters } from "./api";

// The filter schema (data/filters) is large + static per region; fetch once,
// cache in memory + localStorage. Cleared on region change (localized text).
const KEY = "poe-filters.v1";
let memo: FilterGroupSchema[] | null = null;

export async function loadFilters(): Promise<FilterGroupSchema[]> {
  if (memo) return memo;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) {
        memo = p as FilterGroupSchema[];
        return memo;
      }
    }
  } catch {
    /* fall through to network */
  }
  const res = (await getFilters()) as { result?: FilterGroupSchema[] };
  memo = res?.result ?? [];
  try {
    localStorage.setItem(KEY, JSON.stringify(memo));
  } catch {
    /* quota: in-memory only */
  }
  return memo;
}

export function clearFiltersCache(): void {
  memo = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
