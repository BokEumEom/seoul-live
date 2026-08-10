# Google Maps 스타일 셸 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지도를 전체 배경으로 깔고 그 위에 3단 바텀시트를 띄우는 Google Maps 스타일 셸로 바꾸고, 하단 탭바를 없애고, 상세에 인구 구성을 추가 호출 없이 더한다.

**Architecture:** `SplitPane`(공간 분할)을 `BottomSheet`(오버레이)로 교체한다. 지도는 뷰포트를 꽉 채우고 검색 바·필터 칩은 그 위에 뜬다. 시트 안 내용이 목록 / 명소 상세 / 오늘의 서울 셋으로 갈린다. 즐겨찾기는 탭이 아니라 필터 칩이 되고, 오늘의 서울은 시트 상단 요약 스트립에서 열린다. 인구 구성 필드는 기존 엄격한 혼잡도 스키마를 건드리지 않고 **원본 payload에서 따로 관대하게** 읽는다.

**Tech Stack:** React 19.2.8, TypeScript, Vite, TanStack Query, Tailwind v4, `@vis.gl/react-google-maps`, zod 4, Vitest + Testing Library, 앱인토스 `@apps-in-toss/web-framework`

설계 문서: [`docs/superpowers/specs/2026-08-07-gmaps-style-shell-design.md`](../specs/2026-08-07-gmaps-style-shell-design.md)

---

## Global Constraints

- **TDD.** 실패하는 테스트 먼저 → 실패 확인 → 구현 → 통과 확인 → 커밋.
- **변이 테스트.** 새 테스트를 쓴 뒤 구현을 일부러 한 줄 깨뜨려 그 테스트가 실제로 실패하는지 확인한다. 실패하지 않으면 그 테스트는 값이 없다.
- **"입력 배열 불변"류 테스트를 쓰지 마라.** `filter`·`toSorted`를 쓰는 한 어떤 구현으로도 깨지지 않는다. 순서·내용처럼 구현을 바꾸면 실제로 달라지는 것을 단언한다.
- **불변성.** 배열은 `.sort()` 대신 `.toSorted()`.
- **`src/domain/`에서 React를 import하지 않는다.**
- **컴포넌트는 `fetch`를 직접 부르지 않는다.** `src/data/queries.ts`의 훅만 쓴다.
- **Google Maps SDK는 `HomeScreen.tsx`에서만 import 한다.**
- **동적 Tailwind 클래스 금지.** 리터럴 맵을 쓴다.
- **글자 크기는 토큰으로.** `text-sm` 대신 `text-label-md`.
- **`console.log` 금지.** 진단은 `console.error`.
- **npm 명령을 파이프로 넘기지 마라.** 종료 코드가 가려진다.
- 커버리지 임계: 라인·구문·함수 80%, 브랜치 75%.
- 작업을 마쳤다고 보고하기 전 `npm test`와 `npx tsc -b`를 통과시킬 것.

---

## File Structure

**신규**

| 파일 | 책임 |
|---|---|
| `src/domain/sheet.ts` | 시트 3단 비율 상수와 clamp·스냅 (`split.ts`를 대체) |
| `src/domain/composition.ts` | 인구 구성 타입과 표시용 파생값 |
| `src/data/compositionSchema.ts` | 원본 payload에서 인구 구성을 관대하게 읽는다 |
| `src/components/home/BottomSheet.tsx` | 오버레이 시트 (3단 스냅, 드래그) |
| `src/components/home/SummaryStrip.tsx` | 시트 상단 한 줄 요약 |
| `src/components/home/FilterChips.tsx` | 「★ 내 장소」 + 목적 프리셋 칩 |
| `src/components/home/PopulationCard.tsx` | 성별·연령·상주 비율 |

**삭제**

`src/domain/split.ts`(+테스트), `src/components/home/SplitPane.tsx`(+테스트), `src/components/layout/BottomTabBar.tsx`, `src/screens/FavoritesScreen.tsx`(+테스트), `src/components/map/PresetFilter.tsx`(+테스트 — `FilterChips`가 흡수)

**수정**

`src/domain/types.ts`, `src/domain/presets.ts`, `src/data/schema.ts`, `src/data/mock.ts`, `src/hooks/useHomeFilters.ts`, `src/components/list/AreaListItem.tsx`, `src/components/home/SearchBar.tsx`, `src/components/home/AreaDetail.tsx`, `src/components/map/RecenterButton.tsx`, `src/screens/HomeScreen.tsx`, `src/screens/TodayScreen.tsx`, `src/App.tsx`

---

## Task 1: `domain/sheet.ts` — 시트 3단 비율

`split.ts`는 "분할 비율"이라는 이름인데 이제 오버레이 시트 높이다. 이름과 값을 함께 바꾼다.

**Files:**
- Create: `src/domain/sheet.ts`, `src/domain/sheet.test.ts`
- Delete: `src/domain/split.ts`, `src/domain/split.test.ts`
- Modify: `src/components/home/SplitPane.tsx` (import 경로만 — Task 9에서 삭제되지만 그때까지 빌드가 깨지면 안 된다)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type Detent = 'peek' | 'half' | 'full'`
  - `const SHEET_RATIO: Readonly<Record<Detent, number>>` — peek 0.16 / half 0.46 / full 0.92
  - `function clampSheetRatio(ratio: number): number`
  - `function nearestDetent(ratio: number): Detent`

- [ ] **Step 1: 실패 테스트를 쓴다**

`src/domain/sheet.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  clampSheetRatio,
  nearestDetent,
  SHEET_RATIO,
  type Detent,
} from './sheet'

describe('SHEET_RATIO', () => {
  it('세 단계가 오름차순이다', () => {
    expect(SHEET_RATIO.peek).toBeLessThan(SHEET_RATIO.half)
    expect(SHEET_RATIO.half).toBeLessThan(SHEET_RATIO.full)
  })

  it('어느 쪽도 완전히 접히거나 덮지 않는다', () => {
    // peek이 0이면 시트를 되돌릴 손잡이가 사라지고, full이 1이면 지도가 없어진다.
    expect(SHEET_RATIO.peek).toBeGreaterThan(0)
    expect(SHEET_RATIO.full).toBeLessThan(1)
  })
})

describe('clampSheetRatio', () => {
  it('peek 아래는 peek으로 올린다', () => {
    expect(clampSheetRatio(0)).toBe(SHEET_RATIO.peek)
    expect(clampSheetRatio(-1)).toBe(SHEET_RATIO.peek)
  })

  it('full 위는 full로 내린다', () => {
    expect(clampSheetRatio(1)).toBe(SHEET_RATIO.full)
    expect(clampSheetRatio(2)).toBe(SHEET_RATIO.full)
  })

  it('범위 안은 그대로 둔다', () => {
    expect(clampSheetRatio(0.5)).toBe(0.5)
  })

  it('NaN은 half로 떨어뜨린다', () => {
    expect(clampSheetRatio(Number.NaN)).toBe(SHEET_RATIO.half)
  })
})

