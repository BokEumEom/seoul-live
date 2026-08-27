# 상세를 `citydata` 한 번으로 합친다 (2026-08-27)

## 왜

**같은 데이터를 두 번 부르고 있었다.**

상세를 열면 지금 서울 API를 두 번 부른다.

| 호출 | 프록시 | TTL | 하루 호출/명소 |
| --- | --- | --- | --- |
| `citydata_ppltn` | `api/citydata.ts` | 1시간 | 24 |
| `citydata` | `api/cityinfo.ts` | 3시간 | 8 |

그런데 **`citydata` 응답의 `LIVE_PPLTN_STTS`가 `citydata_ppltn`이 주는 것을 전부 포함한다.** 앞의 24회는 낭비다.

픽스처(`docs/fixtures/citydata-광화문덕수궁.json`)로 확인했다:

```
CITYDATA.LIVE_PPLTN_STTS  →  길이 1 배열
  PPLTN_TIME         = "2026-08-25 11:05"      ← 분 단위 관측 시각
  AREA_CONGEST_LVL   = "보통"
  AREA_PPLTN_MIN/MAX = 38000 / 40000
  AREA_CONGEST_MSG   = "사람이 몰려있을 수 있지만…"
  REPLACE_YN, FCST_YN
  FCST_PPLTN         = 12칸, 필드명이 citydata_ppltn과 동일
  MALE/FEMALE_PPLTN_RATE, PPLTN_RATE_0~70, RESNT/NON_RESNT_PPLTN_RATE
```

**하루 1,000회 한도가 이 앱의 진짜 천장이다.** AGENTS.md가 적어 둔 대로, 지금은 하루에 서로 다른 명소 상세가 30곳 넘게 열리면 한도에 닿는다 — 즉 **사용자가 늘수록 앱이 깨진다.** 이 변경은 그 천장을 30곳에서 41곳으로 올린다.

## 무엇을 안 하나

**SeoulRtd로 옮기지 않는다.** 처음에는 상세를 통째로 SeoulRtd(인증키 없는 상류)로 옮기려 했는데, 조사 중에 `citydata` 쪽이 더 나은 답인 것이 드러났다:

- 관측 시각이 **분 단위로 그대로 남는다.** SeoulRtd는 `ppltn_congest`의 `time_cd`에서 「현재」 칸 위치로 **시간 단위**까지만 복원된다 (실호출 2회로 확인: 14:49 호출 → 현재=14시, 15:0x 호출 → 현재=15시)
- 문서화 안 된 상류에 **상세까지** 얹지 않는다. 목록·지도가 이미 거기 걸려 있고 폴백이 없다
- SeoulRtd에 새 우물은 없다. `/api/population`이 따로 있는 줄 알았으나 그들의 `js/api/population-api.js`를 받아 보니 `/ppltn`·`/ppltn_congest`를 부르는 래퍼였다 — **우리가 이미 쓰는 그 둘이 전부다**

**TTL 3시간 유지 + 등급만 SeoulRtd로 덮어쓰기(「안 B」)도 안 한다.** 그러면 명소당 8회로 121곳 전부가 한도에 들어오지만, 한 화면에서 등급은 5분 전 값이고 인원수는 3시간 전 값이 된다 — AGENTS.md가 경고한 「한 화면의 두 숫자가 서로 다른 순간을 말한다」에 정면으로 걸린다. 값마다 기준 시각을 따로 적어야 하고 그건 별도 설계다. **이 스펙은 그리로 가는 길 위에 있다** — 나중에 TTL만 올리고 등급 덮어쓰기를 더하면 된다.

## 설계

### 1. 봉투만 바꾼다

안쪽 행이 동일하므로 **`areaSchema`를 한 줄도 안 고친다.**

```
지금: { 'SeoulRtd.citydata_ppltn': [row] }
새것: { CITYDATA: { LIVE_PPLTN_STTS: [row] } }
```

바뀌는 곳은 봉투를 기대하는 두 자리다:

- `src/data/schema.ts`의 `responseSchema`
- `src/data/compositionSchema.ts`의 `looseListSchema`

**두 봉투를 다 읽게 하지 않는다.** 그러면 죽은 갈래가 영구히 남는다. 새 봉투 하나만 읽고, `buildMockSnapshot`(`src/data/mock.ts`)도 같은 모양으로 옮긴다 — 빠뜨린 곳은 테스트가 잡는다.

