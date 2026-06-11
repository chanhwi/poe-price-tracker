import { invoke } from "@tauri-apps/api/core";
import type { CurrencyOption, ItemOption, League, ParsedItem, PriceCheckResult, StatOption } from "./types";

/** Typed wrappers around the Rust Tauri commands. */

export const getLeagues = () => invoke<League[]>("get_leagues");
export const getStats = () => invoke<StatOption[]>("get_stats");
export const getFilters = () => invoke<unknown>("get_filters");
export const getItems = () => invoke<ItemOption[]>("get_items");
export const getStatic = () => invoke<CurrencyOption[]>("get_static");

/** `query` is the full trade2 POST body `{ query, sort }` (from buildSearchBody). */
export const priceCheck = (league: string, query: unknown) =>
  invoke<PriceCheckResult>("price_check", { league, query });

export const parseItemText = (text: string) =>
  invoke<ParsedItem | null>("parse_item_text", { text });

export const openLogin = () => invoke<void>("open_login");
export const capturePoesessid = () => invoke<string | null>("capture_poesessid");
export const clearPoesessid = () => invoke<void>("clear_poesessid");
export const setPoesessid = (poesessid: string | null) =>
  invoke<void>("set_poesessid", { poesessid });

export const getTradeHost = () => invoke<string>("get_trade_host");
export const setTradeHost = (host: string) => invoke<void>("set_trade_host", { host });

export const openInBrowser = (url: string) => invoke<void>("open_in_browser", { url });

export const setCaptureHotkey = (accel: string) =>
  invoke<void>("set_capture_hotkey", { accel });
export const getCaptureHotkey = () => invoke<string>("get_capture_hotkey");
