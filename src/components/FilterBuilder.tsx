import { useEffect, useState } from "react";
import type { FilterGroupSchema, QuerySpec, StatFilter } from "../lib/types";
import { loadFilters } from "../lib/filters";
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
  const [groups, setGroups] = useState<FilterGroupSchema[]>([]);
  useEffect(() => {
    loadFilters().then(setGroups).catch(() => {});
  }, []);

  const mode: Mode = spec.name ? "name" : spec.type ? "type" : "term";
  const termValue = spec.name ?? spec.type ?? spec.term ?? "";
  function setSearch(nextMode: Mode, value: string) {
    const next: QuerySpec = { ...spec, name: undefined, type: undefined, term: undefined };
    if (nextMode === "name") next.name = value;
    else if (nextMode === "type") next.type = value;
    else next.term = value;
    onChange(next);
  }

  function getVal(group: string, fid: string) {
    return spec.filters?.[group]?.[fid];
  }
  function setVal(group: string, fid: string, patch: { min?: number; max?: number; option?: string } | null) {
    const filters = { ...(spec.filters ?? {}) };
    const g = { ...(filters[group] ?? {}) };
    const empty =
      !patch || (patch.option === undefined && patch.min === undefined && patch.max === undefined);
    if (empty) delete g[fid];
    else g[fid] = patch;
    if (Object.keys(g).length) filters[group] = g;
    else delete filters[group];
    onChange({ ...spec, filters: Object.keys(filters).length ? filters : undefined });
  }

  const stats = spec.stats ?? [];
  function setStats(next: StatFilter[]) {
    onChange({ ...spec, stats: next.length ? next : undefined });
  }

  const statusGroup = groups.find((g) => g.id === "status_filters");
  const statusOptions = statusGroup?.filters.find((f) => f.id === "status")?.option?.options ?? [];

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
        {statusOptions.length > 0 && (
          <label>
            상태
            <select value={spec.status ?? "online"} onChange={(e) => onChange({ ...spec, status: e.currentTarget.value })}>
              {statusOptions.map((o) => (
                <option key={o.id ?? "any"} value={o.id ?? "any"}>
                  {o.text}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {groups
        .filter((g) => g.id !== "status_filters")
        .map((g) => (
          <details key={g.id} className="fb-group" open={g.id === "type_filters"}>
            <summary>{g.title ?? g.id}</summary>
            <div className="fb-grid">
              {g.filters.map((f) => {
                const cur = getVal(g.id, f.id);
                if (f.option) {
                  return (
                    <label key={f.id}>
                      {f.text ?? f.id}
                      <select
                        value={cur?.option ?? ""}
                        onChange={(e) =>
                          setVal(g.id, f.id, e.currentTarget.value ? { option: e.currentTarget.value } : null)
                        }
                      >
                        <option value="">전체</option>
                        {f.option.options
                          .filter((o) => o.id != null)
                          .map((o) => (
                            <option key={o.id!} value={o.id!}>
                              {o.text}
                            </option>
                          ))}
                      </select>
                    </label>
                  );
                }
                return (
                  <label key={f.id} className="fb-range">
                    {f.text ?? f.id}
                    <span className="fb-minmax">
                      <input
                        type="number"
                        placeholder="min"
                        value={cur?.min ?? ""}
                        onChange={(e) => setVal(g.id, f.id, { ...cur, min: numOrUndef(e.currentTarget.value) })}
                      />
                      <input
                        type="number"
                        placeholder="max"
                        value={cur?.max ?? ""}
                        onChange={(e) => setVal(g.id, f.id, { ...cur, max: numOrUndef(e.currentTarget.value) })}
                      />
                    </span>
                  </label>
                );
              })}
            </div>
          </details>
        ))}

      <div className="fb-stats">
        <div className="fb-stats-head">모드(스탯) 필터</div>
        {stats.map((s, i) => (
          <div className="fb-stat-row" key={s.id + ":" + i}>
            <input
              type="checkbox"
              checked={!s.disabled}
              title="사용/해제"
              onChange={(e) => {
                const n = stats.slice();
                n[i] = { ...n[i], disabled: !e.currentTarget.checked };
                setStats(n);
              }}
            />
            <span className="fb-stat-text" title={s.id}>
              {s.text ?? s.id}
            </span>
            <input
              type="number"
              placeholder="min"
              value={s.min ?? ""}
              onChange={(e) => {
                const n = stats.slice();
                n[i] = { ...n[i], min: numOrUndef(e.currentTarget.value) };
                setStats(n);
              }}
              style={{ width: 70 }}
            />
            <input
              type="number"
              placeholder="max"
              value={s.max ?? ""}
              onChange={(e) => {
                const n = stats.slice();
                n[i] = { ...n[i], max: numOrUndef(e.currentTarget.value) };
                setStats(n);
              }}
              style={{ width: 70 }}
            />
            <button onClick={() => setStats(stats.filter((_, j) => j !== i))} title="삭제">
              ✕
            </button>
          </div>
        ))}
        <StatPicker onPick={(opt) => setStats([...stats, { id: opt.id, text: opt.text, disabled: false }])} />
      </div>
    </div>
  );
}
