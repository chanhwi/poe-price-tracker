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
}

/** Mirror of Rust `trade::model::PriceCheckResult`. */
export interface PriceCheckResult {
  total: number;
  sampled: number;
  listings: PricePoint[];
  median: PricePoint | null;
  partial: boolean;
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

/** High-level, UI-friendly description of a search; compiled to a trade2 body. */
export interface QuerySpec {
  name?: string; // unique name -> query.name
  type?: string; // base type -> query.type
  term?: string; // free text -> query.term
  rarity?: string; // type_filters.rarity.option
  category?: string; // type_filters.category.option
  corrupted?: boolean; // misc_filters.corrupted
  minIlvl?: number;
  maxIlvl?: number;
  minQuality?: number;
  onlineOnly?: boolean; // status online vs any (default online)
  stats?: StatFilter[];
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
}
