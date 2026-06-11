import { useEffect, useMemo, useState } from "react";
import type { StatOption } from "../lib/types";
import { loadStats } from "../lib/stats";

interface Props {
  onPick: (opt: StatOption) => void;
}

export default function StatPicker({ onPick }: Props) {
  const [all, setAll] = useState<StatOption[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadStats()
      .then((s) => {
        if (active) {
          setAll(s);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setErr(String(e));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    return all.filter((o) => o.text.toLowerCase().includes(term)).slice(0, 30);
  }, [q, all]);

  return (
    <div className="stat-picker">
      <input
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        placeholder={loading ? "스탯 목록 로딩..." : "모드 검색해서 추가 (2글자+)"}
        disabled={loading}
      />
      {err && <div className="stat-err">스탯 로드 실패: {err}</div>}
      {results.length > 0 && (
        <ul className="stat-results">
          {results.map((o) => (
            <li
              key={o.id}
              onClick={() => {
                onPick(o);
                setQ("");
              }}
            >
              <span>{o.text}</span>
              <small>
                {o.group}
                {o.kind ? ` · ${o.kind}` : ""}
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
