# PoE Price Tracker — 설계 문서

> 개인용 Path of Exile 가격 추적 데스크톱 앱 (현재 PoE2, PoE1 추후 지원).
> This product isn't affiliated with or endorsed by Grinding Gear Games in any way.

상태: 설계 완료, 개발 착수 단계 (2026-06).

---

## 1. 개요 / 목표

- 워치리스트 항목의 현재 가격을 PoE2 trade2 API로 조회
- 조회 일시 + 가격을 로컬에 저장(히스토리), **한 줄**로 표시
- 항목별 세부 검색조건을 실제 거래소처럼 **아코디언**으로 편집 (on/off)
- 항목별 **수동 새로고침** 버튼
- 인게임 **마우스오버 + 핫키**로 아이템을 워치리스트에 빠르게 등록
- **즐겨찾기** 탭

---

## 2. 기술 스택

- **Tauri 2** (Rust 백엔드 + 시스템 웹뷰 UI) — 타당성 검증 완료, Electron 폴백 불필요
- HTTP: Rust **reqwest** (브라우저 CORS 무관, User-Agent/Cookie 자유 설정)
- 글로벌 핫키: `tauri-plugin-global-shortcut` (동적 재바인딩 지원)
- 클립보드: `tauri-plugin-clipboard-manager`
- 키 입력 모사: `enigo` (게임에 Ctrl+C 전송) — 유일한 non-plugin native 의존성
- 저장: localStorage / IndexedDB (웹뷰)
- 프론트엔드 프레임워크: **미정 (TBD)**

---

## 3. 핵심 사실 (검증됨)

- trade2는 **게임 클라이언트와 무관한 웹 API**. **게임 실행 불필요** — 게임 없는 환경에서 익명 search → HTTP 200 실측.
- **익명(쿠키 없음)으로도 search 동작.** POESESSID(= 홈페이지 로그인, 게임 무관)는 한도 상향 + 라이브서치용일 뿐.
- Cloudflare는 이 호스트에서 TLS 지문/UA로 차단하지 않음 (일반 UA curl → 200). **reqwest 그대로 가능.** 차단은 IP 평판(VPN/데이터센터) 한정 — 가정 IP 무관.
- Tauri `WebviewWindow.cookies()`가 **HTTP-only 쿠키까지** 읽음 → 임베디드 로그인으로 POESESSID 캡처 가능 (Windows는 async command + 별도 스레드 필수).

---

## 4. 아키텍처

```
┌─ Tauri 앱 ──────────────────────────────────────────────┐
│ Rust 백엔드                                              │
│  • global-shortcut (기본 F7, 재바인딩)                  │
│      → foreground가 PoE2인지 확인 → enigo로 Ctrl+C 모사 │
│      → clipboard 읽기 → emit("item-captured", text)     │
│  • reqwest HTTP: trade2 호출 (UA + POESESSID 헤더)       │
│      → 단일 직렬 큐 + 헤더 기반 throttle                 │
│  • 임베디드 로그인 webview → cookies()로 POESESSID 캡처  │
│                                                          │
│ Webview UI (프론트)                                      │
│  • 탭: [전체] [즐겨찾기] [설정]                          │
│  • 항목 행(한 줄): ★ | 이름 | 중앙값+추세 | [🔄] [⚙️]    │
│  • ⚙️ → 아코디언 필터 빌더 (거래소 모방)                │
│  • 클립보드 파서: rarity → 이름/베이스 분기 + corrupted │
│  • localStorage/IndexedDB: 가격 히스토리                 │
└──────────────────────────────────────────────────────────┘
```

모든 요청이 **사용자 본인 IP / 세션**에서 나감. 중앙 서버 ❌ (서버 집중 시 단일 IP 한도 공유 → throttle/밴).

---

## 5. API 레퍼런스

### 5.1 두 개의 API (구분 필수)

| | 비공식 trade2 사이트 API | 공식 OAuth API |
|---|---|---|
| 호스트 | `www.pathofexile.com/api/trade2/...` | `api.pathofexile.com` + `/developer/docs` |
| 문서화 | 없음 (역공학) | 있음 |
| 아이템 검색 | **가능 (본 앱이 사용)** | 불가 |
| 통화 환전 | exchange 엔드포인트 | `service:cxapi` 스코프 |

