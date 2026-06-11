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
  it("unique -> name + rarity unique + corrupted", () => {
    const s = specFromParsedItem(
      item({ rarity: "unique", name: "Tabula Rasa", base_type: "Simple Robe", corrupted: true })
    );
    expect(s.name).toBe("Tabula Rasa");
    expect(s.rarity).toBe("unique");
    expect(s.corrupted).toBe(true);
    expect(s.type).toBeUndefined();
  });

  it("rare -> type (base type), no name", () => {
    const s = specFromParsedItem(item({ rarity: "rare", name: "Gale Grip", base_type: "Stellar Gauntlets" }));
    expect(s.type).toBe("Stellar Gauntlets");
    expect(s.name).toBeUndefined();
  });

  it("currency -> type by name", () => {
    const s = specFromParsedItem(item({ rarity: "currency", name: "Divine Orb" }));
    expect(s.type).toBe("Divine Orb");
  });
});

describe("buildSearchBody", () => {
  it("unique body: name, rarity filter, corrupted filter, sort asc", () => {
    const body = buildSearchBody({ name: "Tabula Rasa", rarity: "unique", corrupted: true, onlineOnly: true }) as any;
    expect(body.query.name).toBe("Tabula Rasa");
    expect(body.query.status.option).toBe("online");
    expect(body.query.filters.type_filters.filters.rarity.option).toBe("unique");
    expect(body.query.filters.misc_filters.filters.corrupted.option).toBe("true");
    expect(body.sort.price).toBe("asc");
  });

  it("minimal spec -> only status + sort, no filters", () => {
    const body = buildSearchBody({ type: "Stellar Gauntlets" }) as any;
    expect(body.query.type).toBe("Stellar Gauntlets");
    expect(body.query.filters).toBeUndefined();
  });

  it("disabled stats are dropped; active ones compiled", () => {
    const body = buildSearchBody({
      type: "X",
      stats: [
        { id: "explicit.stat_1", min: 50 },
        { id: "explicit.stat_2", disabled: true },
      ],
    }) as any;
    expect(body.query.stats[0].filters).toHaveLength(1);
    expect(body.query.stats[0].filters[0].id).toBe("explicit.stat_1");
    expect(body.query.stats[0].filters[0].value.min).toBe(50);
  });

  it("ilvl range is pruned to set bounds only", () => {
    const body = buildSearchBody({ type: "X", minIlvl: 80 }) as any;
    expect(body.query.filters.misc_filters.filters.ilvl).toEqual({ min: 80 });
  });

  it("onlineOnly false -> status any", () => {
    const body = buildSearchBody({ type: "X", onlineOnly: false }) as any;
    expect(body.query.status.option).toBe("any");
  });
});
