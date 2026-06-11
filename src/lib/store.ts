import type { HistoryEntry, QuerySpec, WatchItem } from "./types";

const WATCH_KEY = "poe-watchlist.v1";
const LEAGUE_KEY = "poe-league.v1";

/** Validate + normalize one persisted entry; returns null for bad shapes so a
 * corrupt/old-schema blob can never crash the render. */
function normalizeWatchItem(x: unknown): WatchItem | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.spec !== "object" || o.spec == null) return null;
  const history = Array.isArray(o.history)
    ? (o.history.filter(
        (h): h is HistoryEntry =>
          !!h &&
          typeof (h as Record<string, unknown>).amount === "number" &&
          typeof (h as Record<string, unknown>).currency === "string"
      ) as HistoryEntry[])
    : [];
  return {
    id: o.id,
    label: typeof o.label === "string" ? o.label : "(unknown)",
    spec: o.spec as QuerySpec,
    favorite: o.favorite === true,
    history,
    lastChecked: typeof o.lastChecked === "number" ? o.lastChecked : null,
    lastTotal: typeof o.lastTotal === "number" ? o.lastTotal : null,
    lastPartial: o.lastPartial === true,
  };
}

export function loadWatchlist(): WatchItem[] {
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeWatchItem).filter((i): i is WatchItem => i !== null);
  } catch {
    return [];
  }
}

export function saveWatchlist(items: WatchItem[]): void {
  try {
    localStorage.setItem(WATCH_KEY, JSON.stringify(items));
  } catch (e) {
    // Surface (rather than silently swallow) quota/serialization failures.
    console.error("saveWatchlist failed (watchlist not persisted):", e);
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
