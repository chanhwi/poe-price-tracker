import { useState } from "react";
import type { WatchItem } from "../lib/types";
import { formatEntry, trend, trendSymbol } from "../lib/currency";

interface Props {
  item: WatchItem;
  busy: boolean;
  onRefresh: (id: string) => void;
  onToggleFav: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function WatchRow({ item, busy, onRefresh, onToggleFav, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const last = item.history.length ? item.history[item.history.length - 1] : null;
  const t = trend(item.history);

  return (
    <div className="watch-row-wrap">
      <div className="watch-row">
        <button className="star" title="즐겨찾기" onClick={() => onToggleFav(item.id)}>
          {item.favorite ? "★" : "☆"}
        </button>
        <span className="label" title={item.label}>
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
          <div style={{ opacity: 0.6, fontSize: 12, marginBottom: 4 }}>
            검색 조건 (Section 8에서 거래소형 편집 UI 추가)
          </div>
          <pre>{JSON.stringify(item.spec, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