### 2. 서버 — 엔드포인트 둘을 지운다

| 파일 | 처분 | 이유 |
| --- | --- | --- |
| `api/citydata.ts` | **삭제** | `citydata_ppltn`을 부르는 유일한 자리 |
| `api/citydata-bulk.ts` | **삭제** | 이미 죽어 있다. `useAreaSnapshots`가 어느 화면에서도 안 불리고 HomeScreen에는 주석만 남아 있다. **이것도 `citydata_ppltn`을 부르므로, 남겨두면 쿼터를 먹는 경로가 살아 있는 채로 잊힌다** |
| `api/cityinfo.ts` | **유지** — 상세의 유일한 출처가 된다 | |

딸려 죽는 것: `src/data/client.ts`의 `fetchAreaSnapshots`, `src/data/schema.ts`의 `parseBulkEnvelope`, `src/data/queries.ts`의 `useAreaSnapshots`.

`api/_lib/seoul.ts`의 `cityInfoCacheTtlSeconds()`에서 `Math.max(DEFAULT_CITYINFO_TTL_SECONDS, …)` 바닥을 없애고 기본값을 `cacheTtlSeconds()`(1시간)에 맞춘다. **환경변수 손잡이(`CITYINFO_CACHE_TTL_SECONDS`)는 그대로 둔다** — Vercel 콘솔에 아직 안 넣었으므로 코드 기본값이 곧 실동작이다.

### 3. 클라이언트 — 두 훅이 한 캐시를 나눠 쓴다

`useAreaSnapshot`과 `useCityInfo`가 **같은 `queryKey`(`['cityinfo', areaName]`)**를 쓴다. 안 그러면 같은 URL을 두 번 부른다(CDN이 상류 호출은 막아 주지만 왕복이 둘이다).

`['area', areaName]` 키는 없어진다 — 그 키의 유일한 주인이던 `fetchAreaSnapshot`이 `/api/citydata`와 함께 사라지기 때문이다.

- queryFn은 **원본 payload를 그대로** 캐시에 넣는다
- 각 훅이 `select`로 자기 몫을 뽑는다

| 훅 | select | 실패 정책 |
| --- | --- | --- |
| `useAreaSnapshot` | `parseCitydataResponse` | 던진다 (지금과 같다) |
| `useCityInfo` | `parseCityInfoResponse` | 관대하다 (지금과 같다) |

**미확인 지점 하나.** `select`가 던질 때 그 훅만 에러가 되고 다른 훅을 오염시키지 않아야 한다. **구현 전에 작은 테스트로 확정할 것** — 만약 오염된다면 `select`를 쓰지 않고 훅 안에서 파싱하는 쪽으로 바꾼다.

### 4. 씨앗 심기를 되살린다

**2026-08-20부터 죽어 있다.** `findSeededSnapshot`이 `['areas', names[]]` 캐시를 뒤지는데, 목록 출처가 SeoulRtd로 가면서 그 캐시를 아무도 안 채운다 — 항상 `undefined`를 돌려주고 상세가 빈 히어로로 열린다.

이번 합치기가 상세 첫 로딩을 **느리게 만들기 때문에**(가벼운 `citydata_ppltn`이 먼저 오던 것이 없어지고 무거운 `citydata` 하나를 기다린다) 같은 회차에 되살린다.

**`initialData`로는 못 깐다.** 새 출처(`useHotspots` → `AreaCongestion`)는 등급·좌표·분류뿐이라 `AreaSnapshot`이 요구하는 인원수·관측시각·예보·메시지가 없다.

**빈 값을 0이나 빈 문자열로 채워 가짜 `AreaSnapshot`을 만들지 않는다.** 「0명」이 잠깐 뜨는 쪽이 스켈레톤보다 나쁘다 — AGENTS.md의 「없는 값을 그럴듯한 틀린 값으로 떨어뜨리지 마라」와 같은 규칙이다.

대신 **`DetailHero`가 「등급은 있고 나머지는 아직 없는」 상태를 1급 상태로 그린다.**

| 히어로의 줄 | 출처 | 언제 |
| --- | --- | --- |
| 카테고리 · 거리 · 도보 | 정적 카탈로그 | 즉시 (지금도 그렇다) |
| **점 + 「지금 약간 붐벼요」** | **hotspots 등급** | **즉시 (이번에 되살리는 것)** |
| 「38,000~40,000명」 | `citydata` | 도착하면 |
| 안내 메시지 | `citydata` | 도착하면 |
| 「14:35 기준」 | `citydata` | 도착하면 |

