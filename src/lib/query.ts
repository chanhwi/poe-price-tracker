import type { FilterValue, ParsedItem, QuerySpec } from "./types";

/**
 * Build a sensible default QuerySpec from a parsed clipboard item
 * (DESIGN.md §4). Registration rule: unique -> by name, rare/normal -> by base
 * type, currency/gem -> by name, magic/other -> free-text term. Corrupted items
 * constrain corruption; normal items leave it unset ("any").
 */
export function specFromParsedItem(item: ParsedItem): QuerySpec {
  const spec: QuerySpec = { status: "online" };
  const filters: NonNullable<QuerySpec["filters"]> = {};
  const set = (g: string, f: string, v: FilterValue) => {
    filters[g] = { ...(filters[g] ?? {}), [f]: v };
  };

  switch (item.rarity) {
    case "unique":
      if (item.name) spec.name = item.name;
      set("type_filters", "rarity", { option: "unique" });
      break;
    case "rare":
    case "normal":
      if (item.base_type) spec.type = item.base_type;
      break;
    case "currency":
    case "gem":
    case "divination_card":
      if (item.name) spec.type = item.name;
      break;
    default: // magic / other
      if (item.register_term) spec.term = item.register_term;
  }

  if (item.corrupted) set("misc_filters", "corrupted", { option: "true" });

  if (Object.keys(filters).length) spec.filters = filters;
  return spec;
}

/** Compile a QuerySpec into the trade2 search POST body `{ query, sort }`. */
export function buildSearchBody(spec: QuerySpec): Record<string, unknown> {
  const query: Record<string, unknown> = {
    status: { option: spec.status ?? "online" },
  };
  if (spec.name) query.name = spec.name;
  if (spec.type) query.type = spec.type;
  if (spec.term) query.term = spec.term;

  if (spec.filters) {
    const out: Record<string, unknown> = {};
    for (const [group, fmap] of Object.entries(spec.filters)) {
      const filters: Record<string, unknown> = {};
      for (const [fid, v] of Object.entries(fmap)) {
        const val = filterValue(v);
        if (val) filters[fid] = val;
      }
      if (Object.keys(filters).length) out[group] = { filters };
    }
    if (Object.keys(out).length) query.filters = out;
  }

  const activeStats = (spec.stats ?? []).filter((s) => !s.disabled);
  if (activeStats.length) {
    query.stats = [
      {
        type: "and",
        filters: activeStats.map((s) => ({ id: s.id, value: range(s.min, s.max), disabled: false })),
      },
    ];
  }

  return { query, sort: { price: "asc" } };
}

function filterValue(v: FilterValue): Record<string, unknown> | undefined {
  if (v.option !== undefined && v.option !== "") return { option: v.option };
  if (v.min !== undefined || v.max !== undefined) return range(v.min, v.max);
  return undefined;
}

function range(min?: number, max?: number): Record<string, number> {
  const r: Record<string, number> = {};
  if (min !== undefined) r.min = min;
  if (max !== undefined) r.max = max;
  return r;
}
