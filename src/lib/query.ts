import type { ParsedItem, QuerySpec } from "./types";

/**
 * Build a sensible default QuerySpec from a parsed clipboard item
 * (DESIGN.md §4: smart defaults, toggles off). Registration rule:
 *   unique -> by name, rare/normal -> by base type, currency/gem -> by name,
 *   magic/other -> free-text term (user refines later).
 */
export function specFromParsedItem(item: ParsedItem): QuerySpec {
  const spec: QuerySpec = { onlineOnly: true, corrupted: item.corrupted };
  switch (item.rarity) {
    case "unique":
      if (item.name) spec.name = item.name;
      spec.rarity = "unique";
      break;
    case "rare":
    case "normal":
      if (item.base_type) spec.type = item.base_type;
      break;
    case "currency":
    case "gem":
    case "divination_card":
      if (item.name) spec.type = item.name; // their name is the trade "type"
      break;
    default: // magic / other: base is embedded in the name -> free text
      if (item.register_term) spec.term = item.register_term;
  }
  return spec;
}

/** Compile a QuerySpec into the trade2 search POST body `{ query, sort }`. */
export function buildSearchBody(spec: QuerySpec): Record<string, unknown> {
  const query: Record<string, unknown> = {
    status: { option: spec.onlineOnly === false ? "any" : "online" },
  };
  if (spec.name) query.name = spec.name;
  if (spec.type) query.type = spec.type;
  if (spec.term) query.term = spec.term;

  const filters: Record<string, unknown> = {};

  const typeFilters: Record<string, unknown> = {};
  if (spec.category) typeFilters.category = { option: spec.category };
  if (spec.rarity) typeFilters.rarity = { option: spec.rarity };
  if (Object.keys(typeFilters).length) filters.type_filters = { filters: typeFilters };

  const miscFilters: Record<string, unknown> = {};
  if (spec.corrupted !== undefined) {
    miscFilters.corrupted = { option: spec.corrupted ? "true" : "false" };
  }
  if (spec.minIlvl !== undefined || spec.maxIlvl !== undefined) {
    miscFilters.ilvl = pruneRange(spec.minIlvl, spec.maxIlvl);
  }
  if (spec.minQuality !== undefined) miscFilters.quality = { min: spec.minQuality };
  if (Object.keys(miscFilters).length) filters.misc_filters = { filters: miscFilters };

  if (Object.keys(filters).length) query.filters = filters;

  const activeStats = (spec.stats ?? []).filter((s) => !s.disabled);
  if (activeStats.length) {
    query.stats = [
      {
        type: "and",
        filters: activeStats.map((s) => ({
          id: s.id,
          value: pruneRange(s.min, s.max),
          disabled: false,
        })),
      },
    ];
  }

  return { query, sort: { price: "asc" } };
}

function pruneRange(min?: number, max?: number): Record<string, number> {
  const v: Record<string, number> = {};
  if (min !== undefined) v.min = min;
  if (max !== undefined) v.max = max;
  return v;
}
