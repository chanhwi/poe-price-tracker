import type { QuerySpec, StatFilter } from "../lib/types";
import StatPicker from "./StatPicker";

interface Props {
  spec: QuerySpec;
  onChange: (spec: QuerySpec) => void;
}

type Mode = "name" | "type" | "term";

function numOrUndef(v: string): number | undefined {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

export default function FilterBuilder({ spec, onChange }: Props) {
  function set<K extends keyof QuerySpec>(key: K, value: QuerySpec[K]) {
    onChange({ ...spec, [key]: value });
  }

  const mode: Mode = spec.name ? "name" : spec.type ? "type" : "term";
  const termValue = spec.name ?? spec.type ?? spec.term ?? "";

  function setSearch(nextMode: Mode, value: string) {
    const next: QuerySpec = { ...spec, name: undefined, type: undefined, term: undefined };
    // Drop an auto-derived 'unique' rarity when no longer searching by name.
    if (nextMode !== "name" && next.rarity === "unique") next.rarity = undefined;
    if (nextMode === "name") next.name = value;
    else if (nextMode === "type") next.type = value;
    else next.term = value;
    onChange(next);
  }

  const corruptedTri = spec.corrupted === undefined ? "any" : spec.corrupted ? "yes" : "no";

  const stats = spec.stats ?? [];
  function addStat(s: StatFilter) {
    set("stats", [...stats, s]);
  }
  function updateStat(i: number, patch: Partial<StatFilter>) {
    const next = stats.slice();
    next[i] = { ...next[i], ...patch };
    set("stats", next);
  }
  function removeStat(i: number) {
    set(
      "stats",
      stats.filter((_, j) => j !== i)
    );
  }

  return (
    <div className="filter-builder">
      <div className="fb-grid">
        <label>
          검색 방식
          <select value={mode} onChange={(e) => setSearch(e.currentTarget.value as Mode, termValue)}>
            <option value="name">이름(유니크)</option>
            <option value="type">베이스 타입</option>
            <option value="term">자유 텍스트</option>
          </select>
        </label>
        <label>
          검색어
          <input value={termValue} onChange={(e) => setSearch(mode, e.currentTarget.value)} />
        </label>
        <label>
          희귀도
          <select value={spec.rarity ?? ""} onChange={(e) => set("rarity", e.currentTarget.value || undefined)}>
            <option value="">전체</option>
            <option value="unique">Unique</option>
            <option value="nonunique">Non-unique</option>
            <option value="rare">Rare</option>
            <option value="magic">Magic</option>
            <option value="normal">Normal</option>
          </select>
        </label>
        <label>
          타락
          <select
            value={corruptedTri}
            onChange={(e) => {
              const v = e.currentTarget.value;
              set("corrupted", v === "any" ? undefined : v === "yes");
            }}
          >
            <option value="any">전체</option>
            <option value="yes">예</option>
            <option value="no">아니오</option>
          </select>
        </label>
        <label>
          최소 ilvl
          <input
            type="number"
            value={spec.minIlvl ?? ""}
            onChange={(e) => set("minIlvl", numOrUndef(e.currentTarget.value))}
          />
        </label>
        <label>
          최대 ilvl
          <input
            type="number"
            value={spec.maxIlvl ?? ""}
            onChange={(e) => set("maxIlvl", numOrUndef(e.currentTarget.value))}
          />
        </label>
        <label>
          최소 품질
          <input
            type="number"
            value={spec.minQuality ?? ""}
            onChange={(e) => set("minQuality", numOrUndef(e.currentTarget.value))}
          />
        </label>
        <label className="fb-checkbox">
          <input
            type="checkbox"
            checked={spec.onlineOnly !== false}
            onChange={(e) => set("onlineOnly", e.currentTarget.checked)}
          />
          온라인만
        </label>
      </div>

      <div className="fb-stats">
        <div className="fb-stats-head">모드(스탯) 필터</div>
        {stats.map((s, i) => (
          <div className="fb-stat-row" key={s.id + ":" + i}>
            <input
              type="checkbox"
              checked={!s.disabled}
              title="사용/해제"
              onChange={(e) => updateStat(i, { disabled: !e.currentTarget.checked })}
            />
            <span className="fb-stat-text" title={s.id}>
              {s.text ?? s.id}
            </span>
            <input
              type="number"
              placeholder="min"
              value={s.min ?? ""}
              onChange={(e) => updateStat(i, { min: numOrUndef(e.currentTarget.value) })}
              style={{ width: 70 }}
            />
            <input
              type="number"
              placeholder="max"
              value={s.max ?? ""}
              onChange={(e) => updateStat(i, { max: numOrUndef(e.currentTarget.value) })}
              style={{ width: 70 }}
            />
            <button onClick={() => removeStat(i)} title="삭제">
              ✕
            </button>
          </div>
        ))}
        <StatPicker onPick={(opt) => addStat({ id: opt.id, text: opt.text, disabled: false })} />
      </div>
    </div>
  );
}
