# PoE2 Price Tracker

개인용 **Path of Exile 2** 아이템 가격 추적 데스크톱 앱.

워치리스트에 담은 항목을 trade2 API로 조회해 가격을 한 줄로 보여주고, 일시·가격 히스토리를 로컬에 저장합니다. 인게임에서 마우스오버 + 핫키로 아이템을 빠르게 등록하고, 항목별로 거래소처럼 세부 검색조건을 편집할 수 있습니다.

> ⚠️ This product isn't affiliated with or endorsed by Grinding Gear Games in any way.

## 상태

설계 완료, 개발 착수 단계 (2026-06). 자세한 내용은 [docs/DESIGN.md](docs/DESIGN.md) 참고.

## 기술 스택

- **Tauri 2** (Rust 백엔드 + 시스템 웹뷰 UI)
- HTTP: Rust `reqwest` (브라우저 CORS 무관)
- 글로벌 핫키: `tauri-plugin-global-shortcut`
- 클립보드: `tauri-plugin-clipboard-manager`
- 키 입력 모사: `enigo`
- 프론트엔드 프레임워크: 미정 (TBD)

## 핵심 원칙

- 모든 trade2 요청은 **사용자 본인 클라이언트(IP/세션)에서** 직접 — 중앙 서버 없음.
- GGG ToS 준수: 수동 1키 = 1액션, 게임 클라이언트 미접촉, 레이트리밋 헤더 준수.
