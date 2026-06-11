import type { WatchItem } from "../lib/types";
import { openInBrowser } from "../lib/api";

interface Props {
  item: WatchItem | null;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function ResultPanel({ item }: Props) {
  if (!item) {
    return <div className="result-panel empty">왼쪽 항목을 클릭하면 검색 결과가 여기 표시됩니다.</div>;
  }
  const results = item.lastResults ?? [];
  return (
    <div className="result-panel">
      <div className="rp-head">
        <strong title={item.label}>{item.label}</strong>
        {item.tradeUrl && (
          <button onClick={() => openInBrowser(item.tradeUrl!)} title="공식 웹 거래소에서 열기">
            거래소 ↗
          </button>
        )}
      </div>
      {results.length === 0 ? (
        <div className="rp-empty">결과 없음 — 🔄로 검색하세요.</div>
      ) : (
        <ul className="rp-list">
          {results.map((r, i) => (
            <li key={i} className="rp-row">
              <div className="rp-top">
                <span className="rp-name">{r.item ?? "(이름 없음)"}</span>
                <span className="rp-price">
                  {round(r.amount)} {r.currency}
                </span>
              </div>
              {r.mods.length > 0 && (
                <ul className="rp-mods">
                  {r.mods.slice(0, 6).map((m, j) => (
                    <li key={j}>{m}</li>
                  ))}
                  {r.mods.length > 6 && <li>…</li>}
                </ul>
              )}
              {r.account && <div className="rp-acct">{r.account}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
