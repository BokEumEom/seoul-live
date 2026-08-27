# 상세를 `citydata` 한 번으로 합치기 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상세를 열 때 나가던 서울 API 호출 두 번(`citydata_ppltn` + `citydata`)을 한 번(`citydata`)으로 합쳐, 명소당 하루 호출을 32회에서 24회로 줄이고 한도 안에 드는 명소를 30곳에서 41곳으로 늘린다.

**Architecture:** `citydata` 응답의 `CITYDATA.LIVE_PPLTN_STTS`가 `citydata_ppltn`이 주는 행과 **완전히 같다**(아래 「선행 검증」). 그래서 안쪽 스키마(`areaSchema`)는 한 줄도 안 고치고 **봉투를 꺼내는 자리만** 바꾼다. 클라이언트에서는 `useAreaSnapshot`과 `useCityInfo`가 같은 `queryKey`를 공유하고 각자 `select`로 자기 몫을 뽑는다.

**Tech Stack:** TypeScript, Zod 4, TanStack Query 5, Vitest 4, Vercel Functions

**설계 문서:** `docs/superpowers/specs/2026-08-27-detail-single-call-design.md`

---

## 선행 검증 — 이미 끝났다 (2026-08-27)

인증키로 명소 3곳에서 `citydata`와 `citydata_ppltn`을 **동시에**(`Promise.all`) 불러 대조했다. 6필드 + 예보 12칸 전부 일치했다.

| 명소 | `AREA_CONGEST_LVL` | `AREA_PPLTN_MIN/MAX` | `PPLTN_TIME` | 불일치 |
| --- | --- | --- | --- | --- |
| 광화문·덕수궁 | 약간 붐빔 = 약간 붐빔 | 44000/46000 = 동일 | `2026-08-27 14:55` = 동일 | **없음** |
| 강남역 | 약간 붐빔 = 약간 붐빔 | 86000/88000 = 동일 | `2026-08-27 14:55` = 동일 | **없음** |
| 홍대 관광특구 | 보통 = 보통 | 76000/78000 = 동일 | `2026-08-27 14:55` = 동일 | **없음** |

`REPLACE_YN`·`FCST_YN`·`FCST_PPLTN.length`(12)·`FCST_PPLTN[0]` 전부 동일. **이 계획의 전제가 확정됐다.**

---

## 파일 구조

| 파일 | 책임 | 처분 |
| --- | --- | --- |
| `src/data/populationEnvelope.ts` | **신규.** 두 봉투 중 어느 쪽이든 인구 행 배열을 꺼낸다 | 생성 |
| `src/data/populationEnvelope.test.ts` | 위의 테스트 | 생성 |
| `src/data/schema.ts` | `parseCitydataResponse` — 봉투 꺼내기를 위 모듈에 위임 | 수정 |
| `src/data/compositionSchema.ts` | `parseComposition` — 같은 위임 | 수정 |
| `src/data/mockCityInfo.ts` | 목업 `citydata` 봉투에 `LIVE_PPLTN_STTS`를 싣는다 | 수정 |
| `src/data/mock.ts` | `buildMockSnapshot` — 옛 봉투 생산자. 마지막에 제거 | 수정 → 삭제 |
| `src/data/client.ts` | `fetchAreaPayload` 하나로 합치고 `fetchAreaSnapshot`·`fetchCityInfo`·`fetchAreaSnapshots`를 걷어낸다 | 수정 |
| `src/data/queries.ts` | 두 훅이 한 `queryKey`를 공유 + 씨앗 심기 | 수정 |
| `src/components/detail/DetailHero.tsx` | 「등급만 아는」 상태를 1급으로 그린다 | 수정 |
| `src/components/detail/AreaDetailScreen.tsx` | 씨앗을 히어로에 넘긴다 | 수정 |
| `api/citydata.ts`, `api/_lib/citydata.test.ts` | `citydata_ppltn` 프록시 | **삭제** |
| `api/citydata-bulk.ts`, `api/_lib/citydata-bulk.test.ts` | 죽은 일괄 프록시 | **삭제** |
| `api/_lib/seoul.ts` | `cityInfoCacheTtlSeconds` 기본값 3시간 → 1시간 | 수정 |
| `AGENTS.md` | 쿼터 배분 표 | 수정 |

**`populationEnvelope.ts`를 따로 두는 이유:** `schema.ts`가 `compositionSchema.ts`를 import하므로(`parseComposition`), 봉투 함수를 `schema.ts`에 두고 `compositionSchema.ts`가 가져가면 **순환 import**가 된다. 제3의 작은 모듈이 그 고리를 끊는다.

---

## Task 1: 목업 `citydata` 봉투에 인구 블록을 싣는다

합쳐진 뒤에는 **한 payload가 두 파서를 다 먹여야 한다.** 지금 `buildMockCityInfo`에는 `LIVE_PPLTN_STTS`가 없다.

**Files:**
- Modify: `src/data/mockCityInfo.ts`
- Test: `src/data/mockCityInfo.test.ts` (없으면 생성)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/data/mockCityInfo.test.ts`에 추가한다 (파일이 없으면 아래 전체로 만든다):

```ts
import { describe, expect, it } from 'vitest'
import { buildMockCityInfo } from './mockCityInfo'

