import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import type { League, PriceCheckResult, WatchItem } from "./lib/types";
import { loadLeague, loadWatchlist, saveLeague, saveWatchlist } from "./lib/store";
import { getLeagues, priceCheck } from "./lib/api";
import { buildSearchBody } from "./lib/query";
import WatchRow from "./components/WatchRow";
import Settings from "./components/Settings";
import AddItem from "./components/AddItem";

type Tab = "all" | "fav" | "settings";

function applyResult(i: WatchItem, res: PriceCheckResult): WatchItem {
  const history = i.history.slice();
  if (res.median) {
    history.push({ ts: Date.now(), amount: res.median.amount, currency: res.median.currency });
  }
  return { ...i, history, lastChecked: Date.now(), lastTotal: res.total, lastPartial: res.partial };
}

function App() {
  const [items, setItems] = useState<WatchItem[]>(() => loadWatchlist());
  const [tab, setTab] = useState<Tab>("all");
  const [league, setLeague] = useState<string>(() => loadLeague());
  const [leagues, setLeagues] = useState<League[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  // Keep a ref of items so the refresh callback stays stable and never reads a
  // stale list mid "refresh all".
  const itemsRef = useRef<WatchItem[]>(items);
  useEffect(() => {
    itemsRef.current = items;
    saveWatchlist(items);
  }, [items]);
  useEffect(() => {
    saveLeague(league);
  }, [league]);
  useEffect(() => {
    getLeagues()
      .then(setLeagues)
      .catch(() => {});
  }, []);

  const refresh = useCallback(
    async (id: string) => {
      const it = itemsRef.current.find((i) => i.id === id);
      if (!it) return;
      setBusyId(id);
      try {
        const res = await priceCheck(league, buildSearchBody(it.spec));
        setItems((prev) => prev.map((i) => (i.id === id ? applyResult(i, res) : i)));
      } catch (e) {
        console.error(e);
        alert("가격 조회 실패: " + String(e));
      } finally {
        setBusyId(null);
      }
    },
    [league]
  );

  async function refreshAll() {
    setRefreshingAll(true);
    const list = itemsRef.current.filter((i) => tab !== "fav" || i.favorite);
    for (const it of list) {
      await refresh(it.id);
    }
    setRefreshingAll(false);
  }

  const visible = items.filter((i) => tab !== "fav" || i.favorite);

  return (
    <main className="container">
      <header className="topbar">
        <h1>PoE Price Tracker</h1>
        <select value={league} onChange={(e) => setLeague(e.currentTarget.value)} title="리그">
          {leagues.length === 0 && <option value={league}>{league}</option>}
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>
              {l.text ?? l.id}
            </option>
          ))}
        </select>
      </header>

      <nav className="tabs">
        <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>
          전체
        </button>
        <button className={tab === "fav" ? "active" : ""} onClick={() => setTab("fav")}>
          즐겨찾기
        </button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
          설정
        </button>
      </nav>

      {tab === "settings" ? (
        <Settings />
      ) : (
        <>
          <AddItem onAdd={(it) => setItems((prev) => [...prev, it])} />
          <div className="row" style={{ justifyContent: "space-between", margin: "8px 0" }}>
            <span style={{ opacity: 0.6 }}>{visible.length}개 항목</span>
            <button disabled={refreshingAll || visible.length === 0} onClick={refreshAll}>
              {refreshingAll ? "새로고침 중..." : "전체 새로고침"}
            </button>
          </div>
          <div className="watchlist">
            {visible.length === 0 && <p style={{ opacity: 0.6 }}>항목이 없습니다. 위에서 추가하세요.</p>}
            {visible.map((it) => (
              <WatchRow
                key={it.id}
                item={it}
                busy={busyId === it.id || refreshingAll}
                onRefresh={refresh}
                onToggleFav={(id) =>
                  setItems((prev) => prev.map((i) => (i.id === id ? { ...i, favorite: !i.favorite } : i)))
                }
                onRemove={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

export default App;
