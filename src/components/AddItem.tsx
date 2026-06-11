import { useState } from "react";
import type { QuerySpec, WatchItem } from "../lib/types";
import { newId } from "../lib/store";

interface Props {
  onAdd: (item: WatchItem) => void;
}

export default function AddItem({ onAdd }: Props) {
  const [text, setText] = useState("");
  const [byName, setByName] = useState(true);
  const [corrupted, setCorrupted] = useState(false);

  function add() {
    const term = text.trim();
    if (!term) return;
    const spec: QuerySpec = { onlineOnly: true, corrupted };
    if (byName) {
      spec.name = term;
      spec.rarity = "unique";
    } else {
      spec.type = term;
    }
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
        placeholder="아이템 이름(유니크) 또는 베이스 타입"
        style={{ flex: 1, minWidth: 200 }}
      />
      <label>
        <input type="checkbox" checked={byName} onChange={(e) => setByName(e.currentTarget.checked)} /> 이름으로(유니크)
      </label>
      <label>
        <input type="checkbox" checked={corrupted} onChange={(e) => setCorrupted(e.currentTarget.checked)} /> 타락
      </label>
      <button onClick={add}>추가</button>
    </div>
  );
}
