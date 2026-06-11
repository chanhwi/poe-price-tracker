import { useState } from "react";
import { capturePoesessid, clearPoesessid, openLogin } from "../lib/api";

export default function Settings() {
  const [status, setStatus] = useState<string>("");

  async function capture() {
    setStatus("가져오는 중...");
    try {
      const sid = await capturePoesessid();
      setStatus(sid ? "POESESSID 적용됨 (로그인 상태 감지)" : "POESESSID 못 찾음 — 로그인 창에서 로그인 후 다시 시도하세요.");
    } catch (e) {
      setStatus("오류: " + String(e));
    }
  }

  return (
    <div className="settings">
      <h2>세션 (POESESSID)</h2>
      <p style={{ opacity: 0.7 }}>
        익명으로도 검색되지만, 로그인하면 요청 한도가 올라가고 더 안정적입니다. 로그인은 게임이 아니라 홈페이지 로그인입니다.
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
    </div>
  );
}
