import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import "./App.css";
import type { League, ParsedItem, PriceCheckResult, QuerySpec, WatchItem } from "./lib/types";
import { loadLeague, loadWatchlist, newId, saveLeague, saveWatchlist } from "./lib/store";
import { getLeagues, getTradeHost, priceCheck, setTradeHost } from "./lib/api";
import { clearStatsCache } from "./lib/stats";
import { buildSearchBody, specFromParsedItem } from "./lib/query";
import WatchRow from "./components/WatchRow";
import Settings from "./components/Settings";
import AddItem from "./components/AddItem";
import ResultPanel from "./components/ResultPanel";

type Tab = "all" | "fav" | "settings";

const MAX_HISTORY = 200;

function applyResult(i: WatchItem, res: PriceCheckResult): WatchItem {
  let history = i.history.slice();
  if (res.median) {
    history.push({ ts: Date.now(), amount: res.median.amount, currency: res.median.currency });
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
  }
  return {
    ...i,
    history,
    lastChecked: Date.now(),
    lastTotal: res.total,
    lastPartial: res.partial,
    lastResults: res.listings,
    tradeUrl: res.trade_url,
  };
}

function itemFromParsed(p: ParsedItem): WatchItem {
  return {
    id: newId(),
    label: p.register_term ?? p.name ?? p.base_type ?? "(unknown)",
    spec: specFromParsedItem(p),
    favorite: false,
    history: [],
    lastChecked: null,
    lastTotal: null,
    lastPartial: false,
  };
}

function specKey(s: QuerySpec): string {
  return JSON.stringify({ name: s.name, type: s.type, term: s.term, rarity: s.rarity, corrupted: s.corrupted });
}

function App() {
  const [items, setItems] = useState<WatchItem[]>(() => loadWatchlist());
  const [tab, setTab] = useState<Tab>("all");
  const [league, setLeague] = useState<string>(() => loadLeague());
  const [leagues, setLeagues] = useState<League[]>([]);
  const [host, setHostState] = useState<string>("www.pathofexile.com");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const itemsRef = useRef<WatchItem[]>(items);
  useEffect(() => {
    itemsRef.current = items;
    const t = setTimeout(() => saveWatchlist(items), 400);
    return () => clearTimeout(t);
  }, [items]);
  useEffect(() => {
    saveLeague(league);
  }, [league]);
  useEffect(() => {
    getTradeHost().then(setHostState).catch(() => {});
    getLeagues().then(setLeagues).catch(() => {});
  }, []);

  useEffect(() => {
    let disposed = false;
    const un = listen<ParsedItem>("item-captured", (e) => {
      const incoming = itemFromParsed(e.payload);
      setItems((prev) =>
        prev.some((i) => specKey(i.spec) === specKey(incoming.spec)) ? prev : [...prev, incoming]
      );
    });
    un.then((f) => {
      if (disposed) f();
    });
    return () => {
      disposed = true;
      un.then((f) => f());
    };
  }, []);

  async function changeHost(h: string) {
    try {
      await setTradeHost(h);
    } catch (e) {
      console.error(e);
    }
    setHostState(h);
    clearStatsCache();
    getLeagues().then(setLeagues).catch(() => setLeagues([]));
  }

  const refresh = useCallback(
    async (id: string) => {
      const it = itemsRef.current.find((i) => i.id === id);
      if (!it) return;
      setBusyId(id);
      setSelectedId(id); // show this item's results in the right panel
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
  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

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
        <Settings host={host} onChangeHost={changeHost} />
      ) : (
        <div className="main-split">
          <div className="left-pane">
            <AddItem onAdd={(it) => setItems((prev) => [...prev, it])} />
            <div className="row" style={{ justifyContent: "space-between", margin: "8px 0" }}>
              <span style={{ opacity: 0.6 }}>{visible.length}개 항목</span>
              <button disabled={refreshingAll || visible.length === 0} onClick={refreshAll}>
                {refreshingAll ? "새로고침 중..." : "전체 새로고침"}
              </button>
            </div>
            <div className="watchlist">
              {visible.length === 0 && (
                <p style={{ opacity: 0.6 }}>항목이 없습니다. 위에서 추가하거나 게임에서 단축키로 등록하세요.</p>
              )}
              {visible.map((it) => (
                <WatchRow
                  key={it.id}
                  item={it}
                  busy={busyId === it.id || refreshingAll}
                  selected={selectedId === it.id}
                  onRefresh={refresh}
                  onSelect={setSelectedId}
                  onToggleFav={(id) =>
                    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, favorite: !i.favorite } : i)))
                  }
                  onRemove={(id) => {
                    setItems((prev) => prev.filter((i) => i.id !== id));
                    setSelectedId((s) => (s === id ? null : s));
                  }}
                  onSpecChange={(id, spec) =>
                    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, spec } : i)))
                  }
                />
              ))}
            </div>
          </div>
          <div className="right-pane">
            <ResultPanel item={selectedItem} />
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
