import { useState } from "react";
import type { QuerySpec, WatchItem } from "../lib/types";
import { newId } from "../lib/store";

interface Props {
  onAdd: (item: WatchItem) => void;
}

export default function AddItem({ onAdd }: Props) {
  const [text, setText] = useState("");
  const [corrupted, setCorrupted] = useState(false);

  function add() {
    const term = text.trim();
    if (!term) return;
    // Free-text search (`term`) — forgiving, like the trade site's search box.
    // `query.name`/`query.type` require an EXACT unique name / base type and
    // 400 on anything else, so exact matching is opt-in via the ⚙️ accordion.
    const spec: QuerySpec = { onlineOnly: true, term };
    if (corrupted) spec.corrupted = true;
    onAdd({
      id: newId(),
      label: term,
      spec,
      favorite: false,
      history: [],
      lastChecked: null,
      lastTotal: null,
      lastPartial: false,
    });
    setText("");
  }

  return (
    <div className="add-item row">
      <input
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") add();
        }}
        placeholder="아이템 이름 또는 베이스 (자유 검색 — 정확 매칭은 ⚙️에서)"
        style={{ flex: 1, minWidth: 220 }}
      />
      <label>
        <input type="checkbox" checked={corrupted} onChange={(e) => setCorrupted(e.currentTarget.checked)} /> 타락
      </label>
      <button onClick={add}>추가</button>
    </div>
  );
}