본 앱은 환율을 **공개 시세**로 대체하므로 공식 OAuth는 사용하지 않음.

### 5.2 엔드포인트 (host: `www.pathofexile.com`)

| 용도 | 메서드 / 경로 |
|---|---|
| 검색 | `POST /api/trade2/search/poe2/{league}` |
| 페치 | `GET /api/trade2/fetch/{id1,...,id10}?query={queryId}&realm=poe2` (최대 10) |
| 환전 | `POST /api/trade2/exchange/poe2/{league}` |
| 정적 데이터 | `GET /api/trade2/data/{items|stats|static|filters|leagues}` |

- `{league}`는 하드코딩 금지 → `data/leagues`로 조회 (현재: `Runes of Aldur`, `HC Runes of Aldur`, `Standard`, `Hardcore`).
- realm 세그먼트는 리터럴 `poe2`. fetch에는 league 세그먼트 없음.

### 5.3 2단계 흐름

```
1) POST /search/poe2/{league} + 검색쿼리 JSON
   → { "id": "<queryId>", "complexity": N, "result": ["<hash>", ...], "total": N }
2) GET /fetch/<hash1>,...,<hash10>?query=<queryId>&realm=poe2
   → { "result": [ { "id", "listing": {price, account, indexed}, "item": {...} }, ... ] }
```

가격은 **fetch에서만** 나옴 (search는 해시 목록만). 가격 1건 조회 = search 1콜 + fetch 1콜.

### 5.4 검색 쿼리 JSON (요지)

```json
{
  "query": {
    "status": { "option": "online" },
    "name":  "...",                       // 유니크 이름
    "type":  "...",                       // 베이스 타입
    "stats": [ { "type": "and", "filters": [ { "id": "explicit.stat_XXXX", "value": { "min": 0 } } ] } ],
    "filters": {
      "type_filters": { "filters": { "category": {}, "rarity": {} } },
      "misc_filters": { "filters": { "ilvl": {}, "corrupted": {} } }
    }
  },
  "sort": { "price": "asc" }
}
```

stat id / 통화 id / 베이스 타입은 `data/{stats,static,items}`에서 매핑.

### 5.5 인증

- **POESESSID 쿠키 (선택).** 헤더 `Cookie: POESESSID=<값>`. 홈페이지 로그인으로 획득(게임 무관). 익명도 search 가능, 붙이면 한도 상향(Account 버킷 추가) + 라이브서치.
- **User-Agent**: 연락처 포함 권장 (예: `poe-price-tracker/0.1 (contact: ...)`).
- ⚠️ **세션 쿠키는 절대 레포에 커밋 금지** (.gitignore 처리).

---

## 6. 레이트리밋 (실측 2026, 익명/IP)

```
X-Rate-Limit-Policy: trade-search-request-limit
X-Rate-Limit-Rules:  Ip
X-Rate-Limit-Ip:     5:10:60,15:60:300,30:300:1800
X-Rate-Limit-Ip-State: 1:10:0,1:60:0,1:300:0
```

| 창 | 한도 | 위반 시 제재 |
|---|---|---|
| 단기 | 5회 / 10초 | 60초 락 |
| 중기 | 15회 / 60초 | 300초(5분) 락 |
| 장기 | 30회 / 300초 | **1800초(30분) 락** ⚠️ |

- 장기 지속률 ≈ **1회/10초**. 잠깐 5개 버스트는 OK.
- **30분 락이 핵심 위험** — 5분당 30회(search 기준) 절대 초과 금지.
- POESESSID 첨부 시 `Account` 버킷 추가.

### throttle 설계

- 단일 **직렬 큐** (concurrency 1), 정책별 토큰버킷 (search / fetch / exchange 분리)
- seed 1콜/5초 → 응답 `X-Rate-Limit-*` 헤더로 동적 재구성 (가장 빡빡한 window + 지연 패딩)
- 전역 최소 간격 1.5초, `429` → `Retry-After` 정확히 준수 + 해당 정책 큐 동결 (재시도 난사 금지)
- 항목 캐시 TTL 60~120s, 동일 in-flight 쿼리 dedupe
- "전체 새로고침"은 큐로 간격, 진행률 표시. **자동 폴링 기본 off**.

