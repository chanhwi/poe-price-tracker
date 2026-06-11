import { describe, it, expect } from "vitest";
import { specFromParsedItem, buildSearchBody } from "./query";
import type { ParsedItem } from "./types";

function item(p: Partial<ParsedItem>): ParsedItem {
  return {
    item_class: null,
    rarity: "normal",
    name: null,
    base_type: null,
    corrupted: false,
    item_level: null,
    quality: null,
    register_term: null,
    register_by_name: false,
    ...p,
  };
}

describe("specFromParsedItem", () => {
  it("unique -> name + rarity filter + corrupted filter", () => {
    const s = specFromParsedItem(item({ rarity: "unique", name: "Tabula Rasa", corrupted: true }));
    expect(s.name).toBe("Tabula Rasa");
    expect(s.filters?.type_filters?.rarity?.option).toBe("unique");
    expect(s.filters?.misc_filters?.corrupted?.option).toBe("true");
  });

  it("rare -> type, no rarity filter", () => {
    const s = specFromParsedItem(item({ rarity: "rare", base_type: "Stellar Gauntlets" }));
    expect(s.type).toBe("Stellar Gauntlets");
    expect(s.filters?.type_filters).toBeUndefined();
  });

  it("currency -> type by name", () => {
    const s = specFromParsedItem(item({ rarity: "currency", name: "Divine Orb" }));
    expect(s.type).toBe("Divine Orb");
  });
});

describe("buildSearchBody", () => {
  it("unique body: name + status + nested filters + sort", () => {
    const body = buildSearchBody({
      name: "Tabula Rasa",
      status: "online",
      filters: { type_filters: { rarity: { option: "unique" } }, misc_filters: { corrupted: { option: "true" } } },
    }) as any;
    expect(body.query.name).toBe("Tabula Rasa");
    expect(body.query.status.option).toBe("online");
    expect(body.query.filters.type_filters.filters.rarity.option).toBe("unique");
    expect(body.query.filters.misc_filters.filters.corrupted.option).toBe("true");
    expect(body.sort.price).toBe("asc");
  });

  it("minimal -> status + sort only, no filters", () => {
    const body = buildSearchBody({ type: "Stellar Gauntlets" }) as any;
    expect(body.query.type).toBe("Stellar Gauntlets");
    expect(body.query.status.option).toBe("securable");
    expect(body.query.filters).toBeUndefined();
  });

  it("range filter pruned to set bounds", () => {
    const body = buildSearchBody({ type: "X", filters: { type_filters: { ilvl: { min: 80 } } } }) as any;
    expect(body.query.filters.type_filters.filters.ilvl).toEqual({ min: 80 });
  });

  it("empty option value is dropped", () => {
    const body = buildSearchBody({ type: "X", filters: { type_filters: { rarity: { option: "" } } } }) as any;
    expect(body.query.filters).toBeUndefined();
  });

  it("disabled stats dropped; active compiled", () => {
    const body = buildSearchBody({
      type: "X",
      stats: [
        { id: "explicit.stat_1", min: 50 },
        { id: "explicit.stat_2", disabled: true },
      ],
    }) as any;
    expect(body.query.stats[0].filters).toHaveLength(1);
    expect(body.query.stats[0].filters[0].value.min).toBe(50);
  });

  it("status any", () => {
    const body = buildSearchBody({ type: "X", status: "any" }) as any;
    expect(body.query.status.option).toBe("any");
  });
});