지금 `DetailHero`는 `snapshot === undefined`이면 블록을 통째로 안 그린다. 스켈레톤을 안 두는 이유가 주석에 있다 — 「히어로가 자리를 잡아 두면 도착할 때 아래 탭 줄이 밀리고, 탭은 sticky라 그 밀림이 눈에 크게 띈다」. **그 판단은 유지한다.** 다만 이제 등급이 즉시 오므로 사용자가 먼저 읽어야 할 것(「그래서 지금 갈 만한가」)이 왕복 없이 뜬다. 나머지 세 줄이 뒤따르며 미는 양은 **구현 중 실측으로 확인할 것** — 지금(전부 뒤늦게 오는 것)보다 나쁘면 안 된다.

## 화면에 보이는 변화

- **관측 시각 — 변화 없다.** `PPLTN_TIME`이 그대로 온다
- **도시정보가 신선해진다.** 3시간 → 1시간. 「최대 3시간 전 기준」 문구와 `src/domain/freshness.ts`의 문턱을 다시 볼 것
- **상세를 열면 등급이 즉시 뜬다** (4번). 지금은 스켈레톤이 뜨는 것이 아니라 히어로 블록이 **아예 없다가** 왕복이 끝나면 나타난다 — 그 빈 구간이 사라진다
- **인원수·예보·메시지는 지금보다 늦게 온다.** 4번이 이걸 상쇄하는 것이 이 설계의 전제다

## 쿼터 재계산

**AGENTS.md의 배분 표를 함께 고친다.** 그 파일이 「셋 중 하나라도 건드리면 나머지를 다시 계산할 것」이라고 못 박았다.

| 항목 | 지금 | 뒤 |
| --- | --- | --- |
| 목록·지도 혼잡도(121곳) | 0 (SeoulRtd) | 0 — 변화 없음 |
| 상세 혼잡도 | 24회/명소 | **0** (없어진다) |
| 도시정보 | 8회/명소 | **24회/명소** (TTL 3h→1h) |
| 명소 상세의 CCTV | 0 (SeoulRtd) | 0 — 변화 없음 |
| 인파 변화 | 0 (SeoulRtd) | 0 — 변화 없음 |
| **합계** | **32회/명소** | **24회/명소** |
| **한도(1,000) 안에 드는 명소 수** | **30곳** | **41곳** |

홈의 재난문자(`useCityAlerts`)도 TTL을 따라 8회 → 24회가 되지만, 그 명소가 위 41곳에 포함되면 같은 캐시 항목이라 추가 비용이 0이다 — 지금과 같은 구조다.

**121곳을 다 덮지는 못한다.** 그건 「안 B」의 몫이고 이 스펙의 범위 밖이다.

## 검증

**첫 태스크는 실호출 대조다. 코드를 건드리기 전에 한다.**

같은 순간에 `citydata`와 `citydata_ppltn`을 같은 명소로 불러 다음이 일치하는지 확인한다:

- `AREA_CONGEST_LVL`
- `AREA_PPLTN_MIN` / `AREA_PPLTN_MAX`
- `PPLTN_TIME`
- `FCST_PPLTN`의 칸 수와 첫 칸

2026-08-20에 SeoulRtd를 검증한 것과 같은 방법이다. **여기서 어긋나면 이 설계가 무너진다.** 명소 3곳 이상에서 잰다(표본 하나로 단정하지 않는다 — AGENTS.md의 규칙).

그다음 순서:

1. 봉투 교체 (`schema.ts`, `compositionSchema.ts`, `mock.ts`)
2. 서버 엔드포인트 둘 삭제 + TTL
3. 훅 합치기 (`select` 오염 여부 확인 포함)
4. 씨앗 심기 되살리기
5. 문구·`freshness` 문턱
6. AGENTS.md 쿼터 표

각 단계마다 `npm test`와 `npx tsc -b`를 통과시킨다.

## 되돌리기

한 커밋씩 원자적으로 쌓으므로 어느 단계에서든 `git revert`로 돌아간다. 가장 위험한 것은 2번(엔드포인트 삭제)이고, 그건 1번과 3번이 끝난 뒤에 한다 — **호출자가 없어진 뒤에 지운다.**
