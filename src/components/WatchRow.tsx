import { useState } from "react";
import type { QuerySpec, WatchItem } from "../lib/types";
import { formatEntry, relativeTime } from "../lib/currency";
import { derivedLabel, watchLabel } from "../lib/store";
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
  onRename: (id: string, name: string | undefined) => void;
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
  onRename,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const last = item.history.length ? item.history[item.history.length - 1] : null;

  const shown = watchLabel(item);

  function beginEdit() {
    setDraft(shown);
    setEditing(true);
  }
  function commitEdit() {
    setEditing(false);
    const v = draft.trim();
    // Empty or same as the auto name → clear the custom name (revert to auto).
    onRename(item.id, !v || v === derivedLabel(item) ? undefined : v);
  }

  return (
    <div className={"watch-row-wrap" + (selected ? " selected" : "")}>
      <div className="watch-row">
        <button className="star" title="즐겨찾기" onClick={() => onToggleFav(item.id)}>
          {item.favorite ? "★" : "☆"}
        </button>
        {editing ? (
          <input
            className="label-edit"
            autoFocus
            value={draft}
            placeholder="이름 (비우면 자동)"
            onChange={(e) => setDraft(e.currentTarget.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              else if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <span
            className="label"
            title="클릭=결과 보기 · 더블클릭/✏️=이름 변경"
            onClick={() => onSelect(item.id)}
            onDoubleClick={beginEdit}
            style={{ cursor: "pointer" }}
          >
            {shown}
            {item.displayName && <span className="label-custom" title="사용자 지정 이름"> ✎</span>}
          </span>
        )}
        {!editing && (
          <button className="rename" onClick={beginEdit} title="이름 변경">
            ✏️
          </button>
        )}
        <span className="price">{formatEntry(last)}</span>
        <span
          className="when"
          title={item.lastChecked ? new Date(item.lastChecked).toLocaleString() : ""}
        >
          {item.lastChecked ? relativeTime(item.lastChecked) : ""}
        </span>
        <span className="meta">
          {item.lastTotal != null ? `${item.lastTotal}건` : ""}
          {item.lastPartial ? " *" : ""}
        </span>
        <button disabled={busy} onClick={() => onRefresh(item.id)} title="검색">
          🔍
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
