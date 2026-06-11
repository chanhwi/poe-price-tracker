import { useEffect, useState } from "react";
import {
  capturePoesessid,
  clearPoesessid,
  getCaptureHotkey,
  openLogin,
  setCaptureHotkey,
} from "../lib/api";

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

export default function Settings() {
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
    if (MOD_CODES.includes(e.code)) return; // wait for a non-modifier key
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

  return (
    <div className="settings">
      <h2>세션 (POESESSID)</h2>
      <p style={{ opacity: 0.7 }}>
        익명으로도 검색되지만, 로그인하면 요청 한도가 올라가고 더 안정적입니다. 게임이 아니라 홈페이지 로그인입니다.
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
        <code style={{ padding: "4px 8px", background: "rgba(0,0,0,0.06)", borderRadius: 6 }}>
          {hotkey || "—"}
        </code>
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
