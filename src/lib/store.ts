import type { WatchItem } from "./types";

const WATCH_KEY = "poe-watchlist.v1";
const LEAGUE_KEY = "poe-league.v1";

export function loadWatchlist(): WatchItem[] {
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    return raw ? (JSON.parse(raw) as WatchItem[]) : [];
  } catch {
    return [];
  }
}

export function saveWatchlist(items: WatchItem[]): void {
  try {
    localStorage.setItem(WATCH_KEY, JSON.stringify(items));
  } catch {
    /* quota / serialization errors are non-fatal */
  }
}

export function loadLeague(): string {
  return localStorage.getItem(LEAGUE_KEY) ?? "Standard";
}

export function saveLeague(league: string): void {
  try {
    localStorage.setItem(LEAGUE_KEY, league);
  } catch {
    /* ignore */
  }
}

export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
