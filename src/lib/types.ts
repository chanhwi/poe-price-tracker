// Shared types mirroring the Rust backend (serde) payloads + frontend specs.

export type Rarity =
  | "normal"
  | "magic"
  | "rare"
  | "unique"
  | "gem"
  | "currency"
  | "divination_card"
  | "other";

/** Mirror of Rust `item::ParsedItem` (parse_item_text command). */
export interface ParsedItem {
  item_class: string | null;
  rarity: Rarity;
  name: string | null;
  base_type: string | null;
  corrupted: boolean;
  item_level: number | null;
  quality: number | null;
  register_term: string | null;
  register_by_name: boolean;
}

/** Mirror of Rust `trade::model::PricePoint`. */
export interface PricePoint {
  amount: number;
  currency: string;
  account: string | null;
  item: string | null;
  implicit: string[];
  explicit: string[];
}

/** Mirror of Rust `trade::model::PriceCheckResult`. */
export interface PriceCheckResult {
  total: number;
  sampled: number;
  listings: PricePoint[];
  median: PricePoint | null;
  partial: boolean;
  search_id: string;
  trade_url: string;
}

/** Mirror of Rust `trade::model::League`. */
export interface League {
  id: string;
  realm: string | null;
  text: string | null;
}

/** A single stat (mod) filter line in the trade query. */
export interface StatFilter {
  id: string;
  text?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}

/** A single filter value: a range (min/max) or a selected option id. */
export interface FilterValue {
  min?: number;
  max?: number;
  option?: string;
}

/** High-level search spec compiled to a trade2 body. `filters` mirrors the
 * trade2 `query.filters.{group}.filters.{id}` structure, driven by the
 * data/filters schema (full filter set, not a hand-picked subset). `status`
 * maps to `query.status.option`. */
export interface QuerySpec {
  name?: string; // unique name -> query.name
  type?: string; // base type -> query.type
  term?: string; // free text -> query.term
  status?: string; // query.status.option (online/any/...)
  filters?: { [group: string]: { [filterId: string]: FilterValue } };
  stats?: StatFilter[];
}

// --- data/filters schema (drives the dynamic filter builder) ---
export interface FilterOption {
  id: string | null;
  text: string;
}
export interface FilterDef {
  id: string;
  text?: string;
  option?: { options: FilterOption[] };
}
export interface FilterGroupSchema {
  id: string;
  title?: string;
  filters: FilterDef[];
}

/** Mirror of Rust `ItemOption` (get_items) — autocomplete entry. */
export interface ItemOption {
  display: string;
  name: string | null;
  base: string;
  unique: boolean;
}

/** One price reading saved to history. */
export interface HistoryEntry {
  ts: number;
  amount: number;
  currency: string;
}

/** A watchlist entry persisted to localStorage. */
export interface WatchItem {
  id: string;
  label: string;
  spec: QuerySpec;
  favorite: boolean;
  history: HistoryEntry[];
  lastChecked: number | null;
  lastTotal: number | null;
  lastPartial: boolean;
  /** Last search's result listings + web trade deep link (persisted). */
  lastResults?: PricePoint[];
  tradeUrl?: string;
}

/** Mirror of Rust `trade::model::StatOption` (get_stats command). */
export interface StatOption {
  id: string;
  text: string;
  kind: string | null;
  group: string | null;
}
