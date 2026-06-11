import type { WatchItem } from "../lib/types";
import { openInBrowser } from "../lib/api";
import { cleanMod, relativeTime } from "../lib/currency";
import { watchLabel as labelOf } from "../lib/store";

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
        <strong title={labelOf(item)}>{labelOf(item)}</strong>
        {item.tradeUrl && (
          <button onClick={() => openInBrowser(item.tradeUrl!)} title="공식 웹 거래소에서 열기">
            거래소 ↗
          </button>
        )}
      </div>
      <div className="rp-when">
        마지막 조회: {relativeTime(item.lastChecked)}
        {item.lastTotal != null ? ` · 총 ${item.lastTotal}건` : ""}
        {item.lastPartial ? " · 일부만" : ""}
      </div>
      {results.length === 0 ? (
        <div className="rp-empty">결과 없음 — 🔍로 검색하세요.</div>
      ) : (
        <ul className="rp-list">
          {results.map((r, i) => {
            const imp = r.implicit ?? [];
            const exp = r.explicit ?? [];
            return (
              <li key={i} className="rp-row">
                <div className="rp-top">
                  <span className="rp-name">{r.item ?? "(이름 없음)"}</span>
                  <span className="rp-price">
                    {round(r.amount)} {r.currency}
                  </span>
                </div>
                {imp.length > 0 && (
                  <ul className="rp-mods rp-implicit">
                    {imp.slice(0, 4).map((m, j) => (
                      <li key={j}>{cleanMod(m)}</li>
                    ))}
                  </ul>
                )}
                {imp.length > 0 && exp.length > 0 && <div className="rp-div" />}
                {exp.length > 0 && (
                  <ul className="rp-mods">
                    {exp.slice(0, 8).map((m, j) => (
                      <li key={j}>{cleanMod(m)}</li>
                    ))}
                    {exp.length > 8 && <li className="rp-more">+{exp.length - 8}…</li>}
                  </ul>
                )}
                {r.account && <div className="rp-acct">{r.account}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
