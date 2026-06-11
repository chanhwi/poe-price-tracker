import { useState } from "react";
import type { QuerySpec, WatchItem } from "../lib/types";
import { newId } from "../lib/store";
import ItemSearch from "./ItemSearch";

interface Props {
  onAdd: (item: WatchItem) => void;
}

export default function AddItem({ onAdd }: Props) {
  const [corrupted, setCorrupted] = useState(false);
  const [seq, setSeq] = useState(0); // remount ItemSearch to clear after add

  function apply(sel: { name?: string; type?: string; term?: string }) {
    const label = sel.name ?? sel.type ?? sel.term ?? "";
    if (!label) return;
    const spec: QuerySpec = { status: "securable", ...sel };
    if (corrupted) spec.filters = { misc_filters: { corrupted: { option: "true" } } };
    onAdd({
      id: newId(),
      label,
      spec,
      favorite: false,
      history: [],
      lastChecked: null,
      lastTotal: null,
      lastPartial: false,
    });
    setSeq((s) => s + 1);
  }

  return (
    <div className="add-item row">
      <ItemSearch key={seq} placeholder="아이템 추가 — 이름/베이스 검색 후 선택(Enter)" onApply={apply} />
      <label>
        <input type="checkbox" checked={corrupted} onChange={(e) => setCorrupted(e.currentTarget.checked)} /> 타락
      </label>
    </div>
  );
}
