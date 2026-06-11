import type { ItemOption } from "./types";
import { getItems } from "./api";

// Base types + uniques for the autocomplete; large + static per region.
const KEY = "poe-items.v1";
let memo: ItemOption[] | null = null;

export async function loadItems(): Promise<ItemOption[]> {
  if (memo) return memo;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) {
        memo = p as ItemOption[];
        return memo;
      }
    }
  } catch {
    /* fall through to network */
  }
  memo = await getItems();
  try {
    localStorage.setItem(KEY, JSON.stringify(memo));
  } catch {
    /* quota: in-memory only */
  }
  return memo;
}

export function clearItemsCache(): void {
  memo = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
