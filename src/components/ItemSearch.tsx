import { useEffect, useMemo, useState } from "react";
import type { ItemOption } from "../lib/types";
import { loadItems } from "../lib/items";

interface Props {
  initial?: string;
  placeholder?: string;
  /** Apply typed text (as term) on blur too — used when editing an existing
   * item's search so edits stick without pressing Enter. */
  applyOnBlur?: boolean;
  onApply: (sel: { name?: string; type?: string; term?: string }) => void;
}

export default function ItemSearch({ initial = "", placeholder, applyOnBlur = false, onApply }: Props) {
  const [q, setQ] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState<ItemOption[]>([]);

  useEffect(() => {
    loadItems().then(setAll).catch(() => {});
  }, []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const starts: ItemOption[] = [];
    const incl: ItemOption[] = [];
    for (const o of all) {
      const d = o.display.toLowerCase();
      if (d.startsWith(t)) starts.push(o);
      else if (d.includes(t)) incl.push(o);
      if (starts.length >= 50) break;
    }
    return [...starts, ...incl].slice(0, 40);
  }, [q, all]);

  function pick(o: ItemOption) {
    setQ(o.display);
    setApplied(o.display);
    setOpen(false);
    if (o.unique && o.name) onApply({ name: o.name });
    else onApply({ type: o.base });
  }

  function applyRaw() {
    const t = q.trim();
    setOpen(false);
    if (t) {
      setApplied(t);
      onApply({ term: t });
    }
  }

  return (
    <div className="item-search">
      <input
        value={q}
        placeholder={placeholder ?? "아이템 이름/베이스 검색"}
        onChange={(e) => {
          setQ(e.currentTarget.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() =>
          setTimeout(() => {
            setOpen(false);
            if (applyOnBlur && q.trim() && q.trim() !== applied.trim()) applyRaw();
          }, 150)
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (results[0]) pick(results[0]);
            else applyRaw();
          }
        }}
      />
      {open && results.length > 0 && (
        <ul className="search-results">
          {results.map((o, i) => (
            <li key={i} onMouseDown={() => pick(o)}>
              <span>{o.display}</span>
              <small>{o.unique ? "유니크" : "베이스"}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