---

## 7. 기능 명세

1. **워치리스트 가격 조회** — 한 번 조회 결과의 **중앙값** (최저가 1건은 노이즈).
2. **일시 + 가격 저장** — 정규화(exalted 환산) + 원시값 함께 저장.
3. **한 줄 표시** — `★ | 이름 | 중앙값+추세 | [🔄] [⚙️]`.
4. **세부조건 아코디언** — 거래소 모방, `data/filters·stats`로 구동. 기본값 똑똑하게 → **사용자 무개입**, 토글 default off.
5. **항목별 새로고침** — 수동 버튼(1클릭 = 1조회, 가장 안전).
6. **레이트리밋 회피** — §6 throttle.
7. **클라이언트 사이드 요청** — 사용자 IP/세션, 중앙 서버 ❌.

**인게임 캡처(추가):** 마우스오버 + 핫키(기본 F7, 재바인딩) → enigo로 Ctrl+C 모사 → 클립보드 파싱 → 워치리스트 등록. 유니크=이름, 레어/일반=베이스 타입, +타락여부만 일단. **등록만 하고 검색은 안 함**(수동 버튼). PoE2 클립보드 파서는 Exiled Exchange 2 참고.

**즐겨찾기 탭(추가):** 전체/즐겨찾기 탭, 항목에 `favorite` 플래그.

---

## 8. 데이터 모델 (항목 1개)

```
{
  id, favorite: bool,
  kind: "unique" | "base",            // 등록 시 rarity로 결정
  name | baseType, corrupted: bool,
  query: { ...trade2 검색 JSON },      // 아코디언이 편집하는 대상
  history: [ { ts, rawAmount, rawCurrency, exValue, rate } ],
  lastChecked, cacheTTL
}
```

---

## 9. 통화 처리

- **표시:** div / ex / chaos 중 값이 ≥1 되는 단위 자동 선택 ("유의미한 0 이상").
- **저장:** 단일 기준통화(**exalted 환산**)로 정규화 + 원시값 + 사용 환율 + 시각. (안 그러면 시계열 비교 불가.)
- **환율 소스:** **공개 시세** (poe2scout / poe.ninja), 수 분 캐시. 공식 OAuth(`service:cxapi`)는 무거워서 미사용.

---

## 10. ToS 준수

- 수동 1키 = 1액션, 게임 클라이언트 미접촉 (인젝션/메모리 변조 없음)
- 핫키는 **등록만**(서버 콜 0), 검색은 수동 버튼 → Awakened/EE2와 동일한(밴 사례 없는) 안전 카테고리
- 연락처 User-Agent, 비제휴 고지
- 레이트리밋 / `Retry-After` 준수, 4xx 난사 금지

---

## 11. 개발 계획 (커밋 섹션)

| # | 섹션 | 게임 필요 |
|---|---|---|
| 1 | 프로젝트 설계 문서 (현재 커밋) | ❌ |
| 2 | Tauri 스캐폴드 + 프론트엔드 프레임워크 | ❌ |
| 3 | trade2 HTTP 클라이언트 + throttle 큐 | ❌ |
| 4 | 클립보드 파서 (픽스처 기반) | ❌ |
| 5 | 검색 쿼리 빌더 | ❌ |
| 6 | POESESSID 임베디드 로그인 | ❌ |
| 7 | UI: 한 줄 행 + 탭(전체/즐겨찾기) | ❌ |
| 8 | 아코디언 필터 빌더 (v1 핵심 → v2 풀 stat) | ❌ |
| 9 | 글로벌 핫키 + 등록 플로우 + 설정창(재바인딩) | ❌ |
| 10 | 인게임 통합 테스트 | ✅ |

앱의 ~95%는 게임 없이, 로그인 없이 개발/테스트 가능. 게임은 마지막 통합(10)에서만 필요.
