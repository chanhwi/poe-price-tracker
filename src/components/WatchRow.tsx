import { useState } from "react";
import type { QuerySpec, WatchItem } from "../lib/types";
import { formatEntry, trend, trendSymbol } from "../lib/currency";
import FilterBuilder from "./FilterBuilder";

interface Props {
  item: WatchItem;
  busy: boolean;
  selected: boolean;
  onRefresh: (id: string) => void;
  onToggleFav: (id: string) => void;
  onRemove: (id: string) => void;
  onSpecChange: (id: string, spec: QuerySpec) => void;
  onSelect: (id: string) => void;
}

export default function WatchRow({
  item,
  busy,
  selected,
  onRefresh,
  onToggleFav,
  onRemove,
  onSpecChange,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const last = item.history.length ? item.history[item.history.length - 1] : null;
  const t = trend(item.history);

  return (
    <div className={"watch-row-wrap" + (selected ? " selected" : "")}>
      <div className="watch-row">
        <button className="star" title="즐겨찾기" onClick={() => onToggleFav(item.id)}>
          {item.favorite ? "★" : "☆"}
        </button>
        <span
          className="label"
          title="클릭하면 결과 표시"
          onClick={() => onSelect(item.id)}
          style={{ cursor: "pointer" }}
        >
          {item.label}
        </span>
        <span className={"price " + t.dir}>
          {formatEntry(last)} {trendSymbol(t)}
          {t.pct != null ? ` ${t.pct > 0 ? "+" : ""}${t.pct}%` : ""}
        </span>
        <span className="meta">
          {item.lastTotal != null ? `${item.lastTotal}건` : ""}
          {item.lastPartial ? " *" : ""}
        </span>
        <button disabled={busy} onClick={() => onRefresh(item.id)} title="새로고침">
          🔄
        </button>
        <button onClick={() => setOpen((o) => !o)} title="검색 조건">
          ⚙️
        </button>
        <button onClick={() => onRemove(item.id)} title="삭제">
          🗑
        </button>
      </div>
      {open && (
        <div className="accordion">
          <FilterBuilder spec={item.spec} onChange={(spec) => onSpecChange(item.id, spec)} />
        </div>
      )}
    </div>
  );
}
