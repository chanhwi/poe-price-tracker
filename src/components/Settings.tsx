import { useEffect, useState } from "react";
import type { League } from "../lib/types";
import {
  capturePoesessid,
  clearPoesessid,
  getCaptureHotkey,
  openLogin,
  setCaptureHotkey,
} from "../lib/api";

const REGIONS: { host: string; label: string }[] = [
  { host: "poe.game.daum.net", label: "한국 (한글)" },
  { host: "www.pathofexile.com", label: "글로벌 (영어)" },
  { host: "pathofexile.tw", label: "대만 / Garena (번체)" },
  { host: "jp.pathofexile.com", label: "일본 (日本語)" },
  { host: "ru.pathofexile.com", label: "러시아 (Русский)" },
];

const MOD_CODES = [
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "ShiftLeft",
  "ShiftRight",
  "MetaLeft",
  "MetaRight",
];

interface Props {
  host: string;
  onChangeHost: (host: string) => void;
  league: string;
  leagues: League[];
  onChangeLeague: (league: string) => void;
}

export default function Settings({ host, onChangeHost, league, leagues, onChangeLeague }: Props) {
  const [status, setStatus] = useState("");
  const [hotkey, setHotkey] = useState("");
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    getCaptureHotkey().then(setHotkey).catch(() => {});
  }, []);

  async function capture() {
    setStatus("가져오는 중...");
    try {
      const sid = await capturePoesessid();
      setStatus(
        sid ? "POESESSID 적용됨 (로그인 상태 감지)" : "POESESSID 못 찾음 — 로그인 후 다시 시도하세요."
      );
    } catch (e) {
      setStatus("오류: " + String(e));
    }
  }

  function onHotkeyKey(e: React.KeyboardEvent<HTMLInputElement>) {
    e.preventDefault();
    if (MOD_CODES.includes(e.code)) return;
    const mods: string[] = [];
    if (e.ctrlKey) mods.push("Control");
    if (e.altKey) mods.push("Alt");
    if (e.shiftKey) mods.push("Shift");
    if (e.metaKey) mods.push("Super");
    const accel = [...mods, e.code].join("+");
    setCapturing(false);
    setCaptureHotkey(accel)
      .then(() => {
        setHotkey(accel);
        setStatus("단축키 변경됨: " + accel);
      })
      .catch((err) => setStatus("단축키 등록 실패: " + String(err)));
  }

  const knownHost = REGIONS.some((r) => r.host === host);

  return (
    <div className="settings">
      <h2>지역 / 언어</h2>
      <p style={{ opacity: 0.7 }}>
        게임 클라이언트 언어에 맞춰 선택하세요. 아이템 이름이 그 지역 언어로 검색됩니다. (한국 클라이언트 → "한국")
      </p>
      <select value={host} onChange={(e) => onChangeHost(e.currentTarget.value)} style={{ minWidth: 240 }}>
        {REGIONS.map((r) => (
          <option key={r.host} value={r.host}>
            {r.label}
          </option>
        ))}
        {!knownHost && <option value={host}>{host}</option>}
      </select>

      <h2 style={{ marginTop: 20 }}>리그</h2>
      <select value={league} onChange={(e) => onChangeLeague(e.currentTarget.value)} style={{ minWidth: 240 }}>
        {leagues.length === 0 && <option value={league}>{league || "(로딩...)"}</option>}
        {leagues.map((l) => (
          <option key={l.id} value={l.id}>
            {l.text ?? l.id}
          </option>
        ))}
      </select>

      <h2 style={{ marginTop: 20 }}>세션 (POESESSID)</h2>
      <p style={{ opacity: 0.7 }}>
        익명으로도 검색되지만, 로그인하면 요청 한도가 올라가고 더 안정적입니다. 위에서 고른 지역의 사이트로 로그인됩니다.
      </p>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => openLogin()}>① 로그인 창 열기</button>
        <button onClick={capture}>② POESESSID 가져오기</button>
        <button
          onClick={() => {
            clearPoesessid();
            setStatus("세션을 지웠습니다.");
          }}
        >
          세션 지우기
        </button>
      </div>
      <p style={{ minHeight: 24 }}>{status}</p>

      <h2>단축키</h2>
      <p style={{ opacity: 0.7 }}>
        게임에서 아이템에 마우스를 올리고 이 키를 누르면 워치리스트에 등록됩니다. (borderless windowed 권장)
      </p>
      <div className="row" style={{ gap: 8 }}>
        <code style={{ padding: "4px 8px", background: "rgba(0,0,0,0.06)", borderRadius: 6 }}>{hotkey || "—"}</code>
        {capturing ? (
          <input
            autoFocus
            placeholder="키 조합을 누르세요..."
            onKeyDown={onHotkeyKey}
            onBlur={() => setCapturing(false)}
            style={{ width: 200 }}
          />
        ) : (
          <button onClick={() => setCapturing(true)}>단축키 변경</button>
        )}
      </div>
    </div>
  );
}