describe('nearestDetent', () => {
  it('가장 가까운 단계를 고른다', () => {
    expect(nearestDetent(0.17)).toBe('peek')
    expect(nearestDetent(0.44)).toBe('half')
    expect(nearestDetent(0.9)).toBe('full')
  })

  it('중간값은 더 가까운 쪽으로 간다', () => {
    // peek 0.16과 half 0.46의 중간은 0.31
    expect(nearestDetent(0.33)).toBe('half')
    expect(nearestDetent(0.29)).toBe('peek')
  })

  it('범위 밖도 단계 하나로 떨어진다', () => {
    expect(nearestDetent(5)).toBe('full')
    expect(nearestDetent(-5)).toBe('peek')
  })

  // clampSheetRatio 호출이 실제로 하는 일은 이것 하나다. 범위 밖 값은 거리
  // 비교가 어차피 처리하므로, NaN만 갈린다 — clamp가 없으면 비교가 전부
  // false라 첫 단계(peek)에 눌러앉는다.
  it('NaN은 peek이 아니라 half가 된다', () => {
    expect(nearestDetent(Number.NaN)).toBe('half')
  })

  it('언제나 세 단계 중 하나를 준다', () => {
    const all: readonly Detent[] = ['peek', 'half', 'full']
    for (let raw = -0.5; raw <= 1.5; raw += 0.01) {
      expect(all).toContain(nearestDetent(raw))
    }
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/domain/sheet.test.ts`
Expected: FAIL — `Failed to resolve import "./sheet"`

- [ ] **Step 3: `src/domain/sheet.ts`를 만든다**

```ts
// 시트가 화면에서 차지하는 세로 비율. 지도는 뒤에 전체로 깔려 있고 시트가
// 그 위를 덮는다 — 공간을 나눠 갖지 않는다.
//
// peek을 0으로, full을 1로 두지 않는 이유: 한쪽이 완전히 사라지면 되돌릴
// 손잡이도 같이 사라진다.
export type Detent = 'peek' | 'half' | 'full'

export const SHEET_RATIO: Readonly<Record<Detent, number>> = {
  /** 요약 스트립과 목록 첫 항목만. 지도가 주인공 */
  peek: 0.16,
  /** 목록. 기본값 */
  half: 0.46,
  /** 상세 또는 오늘의 서울 */
  full: 0.92,
}

const DETENTS: readonly Detent[] = ['peek', 'half', 'full']

export function clampSheetRatio(ratio: number): number {
  if (Number.isNaN(ratio)) {
    return SHEET_RATIO.half
  }
  return Math.min(SHEET_RATIO.full, Math.max(SHEET_RATIO.peek, ratio))
}

export function nearestDetent(ratio: number): Detent {
  const bounded = clampSheetRatio(ratio)
  return DETENTS.reduce((best, detent) =>
    Math.abs(SHEET_RATIO[detent] - bounded) < Math.abs(SHEET_RATIO[best] - bounded)
      ? detent
      : best,
  )
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/domain/sheet.test.ts`
Expected: PASS (11개)

- [ ] **Step 5: `split.ts`를 지우고 소비처를 바꾼다**

```bash
git rm src/domain/split.ts src/domain/split.test.ts
```

`src/components/home/SplitPane.tsx`의 import를 바꾼다. 이 파일은 Task 9에서 지워지지만 그때까지 빌드가 서 있어야 한다.

```tsx
import { clampSheetRatio, nearestDetent, SHEET_RATIO } from '../../domain/sheet'
```

그리고 본문에서 쓰던 이름을 바꾼다:
- `clampRatio(` → `clampSheetRatio(`
- `snapRatio(next)` → `SHEET_RATIO[nearestDetent(next)]`
- `DEFAULT_MAP_RATIO` → `SHEET_RATIO.half`

`src/hooks/useHomeFilters.ts`도 `DEFAULT_MAP_RATIO`를 쓴다:

```ts
import { SHEET_RATIO } from '../domain/sheet'
// ...
const [mapRatio, setMapRatio] = useState(SHEET_RATIO.half)
```

`src/components/home/SplitPane.test.tsx`와 `src/hooks/useHomeFilters.test.ts`의 import도 함께 바꾼다.

`src/screens/HomeScreen.tsx`의 `MIN_MAP_RATIO`는 `SHEET_RATIO.peek`으로 바꾼다.

- [ ] **Step 6: 통과를 확인한다**

Run: `npm test` 그리고 `npx tsc -b`
Expected: 전부 PASS

- [ ] **Step 7: 변이 확인**

`nearestDetent`의 `clampSheetRatio(ratio)`를 `ratio`로 바꾼다 → "NaN은 peek이 아니라 half가 된다"가 실패해야 한다. 되돌린다.

- [ ] **Step 8: 커밋**

```bash
git add -A src/domain src/components/home src/hooks src/screens
git commit -m "refactor: 분할 비율을 시트 3단 비율로 교체"
```

---

## Task 2: 인구 구성 — 타입 · 관대한 파싱 · 목업

**엄격한 `areaSchema`를 건드리지 않는다.** zod가 파싱한 객체는 미지의 키를 버리므로, 인구 구성은 원본 payload에서 따로 읽는다. 파싱이 실패해도 `null`이 될 뿐 혼잡도는 그대로 산다.

**Files:**
- Create: `src/domain/composition.ts`, `src/domain/composition.test.ts`
- Create: `src/data/compositionSchema.ts`, `src/data/compositionSchema.test.ts`
- Modify: `src/domain/types.ts`, `src/data/schema.ts`, `src/data/mock.ts`
- Test: `src/data/schema.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `interface PopulationComposition { maleRate, femaleRate, nonResidentRate, ageRates }`
  - `const AGE_LABELS: readonly string[]` — 8단계
  - `function residentLabel(c: PopulationComposition): string | null` — 비상주가 0이면 `null`. `rate()`가 못 읽은 값을 0으로 떨어뜨리므로, 0을 근거로 장소를 단정하지 않는다. `PopulationCard`는 JSX에 그대로 넣으면 되고 null은 아무것도 그리지 않는다.
  - `function parseComposition(payload: unknown, expectedName: string): PopulationComposition | null`
  - `AreaSnapshot`에 `readonly composition: PopulationComposition | null` 추가

- [ ] **Step 1: 도메인 실패 테스트를 쓴다**

`src/domain/composition.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { AGE_LABELS, residentLabel } from './composition'
import type { PopulationComposition } from './composition'

function make(nonResidentRate: number): PopulationComposition {
  return {
    maleRate: 50,
    femaleRate: 50,
    nonResidentRate,
    ageRates: [5, 10, 30, 20, 15, 10, 7, 3],
  }
}

describe('AGE_LABELS', () => {
  it('여덟 단계다', () => {
    // 서울 API의 PPLTN_RATE_0 ~ PPLTN_RATE_70과 1:1이다.
    expect(AGE_LABELS).toHaveLength(8)
  })
})

describe('residentLabel', () => {
  it('비상주가 많으면 외지인이 많다고 말한다', () => {
    expect(residentLabel(make(71))).toBe('외지인이 많아요')
  })

  it('비상주가 적으면 동네 생활권이라고 말한다', () => {
    expect(residentLabel(make(28))).toBe('동네 생활권이에요')
  })

  it('경계값 60은 외지인 쪽이 아니다', () => {
    // 60을 넘어야 "많다"고 말한다. 딱 60은 반반에 가깝다.
    expect(residentLabel(make(60))).toBe('동네 생활권이에요')
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/domain/composition.test.ts`
Expected: FAIL — `Failed to resolve import "./composition"`

- [ ] **Step 3: `src/domain/composition.ts`를 만든다**

```ts
/** 서울 API `citydata_ppltn`의 인구 구성. 혼잡도와 같은 응답에 실려 온다.
 *
 * 모든 값이 백분율이다. 응답을 실제로 본 적이 없어 합이 정확히 100인지는
 * 확인되지 않았다 — 화면은 합을 가정하지 않는다. */
export interface PopulationComposition {
  readonly maleRate: number
  readonly femaleRate: number
  /** 비상주(외지인) 비율. 높으면 관광지, 낮으면 생활권이다. */
  readonly nonResidentRate: number
  /** PPLTN_RATE_0 ~ PPLTN_RATE_70 순서대로 여덟 개. */
  readonly ageRates: readonly number[]
}

export const AGE_LABELS: readonly string[] = [
  '0~9세',
  '10대',
  '20대',
  '30대',
  '40대',
  '50대',
  '60대',
  '70대+',
]

/** 60%를 넘어야 "외지인이 많다"고 말한다. 반반에 가까운 곳을 단정하지 않으려는 것이다. */
const NON_RESIDENT_THRESHOLD = 60

export function residentLabel(composition: PopulationComposition): string {
  return composition.nonResidentRate > NON_RESIDENT_THRESHOLD
    ? '외지인이 많아요'
    : '동네 생활권이에요'
}
```

- [ ] **Step 4: 파싱 실패 테스트를 쓴다**

`src/data/compositionSchema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseComposition } from './compositionSchema'

function payload(area: Record<string, unknown>): unknown {
  return { 'SeoulRtd.citydata_ppltn': [{ AREA_NM: '강남역', ...area }] }
}

const FULL = {
  MALE_PPLTN_RATE: '48.2',
  FEMALE_PPLTN_RATE: '51.8',
  NON_RESNT_PPLTN_RATE: '71.4',
  PPLTN_RATE_0: '3.1',
  PPLTN_RATE_10: '8.0',
  PPLTN_RATE_20: '31.2',
  PPLTN_RATE_30: '22.5',
  PPLTN_RATE_40: '14.0',
  PPLTN_RATE_50: '11.2',
  PPLTN_RATE_60: '6.0',
  PPLTN_RATE_70: '4.0',
}

describe('parseComposition', () => {
  it('전부 있으면 숫자로 읽는다', () => {
    const c = parseComposition(payload(FULL), '강남역')
    expect(c).not.toBeNull()
    expect(c?.maleRate).toBe(48.2)
    expect(c?.femaleRate).toBe(51.8)
    expect(c?.nonResidentRate).toBe(71.4)
    expect(c?.ageRates).toEqual([3.1, 8, 31.2, 22.5, 14, 11.2, 6, 4])
  })

  it('필드가 통째로 없으면 null이다', () => {
    expect(parseComposition(payload({}), '강남역')).toBeNull()
  })

  it('요청한 명소가 없으면 null이다', () => {
    expect(parseComposition(payload(FULL), '경복궁')).toBeNull()
  })

  it('payload가 엉뚱한 모양이어도 던지지 않는다', () => {
    // 이 함수는 절대 던지면 안 된다 — 던지면 혼잡도까지 같이 죽는다.
    expect(parseComposition(null, '강남역')).toBeNull()
    expect(parseComposition('문자열', '강남역')).toBeNull()
    expect(parseComposition({ RESULT: {} }, '강남역')).toBeNull()
  })

  it('성별만 이상하면 성별만 버리고 나머지는 산다', () => {
    const c = parseComposition(
      payload({ ...FULL, MALE_PPLTN_RATE: '', FEMALE_PPLTN_RATE: 'N/A' }),
      '강남역',
    )
    expect(c).not.toBeNull()
    expect(c?.maleRate).toBe(0)
    expect(c?.femaleRate).toBe(0)
    expect(c?.ageRates[2]).toBe(31.2)
  })

  it('범위를 벗어난 값은 0으로 떨어뜨린다', () => {
    const c = parseComposition(
      payload({ ...FULL, NON_RESNT_PPLTN_RATE: '250' }),
      '강남역',
    )
    expect(c?.nonResidentRate).toBe(0)
  })

  it('연령대가 일부만 와도 여덟 칸을 채운다', () => {
    const c = parseComposition(
      payload({ MALE_PPLTN_RATE: '50', PPLTN_RATE_20: '40' }),
      '강남역',
    )
    expect(c?.ageRates).toHaveLength(8)
    expect(c?.ageRates[2]).toBe(40)
    expect(c?.ageRates[0]).toBe(0)
  })
})
```

- [ ] **Step 5: 실패를 확인한다**

Run: `npx vitest run src/data/compositionSchema.test.ts`
Expected: FAIL — `Failed to resolve import "./compositionSchema"`

- [ ] **Step 6: `src/data/compositionSchema.ts`를 만든다**

```ts
import { z } from 'zod'
import type { PopulationComposition } from '../domain/composition'

// cityInfoSchema.ts와 같은 방향의 관대한 파싱이다. schema.ts의 엄격한
// areaSchema에 이 필드들을 얹으면, 비율 하나가 비어 오는 순간 혼잡도까지
// 통째로 날아간다. 부가 정보 때문에 본체를 잃지 않으려고 분리했다.
//
// **이 파일의 함수는 절대 예외를 던지지 않는다.**

/** payload 안의 원본 명소 객체만 꺼낸다. areaSchema와 달리 키를 버리지 않는다. */
const looseListSchema = z.object({
  'SeoulRtd.citydata_ppltn': z.array(z.unknown()),
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 백분율 한 칸. 읽을 수 없으면 0이다 — null로 두면 화면이 칸마다 분기해야 한다. */
function rate(raw: unknown): number {
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return 0
  }
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return 0
  }
  return value
}

const AGE_KEYS: readonly string[] = [
  'PPLTN_RATE_0',
  'PPLTN_RATE_10',
  'PPLTN_RATE_20',
  'PPLTN_RATE_30',
  'PPLTN_RATE_40',
  'PPLTN_RATE_50',
  'PPLTN_RATE_60',
  'PPLTN_RATE_70',
]

const COMPOSITION_KEYS: readonly string[] = [
  'MALE_PPLTN_RATE',
  'FEMALE_PPLTN_RATE',
  'NON_RESNT_PPLTN_RATE',
  ...AGE_KEYS,
]

export function parseComposition(
  payload: unknown,
  expectedName: string,
): PopulationComposition | null {
  const parsed = looseListSchema.safeParse(payload)
  if (!parsed.success) {
    return null
  }

  const area = parsed.data['SeoulRtd.citydata_ppltn'].find(
    (item) => isRecord(item) && item.AREA_NM === expectedName,
  )
  if (!isRecord(area)) {
    return null
  }

  // 관련 키가 하나도 없으면 이 API 버전이 인구 구성을 안 준다는 뜻이다.
  // 0으로 채운 껍데기를 돌려주면 화면이 "남 0% 여 0%"를 그린다.
  if (!COMPOSITION_KEYS.some((key) => key in area)) {
    return null
  }

  return {
    maleRate: rate(area.MALE_PPLTN_RATE),
    femaleRate: rate(area.FEMALE_PPLTN_RATE),
    nonResidentRate: rate(area.NON_RESNT_PPLTN_RATE),
    ageRates: AGE_KEYS.map((key) => rate(area[key])),
  }
}
```

- [ ] **Step 7: `AreaSnapshot`에 붙인다**

`src/domain/types.ts` — `AreaSnapshot`에 필드를 더한다:

```ts
import type { PopulationComposition } from './composition'
// ...
export interface AreaSnapshot {
  // ...기존 필드 그대로...
  readonly forecasts: readonly Forecast[]
  /** 없을 수 있다. 이 값이 없어도 혼잡도 화면은 그대로 선다. */
  readonly composition: PopulationComposition | null
}
```

`src/data/schema.ts` — `parseCitydataResponse`의 반환에 한 줄 더한다:

```ts
import { parseComposition } from './compositionSchema'
// ...
  return {
    code: area.AREA_CD,
    name: expectedName,
    congestion: area.AREA_CONGEST_LVL,
    message: area.AREA_CONGEST_MSG,
    populationMin: area.AREA_PPLTN_MIN,
    populationMax: area.AREA_PPLTN_MAX,
    observedAt: area.PPLTN_TIME.raw,
    observedAtLabel: area.PPLTN_TIME.label,
    forecasts: (area.FCST_PPLTN ?? []).map(toForecast),
    // 원본 payload에서 따로 읽는다. 실패해도 null일 뿐 위 값들은 그대로다.
    composition: parseComposition(payload, expectedName),
  }
```

- [ ] **Step 8: 회귀 테스트를 더한다**

`src/data/schema.test.ts`에 추가한다. **이게 이 태스크의 핵심 안전망이다.**

```ts
it('인구 구성이 깨져 있어도 혼잡도는 살아남는다', () => {
  // 부가 정보 때문에 본체를 잃지 않는다.
  const payload = {
    'SeoulRtd.citydata_ppltn': [
      {
        AREA_NM: '강남역',
        AREA_CD: 'POI014',
        AREA_CONGEST_LVL: '붐빔',
        AREA_CONGEST_MSG: '붐벼요',
        AREA_PPLTN_MIN: '74000',
        AREA_PPLTN_MAX: '76000',
        PPLTN_TIME: '2026-08-10 11:00',
        MALE_PPLTN_RATE: { 이상한: '모양' },
        PPLTN_RATE_20: [1, 2, 3],
      },
    ],
  }

  const snapshot = parseCitydataResponse(payload, '강남역')
  expect(snapshot.congestion).toBe('붐빔')
  expect(snapshot.populationMax).toBe(76_000)
  expect(snapshot.composition?.maleRate).toBe(0)
})

it('인구 구성 필드가 아예 없으면 composition이 null이다', () => {
  const payload = {
    'SeoulRtd.citydata_ppltn': [
      {
        AREA_NM: '강남역',
        AREA_CD: 'POI014',
        AREA_CONGEST_LVL: '여유',
        AREA_CONGEST_MSG: '한산해요',
        AREA_PPLTN_MIN: '1000',
        AREA_PPLTN_MAX: '2000',
        PPLTN_TIME: '2026-08-10 11:00',
      },
    ],
  }

  expect(parseCitydataResponse(payload, '강남역').composition).toBeNull()
})
```

- [ ] **Step 9: 목업에 인구 구성을 넣는다**

목업에 없으면 개발 중에 이 섹션을 한 번도 볼 수 없다. `src/data/mock.ts`의 `buildMockSnapshot`이 돌려주는 객체에 필드를 더한다. 기존 `mixSeed`를 그대로 쓴다.

```ts
// buildMockSnapshot 안, 반환 객체에 아래 키들을 더한다.
// mixSeed(seed, n)의 n은 예측이 쓰지 않는 큰 번호대를 쓴다 — 겹치면 같은 명소의
// 예측과 인구 구성이 상관관계를 갖는다.
const male = 35 + (mixSeed(seed, 100) % 30)
const nonResident = 20 + (mixSeed(seed, 101) % 70)
const rawAges = Array.from({ length: 8 }, (_, i) => 1 + (mixSeed(seed, 110 + i) % 40))
const ageTotal = rawAges.reduce((sum, value) => sum + value, 0)

// ...반환 객체에 추가...
  MALE_PPLTN_RATE: String(male),
  FEMALE_PPLTN_RATE: String(100 - male),
  NON_RESNT_PPLTN_RATE: String(nonResident),
  RESNT_PPLTN_RATE: String(100 - nonResident),
  ...Object.fromEntries(
    rawAges.map((value, i) => [
      `PPLTN_RATE_${i * 10}`,
      ((value / ageTotal) * 100).toFixed(1),
    ]),
  ),
```

- [ ] **Step 10: 통과를 확인한다**

Run: `npm test` 그리고 `npx tsc -b`
Expected: 전부 PASS. `AreaSnapshot`에 필수 필드가 늘었으므로 스냅샷을 손으로 만드는 테스트들이 컴파일 에러를 낸다 — 전부 `composition: null`을 더한다.

- [ ] **Step 11: 변이 확인**

두 가지를 각각 해보고 대응 테스트가 실패하는지 본다.

1. `compositionSchema.ts`의 `rate()`에서 범위 검사(`value < 0 || value > 100`)를 지운다 → "범위를 벗어난 값은 0으로 떨어뜨린다"가 실패해야 한다
2. `COMPOSITION_KEYS.some(...)` 가드를 지운다 → "필드가 통째로 없으면 null이다"가 실패해야 한다

둘 다 확인한 뒤 되돌린다.

- [ ] **Step 12: 커밋**

```bash
git add -A src/domain src/data
git commit -m "feat: 인구 구성을 추가 호출 없이 읽는다 (관대한 파싱)"
```

---

## Task 3: `BottomSheet` 컴포넌트

**Files:**
- Create: `src/components/home/BottomSheet.tsx`, `src/components/home/BottomSheet.test.tsx`

**Interfaces:**
- Consumes: `SHEET_RATIO`, `nearestDetent`, `clampSheetRatio`, `Detent` (Task 1)
- Produces: `function BottomSheet(props: { detent: Detent; onDetentChange: (next: Detent) => void; children: ReactNode })`

`SplitPane`과 다른 점: 위쪽 pane이 없다. 시트는 `absolute inset-x-0 bottom-0`이고 높이만 비율로 정한다. 지도는 부모가 뒤에 깔아둔다.

- [ ] **Step 1: 실패 테스트를 쓴다**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomSheet } from './BottomSheet'

function setup(onDetentChange = vi.fn(), detent: 'peek' | 'half' | 'full' = 'half') {
  const { container } = render(
    <BottomSheet detent={detent} onDetentChange={onDetentChange}>
      <div>시트내용</div>
    </BottomSheet>,
  )
  const sheet = container.firstElementChild as HTMLElement
  // jsdom은 레이아웃을 계산하지 않는다. 비율 계산이 0으로 나누지 않도록 심는다.
  vi.spyOn(sheet.parentElement as HTMLElement, 'getBoundingClientRect').mockReturnValue({
    top: 0, height: 800, bottom: 800, left: 0, right: 0, width: 400, x: 0, y: 0,
    toJSON: () => ({}),
  })
  return { handle: screen.getByRole('separator'), onDetentChange, sheet }
}

describe('BottomSheet', () => {
  it('내용을 그린다', () => {
    setup()
    expect(screen.getByText('시트내용')).toBeInTheDocument()
  })

  it('단계에 맞는 높이를 준다', () => {
    const { sheet } = setup(vi.fn(), 'half')
    expect(sheet.style.height).toBe('46%')
  })

  it('위로 끌어 놓으면 full이 된다', () => {
    const { handle, onDetentChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 430, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 100, pointerId: 1 })
    // 아래에서 100px 남은 지점 = 시트 높이 700/800 = 0.875 → full(0.92)에 가장 가깝다
    expect(onDetentChange).toHaveBeenLastCalledWith('full')
  })

  it('아래로 끌어 놓으면 peek이 된다', () => {
    const { handle, onDetentChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 430, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 700, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 700, pointerId: 1 })
    expect(onDetentChange).toHaveBeenLastCalledWith('peek')
  })

  it('끌지 않고 누르기만 하면 단계가 안 바뀐다', () => {
    const { handle, onDetentChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 430, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 430, pointerId: 1 })
    expect(onDetentChange).not.toHaveBeenCalled()
  })

  it('누르지 않고 지나가는 포인터는 무시한다', () => {
    const { handle, onDetentChange } = setup()
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 1 })
    expect(onDetentChange).not.toHaveBeenCalled()
  })

  it('다른 포인터의 움직임은 무시한다', () => {
    const { handle, onDetentChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 430, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 2 })
    fireEvent.pointerUp(handle, { clientY: 100, pointerId: 2 })
    expect(onDetentChange).not.toHaveBeenCalled()
  })

  it('더블클릭하면 half로 돌아간다', () => {
    const { handle, onDetentChange } = setup(vi.fn(), 'full')
    fireEvent.doubleClick(handle)
    expect(onDetentChange).toHaveBeenCalledWith('half')
  })

  it('손잡이에 접근 가능한 이름이 있다', () => {
    const { handle } = setup()
    expect(handle).toHaveAccessibleName('시트 높이 조절')
  })

  it('내용 영역이 스크롤된다', () => {
    setup()
    // 손잡이는 고정이고 내용만 흐른다 — full에서 상세를 스크롤할 때
    // 시트가 따라 내려가면 안 된다.
    const scroller = screen.getByText('시트내용').parentElement as HTMLElement
    expect(scroller.className).toContain('overflow-y-auto')
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/components/home/BottomSheet.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현한다**

```tsx
import { useRef, type PointerEvent, type ReactNode } from 'react'
import {
  clampSheetRatio,
  nearestDetent,
  SHEET_RATIO,
  type Detent,
} from '../../domain/sheet'

interface Props {
  readonly detent: Detent
  readonly onDetentChange: (next: Detent) => void
  readonly children: ReactNode
}

// 지도 위에 뜨는 오버레이 시트다. 공간을 나눠 갖지 않으므로 지도는 뒤에서
// 온전한 크기로 살아 있다.
//
// 드래그는 손잡이에서만 받는다. 내용 영역에서도 받으면 full 단계에서 상세를
// 스크롤할 때마다 시트가 따라 내려간다.
//
// 토스 웹뷰에서 이 드래그와 지도 팬 제스처가 충돌하는지는 실기기로만 확인된다
// — 설계 문서 §6.
export function BottomSheet({ detent, onDetentChange, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const movedRef = useRef(false)
  const liveDetentRef = useRef<Detent>(detent)

  function detentFromY(clientY: number): Detent | null {
    const rect = sheetRef.current?.parentElement?.getBoundingClientRect()
    if (rect === undefined || rect.height === 0) {
      return null
    }
    // 시트는 아래에 붙어 있다. 손끝이 위로 갈수록 높이가 커진다.
    return nearestDetent(clampSheetRatio((rect.bottom - clientY) / rect.height))
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (pointerIdRef.current !== null) {
      return
    }
    pointerIdRef.current = event.pointerId
    movedRef.current = false
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }
    const next = detentFromY(event.clientY)
    if (next === null) return
    movedRef.current = true
    liveDetentRef.current = next
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>): void {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    pointerIdRef.current = null

    // 손잡이를 스치기만 해도 시트가 튀면 목록을 만지기 무서워진다.
    if (!movedRef.current) {
      return
    }
    movedRef.current = false
    const next = detentFromY(event.clientY) ?? liveDetentRef.current
    onDetentChange(next)
  }

  return (
    <div
      ref={sheetRef}
      style={{ height: `${SHEET_RATIO[detent] * 100}%` }}
      className="absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-2xl bg-surface-container-lowest shadow-floating transition-[height] duration-200 ease-out"
    >
      <div
        role="separator"
        aria-label="시트 높이 조절"
        aria-orientation="horizontal"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={() => onDetentChange('half')}
        className="flex shrink-0 cursor-row-resize touch-none justify-center py-2.5"
      >
        <span className="h-1 w-9 rounded-full bg-outline-variant" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/components/home/BottomSheet.test.tsx`
Expected: PASS (10개)

- [ ] **Step 5: 변이 확인**

1. `handlePointerUp`의 `if (!movedRef.current) return`을 지운다 → "끌지 않고 누르기만 하면"이 실패해야 한다
2. `detentFromY`의 `rect.bottom - clientY`를 `clientY - rect.top`으로 바꾼다 → 위로/아래로 끄는 테스트 둘이 실패해야 한다

되돌린다.

- [ ] **Step 6: 커밋**

```bash
git add src/components/home/BottomSheet.tsx src/components/home/BottomSheet.test.tsx
git commit -m "feat: 오버레이 바텀시트 컴포넌트 추가"
```

---

## Task 4: `AreaListItem` — 카드에서 구분선으로

**Files:**
- Modify: `src/components/list/AreaListItem.tsx`
- Create: `src/components/list/AreaListItem.test.tsx`

**Interfaces:**
- Consumes: `NearbyArea`, `CATEGORY_LABEL`
- Produces: 같은 컴포넌트, 새 스타일

- [ ] **Step 1: 실패 테스트를 쓴다**

이 파일에는 테스트가 없었다. 밀도 규칙을 고정한다.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { NearbyArea } from '../../domain/types'
import { AreaListItem } from './AreaListItem'

function area(overrides: Partial<NearbyArea> = {}): NearbyArea {
  return {
    entry: {
      code: 'POI014',
      name: '강남역',
      lat: 37.498,
      lng: 127.0276,
      category: '인구밀집지역',
    },
    snapshot: {
      code: 'POI014',
      name: '강남역',
      congestion: '붐빔',
      message: '',
      populationMin: 0,
      populationMax: 0,
      observedAt: '2026-08-10 11:00',
      observedAtLabel: '11:00',
      forecasts: [],
      composition: null,
    },
    distanceMeters: 1200,
    ...overrides,
  }
}

describe('AreaListItem', () => {
  it('이름과 혼잡도를 보여준다', () => {
    render(<AreaListItem area={area()} onSelect={() => {}} />)
    expect(screen.getByText('강남역')).toBeInTheDocument()
    expect(screen.getByText('붐빔')).toBeInTheDocument()
  })

  it('행정 용어가 아니라 화면 라벨로 카테고리를 쓴다', () => {
    render(<AreaListItem area={area()} onSelect={() => {}} />)
    expect(screen.getByText(/역·번화가/)).toBeInTheDocument()
    expect(screen.queryByText(/인구밀집지역/)).toBeNull()
  })

  it('거리가 없으면 거리를 그리지 않는다', () => {
    render(<AreaListItem area={area({ distanceMeters: null })} onSelect={() => {}} />)
    expect(screen.queryByText(/km|m$/)).toBeNull()
  })

  it('즐겨찾기면 별을 붙인다', () => {
    render(<AreaListItem area={area()} favorite onSelect={() => {}} />)
    expect(screen.getByLabelText('즐겨찾기')).toBeInTheDocument()
  })

  it('즐겨찾기가 아니면 별이 없다', () => {
    render(<AreaListItem area={area()} onSelect={() => {}} />)
    expect(screen.queryByLabelText('즐겨찾기')).toBeNull()
  })

  it('누르면 명소 이름을 올려보낸다', async () => {
    const onSelect = vi.fn()
    render(<AreaListItem area={area()} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith('강남역')
  })

  // 시트라는 좁은 창에서 한 화면에 몇 줄이 들어가는지가 이 컴포넌트의 값이다.
  it('카드가 아니라 구분선이고 행 높이가 48px이다', () => {
    render(<AreaListItem area={area()} onSelect={() => {}} />)
    const row = screen.getByRole('button')
    expect(row.className).toContain('min-h-12')
    expect(row.className).toContain('border-b')
    expect(row.className).not.toContain('rounded-card')
  })

  it('이름이 제목 크기가 아니다', () => {
    render(<AreaListItem area={area()} onSelect={() => {}} />)
    expect(screen.getByText('강남역').className).toContain('text-body-md')
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/components/list/AreaListItem.test.tsx`
Expected: FAIL — `favorite` prop이 없고, 클래스가 `rounded-card`·`text-headline-sm`이다

- [ ] **Step 3: 구현한다**

```tsx
import { formatDistance } from '../../domain/distance'
import { CATEGORY_LABEL, type NearbyArea } from '../../domain/types'
import { CongestionBadge } from '../common/CongestionBadge'

interface Props {
  readonly area: NearbyArea
  readonly favorite?: boolean
  readonly onSelect: (name: string) => void
}

// 카드가 아니라 구분선 목록이다. 시트가 좁은 창이라 한 화면에 몇 줄이
// 들어가는지가 곧 쓸모다 — 카드 테두리와 12px 간격은 두 줄어치를 먹는다.
export function AreaListItem({ area, favorite = false, onSelect }: Props) {
  const { entry, snapshot, distanceMeters } = area

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.name)}
      className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-outline-variant py-2 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-body-md font-semibold text-on-surface">
            {entry.name}
          </span>
          {favorite && (
            <span aria-label="즐겨찾기" className="shrink-0 text-label-sm text-primary">
              ★
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-label-sm text-on-surface-variant">
          {distanceMeters !== null && `${formatDistance(distanceMeters)} · `}
          {CATEGORY_LABEL[entry.category]}
        </span>
      </span>
      <CongestionBadge level={snapshot?.congestion ?? null} />
    </button>
  )
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm test` 그리고 `npx tsc -b`
Expected: 전부 PASS. 갱신 시각(`observedAtLabel`)이 행에서 빠졌으므로 그걸 단언하던 다른 테스트가 있으면 함께 고친다.

- [ ] **Step 5: 변이 확인**

`CATEGORY_LABEL[entry.category]`를 `entry.category`로 바꾼다 → "행정 용어가 아니라 화면 라벨로"가 실패해야 한다. 되돌린다.

- [ ] **Step 6: 커밋**

```bash
git add -A src/components/list
git commit -m "feat: 목록 행을 카드에서 구분선으로 바꾸고 밀도를 높인다"
```

---

## Task 5: `SummaryStrip` — 시트 상단 한 줄 요약

**Files:**
- Create: `src/components/home/SummaryStrip.tsx`, `src/components/home/SummaryStrip.test.tsx`

**Interfaces:**
- Consumes: `CitySummary` (`domain/summary.ts`), `CityAlert` (`domain/cityInfo.ts`)
- Produces: `function SummaryStrip(props: { summary: CitySummary; alertCount: number; onOpen: () => void })`

- [ ] **Step 1: 실패 테스트를 쓴다**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CitySummary } from '../../domain/summary'
import { SummaryStrip } from './SummaryStrip'

function summary(overrides: Partial<CitySummary> = {}): CitySummary {
  return {
    total: 30,
    counted: 30,
    byLevel: { 여유: 20, 보통: 3, '약간 붐빔': 0, 붐빔: 7 },
    ...overrides,
  }
}

describe('SummaryStrip', () => {
  it('붐빔 개수를 한 줄로 보여준다', () => {
    render(<SummaryStrip summary={summary()} alertCount={0} onOpen={() => {}} />)
    expect(screen.getByRole('button', { name: /30곳 중 붐빔 7곳/ })).toBeInTheDocument()
  })

  it('재난문자가 있으면 앞에 세우고 경보로 표시한다', () => {
    render(<SummaryStrip summary={summary()} alertCount={2} onOpen={() => {}} />)
    const strip = screen.getByRole('button')
    expect(strip).toHaveTextContent(/재난문자 2건/)
    expect(strip).toHaveAttribute('data-alert', 'true')
  })

  it('재난문자가 없으면 경보 표시가 아니다', () => {
    render(<SummaryStrip summary={summary()} alertCount={0} onOpen={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('data-alert', 'false')
  })

  it('아직 아무것도 안 왔으면 그렇게 말한다', () => {
    render(
      <SummaryStrip
        summary={summary({ counted: 0, byLevel: { 여유: 0, 보통: 0, '약간 붐빔': 0, 붐빔: 0 } })}
        alertCount={0}
        onOpen={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /아직 받지 못했어요/ })).toBeInTheDocument()
  })

  it('누르면 콜백이 불린다', async () => {
    const onOpen = vi.fn()
    render(<SummaryStrip summary={summary()} alertCount={0} onOpen={onOpen} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/components/home/SummaryStrip.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현한다**

```tsx
import type { CitySummary } from '../../domain/summary'

interface Props {
  readonly summary: CitySummary
  readonly alertCount: number
  readonly onOpen: () => void
}

// 「더보기」 탭을 대신한다. 탭은 눌러야 보이지만 이 줄은 시트를 열 때마다
// 눈에 들어온다 — 안 눌리는 탭보다 발견된다.
//
// 한 줄을 넘지 않는다. 큰 카드를 목록 위에 올리면 half 단계에서 명소가
// 한 곳도 안 보인다.
export function SummaryStrip({ summary, alertCount, onOpen }: Props) {
  const hasAlert = alertCount > 0

  const label =
    summary.counted === 0
      ? '혼잡도 정보를 아직 받지 못했어요.'
      : `${summary.counted}곳 중 붐빔 ${summary.byLevel.붐빔}곳`

  return (
    <button
      type="button"
      onClick={onOpen}
      data-alert={hasAlert}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-label-md font-medium ${
        hasAlert
          ? 'bg-error-container text-on-error-container'
          : 'bg-secondary-container text-primary'
      }`}
    >
      <span className="truncate">
        {hasAlert ? `재난문자 ${alertCount}건 · ${label}` : label}
      </span>
      <span aria-hidden className="shrink-0">
        ›
      </span>
    </button>
  )
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/components/home/SummaryStrip.test.tsx`
Expected: PASS (5개)

- [ ] **Step 5: 변이 확인**

`hasAlert ? \`재난문자 ...\` : label`을 `label`로 바꾼다 → "재난문자가 있으면 앞에 세우고"가 실패해야 한다. 되돌린다.

- [ ] **Step 6: 커밋**

```bash
git add src/components/home/SummaryStrip.tsx src/components/home/SummaryStrip.test.tsx
git commit -m "feat: 시트 상단 요약 스트립 추가"
```

---

## Task 6: `FilterChips` — 즐겨찾기를 필터로

`PresetFilter`를 `FilterChips`로 대체한다. 「★ 내 장소」가 프리셋 셋과 같은 줄에서 배타적으로 동작한다.

**Files:**
- Create: `src/components/home/FilterChips.tsx`, `src/components/home/FilterChips.test.tsx`
- Delete: `src/components/map/PresetFilter.tsx`, `src/components/map/PresetFilter.test.tsx`
- Modify: `src/domain/presets.ts`, `src/hooks/useHomeFilters.ts`, `src/hooks/useHomeFilters.test.ts`
- Modify (전환 배선 — Step 6·7): `src/screens/HomeScreen.tsx`, `src/screens/HomeScreen.test.tsx`

`HomeScreen`은 Task 9에서 전면 재작성되지만 **그때까지 빌드와 테스트가 서 있어야 한다.** `preset`/`setPreset`이 `filter`/`setFilter`로 바뀌고 `PresetFilter`가 사라지므로 소비처를 함께 고치지 않으면 이 커밋에서 `tsc -b`가 깨진다. `HomeScreen`에는 지금 `useFavorites`가 없다(즐겨찾기는 `FavoritesScreen`에만 있었다) — Step 6에서 들여온다.

**Interfaces:**
- Consumes: `PRESETS`, `PresetKey`, `presetCounts`
- Produces:
  - `type FilterKey = 'fav' | PresetKey` (in `domain/presets.ts`)
  - `function FilterChips(props: { counts: Readonly<Record<FilterKey, number>>; value: FilterKey | null; onChange: (next: FilterKey | null) => void })`
  - `useHomeFilters`의 `preset: PresetKey | null` → `filter: FilterKey | null`

- [ ] **Step 1: 실패 테스트를 쓴다**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FilterChips } from './FilterChips'

const COUNTS = { fav: 3, kids: 10, date: 19, hot: 7 } as const

describe('FilterChips', () => {
  it('내 장소가 맨 앞이고 프리셋 셋이 뒤따른다', () => {
    render(<FilterChips counts={COUNTS} value={null} onChange={() => {}} />)
    const names = screen.getAllByRole('tab').map((t) => t.textContent ?? '')
    expect(names[0]).toMatch(/내 장소/)
    expect(names).toHaveLength(4)
  })

  it('개수를 함께 보여준다', () => {
    render(<FilterChips counts={COUNTS} value={null} onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: /내 장소 3/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /지금 핫플 7/ })).toBeInTheDocument()
  })

  it('0이면 비활성이다', () => {
    render(
      <FilterChips counts={{ ...COUNTS, fav: 0 }} value={null} onChange={() => {}} />,
    )
    expect(screen.getByRole('tab', { name: /내 장소 0/ })).toBeDisabled()
  })

  it('고르면 값을 올려보낸다', async () => {
    const onChange = vi.fn()
    render(<FilterChips counts={COUNTS} value={null} onChange={onChange} />)
    await userEvent.click(screen.getByRole('tab', { name: /내 장소/ }))
    expect(onChange).toHaveBeenCalledWith('fav')
  })

  it('선택된 칩을 다시 누르면 해제된다', async () => {
    const onChange = vi.fn()
    render(<FilterChips counts={COUNTS} value="fav" onChange={onChange} />)
    await userEvent.click(screen.getByRole('tab', { name: /내 장소/ }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('한 번에 하나만 선택된다', () => {
    render(<FilterChips counts={COUNTS} value="kids" onChange={() => {}} />)
    const selected = screen
      .getAllByRole('tab')
      .filter((t) => t.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(1)
  })

  it('비활성인 칩을 눌러도 값이 안 올라간다', async () => {
    const onChange = vi.fn()
    render(
      <FilterChips counts={{ ...COUNTS, hot: 0 }} value={null} onChange={onChange} />,
    )
    await userEvent.click(screen.getByRole('tab', { name: /지금 핫플 0/ }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/components/home/FilterChips.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: `domain/presets.ts`에 `FilterKey`를 더한다**

```ts
/** 필터 칩 한 줄의 값. 즐겨찾기는 프리셋이 아니지만 같은 줄에서 배타적으로 동작한다.
 *
 * 교집합(내 장소 ∩ 아이와 나들이)을 지원하지 않는 이유는 30곳 규모에서
 * 결과가 0이 되기 쉬워서다. */
export type FilterKey = 'fav' | PresetKey
```

- [ ] **Step 4: `FilterChips.tsx`를 만든다**

```tsx
import { PRESETS, type FilterKey } from '../../domain/presets'

const LABEL: Readonly<Record<FilterKey, string>> = {
  fav: '★ 내 장소',
  kids: '아이와 나들이',
  date: '데이트',
  hot: '지금 핫플',
}

const ORDER: readonly FilterKey[] = ['fav', ...PRESETS.map((preset) => preset.key)]

interface Props {
  readonly counts: Readonly<Record<FilterKey, number>>
  readonly value: FilterKey | null
  readonly onChange: (next: FilterKey | null) => void
}

// 지도 위에 떠 있으므로 바깥 컨테이너에 pointer-events-auto가 필요하다.
export function FilterChips({ counts, value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="필터"
      className="pointer-events-auto flex gap-2 overflow-x-auto px-4 pb-1"
    >
      {ORDER.map((key) => {
        const count = counts[key]
        const selected = value === key
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selected}
            // 0이면 누를 수 없다. 눌렀는데 아무 일도 안 일어나는 순간을 만들지 않는다.
            disabled={count === 0}
            onClick={() => onChange(selected ? null : key)}
            className={`min-h-10 shrink-0 rounded-full px-4 text-label-md font-semibold shadow-floating disabled:opacity-50 ${
              selected ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface-variant'
            }`}
          >
            {LABEL[key]} {count}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: `useHomeFilters`의 `preset`을 `filter`로 바꾼다**

`src/hooks/useHomeFilters.ts`에서 `PresetKey`를 `FilterKey`로, `preset`/`setPreset`을 `filter`/`setFilter`로 바꾼다. 선택 해제 규칙은 그대로다.

```ts
import type { FilterKey } from '../domain/presets'
// ...
  readonly filter: FilterKey | null
  readonly setFilter: (next: FilterKey | null) => void
// ...
  const [filter, setFilterRaw] = useState<FilterKey | null>(null)
// ...
  const setFilter = useCallback((next: FilterKey | null) => {
    setFilterRaw(next)
    setSelectedName(null)
  }, [])
```

`useHomeFilters.test.ts`의 `setPreset`·`preset`도 함께 바꾼다.

- [ ] **Step 6: `PresetFilter`를 지운다**

```bash
git rm src/components/map/PresetFilter.tsx src/components/map/PresetFilter.test.tsx
```

`HomeScreen.tsx`가 `PresetFilter`를 쓰고 있다. Task 9에서 전면 재작성하지만 그때까지 빌드가 서야 하므로, 지금은 `FilterChips`로 갈아 끼우고 `counts`에 `fav`를 더한다:

```tsx
const counts = { ...presetCounts(list), fav: favorites.length }
```

`useFavorites`를 `HomeScreen`에서 부른다.

- [ ] **Step 7: `visible()` 파이프라인에 fav를 더한다**

`HomeScreen.tsx`의 필터 계산을 바꾼다:

```tsx
const filtered =
  filters.filter === 'fav'
    ? list.filter((area) => favorites.includes(area.entry.name))
    : filterByPreset(list, filters.filter)
const visible = searchAreas(filtered, filters.query)
```

`filterByPreset`은 `PresetKey | null`을 받는데 `'fav'`가 들어올 수 있다. `filters.filter === 'fav'`를 먼저 걸러내므로 타입은 좁혀지지만, TypeScript가 좁히지 못하면 지역 변수로 나눈다.

- [ ] **Step 8: 통과를 확인한다**

Run: `npm test` 그리고 `npx tsc -b`
Expected: 전부 PASS

- [ ] **Step 9: 변이 확인**

`FilterChips`의 `disabled={count === 0}`을 지운다 → "0이면 비활성이다"와 "비활성인 칩을 눌러도"가 실패해야 한다. 되돌린다.

- [ ] **Step 10: 커밋**

```bash
git add -A src/components src/domain src/hooks src/screens
git commit -m "feat: 즐겨찾기를 탭에서 필터 칩으로 옮긴다"
```

---

## Task 7: `PopulationCard` — 지금 누가 있나

**Files:**
- Create: `src/components/home/PopulationCard.tsx`, `src/components/home/PopulationCard.test.tsx`

**Interfaces:**
- Consumes: `PopulationComposition`, `AGE_LABELS`, `residentLabel` (Task 2)
- Produces: `function PopulationCard(props: { composition: PopulationComposition })`

- [ ] **Step 1: 실패 테스트를 쓴다**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PopulationComposition } from '../../domain/composition'
import { PopulationCard } from './PopulationCard'

function composition(
  overrides: Partial<PopulationComposition> = {},
): PopulationComposition {
  return {
    maleRate: 48,
    femaleRate: 52,
    nonResidentRate: 71,
    ageRates: [3, 8, 31, 22, 14, 11, 6, 4],
    ...overrides,
  }
}

describe('PopulationCard', () => {
  it('남녀 비율을 보여준다', () => {
    render(<PopulationCard composition={composition()} />)
    expect(screen.getByText(/남 48%/)).toBeInTheDocument()
    expect(screen.getByText(/여 52%/)).toBeInTheDocument()
  })

  it('비상주가 많으면 외지인이 많다고 말한다', () => {
    render(<PopulationCard composition={composition()} />)
    expect(screen.getByText('외지인이 많아요')).toBeInTheDocument()
  })

  it('비상주가 적으면 동네 생활권이라고 말한다', () => {
    render(<PopulationCard composition={composition({ nonResidentRate: 22 })} />)
    expect(screen.getByText('동네 생활권이에요')).toBeInTheDocument()
  })

  it('비상주가 0이면 아무 말도 하지 않는다', () => {
    // rate()가 못 읽은 값을 0으로 떨어뜨린다. 못 읽은 0으로 장소를 단정하지
    // 않는다 — residentLabel이 null을 주고 JSX는 아무것도 그리지 않는다.
    render(<PopulationCard composition={composition({ nonResidentRate: 0 })} />)
    expect(screen.queryByText('동네 생활권이에요')).toBeNull()
    expect(screen.queryByText('외지인이 많아요')).toBeNull()
  })

  it('비중이 큰 연령대만 라벨로 적는다', () => {
    // 여덟 칸을 다 적으면 좁은 시트에서 두 줄을 먹는다.
    render(<PopulationCard composition={composition()} />)
    expect(screen.getByText(/20대/)).toBeInTheDocument()
    expect(screen.queryByText(/70대\+/)).toBeNull()
  })

  it('연령대 막대가 여덟 칸이다', () => {
    const { container } = render(<PopulationCard composition={composition()} />)
    expect(container.querySelectorAll('[data-age]')).toHaveLength(8)
  })

  it('읽지 못해 전부 0이면 칩도 막대도 그리지 않는다', () => {
    // 키는 왔는데 내용이 쓰레기인 경우다. 0을 사실처럼 그리면 없는 인구를
    // 지어낸다 — 균등 8칸 막대는 "연령대가 고르다"는 없는 사실까지 그린다.
    const { container } = render(
      <PopulationCard
        composition={composition({
          maleRate: 0,
          femaleRate: 0,
          nonResidentRate: 0,
          ageRates: [0, 0, 0, 0, 0, 0, 0, 0],
        })}
      />,
    )
    expect(screen.getByRole('heading', { name: '지금 누가 있나' })).toBeInTheDocument()
    expect(screen.queryByText(/남 0%/)).toBeNull()
    expect(screen.queryByText(/비상주/)).toBeNull()
    expect(container.querySelectorAll('[data-age]')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/components/home/PopulationCard.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현한다**

```tsx
import { AGE_LABELS, residentLabel } from '../../domain/composition'
import type { PopulationComposition } from '../../domain/composition'

/** 이 비율을 넘는 연령대만 라벨을 적는다. 여덟 칸을 다 적으면 두 줄을 먹는다. */
const LABEL_THRESHOLD = 10

// 동적 클래스 금지라 리터럴 맵으로 둔다. 20~30대를 진하게 해서 어느 층이
// 많은지 색만으로도 읽히게 한다.
const AGE_CLASS: readonly string[] = [
  'bg-secondary-container',
  'bg-secondary',
  'bg-primary',
  'bg-primary',
  'bg-secondary',
  'bg-secondary-container',
  'bg-surface-container',
  'bg-surface-container',
]

interface Props {
  readonly composition: PopulationComposition
}

export function PopulationCard({ composition }: Props) {
  const total = composition.ageRates.reduce((sum, value) => sum + value, 0)
  const label = residentLabel(composition)

  // 0은 "실제로 0%"가 아니라 "읽지 못함"일 수 있다(compositionSchema.ts의 rate()).
  // 못 읽은 값을 사실처럼 그리지 않는다 — 칸마다 값이 있을 때만 그린다.
  // 하나도 못 읽었으면 제목만 남는데, 그건 Task 8이 composition이 null일 때
  // 섹션을 통째로 숨기는 것과 다른 상태다(키는 왔는데 내용이 쓰레기).
  const hasGender = composition.maleRate > 0 || composition.femaleRate > 0

  return (
    <section className="mt-4 border-t border-outline-variant pt-3">
      <h3 className="text-label-md font-bold text-on-surface">지금 누가 있나</h3>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {hasGender && (
          <span className="rounded-lg bg-surface-container px-2.5 py-1 text-label-sm text-on-surface-variant">
            남 {Math.round(composition.maleRate)}% · 여 {Math.round(composition.femaleRate)}%
          </span>
        )}
        {composition.nonResidentRate > 0 && (
          <span className="rounded-lg bg-surface-container px-2.5 py-1 text-label-sm text-on-surface-variant">
            비상주 {Math.round(composition.nonResidentRate)}%
          </span>
        )}
        {label !== null && (
          <span className="rounded-lg bg-secondary-container px-2.5 py-1 text-label-sm text-primary">
            {label}
          </span>
        )}
      </div>

      {/* 합이 100이라는 보장이 없다. 실제 합으로 나눠 폭을 낸다.
          합이 0이면 균등 8칸을 그리는 대신 막대를 통째로 뺀다 — 균등 막대는
          "모든 연령대가 고르게 있다"는 없는 사실을 그린다. */}
      {total > 0 && (
        <>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full">
            {composition.ageRates.map((value, index) => (
              <span
                key={AGE_LABELS[index]}
                data-age={AGE_LABELS[index]}
                style={{ width: `${(value / total) * 100}%` }}
                className={AGE_CLASS[index]}
              />
            ))}
          </div>

          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-label-sm text-on-surface-variant">
            {composition.ageRates.map((value, index) =>
              value >= LABEL_THRESHOLD ? (
                <span key={AGE_LABELS[index]}>
                  <b className="font-semibold text-on-surface">{AGE_LABELS[index]}</b>{' '}
                  {Math.round(value)}%
                </span>
              ) : null,
            )}
          </p>
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/components/home/PopulationCard.test.tsx`
Expected: PASS (5개)

- [ ] **Step 5: 변이 확인**

`value >= LABEL_THRESHOLD ? ... : null`을 항상 그리게 바꾼다 → "비중이 큰 연령대만 라벨로 적는다"가 실패해야 한다. 되돌린다.

- [ ] **Step 6: 커밋**

```bash
git add src/components/home/PopulationCard.tsx src/components/home/PopulationCard.test.tsx
git commit -m "feat: 인구 구성 카드 추가"
```

---

## Task 8: `AreaDetail` — 액션 행과 인구 구성

**Files:**
- Modify: `src/components/home/AreaDetail.tsx`, `src/components/home/AreaDetail.test.tsx`

**Interfaces:**
- Consumes: `PopulationCard` (Task 7), 기존 `ActionButtons`·`ForecastChart`·`cityinfo/*`
- Produces: 같은 컴포넌트. 별 아이콘이 액션 행의 「저장」 버튼이 된다

- [ ] **Step 1: 실패 테스트를 더한다**

`AreaDetail.test.tsx`에 추가한다. `SNAPSHOT` 상수에 `composition`을 넣어야 컴파일된다.

```tsx
// 파일 위 SNAPSHOT에 추가:
//   composition: { maleRate: 48, femaleRate: 52, nonResidentRate: 71,
//                  ageRates: [3, 8, 31, 22, 14, 11, 6, 4] },

it('저장 버튼이 즐겨찾기를 토글한다', async () => {
  renderDetail()
  await userEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(await screen.findByRole('button', { name: '저장됨' })).toBeInTheDocument()
})

it('인구 구성이 있으면 보여준다', () => {
  renderDetail()
  expect(screen.getByText('지금 누가 있나')).toBeInTheDocument()
  expect(screen.getByText('외지인이 많아요')).toBeInTheDocument()
})

it('인구 구성이 없으면 그 섹션만 빠지고 혼잡도는 남는다', () => {
  useAreaSnapshot.mockReturnValue(ok({ ...SNAPSHOT, composition: null }))
  renderDetail()
  expect(screen.queryByText('지금 누가 있나')).toBeNull()
  expect(screen.getByText(/지금은 약간 붐빔/)).toBeInTheDocument()
})
```

기존 테스트 중 `'즐겨찾기에 추가'`·`'즐겨찾기에서 빼기'`를 쓰는 것은 `'저장'`·`'저장됨'`으로 고친다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/components/home/AreaDetail.test.tsx`
Expected: FAIL — `저장` 버튼이 없고 `지금 누가 있나`가 없다

- [ ] **Step 3: 액션 행을 만든다**

`AreaDetail.tsx`의 헤더에서 별 버튼을 빼고, `ActionButtons` 옆에 저장을 넣는다. 「목록으로」는 남긴다.

```tsx
const header = (
  <button
    type="button"
    onClick={onBack}
    className="flex min-h-12 items-center gap-1 text-label-md font-semibold text-primary"
  >
    <Icon name="back" className="size-4" />
    목록으로
  </button>
)
```

`ActionButtons` 자리 바로 아래(또는 같은 줄)에 저장 버튼을 둔다. Google Maps의 Directions·Save·Share 자리다.

```tsx
<button
  type="button"
  aria-pressed={starred}
  onClick={() => toggle(areaName)}
  className={`flex min-h-12 flex-1 items-center justify-center gap-1 rounded-full border text-label-md font-semibold ${
    starred
      ? 'border-secondary-container bg-secondary-container text-primary'
      : 'border-outline-variant text-primary'
  }`}
>
  <Icon name={starred ? 'starFilled' : 'star'} className="size-4" />
  {starred ? '저장됨' : '저장'}
</button>
```

- [ ] **Step 4: 히어로를 Google Maps 장소 카드 순서로 만든다**

지금은 `<h2>{entry.name}</h2>` 한 줄뿐이다. 설계 §2.6의 1번 항목에 맞춰 카테고리·거리·도보 시간을 붙이고 혼잡도 배지를 오른쪽에 둔다.

```tsx
import { formatDistance } from '../../domain/distance'
import { CATEGORY_LABEL } from '../../domain/types'
import { haversineMeters } from '../../domain/distance'

// 도보 4km/h 기준. AreaListItem의 "800m · 도보 12분"과 같은 환산이다.
const WALK_METERS_PER_MINUTE = 67

// ...컴포넌트 안, entry가 확정된 뒤...
const distanceMeters =
  location.coords === null ? null : haversineMeters(location.coords, entry)

// ...JSX, 헤더 바로 아래...
<div className="flex items-start justify-between gap-3 px-4">
  <div className="min-w-0">
    <h2 className="truncate text-headline-md text-on-surface">{entry.name}</h2>
    <p className="mt-0.5 text-label-sm text-on-surface-variant">
      {CATEGORY_LABEL[entry.category]}
      {distanceMeters !== null &&
        ` · ${formatDistance(distanceMeters)} · 도보 ${Math.max(1, Math.round(distanceMeters / WALK_METERS_PER_MINUTE))}분`}
    </p>
  </div>
  {snapshot !== undefined && <CongestionBadge level={snapshot.congestion} />}
</div>
```

- [ ] **Step 5: 예측 섹션 이름을 「시간대별 예상」으로 바꾼다**

설계 §2.7이 Google Maps의 「인기 시간대」 자리로 규정한 섹션이다. 지금 제목이 "시간별 예측"인데 "예측"은 시스템 용어에 가깝다.

```tsx
<h3 className="text-headline-sm text-on-surface">시간대별 예상</h3>
```

이 문구를 단언하는 테스트를 더한다.

```tsx
it('예측 섹션 제목이 시간대별 예상이다', () => {
  renderDetail()
  expect(screen.getByRole('heading', { name: '시간대별 예상' })).toBeInTheDocument()
})
```

- [ ] **Step 6: 인구 구성 섹션을 넣는다**

「시간대별 예상」 바로 다음, 접이식 도시 정보 앞이다.

```tsx
{snapshot?.composition != null && (
  <div className="mx-4">
    <PopulationCard composition={snapshot.composition} />
  </div>
)}
```

- [ ] **Step 7: 통과를 확인한다**

Run: `npm test` 그리고 `npx tsc -b`
Expected: 전부 PASS

- [ ] **Step 8: 변이 확인**

접이식 지연 조회가 아직 사는지 다시 확인한다. `useCityInfo(cityInfoOpen ? areaName : undefined)`를 `useCityInfo(areaName)`으로 바꾼다 → "도시 정보는 접힌 채로 시작하고 조회하지 않는다"가 실패해야 한다. 되돌린다.

- [ ] **Step 9: 커밋**

```bash
git add -A src/components/home
git commit -m "feat: 상세에 액션 행과 인구 구성을 더한다"
```

---

## Task 9: `HomeScreen` — 지도 배경 + 오버레이 시트

**Files:**
- Modify: `src/screens/HomeScreen.tsx`, `src/screens/HomeScreen.test.tsx`
- Modify: `src/components/home/SearchBar.tsx`, `src/components/map/RecenterButton.tsx`
- Modify: `src/screens/TodayScreen.tsx`
- Delete: `src/components/home/SplitPane.tsx`, `src/components/home/SplitPane.test.tsx`

**Interfaces:**
- Consumes: `BottomSheet`(T3), `SummaryStrip`(T5), `FilterChips`(T6), `AreaDetail`(T8), `TodayScreen`
- Produces: `function HomeScreen(): JSX.Element` — `focusArea` prop이 없어진다

시트 안 내용이 셋으로 갈린다: 목록 / 상세 / 오늘의 서울.

### Task 3 리뷰에서 이월된 결정 사항 세 가지

`BottomSheet`를 만들며 나왔지만 화면을 조립할 때라야 판단할 수 있어 여기로 미룬 것들이다. **Step 1을 시작하기 전에 셋 다 결론을 내라.**

**(A) 손잡이가 보조기술로는 조작 불가다.** `role="separator"`에 `tabindex`가 없으면 ARIA상 위젯이 아니라 구조적 구분선이다. TalkBack/VoiceOver는 "시트 높이 조절, 구분선"이라 읽고 실행 동작을 주지 않는다. 남은 `onDoubleClick`도 TalkBack의 두 번 탭이 `dblclick`이 아니라 `click`을 쏘므로 닿지 않는다. 결과적으로 **보조기술 사용자는 시트 단계를 바꿀 수단이 전혀 없다.** 명소를 누르면 `full`로 올라가니 내용에는 닿지만 되돌릴 길이 없다.

싼 보완은 손잡이를 포커스 가능한 `button`으로 바꾸고 `onClick`으로 peek→half→full을 순환시키는 것이다. 한 손 조작 사용자에게도 이득이다. 주의할 것 둘: (1) 드래그 뒤에도 `click`이 뒤따라 발생하므로 `movedRef`류의 가드가 필요하다, (2) `BottomSheet.test.tsx`의 `getByRole('separator')`를 쓰는 테스트가 여럿이라 함께 고쳐야 한다. `role="separator"`를 유지한 채 포커스만 주려면 `aria-valuenow`/`min`/`max`가 따라와야 하므로 `button`이 더 정직하다 — 이 컴포넌트에는 splitter가 가르는 "두 pane"이 애초에 없다(`SplitPane`에는 있었다).

**(B) `transition-[height]`가 스크롤 위치를 버린다.** 시트가 줄면 스크롤 컨테이너가 줄고 브라우저가 `scrollTop`을 잘라내는데, 다시 커져도 복원하지 않는다. **full에서 상세를 읽다가 peek으로 내렸다 올리면 읽던 자리를 잃는다.** 또 `height` 애니메이션은 매 프레임 리플로우라 저사양 안드로이드 웹뷰에서 200ms 동안 목록 전체가 재배치된다. Google Maps는 이 지점에서 고정 높이 + `transform: translateY`를 쓴다. 상세를 시트에 올리는 게 이 태스크이므로 **바꾸려면 지금이 가장 싸다.**

**(C) `full`에서 손잡이가 `z-20` 오버레이 밑에 들어간다.** 아래 Step 3의 검색 바·필터 칩이 `z-20`이라 `z-10` 시트 위에 뜬다. 800px 기준 `full`(92%)에서 숫자는 이렇다:

| | y 좌표 |
|---|---|
| 시트 상단 | 64px |
| 손잡이 히트 영역 상단 | **44px** (Task 3 M6에서 위로 20px 확장) |
| 띠(보이는 부분) | 74~78px |
| 검색 바 + 필터 칩 열 | 0 ~ 약 88px |

즉 **겹친다.** `pointer-events-auto`가 걸린 부분이 손잡이를 덮으면 `full`에서 손잡이를 아예 못 잡는다. 실기기에서 숫자로 확인하고, 겹치면 `full`을 낮추든 검색 바를 `full`에서 숨기든 오버레이에 `pointer-events-none`을 깔고 자식에만 되돌리든 정해라.

**(D) 손잡이가 지도 위 20px을 삼킨다.** Task 3에서 히트 영역을 44px로 키우며 `touch-none` 상자가 시트 위로 20px 올라갔다. 그 띠에서는 마커 탭도 지도 팬도 안 먹는다. 의도한 교환이고 Google Maps도 같은 방식이지만, `peek`에서는 화면 84% 지점을 가로지르는 죽은 띠가 된다. 실기기에서 거슬리는지 보라.

**(E) 시트 루트에 `overflow-hidden`을 걸지 마라.** 걸면 (D)의 위쪽 20px 히트 영역이 조용히 잘린다. 시트 상단에 배경 있는 요소(요약 스트립, 상세 히어로)를 풀블리드로 넣어 `rounded-t-2xl` 모서리가 각져 보이면, 루트가 아니라 **그 요소 쪽에** 반경을 주거나 내용 래퍼에 `overflow-hidden`을 걸어라.

- [ ] **Step 1: 실패 테스트를 쓴다**

`HomeScreen.test.tsx`에 추가한다(기존 목업 설정은 그대로 두고, `focusArea` 테스트는 지운다).

```tsx
it('지도가 시트 뒤에 전체 크기로 깔린다', () => {
  render(<HomeScreen />)
  // 시트는 오버레이라 지도와 공간을 나눠 갖지 않는다.
  const map = screen.getByRole('region', { name: '지도' })
  expect(map.closest('[data-map-layer]')).not.toBeNull()
})

it('검색 바와 필터 칩이 지도 위에 뜬다', () => {
  render(<HomeScreen />)
  expect(screen.getByRole('searchbox').closest('[data-overlay]')).not.toBeNull()
  expect(screen.getByRole('tablist', { name: '필터' })).toBeInTheDocument()
})

it('명소를 누르면 시트가 full로 올라간다', async () => {
  render(<HomeScreen />)
  await userEvent.click(screen.getAllByRole('button', { name: /강남역/ })[0])
  expect(screen.getByRole('button', { name: '목록으로' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: '지도' })).toBeInTheDocument()
})

it('요약 스트립을 누르면 오늘의 서울이 열린다', async () => {
  render(<HomeScreen />)
  await userEvent.click(screen.getByRole('button', { name: /곳 중 붐빔/ }))
  expect(screen.getByRole('heading', { name: '지금 가장 붐비는 곳' })).toBeInTheDocument()
})

it('오늘의 서울에서 명소를 누르면 그 상세로 간다', async () => {
  render(<HomeScreen />)
  await userEvent.click(screen.getByRole('button', { name: /곳 중 붐빔/ }))
  const busiest = screen.getByRole('heading', { name: '지금 가장 붐비는 곳' })
    .parentElement as HTMLElement
  await userEvent.click(busiest.querySelectorAll('button')[0])
  expect(screen.getByRole('button', { name: '목록으로' })).toBeInTheDocument()
})

it('내 장소 칩이 즐겨찾기만 남긴다', async () => {
  localStorage.setItem('seoul-live:favorites', JSON.stringify(['경복궁']))
  render(<HomeScreen />)
  await userEvent.click(await screen.findByRole('tab', { name: /내 장소 1/ }))
  expect(screen.getAllByRole('button', { name: /경복궁/ }).length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: /강남역/ })).toBeNull()
})

it('지도 키가 없어도 목록과 검색이 동작한다', async () => {
  isMapAvailable.mockReturnValue(false)
  render(<HomeScreen />)
  expect(screen.queryByRole('region', { name: '지도' })).toBeNull()
  expect(screen.getAllByRole('button', { name: /강남역/ }).length).toBeGreaterThan(0)
  await userEvent.type(screen.getByRole('searchbox'), '경복궁')
  expect(screen.queryByRole('button', { name: /강남역/ })).toBeNull()
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/screens/HomeScreen.test.tsx`
Expected: FAIL — `data-map-layer`가 없고 요약 스트립이 없다

- [ ] **Step 3: `SearchBar`에서 「내 주변」을 뺀다**

「내 주변」은 FAB으로 합친다. `SearchBar`는 검색만 한다.

```tsx
interface Props {
  readonly value: string
  readonly onChange: (next: string) => void
}
```

`onRecenter`·`canRecenter`와 그 버튼 JSX를 지운다. `SearchBar.test.tsx`에서 「내 주변」 관련 테스트 셋도 지운다.

- [ ] **Step 4: `RecenterButton`의 위치를 시트에 맞춘다**

`raised` 불리언 대신 시트 단계를 받는다.

```tsx
import type { Detent } from '../../domain/sheet'

interface Props {
  readonly disabled: boolean
  readonly detent: Detent
  readonly onClick: () => void
}

// 시트가 올라오면 함께 올라간다. 안 그러면 시트가 이 버튼을 덮는다.
const BOTTOM_CLASS: Readonly<Record<Detent, string>> = {
  peek: 'bottom-[18%]',
  half: 'bottom-[48%]',
  full: 'bottom-[94%]',
}
```

`className`의 `${raised ? 'bottom-64' : 'bottom-28'}`를 `${BOTTOM_CLASS[detent]}`로 바꾸고, `aria-label`을 `'내 위치로 이동'`에서 `'내 주변'`으로 바꾼다(「내 주변」 버튼을 흡수했으므로). `RecenterButton.test.tsx`도 함께 고친다.

- [ ] **Step 5: `TodayScreen`을 시트 안 뷰로 바꾼다**

바깥 여백(`px-4`)은 시트가 이미 준다. `TodayScreen`의 최상위 `div`에서 좌우 패딩을 걷어내고, 각 섹션의 `mx-4`도 뺀다. props는 그대로(`onSelectArea`).

- [ ] **Step 6: `HomeScreen`을 재작성한다**

```tsx
export function HomeScreen() {
  const snapshots = useAreaSnapshots(AREA_NAMES)
  const location = useLocation()
  const filters = useHomeFilters()
  const { favorites } = useFavorites()
  const alerts = useCachedCityAlerts()

  const [center, setCenter] = useState<Coords>(SEOUL_CENTER)
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM)
  const [loadFailed, setLoadFailed] = useState(false)
  const [detent, setDetent] = useState<Detent>('half')
  const [view, setView] = useState<'list' | 'today'>('list')

  const { setSelectedName, setSort } = filters

  const list = useMemo(
    () =>
      buildNearbyList({
        entries: AREA_CATALOG,
        snapshots: snapshots.data ?? [],
        coords: location.coords,
        category: filters.category,
        sort: filters.sort,
      }),
    [snapshots.data, location.coords, filters.category, filters.sort],
  )

  // 개수는 걸러지기 전 목록으로 센다. 걸러진 목록으로 세면 칩 하나를 고르는
  // 순간 나머지가 0이 되어 비활성으로 굳는다.
  const counts = { ...presetCounts(list), fav: favorites.length }

  const chosen = filters.filter
  const filtered =
    chosen === 'fav'
      ? list.filter((area) => favorites.includes(area.entry.name))
      : filterByPreset(list, chosen)
  const visible = searchAreas(filtered, filters.query)
  const markers = snapshots.isPending ? [] : toMapMarkers(visible)

  function openArea(name: string): void {
    setSelectedName(name)
    setView('list')
    setDetent('full')
  }

  function handleCameraChanged(event: MapCameraChangedEvent): void {
    setCenter(event.detail.center)
    setZoom(event.detail.zoom)
  }

  // 「내 주변」 버튼을 흡수했다. 지도를 내 위치로 옮기고 목록을 거리순으로 바꾼다.
  function handleRecenter(): void {
    if (location.coords === null) return
    setCenter(location.coords)
    setZoom(RECENTER_ZOOM)
    setSort('distance')
    setDetent('peek')
  }

  const mapReady = isMapAvailable() && !loadFailed

  const mapPane = !isMapAvailable() ? (
    <MapUnavailableNotice reason="no-key" />
  ) : loadFailed ? (
    // 스크립트를 못 받은 경우다(오프라인·차단·잘못된 키). 키 미설정과 문구를
    // 나눠야 개발자와 사용자가 각각 맞는 곳을 의심한다.
    <MapUnavailableNotice reason="load-failed" />
  ) : (
    <APIProvider
      apiKey={googleMapsApiKey()}
      onError={(error) => {
        console.error('지도 스크립트를 불러오지 못했습니다:', error)
        setLoadFailed(true)
      }}
    >
      <Map
        mapId={googleMapsMapId()}
        center={center}
        zoom={zoom}
        onCameraChanged={handleCameraChanged}
        reuseMaps
        gestureHandling="greedy"
        disableDefaultUI
        className="size-full"
      >
        {location.coords !== null && (
          <AdvancedMarker position={location.coords}>
            <span
              role="img"
              aria-label="현재 위치"
              className="block size-4 rounded-full border-2 border-white bg-primary shadow-floating"
            />
          </AdvancedMarker>
        )}

        {markers.map((marker) => (
          <AdvancedMarker
            key={marker.entry.code}
            position={{ lat: marker.entry.lat, lng: marker.entry.lng }}
            onClick={() => openArea(marker.entry.name)}
          >
            <CongestionMarker
              name={marker.entry.name}
              level={marker.level}
              showLabel={shouldShowMarkerLabel(zoom)}
              selected={marker.entry.name === filters.selectedName}
            />
          </AdvancedMarker>
        ))}
      </Map>
    </APIProvider>
  )

  const listPane = (
    <>
      <SummaryStrip
        summary={summarize(list)}
        alertCount={alerts.length}
        onOpen={() => {
          setView('today')
          setDetent('full')
        }}
      />

      <LocationNotice status={location.status} onRetry={location.retry} />

      <div className="mt-3">
        <SortSegmented
          value={filters.sort}
          canSortByDistance={location.coords !== null}
          onChange={setSort}
        />
      </div>

      <CategoryFilter value={filters.category} onChange={filters.setCategory} />

      {snapshots.isPending && <SkeletonList count={6} />}

      {snapshots.isError && (
        <ErrorState
          message="혼잡도 정보를 가져오지 못했어요."
          onRetry={() => void snapshots.refetch()}
        />
      )}

      {!snapshots.isPending && visible.length === 0 && (
        <p className="py-10 text-center text-body-md text-on-surface-variant">
          {filters.query === ''
            ? '조건에 맞는 명소가 없어요.'
            : `「${filters.query}」에 해당하는 명소가 없어요.`}
        </p>
      )}

      {visible.map((area) => (
        <AreaListItem
          key={area.entry.code}
          area={area}
          favorite={favorites.includes(area.entry.name)}
          onSelect={openArea}
        />
      ))}
    </>
  )

  // 시트 내용은 셋 중 하나다.
  const sheetContent =
    filters.selectedName !== null ? (
      <AreaDetail
        areaName={filters.selectedName}
        onBack={() => {
          setSelectedName(null)
          setDetent('half')
        }}
        onSelectArea={openArea}
      />
    ) : view === 'today' ? (
      <TodayScreen
        onSelectArea={openArea}
        onBack={() => {
          setView('list')
          setDetent('half')
        }}
      />
    ) : (
      listPane
    )

  return (
    <div className="relative size-full overflow-hidden">
      <div data-map-layer className="absolute inset-0">
        {mapPane}
      </div>

      <div
        data-overlay
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-1"
      >
        <div className="pointer-events-auto">
          <SearchBar value={filters.query} onChange={filters.setQuery} />
        </div>
        <FilterChips
          counts={counts}
          value={filters.filter}
          onChange={filters.setFilter}
        />
      </div>

      <RecenterButton
        disabled={location.coords === null}
        detent={detent}
        onClick={handleRecenter}
      />

      {/* 키가 없으면 시트를 half로 고정한다. 지도 안내가 화면의 92%를
          차지할 이유가 없고, 접을 수 있게 두면 안내가 사라져 더 헷갈린다. */}
      <BottomSheet
        detent={mapReady ? detent : 'half'}
        onDetentChange={mapReady ? setDetent : () => {}}
      >
        {sheetContent}
      </BottomSheet>
    </div>
  )
}
```

`TodayScreen`에 `onBack`을 더한다 — 오늘의 서울에서 목록으로 돌아갈 길이 있어야 한다.

```tsx
// src/screens/TodayScreen.tsx
interface Props {
  readonly onSelectArea: (name: string) => void
  readonly onBack: () => void
}

// ...최상단에...
<button
  type="button"
  onClick={onBack}
  className="flex min-h-12 items-center gap-1 text-label-md font-semibold text-primary"
>
  <Icon name="back" className="size-4" />
  목록으로
</button>
```

`TodayScreen.test.tsx`의 모든 `render(<TodayScreen onSelectArea={...} />)`에 `onBack={() => {}}`를 더한다.

- [ ] **Step 7: `SplitPane`을 지운다**

```bash
git rm src/components/home/SplitPane.tsx src/components/home/SplitPane.test.tsx
```

- [ ] **Step 8: 통과를 확인한다**

Run: `npm test` 그리고 `npx tsc -b`
Expected: 전부 PASS

- [ ] **Step 9: 변이 확인**

`counts`를 걸러진 목록으로 세게 바꾼다(`presetCounts(visible)`) → "프리셋 개수는 걸러진 목록이 아니라 전체로 센다"가 실패해야 한다. 되돌린다.

- [ ] **Step 10: 커밋**

```bash
git add -A src
git commit -m "feat: 지도를 전체 배경으로 깔고 오버레이 시트로 전환"
```

---

## Task 10: 탭바 제거와 App 단순화

**Files:**
- Modify: `src/App.tsx`, `src/App.test.tsx`
- Delete: `src/components/layout/BottomTabBar.tsx`, `src/screens/FavoritesScreen.tsx`, `src/screens/FavoritesScreen.test.tsx`

- [ ] **Step 1: 실패 테스트를 쓴다**

`App.test.tsx`를 고친다.

```tsx
it('탭바가 없다', () => {
  render(<App />)
  expect(screen.queryByRole('button', { name: '즐겨찾기' })).toBeNull()
  expect(screen.queryByRole('button', { name: '더보기' })).toBeNull()
})

it('첫 화면이 지도다', async () => {
  render(<App />)
  expect(await screen.findByRole('region', { name: '지도' })).toBeInTheDocument()
})

it('별을 저장하면 내 장소 칩에 잡힌다', async () => {
  render(<App />)
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: /광화문·덕수궁/ }).length).toBeGreaterThan(0),
  )
  await userEvent.click(screen.getAllByRole('button', { name: /광화문·덕수궁/ })[0])
  await userEvent.click(screen.getByRole('button', { name: '저장' }))
  await userEvent.click(screen.getByRole('button', { name: '목록으로' }))
  expect(await screen.findByRole('tab', { name: /내 장소 1/ })).toBeInTheDocument()
})
```

탭 전환·`focusArea` 관련 기존 테스트는 지운다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — 탭바가 아직 있다

- [ ] **Step 3: `App.tsx`를 단순화한다**

```tsx
import { LocationProvider } from './app/LocationProvider'
import { QueryProvider } from './app/QueryProvider'
import { TopAppBar } from './components/layout/TopAppBar'
import { HomeScreen } from './screens/HomeScreen'

// 화면이 하나다. 즐겨찾기는 필터 칩이고 오늘의 서울은 시트 안 뷰라서
// 탭으로 갈 곳이 없다 — 설계 §2.2.
function AppShell() {
  return (
    <div className="flex h-dvh flex-col bg-surface">
      <TopAppBar title="Seoul Live" />
      <main className="min-h-0 flex-1">
        <HomeScreen />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <QueryProvider>
      <LocationProvider>
        <AppShell />
      </LocationProvider>
    </QueryProvider>
  )
}
```

- [ ] **Step 4: 옛 파일을 지운다**

```bash
git rm src/components/layout/BottomTabBar.tsx
git rm src/screens/FavoritesScreen.tsx src/screens/FavoritesScreen.test.tsx
```

`src/components/layout/`에 `TopAppBar`만 남는지 확인한다.

`HomeScreen`의 높이 계산도 고친다 — 탭바가 없어졌으므로 `h-dvh`에서 상단바(3.5rem)만 빼면 된다.

- [ ] **Step 5: 통과를 확인한다**

Run: `npm test`, `npx tsc -b`, `npm run lint`, `npm run build:vite`
Expected: 전부 PASS

- [ ] **Step 6: 실제로 띄워 본다**

Run: `npm run dev`

브라우저에서 확인할 것:

1. 지도가 화면을 꽉 채우고 시트가 그 위에 떠 있다
2. 손잡이를 끌면 peek / half / full로 스냅된다
3. 검색 바와 필터 칩이 지도 위에 떠 있다
4. 명소를 누르면 시트가 full로 올라가고 **지도는 뒤에 남는다**
5. 상세에 「지금 누가 있나」가 뜬다 (목업 인구 구성)
6. 「저장」을 누르면 「★ 내 장소」 칩 개수가 는다
7. 요약 스트립을 누르면 오늘의 서울이 열린다
8. 하단 탭바가 없다
9. **콘솔에 에러가 없다**

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat: 하단 탭바를 없애고 단일 화면으로 전환"
```

---

## Task 11: 문서 갱신

**Files:**
- Modify: `README.md`, `PLAN.md`, `STATE.md`, `AGENTS.md`

- [ ] **Step 1: `README.md`**

화면 표를 셋에서 **하나**로 고친다.

```markdown
화면은 하나다. 지도가 전부다.

| 영역 | 내용 |
| --- | --- |
| **지도** | 화면 전체. 혼잡도 마커 + 떠 있는 검색 바와 필터 칩(★ 내 장소 / 아이와 나들이 / 데이트 / 지금 핫플) |
| **바텀시트** | 손잡이로 3단 조절. 목록 → 명소 상세 → 오늘의 서울 |
| **명소 상세** | 예측 차트, 경로·저장·공유, 인구 구성(성별·연령·상주비율), 접이식 도시 정보 |
```

「구조」 절의 `src/screens/`를 `HomeScreen` 하나로 고친다.

- [ ] **Step 2: `PLAN.md`**

- 1차 절의 탭 서술을 "2026-08-10 개편으로 단일 화면이 됐다"로 정정
- 2차 즐겨찾기 항목에 "탭이 아니라 필터 칩"을 적는다
- 3차에 **인구 구성이 추가 호출 없이 붙었다**를 적고, 미착수 항목에서 도로소통·사고통제만 남긴다

- [ ] **Step 3: `STATE.md`**

- 「한 줄 요약」을 단일 화면 구조로
- 「파일 구조」를 새 디렉터리로 (`sheet.ts`·`composition.ts`·`compositionSchema.ts` 추가, `split.ts`·`SplitPane`·`FavoritesScreen`·`BottomTabBar`·`PresetFilter` 삭제)
- 「검증 수치」 갱신
- **새 미해결 항목**: 시트 드래그와 지도 팬 제스처 충돌, 시트 내용 스크롤과 시트 드래그 충돌, 인구 구성 필드의 실제 형태
- **해소된 항목**: 별 아이콘 채움 상태 미검증(라벨 있는 「저장」 버튼이 되면서 사라짐)
- 「진행하며 실제로 잡은 문제」에 이번 개편 표를 더한다

- [ ] **Step 4: `AGENTS.md`**

- 레이어 규칙의 화면 목록을 `HomeScreen` 하나로
- 바텀시트 조항을 갱신: **시트가 다시 생겼다.** "진입하자마자 자동으로 나타나지 않아요"는 여전히 유효하고, 우리 시트는 half로 시작하지만 사용자 조작 없이 뜬 것이 아니라 **화면 자체의 일부**다. 심사에서 지적되면 peek으로 시작하는 것이 대안이다
- **새 조항**: 인구 구성은 `compositionSchema.ts`에서 관대하게 파싱한다. `schema.ts`의 엄격한 `areaSchema`에 얹지 마라 — 비율 하나가 이상할 때 혼잡도까지 날아간다

- [ ] **Step 5: 커밋**

```bash
git add README.md PLAN.md STATE.md AGENTS.md
git commit -m "docs: Google Maps 스타일 셸 개편을 문서에 반영"
```

---

## 완료 기준

- [ ] `npm test` 통과, 커버리지 임계(라인·구문·함수 80%, 브랜치 75%) 유지
- [ ] `npx tsc -b` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run build:vite` 통과
- [ ] `npm run dev`로 띄워 Task 10 Step 6의 아홉 항목을 눈으로 확인
- [ ] 콘솔 에러 0건
- [ ] **인구 구성 필드를 목업에서 지워도 혼잡도 화면이 그대로 선다** (설계 §2.6의 핵심 안전망)