describe('buildMockCityInfo', () => {
  it('citydata 봉투에 LIVE_PPLTN_STTS를 함께 싣는다', () => {
    // 합쳐진 뒤에는 이 payload 하나가 혼잡도 파서와 도시정보 파서를 다 먹인다.
    const payload = buildMockCityInfo('광화문·덕수궁') as {
      CITYDATA: { LIVE_PPLTN_STTS?: readonly Record<string, unknown>[] }
    }
    const rows = payload.CITYDATA.LIVE_PPLTN_STTS
    expect(rows).toHaveLength(1)
    expect(rows?.[0].AREA_NM).toBe('광화문·덕수궁')
    expect(rows?.[0].PPLTN_TIME).toEqual(expect.any(String))
    expect(rows?.[0].FCST_PPLTN).toEqual(expect.any(Array))
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/data/mockCityInfo.test.ts`
Expected: FAIL — `expected undefined to have a length of 1`

- [ ] **Step 3: 구현한다**

`src/data/mockCityInfo.ts` 맨 위 import에 더한다:

```ts
import { buildMockSnapshot } from './mock'
```

`buildMockCityInfo`의 `CITYDATA` 객체 안, `AREA_CD` 줄 바로 아래에 넣는다:

```ts
      // **혼잡도 파서와 도시정보 파서가 이 payload 하나를 나눠 먹는다.**
      // 실제 `citydata` 응답도 인구 블록을 여기 담아 준다 — 2026-08-27에
      // 명소 3곳에서 `citydata_ppltn`과 대조해 6필드와 예보 12칸이 전부
      // 일치하는 것을 확인했다(스펙 참고).
      LIVE_PPLTN_STTS: (
        buildMockSnapshot(areaName, now) as {
          'SeoulRtd.citydata_ppltn': readonly unknown[]
        }
      )['SeoulRtd.citydata_ppltn'],
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/data/mockCityInfo.test.ts`
Expected: PASS

- [ ] **Step 5: 전체 스위트가 안 깨졌는지 본다**

Run: `npm test`
Expected: 전부 통과 (필드를 더하기만 했으므로 아무것도 안 깨진다)

- [ ] **Step 6: 커밋**

```bash
git add src/data/mockCityInfo.ts src/data/mockCityInfo.test.ts
git commit -m "test: 목업 citydata 봉투에 인구 블록을 싣는다 — 합치기 준비"
```

---

## Task 2: 봉투 꺼내기를 한 모듈로 뽑는다

**Files:**
- Create: `src/data/populationEnvelope.ts`
- Create: `src/data/populationEnvelope.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/data/populationEnvelope.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { populationRows } from './populationEnvelope'

describe('populationRows', () => {
  it('citydata 봉투에서 꺼낸다', () => {
    const rows = [{ AREA_NM: '강남역' }]
    expect(populationRows({ CITYDATA: { LIVE_PPLTN_STTS: rows } })).toBe(rows)
  })

  it('citydata_ppltn 봉투에서도 꺼낸다', () => {
    // 마이그레이션 중에만 필요하다. Task 6에서 이 갈래와 이 테스트를 함께 지운다.
    const rows = [{ AREA_NM: '강남역' }]
    expect(populationRows({ 'SeoulRtd.citydata_ppltn': rows })).toBe(rows)
  })

  it('봉투가 아니면 undefined다', () => {
    // **던지지 않는다.** 판별은 호출자의 zod가 한다 — 여기서 던지면
    // parseComposition의 "절대 예외를 던지지 않는다"는 약속이 깨진다.
    expect(populationRows(null)).toBeUndefined()
    expect(populationRows('문자열')).toBeUndefined()
    expect(populationRows({})).toBeUndefined()
    expect(populationRows({ CITYDATA: null })).toBeUndefined()
    expect(populationRows({ CITYDATA: {} })).toBeUndefined()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/data/populationEnvelope.test.ts`
Expected: FAIL — `Failed to resolve import "./populationEnvelope"`

- [ ] **Step 3: 구현한다**

`src/data/populationEnvelope.ts`:

```ts
/**
 * 인구 행 배열을 봉투에서 꺼낸다.
 *
 * **두 서비스가 같은 행을 서로 다른 봉투에 담아 준다.**
 *
 *   citydata_ppltn →  { 'SeoulRtd.citydata_ppltn': [row] }
 *   citydata       →  { CITYDATA: { LIVE_PPLTN_STTS: [row] } }
 *
 * 2026-08-27에 명소 3곳에서 같은 순간을 재어 `AREA_CONGEST_LVL`·
 * `AREA_PPLTN_MIN/MAX`·`PPLTN_TIME`·`REPLACE_YN`·`FCST_YN`과 예보 12칸이
 * **전부 일치**하는 것을 확인했다. 그래서 안쪽 스키마를 공유한다.
 *
 * **옛 봉투(`SeoulRtd.citydata_ppltn`) 갈래는 임시다.** 마이그레이션 도중
 * 커밋마다 스위트를 초록으로 두려고 남겨 둔 것이고, 마지막 태스크에서 지운다.
 *
 * **던지지 않는다.** 모양이 아니면 `undefined`다 — 판별과 에러 문구는
 * 호출자의 zod가 맡는다. `parseComposition`이 「절대 예외를 던지지 않는다」는
 * 약속을 지키려면 이 함수도 조용해야 한다.
 *
 * `src/data/schema.ts`가 아니라 별도 모듈인 이유: `schema.ts`가
 * `compositionSchema.ts`를 import하므로, 여기 두고 저쪽이 가져가면 순환이 된다.
 */
export function populationRows(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null) {
    return undefined
  }
  const record = payload as Record<string, unknown>

  const container = record.CITYDATA
  if (typeof container === 'object' && container !== null) {
    return (container as Record<string, unknown>).LIVE_PPLTN_STTS
  }

  return record['SeoulRtd.citydata_ppltn']
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/data/populationEnvelope.test.ts`
Expected: PASS (3개)

- [ ] **Step 5: 커밋**

```bash
git add src/data/populationEnvelope.ts src/data/populationEnvelope.test.ts
git commit -m "feat: 인구 행을 두 봉투 어느 쪽에서든 꺼내는 모듈"
```

---

## Task 3: 두 파서가 새 봉투를 읽는다

**Files:**
- Modify: `src/data/schema.ts`
- Modify: `src/data/compositionSchema.ts`
- Test: `src/data/schema.test.ts`, `src/data/compositionSchema.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/data/schema.test.ts` 맨 아래에 추가한다:

```ts
describe('citydata 봉투', () => {
  it('CITYDATA.LIVE_PPLTN_STTS에서도 같은 스냅샷을 만든다', () => {
    // 2026-08-27 실호출 대조: 두 서비스의 행이 완전히 같다(스펙 참고).
    const rows = VALID['SeoulRtd.citydata_ppltn']
    const fromLegacy = parseCitydataResponse({ 'SeoulRtd.citydata_ppltn': rows }, NAME)
    const fromCitydata = parseCitydataResponse({ CITYDATA: { LIVE_PPLTN_STTS: rows } }, NAME)
    expect(fromCitydata).toEqual(fromLegacy)
  })
})
```

`src/data/compositionSchema.test.ts` 맨 아래에 추가한다:

```ts
describe('citydata 봉투', () => {
  it('CITYDATA.LIVE_PPLTN_STTS에서도 같은 구성을 읽는다', () => {
    const row = { AREA_NM: '강남역', MALE_PPLTN_RATE: '50.5', FEMALE_PPLTN_RATE: '49.5' }
    expect(parseComposition({ CITYDATA: { LIVE_PPLTN_STTS: [row] } }, '강남역')).toEqual(
      parseComposition({ 'SeoulRtd.citydata_ppltn': [row] }, '강남역'),
    )
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/data/schema.test.ts src/data/compositionSchema.test.ts`
Expected: FAIL — 새 봉투 쪽이 ZodError를 던지거나 `null`을 돌려준다

- [ ] **Step 3: `schema.ts`를 고친다**

import에 더한다:

```ts
import { populationRows } from './populationEnvelope'
```

`responseSchema` 정의를 지우고 그 자리에 넣는다:

```ts
// **봉투가 아니라 행 배열을 검증한다.** 어느 서비스에서 왔는지는
// `populationEnvelope.ts`가 흡수하므로 여기는 알맹이만 본다.
const rowsSchema = z.array(areaSchema).min(1)
```

`parseCitydataResponse` 안의 두 줄을 바꾼다:

```ts
  const result = rowsSchema.safeParse(populationRows(payload))
```

```ts
  const areas = result.data
```

(`const areas = result.data['SeoulRtd.citydata_ppltn']` 를 위 줄로 대체한다. `seoulApiErrorFrom(payload)` 분기는 **원본 `payload`를 그대로 받으므로 안 건드린다** — 에러 봉투는 `RESULT`에 있지 인구 행에 없다.)

- [ ] **Step 4: `compositionSchema.ts`를 고친다**

import에 더한다:

```ts
import { populationRows } from './populationEnvelope'
```

`looseListSchema` 정의를 바꾼다:

```ts
/** 원본 명소 객체만 꺼낸다. areaSchema와 달리 키를 버리지 않는다. */
const looseRowsSchema = z.array(z.unknown())
```

`parseComposition` 안의 세 줄을 바꾼다:

```ts
  const parsed = looseRowsSchema.safeParse(populationRows(payload))
  if (!parsed.success) {
    return null
  }

  const area = parsed.data.find(
    (item) => isRecord(item) && item.AREA_NM === expectedName,
  )
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npm test`
Expected: 전부 통과. 옛 봉투를 쓰는 기존 테스트도 그대로 지나간다(`populationRows`가 둘 다 읽는다)

- [ ] **Step 6: 타입 검사**

Run: `npx tsc -b`
Expected: 종료 코드 0

- [ ] **Step 7: 커밋**

```bash
git add src/data/schema.ts src/data/compositionSchema.ts src/data/schema.test.ts src/data/compositionSchema.test.ts
git commit -m "feat: 인구 파서 둘이 citydata 봉투도 읽는다"
```

---

## Task 4: 클라이언트가 `/api/cityinfo` 하나만 부른다

**Files:**
- Modify: `src/data/client.ts`
- Test: `src/data/client.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/data/client.test.ts` 맨 아래에 추가한다:

이 파일의 관례를 그대로 따른다 — `fetch`를 `Response`가 아니라 `{ ok, headers, json }` 평범한 객체로 스텁한다.

```ts
describe('fetchAreaPayload', () => {
  it('/api/cityinfo 하나만 부르고 나이를 함께 준다', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubEnv('VITE_API_BASE_URL', 'https://proxy.example.com')
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ Age: '42' }),
      json: async () => ({ CITYDATA: { AREA_NM: '강남역' } }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const result = await fetchAreaPayload('강남역')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/cityinfo?area=')
    // **`citydata_ppltn` 프록시는 더 이상 안 부른다.**
    expect(String(fetchSpy.mock.calls[0][0])).not.toContain('/api/citydata?')
    expect(result.freshness?.ageSeconds).toBe(42)
  })
})
```

**이 파일의 맨 위 import를 함께 고친다.** 지금은 `import { fetchAreaSnapshot, fetchAreaSnapshots, fetchCityInfo } from './client'`인데 셋 다 사라진다 — `fetchAreaPayload` 하나로 바꾸고, 그 셋을 쓰던 기존 `describe` 블록들도 이 태스크에서 함께 옮긴다. `PAYLOAD` 상수도 `citydata` 봉투(`{ CITYDATA: { LIVE_PPLTN_STTS: [...] } }`)로 바꾼다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/data/client.test.ts -t fetchAreaPayload`
Expected: FAIL — `fetchAreaPayload is not a function`

- [ ] **Step 3: `fetchAreaSnapshot`과 `fetchCityInfo`를 하나로 합친다**

`src/data/client.ts`에서 `fetchAreaSnapshot`과 `fetchCityInfo` 두 함수를 **통째로 지우고** 그 자리에 넣는다:

```ts
/** 상세 한 곳의 원본 `citydata` 응답과 그 나이. */
export interface AreaPayload {
  readonly body: unknown
  readonly freshness: Freshness | null
}

/**
 * 상세 한 곳의 **모든 것**. 혼잡도와 도시정보가 한 응답에서 나온다.
 *
 * **예전에는 둘을 따로 불렀다**(`/api/citydata` + `/api/cityinfo`). 그런데
 * `citydata` 응답의 `CITYDATA.LIVE_PPLTN_STTS`가 `citydata_ppltn`이 주는 행을
 * 통째로 포함한다 — 2026-08-27에 명소 3곳에서 같은 순간을 재어 6필드와 예보
 * 12칸이 전부 일치하는 것을 확인했다. **앞의 24회/일/명소는 낭비였다.**
 *
 * 파싱은 여기서 안 한다. 두 훅(`useAreaSnapshot`·`useCityInfo`)이 같은 캐시
 * 항목을 나눠 쓰면서 각자 `select`로 뽑기 때문이다 — 여기서 미리 파싱하면
 * 캐시에 파생값이 앉아 한쪽 파서의 실패가 다른 쪽까지 끌고 내려간다.
 *
 * **`receivedAt`을 여기서 찍는다.** `select`는 렌더마다 다시 도는 자리라
 * 거기서 `Date.now()`를 부르면 「받은 시각」이 계속 지금으로 갱신된다.
 */
export async function fetchAreaPayload(areaName: string): Promise<AreaPayload> {
  if (isMockMode()) {
    if (mockFailureAreaNames().has(areaName)) {
      throw new Error(
        `[목업] ${areaName} 조회 실패를 시뮬레이션합니다. (VITE_MOCK_FAIL_AREAS)`,
      )
    }
    // 방금 만든 값이다. 목업에는 CDN도 서울 API도 없으므로 나이가 0이고,
    // 그건 「모른다」가 아니라 실제로 아는 사실이다.
    return {
      body: buildMockCityInfo(areaName),
      freshness: { ageSeconds: 0, receivedAt: Date.now() },
    }
  }

  const url = `${baseUrl()}/api/cityinfo?area=${encodeURIComponent(areaName)}`
  const { body, ageSeconds } = await requestJson(url, SINGLE_AREA_TIMEOUT_MS, '도시 정보')
  return {
    body,
    freshness: ageSeconds === null ? null : { ageSeconds, receivedAt: Date.now() },
  }
}
```

`Freshness` 타입 import가 없으면 더한다 (`src/domain/`에서 온다 — `fetchCityInfo`가 쓰던 경로를 그대로 쓴다). `buildMockSnapshot`·`parseCitydataResponse`·`parseCityInfoResponse` import가 이제 안 쓰이면 지운다 — `npx tsc -b`가 잡아 준다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/data/client.test.ts -t fetchAreaPayload`
Expected: PASS

- [ ] **Step 5: 커밋 (아직 스위트는 빨갈 수 있다 — Task 5와 짝이다)**

이 태스크만으로는 `queries.ts`가 없어진 함수를 부르므로 `npx tsc -b`가 실패한다. **Task 5까지 마친 뒤에 함께 커밋한다.** 여기서는 커밋하지 않는다.

---

## Task 5: 두 훅이 한 캐시를 나눠 쓴다

**Files:**
- Modify: `src/data/queries.ts`
- Test: `src/data/queries.test.ts`

- [ ] **Step 1: `select` 오염 여부를 먼저 확정한다**

**이것이 이 계획의 유일한 미확인 지점이다.** `select`가 던질 때 그 훅만 에러가 되는지, 아니면 같은 캐시를 보는 다른 훅까지 오염되는지 실측한다.

`src/data/queries.test.ts`에 추가한다:

```ts
it('한 select가 던져도 다른 select는 멀쩡하다', async () => {
  // TanStack Query 5의 select는 옵저버별로 돈다 — 그 전제가 이 설계의
  // 바닥이다. 여기가 깨지면 select를 버리고 훅 안에서 파싱해야 한다.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const payload = { ok: 1 }

  const bad = renderHook(
    () => useQuery({ queryKey: ['shared'], queryFn: async () => payload,
      select: () => { throw new Error('던진다') } }),
    { wrapper },
  )
  const good = renderHook(
    () => useQuery({ queryKey: ['shared'], queryFn: async () => payload,
      select: (p: typeof payload) => p.ok }),
    { wrapper },
  )

  await waitFor(() => expect(good.result.current.data).toBe(1))
  expect(bad.result.current.isError).toBe(true)
  expect(good.result.current.isError).toBe(false)
})
```

Run: `npx vitest run src/data/queries.test.ts -t "다른 select는 멀쩡"`

**결과에 따라 갈린다:**
- **PASS** → Step 2로 간다 (설계대로)
- **FAIL** → **멈추고 사람에게 보고한다.** `select`를 쓰지 않고 각 훅의 `queryFn`을 공유 캐시에서 읽어 훅 몸통에서 `useMemo`로 파싱하는 쪽으로 설계를 바꿔야 한다. 임의로 진행하지 말 것

- [ ] **Step 2: 공유 옵션을 만든다**

`src/data/queries.ts`에서 `useAreaSnapshot`과 `useCityInfo`를 **둘 다 지우고** 그 자리에 넣는다:

```ts
/**
 * 상세 한 곳의 원본 응답. **두 훅이 이 항목 하나를 나눠 쓴다.**
 *
 * 키를 공유하지 않으면 같은 URL을 두 번 부른다 — CDN이 상류 호출은 막아
 * 주지만 왕복이 둘이고, 그만큼 상세가 늦게 뜬다.
 */
function areaPayloadOptions(areaName: string | undefined) {
  return {
    queryKey: ['areaPayload', areaName] as const,
    // enabled에만 기대지 않고 가드를 둔다 — enabled는 런타임 보장이지
    // TypeScript가 아는 사실이 아니다.
    queryFn: () => {
      if (!areaName) {
        return Promise.reject(new Error('areaName이 없어 조회할 수 없습니다.'))
      }
      return fetchAreaPayload(areaName)
    },
    enabled: Boolean(areaName),
    staleTime: THIRTY_MINUTES,
    retry: shouldRetry,
  }
}

/**
 * 명소 상세의 혼잡도. **던진다** — 이 값이 없으면 상세의 본체가 없다.
 */
export function useAreaSnapshot(
  areaName: string | undefined,
): UseQueryResult<AreaSnapshot> {
  return useQuery({
    ...areaPayloadOptions(areaName),
    // areaName이 없으면 queryFn이 먼저 거절하므로 여기까지 안 온다.
    select: (payload) => parseCitydataResponse(payload.body, areaName ?? ''),
  })
}

/**
 * 명소 상세의 도시정보. **관대하다** — 절이 하나 비는 것과 화면이 통째로
 * 깨지는 것은 다르다.
 */
export function useCityInfo(areaName: string | undefined): UseQueryResult<CityInfo> {
  return useQuery({
    ...areaPayloadOptions(areaName),
    select: (payload) => ({
      ...parseCityInfoResponse(payload.body, areaName ?? ''),
      freshness: payload.freshness,
    }),
  })
}
```

import를 고친다: `fetchAreaSnapshot`·`fetchCityInfo` → `fetchAreaPayload`, 그리고 `parseCitydataResponse`(`./schema`)·`parseCityInfoResponse`(`./cityInfoSchema`)를 더한다.

- [ ] **Step 3: 스위트와 타입을 돌린다**

Run: `npm test`
Expected: 전부 통과

Run: `npx tsc -b`
Expected: 종료 코드 0

- [ ] **Step 4: 커밋 (Task 4와 함께)**

```bash
git add src/data/client.ts src/data/client.test.ts src/data/queries.ts src/data/queries.test.ts
git commit -m "refactor: 상세가 citydata 한 번만 부른다 — 두 훅이 한 캐시를 나눠 쓴다"
```

---

## Task 6: 서버 — 프록시 둘을 지우고 TTL을 1시간으로

**호출자가 없어진 뒤에 지운다.** Task 5까지 끝났으므로 이제 안전하다.

**Files:**
- Delete: `api/citydata.ts`, `api/_lib/citydata.test.ts`
- Delete: `api/citydata-bulk.ts`, `api/_lib/citydata-bulk.test.ts`
- Modify: `api/_lib/seoul.ts`
- Test: `api/_lib/seoul.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`api/_lib/seoul.test.ts`에 추가한다:

```ts
it('도시정보 TTL 기본값이 혼잡도와 같다', () => {
  // **상세가 citydata 한 번으로 합쳐지면서 둘이 한 값이 됐다.**
  // 예전에 3시간이던 것은 혼잡도(24회)와 도시정보(8회)가 같은 한도를
  // 나눠 쓰던 시절의 배분이다. 이제 호출이 하나뿐이라 나눌 것이 없다.
  delete process.env.CITYINFO_CACHE_TTL_SECONDS
  delete process.env.CACHE_TTL_SECONDS
  expect(cityInfoCacheTtlSeconds()).toBe(cacheTtlSeconds())
  expect(cityInfoCacheTtlSeconds()).toBe(3_600)
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run api/_lib/seoul.test.ts -t "도시정보 TTL"`
Expected: FAIL — `expected 10800 to be 3600`

- [ ] **Step 3: `api/_lib/seoul.ts`를 고친다**

`DEFAULT_CITYINFO_TTL_SECONDS` 상수와 그 위의 긴 주석을 지우고, `cityInfoCacheTtlSeconds`를 이렇게 바꾼다:

```ts
/**
 * 도시정보(`citydata`)용 TTL.
 *
 * **2026-08-27부터 혼잡도와 같은 값이다.** 예전에는 3시간이었는데, 그건
 * 혼잡도(`citydata_ppltn`, 24회/일/명소)와 도시정보(8회/일/명소)가 같은
 * 하루 1,000회를 나눠 쓰던 시절의 배분이다. 상세가 `citydata` 한 번으로
 * 합쳐지면서 **나눌 것이 없어졌다** — 이 호출 하나가 혼잡도까지 준다.
 *
 * 손잡이는 남겨 둔다. 활용갤러리 등록으로 한도가 풀리면 더 짧게 잡을 수 있다.
 */
export function cityInfoCacheTtlSeconds(): number {
  const raw = Number(process.env.CITYINFO_CACHE_TTL_SECONDS)
  // 정수만 받는 이유는 cacheTtlSeconds와 같다(RFC 9111 §1.2.2).
  if (Number.isInteger(raw) && raw > 0) {
    return raw
  }
  return cacheTtlSeconds()
}
```

- [ ] **Step 4: 프록시 넷을 지운다**

```bash
git rm api/citydata.ts api/_lib/citydata.test.ts api/citydata-bulk.ts api/_lib/citydata-bulk.test.ts
```

`api/_lib/seoul.ts`의 `SeoulService` 타입에서 `'citydata_ppltn'`을 지우고 `fetchArea`의 기본값을 `'citydata'`로 바꾼다:

```ts
// 이제 한 서비스만 쓴다. `citydata`가 인구·주차장·따릉이·날씨·문화행사·
// 재난문자를 한 번에 준다 — `citydata_ppltn`은 그중 인구만 주던 좁은 문이라
// 2026-08-27에 걷어냈다(같은 행을 두 번 받고 있었다).
export type SeoulService = 'citydata'
```

```ts
export async function fetchArea(
  areaName: string,
  service: SeoulService = 'citydata',
): Promise<unknown> {
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npm test`
Expected: 전부 통과 (테스트 파일 둘이 줄어든 만큼 파일 수가 준다)

Run: `npx tsc -b`
Expected: 종료 코드 0

- [ ] **Step 6: 커밋**

```bash
git add -A api/
git commit -m "refactor: citydata_ppltn 프록시를 걷어내고 도시정보 TTL을 1시간으로"
```

---

## Task 7: 옛 봉투 갈래와 죽은 코드를 지운다

**임시로 남겨 둔 것을 여기서 치운다.** 이 태스크를 건너뛰면 Task 2가 만든 죽은 갈래가 영구히 남는다.

**Files:**
- Modify: `src/data/populationEnvelope.ts`, `src/data/populationEnvelope.test.ts`
- Modify: `src/data/mock.ts`
- Modify: `src/data/client.ts`, `src/data/schema.ts`, `src/data/queries.ts`
- Test: 위 각각의 테스트 파일

- [ ] **Step 1: 옛 봉투 갈래를 지운다**

`src/data/populationEnvelope.ts`의 마지막 `return`을 바꾸고 주석에서 「옛 봉투 … 임시다」 문단을 지운다:

```ts
  return undefined
```

`src/data/populationEnvelope.test.ts`에서 `citydata_ppltn 봉투에서도 꺼낸다` 테스트를 지우고, 대신 「이제 안 읽는다」를 잠근다:

```ts
  it('옛 citydata_ppltn 봉투는 더 이상 안 읽는다', () => {
    // 2026-08-27에 그 프록시를 걷어냈다. 되살리려는 커밋을 여기서 막는다.
    expect(populationRows({ 'SeoulRtd.citydata_ppltn': [{ AREA_NM: '강남역' }] })).toBeUndefined()
  })
```

- [ ] **Step 2: 목업을 새 봉투로 옮긴다**

`src/data/mock.ts`의 `buildMockSnapshot` 반환에서 봉투를 벗기고 **행 배열만** 돌려준다. 이름도 뜻에 맞춘다:

```ts
/** 목업 인구 행 한 벌. `buildMockCityInfo`가 `LIVE_PPLTN_STTS`에 싣는다. */
export function buildMockPopulationRows(
  areaName: string,
  now: Date = new Date(),
): readonly unknown[] {
```

기존 `return { 'SeoulRtd.citydata_ppltn': [ { … } ] }`를 `return [ { … } ]`로 바꾼다 (안쪽 객체는 그대로).

`src/data/mockCityInfo.ts`의 Task 1에서 넣은 자리를 단순하게 바꾼다:

```ts
      LIVE_PPLTN_STTS: buildMockPopulationRows(areaName, now),
```

import도 `buildMockSnapshot` → `buildMockPopulationRows`로 바꾼다.

- [ ] **Step 3: 죽은 일괄 조회 경로를 지운다**

| 지울 것 | 파일 |
| --- | --- |
| `fetchAreaSnapshots` | `src/data/client.ts` |
| `parseBulkEnvelope`, `bulkEnvelopeSchema` | `src/data/schema.ts` |
| `useAreaSnapshots` | `src/data/queries.ts` |
| 위 셋의 테스트 | 각 `.test.ts` |
| `BULK_TIMEOUT_MS` 상수와 그 긴 주석 | `src/data/client.ts` |

**이유:** `useAreaSnapshots`는 어느 화면에서도 안 불린다(2026-08-27 확인 — `HomeScreen.tsx:129`에 「예전의 `useAreaSnapshots`는…」 주석만 남아 있다). Task 6에서 프록시를 지웠으므로 이제 부르면 404다.

`src/screens/HomeScreen.tsx:129`의 주석은 **남긴다** — 왜 121곳을 한 번에 받는지를 설명하는 역사이고, 그 함수가 사라졌다고 이유까지 사라지지 않는다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npm test`
Expected: 전부 통과

Run: `npx tsc -b`
Expected: 종료 코드 0. 안 쓰는 import가 남았으면 여기서 잡힌다

Run: `npm run lint`
Expected: 통과

- [ ] **Step 5: 커밋**

```bash
git add -A src/
git commit -m "refactor: 옛 citydata_ppltn 봉투와 죽은 일괄 조회 경로를 지운다"
```

---

## Task 8: 씨앗 심기를 등급으로 되살린다

**2026-08-20부터 죽어 있다.** `findSeededSnapshot`이 `['areas', names[]]` 캐시를 뒤지는데 목록 출처가 SeoulRtd로 가면서 아무도 그 캐시를 안 채운다 — 항상 `undefined`를 돌려주고, 상세를 열면 히어로 블록이 **아예 없다가** 왕복이 끝나야 나타난다.

**`initialData`로는 못 깐다.** 새 출처(`useAreaCongestion` → `AreaCongestion`)는 `{ name, congestion }`뿐이라 `AreaSnapshot`이 요구하는 인원수·관측시각·예보·메시지가 없다. **빈 값을 0으로 채운 가짜를 만들지 않는다** — 「0명」이 잠깐 뜨는 쪽이 빈 화면보다 나쁘다.

대신 `DetailHero`가 「등급은 아는데 나머지는 아직」을 1급 상태로 그린다.

**Files:**
- Modify: `src/data/queries.ts`
- Modify: `src/components/detail/AreaDetailScreen.tsx`
- Modify: `src/components/detail/DetailHero.tsx`
- Test: `src/data/queries.test.ts`, `src/components/detail/AreaDetailScreen.test.tsx`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/data/queries.test.ts`에 추가한다:

```ts
describe('useSeededCongestion', () => {
  it('목록 캐시에 있는 등급을 돌려준다', () => {
    const client = new QueryClient()
    // `useAreaCongestion`이 실제로 쓰는 키다 (2026-08-27 확인, queries.ts:218).
    client.setQueryData(['area-congestion'], [
      { name: '강남역', congestion: '붐빔' },
      { name: '광화문·덕수궁', congestion: '보통' },
    ])
    expect(seededCongestion(client, '광화문·덕수궁')).toBe('보통')
  })

  it('목록에 없거나 등급이 null이면 undefined다', () => {
    const client = new QueryClient()
    client.setQueryData(['area-congestion'], [{ name: '강남역', congestion: null }])
    expect(seededCongestion(client, '강남역')).toBeUndefined()
    expect(seededCongestion(client, '없는 곳')).toBeUndefined()
  })
})
```

**이 키가 이 태스크의 급소다.** 2026-08-20에 씨앗 심기가 조용히 죽은 원인이 바로 「뒤지는 캐시 키와 채우는 캐시 키가 갈렸다」였다. 위 테스트가 그 키를 잠근다 — `useAreaCongestion`의 키를 바꾸는 사람은 여기서 걸린다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/data/queries.test.ts -t useSeededCongestion`
Expected: FAIL — `seededCongestion is not a function`

- [ ] **Step 3: `findSeededSnapshot`을 `seededCongestion`으로 갈아끼운다**

`src/data/queries.ts`에서 `findSeededSnapshot`을 **통째로 지우고**(`SeededSnapshot` 타입도 함께) 넣는다:

```ts
/**
 * 목록이 이미 받아 둔 이 명소의 등급. 없으면 `undefined`.
 *
 * **상세가 빈 히어로로 열리는 것을 막는 유일한 수단이다.** 목록·지도는
 * 인증키 없는 상류에서 121곳 등급을 한 번에 받아 두는데(`useAreaCongestion`),
 * 상세는 그걸 놔두고 왕복을 기다렸다.
 *
 * **`AreaSnapshot`을 만들지 않는다.** 여기 있는 것은 등급뿐이고 인원수·
 * 관측시각·예보가 없다. 빈 값을 0이나 빈 문자열로 채워 가짜를 만들면 「0명」이
 * 잠깐 뜬다 — 없는 값을 그럴듯한 틀린 값으로 떨어뜨리지 않는다는 규칙 그대로다.
 *
 * > 2026-08-20~27 사이에는 이 자리가 `findSeededSnapshot`이었고 **항상
 * > `undefined`를 돌려주고 있었다.** 목록 출처가 SeoulRtd로 옮겨가면서
 * > 뒤지던 `['areas', …]` 캐시를 아무도 안 채웠기 때문이다. 코드가 안 깨지고
 * > 조용히 죽는 종류였다 — 그래서 위 테스트가 캐시 키를 잠근다.
 */
export function seededCongestion(
  client: QueryClient,
  areaName: string,
): CongestionLevel | undefined {
  const rows = client.getQueryData<readonly AreaCongestion[]>(['area-congestion'])
  return rows?.find((row) => row.name === areaName)?.congestion ?? undefined
}
```

`useAreaSnapshot`에서 `initialData`·`initialDataUpdatedAt`·`findSeededSnapshot` 호출을 지운다 (Task 5에서 이미 지워졌으면 확인만 한다).

`CongestionLevel`·`AreaCongestion`·`QueryClient` import를 더한다.

- [ ] **Step 4: 히어로가 씨앗을 받게 한다**

`src/components/detail/DetailHero.tsx`의 `Props`에 더한다:

```ts
  /**
   * 목록이 받아 둔 등급. `snapshot`이 오기 전 이 한 줄만 먼저 그린다.
   * 둘 다 없으면 히어로 블록 자체가 없다.
   */
  readonly seededCongestion: CongestionLevel | undefined
```

`tone` 계산을 바꾼다:

```ts
  // **snapshot이 먼저냐 씨앗이 먼저냐가 아니라, 있는 쪽을 쓴다.** snapshot이
  // 도착하면 그쪽이 권위다 — 씨앗은 5분 갱신이고 snapshot은 관측 시각을 달고 온다.
  const congestion = snapshot?.congestion ?? seededCongestion
  const tone = congestion === undefined ? null : congestionTone(congestion)
```

블록의 조건을 바꾼다 — `snapshot !== undefined && tone !== null` → `tone !== null && congestion !== undefined`.

블록 안에서 `congestionSentence(snapshot.congestion)` → `congestionSentence(congestion)`.

**인원수 줄·메시지·「N시 기준」 세 줄은 `snapshot !== undefined`로 각각 감싼다.** 씨앗만 있을 때는 큰 글씨 한 줄만 뜨고 나머지는 도착하면 채워진다.

- [ ] **Step 5: 상세 화면이 씨앗을 넘기게 한다**

`src/components/detail/AreaDetailScreen.tsx`에서 `useAreaSnapshot` 호출 아래에 더한다:

```ts
  const client = useQueryClient()
  const seeded = entry === undefined ? undefined : seededCongestion(client, areaName)
```

`<DetailHero … />`에 `seededCongestion={seeded}`를 넘긴다. `useQueryClient`·`seededCongestion` import를 더한다.

- [ ] **Step 6: 통과를 확인한다**

Run: `npm test`
Expected: 전부 통과. `DetailHero`를 쓰는 기존 테스트가 새 prop을 안 넘겨 타입 오류가 나면 `seededCongestion={undefined}`를 더한다

Run: `npx tsc -b`
Expected: 종료 코드 0

- [ ] **Step 7: 실측으로 확인한다**

개발 서버를 띄우고 명소를 열어 **큰 글씨가 왕복 없이 뜨는지**, 그리고 뒤이어 세 줄이 채워질 때 **아래 탭 줄이 얼마나 밀리는지** 본다.

Run: `npm run dev`

**받아들일 기준:** 지금(전부 뒤늦게 오는 것)보다 나빠지면 안 된다. 밀림이 거슬리면 인원수 줄의 높이를 미리 잡는 것을 검토한다 — 다만 `DetailHero`의 기존 주석이 「자리를 미리 잡으면 sticky 탭이 밀려 눈에 띈다」고 적어 둔 것과 상충하므로, **고치기 전에 사람에게 보고한다.**

- [ ] **Step 8: 커밋**

```bash
git add -A src/
git commit -m "fix: 씨앗 심기를 등급으로 되살린다 — 2026-08-20부터 조용히 죽어 있었다"
```

---

## Task 9: 문구와 문서를 실제와 맞춘다

**Files:**
- Modify: `src/domain/freshness.ts` (문턱을 확인만 하고, 바꿀 근거가 있을 때만 고친다)
- Modify: `AGENTS.md`
- Modify: `STATE.md`

- [ ] **Step 1: 3시간을 전제한 문구를 찾는다**

Run:

```bash
grep -rn "3시간\|10800\|최대 3시간" src/ AGENTS.md docs/DESIGN.md
```

찾은 자리마다 판단한다 — TTL이 1시간이 됐으므로 「최대 3시간 전 기준」은 이제 **거짓**이다. `src/domain/freshness.ts`의 문턱이 3시간을 가정하고 있으면 1시간에 맞춰 고치고, 테스트도 함께 고친다.

- [ ] **Step 2: `AGENTS.md`의 쿼터 배분 표를 고친다**

「현재 배분은 이렇다」 표를 이걸로 바꾼다:

| 항목 | 주기 | 하루 호출 |
| --- | --- | --- |
| 목록·지도 혼잡도(121곳) | 5분 | **0** (SeoulRtd — 인증키가 없다) |
| **상세 전체**(혼잡도 + 도시정보) | 1시간 | 24 × **사용자가 연 명소 수** |
| 홈의 재난문자(1곳) | 1시간 | 24 (아무도 그 명소를 안 연 날에만) |
| 명소 상세의 CCTV | 1시간 | **0** (상류가 다르다) |
| 명소 상세의 인파 변화 | 30분 | **0** (상류가 다르다) |

그리고 「남은 위험은 상세 쪽이다」 문단의 숫자를 고친다 — 30곳 → **41곳**, 「(24+8)×30 = 960」 → 「24×41 = 984」, 「121곳이 다 열리면 3,872회」 → 「121곳이 다 열리면 2,904회」.

**「상세도 SeoulRtd로 옮기는 것이 길이다」고 적힌 문장을 고친다.** 이제 길은 다르다 — TTL을 3시간으로 올리고 등급만 SeoulRtd로 덮어쓰면 8회/명소로 121곳이 다 들어온다(설계 문서의 「안 B」). 그 대신 한 화면에서 값마다 기준 시각이 갈리는 문제를 풀어야 한다는 것도 함께 적는다.

- [ ] **Step 3: `STATE.md`에 회차를 적는다**

「다음에 할 일」 앞에 절을 하나 더한다. **무엇을 왜 했는지와, 실호출 대조 결과(3곳 전부 일치)를 숫자로 남긴다.** 씨앗 심기가 되살아난 것도 여기 적는다 — 「남은 일」에 적혀 있던 항목이다.

- [ ] **Step 4: 마지막 검증**

Run: `npm test`
Expected: 전부 통과

Run: `npx tsc -b`
Expected: 종료 코드 0

Run: `npm run lint`
Expected: 통과

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "docs: 쿼터 배분을 다시 계산한다 — 32회에서 24회로, 30곳에서 41곳으로"
```

---

## 완료 기준

- [ ] 상세를 한 번 열 때 서울 API 호출이 **1회**다 (Vercel 로그 또는 네트워크 탭으로 확인)
- [ ] `PPLTN_TIME`이 화면에 그대로 뜬다 (「14:55 기준」)
- [ ] 상세를 열면 큰 글씨(등급)가 **왕복 없이** 뜬다
- [ ] `api/citydata.ts`·`api/citydata-bulk.ts`가 없다
- [ ] `populationRows`가 `SeoulRtd.citydata_ppltn`을 안 읽는다
- [ ] `npm test`, `npx tsc -b`, `npm run lint` 전부 통과
- [ ] `AGENTS.md`의 쿼터 표가 24회/41곳을 말한다

## 되돌리기

태스크마다 커밋이 원자적이다. 가장 위험한 것은 Task 6(프록시 삭제)이고 Task 4~5 뒤에 온다 — **호출자가 없어진 뒤에 지운다.** 배포 후 문제가 생기면 `git revert`로 Task 6부터 거꾸로 되돌린다. 프록시 파일이 돌아오면 `citydata_ppltn` 경로가 그대로 살아난다.
