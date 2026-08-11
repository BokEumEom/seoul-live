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
| `src/components/list/AreaList.tsx` | 구분선 목록 컨테이너. 행 간격 계약을 소유한다 (Task 4) |
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
- Consumes: `PRESETS`, `PresetKey`
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

`HomeScreen.tsx`가 `PresetFilter`를 쓰고 있다. Task 9에서 전면 재작성하지만 그때까지 빌드가 서야 하므로 `FilterChips`로 갈아 끼우고 `useFavorites`를 `HomeScreen`에서 부른다.

- [ ] **Step 7: 개수와 필터를 도메인 함수 하나로 모은다**

> **실행 중 정정.** 이 자리에 원래 적혀 있던 `const counts = { ...presetCounts(list), fav: favorites.length }`와 `filters.filter === 'fav' ? list.filter(...) : filterByPreset(list, ...)`는 **틀렸다.** `list`는 이미 카테고리로 걸러진 목록이라, 「공원」을 고르면 `favorites.length`가 공원이 아닌 즐겨찾기까지 세서 **칩에 2, 목록에 0**이 뜬다. `presetCounts`가 `filterByPreset`을 그대로 불러 지키던 "개수와 필터가 같은 술어를 쓴다"는 구조적 보장이 `fav`에만 없었던 것이다.

`src/domain/presets.ts`에서 `presetCounts`를 지우고 둘로 대체한다. `filterCounts`는 반드시 `filterAreas`를 **불러서** 세라 — 로직을 복사하면 보장이 사라진다.

```ts
export function filterAreas(
  areas: readonly NearbyArea[],
  filter: FilterKey | null,
  favorites: readonly string[],
): readonly NearbyArea[]

export function filterCounts(
  areas: readonly NearbyArea[],
  favorites: readonly string[],
): Readonly<Record<FilterKey, number>>
```

`HomeScreen`에서는 이렇게 쓴다. `filterAreas`가 `FilterKey | null`을 받으므로 `'fav'` 타입 좁히기 문제가 아예 생기지 않는다.

```tsx
const counts = useMemo(() => filterCounts(list, favorites), [list, favorites])
const visible = useMemo(
  () => searchAreas(filterAreas(list, filters.filter, favorites), filters.query),
  [list, filters.filter, favorites, filters.query],
)
```

도메인 테스트로 보장을 잠가라: **모든 `FilterKey`에 대해 `filterCounts(...)[key] === filterAreas(..., key, ...).length`.**

- [x] **Step 8: 통과를 확인한다**

`npm test`(55파일 597통과 · 1 todo), `npx tsc -b`, `npm run lint`, `npm run build:vite` 전부 통과.

- [x] **Step 9: 변이 확인**

`FilterChips`의 `disabled={count === 0}`을 지운다 → "0이면 비활성이다"와 "비활성인 칩을 눌러도"가 실패해야 한다. 되돌린다.

- [x] **Step 10: 커밋**

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

  it('읽지 못해 전부 0이면 아무것도 그리지 않는다', () => {
    // 키는 왔는데 내용이 쓰레기인 경우다. 0을 사실처럼 그리면 없는 인구를
    // 지어낸다 — 균등 8칸 막대는 "연령대가 고르다"는 없는 사실까지 그린다.
    //
    // 제목만 남기지 않는다. 사용자에게 「키는 왔는데 쓰레기」와 「키가 안 왔다」는
    // 구분할 이유가 없는 같은 상태(= 알 수 있는 게 없다)다. 구분이 필요한 건
    // 개발자이고 그건 화면이 아니라 로그·스키마의 일이다.
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
    expect(container).toBeEmptyDOMElement()
  })
})
```

**섹션을 그릴지 말지는 이 카드가 정한다.** `Task 8`은 `composition != null`만 알고, 「읽을 수 있는 값이 하나라도 있나」는 칸마다 `> 0`을 보는 이 카드만 아는 규칙이다. 그 술어를 상세 화면에 복사하면 판정이 두 곳으로 갈라진다. `residentLabel`이 값 하나에 적용한 규칙을 구성 전체로 넓힌 것이므로 도메인에 둔다:

```ts
// src/domain/composition.ts
/** 성별은 둘 다 읽혀야 쓸 수 있다. 한쪽만 읽고 나머지를 0%라고 적으면 못 읽은
 *  값을 사실로 단정하는 것이다 — 「남 100% · 여 0%」가 그 결과다. */
export function hasGenderSplit(c: PopulationComposition): boolean {
  return c.maleRate > 0 && c.femaleRate > 0
}

/** 읽을 수 있는 값이 하나도 없으면 false. 0은 "못 읽음"일 수 있어(compositionSchema.ts의
 *  rate()) 전부 0인 구성으로는 아무 말도 할 수 없다. residentLabel과 같은 규칙이다.
 *
 *  성별을 `maleRate > 0 || femaleRate > 0`으로 세면 안 된다. 카드가 성별을
 *  `&&`로 그리므로, (남 48 / 여 0 / 비상주 0 / 연령 전부 0)이면 술어는 true인데
 *  그릴 것은 하나도 없어 제목만 뜨는 빈 카드가 남는다 — 이 함수가 없애려던
 *  바로 그 상태다. 두 곳이 같은 규칙을 써야 한다. */
export function hasReadableComposition(c: PopulationComposition): boolean {
  return (
    hasGenderSplit(c) ||
    c.nonResidentRate > 0 ||
    c.ageRates.some((rate) => rate > 0)
  )
}
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

      {/* 합이 100이라는 보장이 없다. 그렇다고 실제 합으로 나누면 안 된다 —
          절반을 못 읽었을 때 남은 두 칸이 각각 50%로 부풀어 "이 둘이 전부"라는
          없는 분포를 그리고, 바로 아래 글자(25%, 25%)와 모순된다.

          Math.max(total, 100)이면 둘 다 맞는다. 합이 99면 눈에 안 보이는 1%
          여백만 남고, 절반을 못 읽었으면 그 빈자리가 정직하게 남는다.

          합이 0이면 막대를 통째로 뺀다 — 균등 8칸은 "연령대가 고르게 있다"는
          없는 사실을 그린다. */}
      {total > 0 && (
        <>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full">
            {composition.ageRates.map((value, index) => (
              <span
                key={AGE_LABELS[index]}
                style={{ width: `${(value / Math.max(total, 100)) * 100}%` }}
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
Expected: PASS (7개)

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
- Consumes: `PopulationCard` (Task 7), `AreaList` (Task 4), 기존 `ActionButtons`·`ForecastChart`·`cityinfo/*`
- Produces: 같은 컴포넌트. 별 아이콘이 액션 행의 「저장」 버튼이 된다

「근처 쾌적한 장소」의 `AreaListItem` 목록은 이미 Task 4에서 `AreaList`로 감싸 뒀다. 이 태스크에서 그 절을 옮기거나 다시 쓸 일이 있으면 `AreaList`를 유지해라 — 행 간격 계약을 그 컴포넌트가 소유한다.

### Task 7 리뷰에서 이월된 것 둘

**(A) 인구 구성이 폴드 아래로 밀릴 수 있다.** 리뷰어가 HEAD의 `AreaDetail`을 390px 폭으로 실측했다 — 예측 섹션 바닥 y=596, 액션 행 바닥 y=716. 아래 Step 6대로 예측 **다음에** 넣으면 카드가 대략 y=608~735를 차지한다. 시트 `full`은 뷰포트의 92%이므로:

| 기기 | 가용 높이 | 결과 |
|---|---|---|
| iPhone 14급(844px) | 약 730~750px | 간신히 걸치거나 아래 절반이 잘린다 |
| 720~740px급 안드로이드 | 약 640px | **제목만 보이고 막대는 폴드 아래** |

Step 4에서 히어로에 카테고리·거리·도보를 더하면 20~30px 더 내려간다. 이 카드는 **「인파레이더 대신 쓸 이유」를 만드는 자리**다 — 예측 섹션(262px)보다 **위로 올리는 것을 검토하라.** 올린다면 Step 6의 배치와 그 근거 주석을 함께 고쳐라.

**(B) 막대 색이 인접 칸끼리 겹쳐 눈에는 최대 여섯 칸이다.** `AGE_CLASS`의 index 2·3이 둘 다 `bg-primary`, 6·7이 둘 다 `bg-surface-container`라 붙어 있는 칸이 한 덩어리로 보인다. 의도(「20~30대를 진하게」)는 알겠으나, 아래 라벨의 `<b>`가 `text-on-surface`(검정)라 **막대의 어느 색이 어느 연령대인지 이어주는 단서가 없다.** 실기기로 보고 정하라 — 라벨의 `<b>`를 해당 칸 색으로 주거나, 막대를 「가장 많은 층이 어디쯤인가」만 보여주는 장식으로 명시하고 문서화하는 두 길이 있다.

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

**도보 시간을 여기서 계산하지 마라.** `src/domain/distance.ts:55`에 `walkingMinutes(meters)`가 이미 있고 테스트도 있으며 `RecommendationCard.tsx:31`이 쓰고 있다. 상수를 새로 박으면 하드코딩 금지 위반이자 도메인 중복이고, 두 곳의 환산이 조용히 갈린다.

```tsx
import { formatDistance, haversineMeters, walkingMinutes } from '../../domain/distance'
import { CATEGORY_LABEL } from '../../domain/types'

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
        ` · ${formatDistance(distanceMeters)} · 도보 ${walkingMinutes(distanceMeters)}분`}
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

> **실행 중 정정.** 「시간대별 예상 다음」이 아니라 **현재 상태 카드 안, 추정 인구 다음**이다. 이유 넷:
> 1. 예측(262px) 아래면 위 (A)의 실측대로 720~740px급에서 막대가 폴드 밖이다.
> 2. `PopulationCard`의 루트가 `mt-4 border-t pt-3`뿐이라 **배경도 좌우 패딩도 `mx-4`도 없다** — 카드 안 하위 블록으로 만들어져 있다. 루트 직계로 두면 테두리가 화면 폭 전체를 긋고 글자가 가장자리에 붙는다.
> 3. 카드 안이면 아래 「래퍼 `<div>`를 두지 마라」 문제가 아예 성립하지 않는다(카드는 혼잡도 때문에 어차피 렌더된다).
> 4. 「얼마나 붐비나 → 몇 명 → 누가 있나」로 한 카드가 한 이야기를 한다.
>
> **치르는 값(구현 뒤 실측으로 정정).** 액션 행까지 히어로 아래로 올리면서(설계 §2.6의 2번 자리) 예측이 더 밀렸다. 390px 헤드리스 크롬 실측:
>
> | | 저장 버튼 | 연령대 막대 | 예측 차트 |
> |---|---|---|---|
> | 개편 전 | y=869~917 | y=472~482 | y=592~736 |
> | 개편 후 | **y=182~230** | y=592~602 | y=712~856 |
>
> 저장은 599~687px 올라와 어느 기기에서도 폴드 위다(상승폭이 범위인 이유: `AREA_CONGEST_MSG` 길이와 「여유 예상」 팁 유무로 카드가 ±24px 흔들린다). 연령대 막대는 최악 조합(가장 긴 메시지 + 팁)에서도 640px 폴드 위에 38px 여유로 남는다.
>
> **잃은 것은 예측이다. 그리고 예상보다 크다** — 640px 가용 기기에서 「막대 하단이 잘린다」 정도가 아니라, 메시지가 긴 명소(경복궁 계열)에서는 **「시간대별 예상」 섹션 제목 자체가 y=672로 화면 밖**이라 절이 통째로 안 보인다. 짧은 명소(광화문 계열)라야 제목만 보이고 차트가 잘린다.
>
> 실기기에서 이게 아깝다고 판단되면 **손댈 지렛대는 액션 행이 아니라 예측 섹션(262px) 자체다** — 차트 높이를 줄이거나, 접이식으로 만들거나, 「지금부터 N시간」만 보여주는 축약형을 검토하라.

아래는 원래 계획했던 자리(「시간대별 예상」 다음, 접이식 도시 정보 앞)의 서술이다. 배치만 위로 옮기고 나머지 규칙은 그대로 적용된다.

**래퍼 `<div>`를 두지 마라.** `PopulationCard`는 `composition`이 non-null이어도 **읽을 수 있는 값이 하나도 없으면 `null`을 돌려준다**(Task 7의 `hasReadableComposition`). 래퍼가 있으면 카드가 사라져도 `<div class="mx-4">`가 플렉스 아이템으로 남아 `AreaDetail` 루트의 `gap-3`이 12px 빈 칸을 하나 더 만든다(실측: 빈 래퍼 있음 24px / 없음 12px). Task 7이 없앤 죽은 공간이 줄어든 채 살아남는다.

`mx-4`는 카드의 `<section>`으로 옮기거나 다른 절과 같은 방식으로 처리해라.

```tsx
{snapshot?.composition != null && (
  <PopulationCard composition={snapshot.composition} />
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

**목록은 `AreaList`로 감싼다**(Task 4에서 만들었다). 행이 아래 구분선으로 갈리므로 컨테이너가 간격을 주면 구분선이 허공에 뜬다 — 그 계약을 컨테이너 컴포넌트가 소유한다. `import { AreaList } from '../components/list/AreaList'`.

### Task 3 리뷰에서 이월된 결정 사항 — **전부 결론이 났다**

`BottomSheet`를 만들며 나왔지만 화면을 조립할 때라야 판단할 수 있어 여기로 미룬 것들이다. 아래 각 항목의 **결론** 단락이 실제로 한 것이다.

**(A) 손잡이가 보조기술로는 조작 불가다.** `role="separator"`에 `tabindex`가 없으면 ARIA상 위젯이 아니라 구조적 구분선이다. TalkBack/VoiceOver는 "시트 높이 조절, 구분선"이라 읽고 실행 동작을 주지 않는다. 남은 `onDoubleClick`도 TalkBack의 두 번 탭이 `dblclick`이 아니라 `click`을 쏘므로 닿지 않는다. 결과적으로 **보조기술 사용자는 시트 단계를 바꿀 수단이 전혀 없다.** 명소를 누르면 `full`로 올라가니 내용에는 닿지만 되돌릴 길이 없다.

싼 보완은 손잡이를 포커스 가능한 `button`으로 바꾸고 `onClick`으로 peek→half→full을 순환시키는 것이다. 한 손 조작 사용자에게도 이득이다. 주의할 것 둘: (1) 드래그 뒤에도 `click`이 뒤따라 발생하므로 `movedRef`류의 가드가 필요하다, (2) `BottomSheet.test.tsx`의 `getByRole('separator')`를 쓰는 테스트가 여럿이라 함께 고쳐야 한다. `role="separator"`를 유지한 채 포커스만 주려면 `aria-valuenow`/`min`/`max`가 따라와야 하므로 `button`이 더 정직하다 — 이 컴포넌트에는 splitter가 가르는 "두 pane"이 애초에 없다(`SplitPane`에는 있었다).

**결론(했다).** 손잡이가 `<button type="button">`이 됐고 누르면 `NEXT_DETENT`(peek→half→full→peek)로 한 칸씩 굴러간다. `onDoubleClick`은 지웠다 — 클릭 순환이 그 역할을 흡수한다.

- **클릭 가드는 `movedRef`로 안 된다.** `handlePointerUp`이 단계를 정하면서 그것을 되돌려 놓아, 뒤따라오는 `click`이 도착할 때는 이미 거짓이다. 별도의 `draggedRef`를 두고 **클릭 핸들러가 소비**한다. 그리고 소비에만 기대면 안 된다 — 드래그 뒤 `click`이 오지 않는 경로가 있으면 가드가 참으로 굳어 다음 탭 한 번이 통째로 먹힌다. `handlePointerDown`에서도 턴다. `handlePointerCancel`에서도 내린다.
- **`w-full`이 필수다.** `button`은 기본이 inline-block이라 히트 영역이 4px짜리 띠 폭으로 쪼그라든다. `div`였을 때는 공짜로 얻던 것이다. 테스트로 잠갔다.
- 접근성 이름은 현재 단계를 담는다: `시트 높이 조절, 현재 {살짝 열림|절반|전체}`. 누르면 무엇이 될지는 지금 몇 단계인지 알아야 예측되고, 스크린리더 사용자는 시트 높이를 볼 수 없다. **`HomeScreen.test.tsx`가 시트 단계를 관찰하는 수단도 이 이름이다** — 다른 수단이 없다.
- 이름이 바뀌었으므로 `getByRole('separator')`뿐 아니라 `toHaveAccessibleName('시트 높이 조절')`도 함께 고쳤다.

**(B) ~~`transition-[height]`가 스크롤 위치를 버린다.~~ — 틀린 주장이었다. 실측으로 정정한다.**

원래 적혀 있던 주장: "시트가 줄면 스크롤 컨테이너가 줄고 브라우저가 `scrollTop`을 잘라내는데, 다시 커져도 복원하지 않는다. full에서 상세를 읽다가 peek으로 내렸다 올리면 읽던 자리를 잃는다." 그래서 고정 높이 + `transform: translateY`로 바꾸자는 제안이 붙어 있었다.

**헤드리스 크롬(145)으로 실제로 쟀다.** 뷰포트 800px, 내용 3000px, 시트 구조·전환값(`transition: height 200ms ease-out`)을 지금 구현 그대로 재현하고 CDP로 몰았다. `--virtual-time-budget`은 CSS 전환 시계를 돌려주지 않아(높이가 92%에 멈춘 채 측정된다) 실시간으로 재야 하고, 매 단계 목표 높이에 닿았는지 확인해 전환이 실제로 끝난 것만 읽었다.

| 시나리오 | scrollTop | clientHeight | maxScrollTop |
|---|---|---|---|
| full에서 읽던 자리 | 300 | 712 | 2288 |
| → peek으로 내린 뒤 | **300** | 104 | 2896 |
| → 다시 full로 올린 뒤 | **300** | 712 | 2288 |

**보존된다.** 6단 왕복(full 1234px → half → peek → half → full → peek → full)에서도 1234가 그대로 남았다. 이유는 산수다: `maxScrollTop = scrollHeight - clientHeight`이므로 시트가 줄면 `clientHeight`가 **작아져** `maxScrollTop`이 **커진다** — 잘릴 일이 없다. 다시 커질 때 줄어드는 `maxScrollTop`도 원래 full에서 유효했던 값이라 여전히 유효하다.

잘리는 경우는 하나뿐이다: **peek 상태에서 스크롤을 직접 만졌을 때.** peek에서 끝까지 내리면 2896이 되고 full로 올리면 2288로 잘린다. 그건 끝 너머를 보여줄 수 없어서이므로 옳은 동작이다.

**제안됐던 `translateY` 대안이 오히려 더 나쁘다.** 높이를 92%로 고정하고 아래로 밀면 peek에서도 `clientHeight`가 712px(92%)로 남는데 눈에 보이는 창은 104px(16%)뿐이다. 끝까지 스크롤해도 `scrollTop`이 2288에서 멈춰 **608px어치 내용에 영원히 닿지 못한다**(실측값).

**결론: `transition-[height]`를 그대로 둔다.** 남은 논거는 "매 프레임 리플로우라 저사양 안드로이드 웹뷰에서 200ms 동안 목록 전체가 재배치된다"는 성능 쪽 하나뿐인데, **그건 실기기 없이 판단할 수 없다 — 미해결로 남긴다.**

**(C) `full`에서 손잡이가 `z-20` 오버레이 밑에 들어간다.** 아래 Step 3의 검색 바·필터 칩이 `z-20`이라 `z-10` 시트 위에 뜬다. 800px 기준 `full`(92%)에서 숫자는 이렇다:

| | y 좌표 |
|---|---|
| 시트 상단 | 64px |
| 손잡이 히트 영역 상단 | **44px** (Task 3 M6에서 위로 20px 확장) |
| 띠(보이는 부분) | 74~78px |
| 검색 바 + 필터 칩 열 | 0 ~ **112px** (Task 10 실측. 여기 적혔던 88px은 검색 바의 세로 패딩을 빠뜨린 오답이었다) |

즉 **겹친다.** 검색 바 컨테이너와 `FilterChips` 컨테이너 **둘 다** `pointer-events-auto`이고 폭이 화면 전체라, 손잡이 히트 영역이 통째로 그 밑에 깔린다 — `full`에서 손잡이를 아예 못 잡는다.

**결론(했다): `detent === 'full'`이면 검색 바 + 필터 칩 열을 조건부로 렌더하지 않는다.** `opacity-0`이 아니라 조건부 렌더다 — 그래야 포인터 이벤트와 접근성 트리가 함께 정리되고 테스트로 잠긴다. `mapReady ? detent : 'half'`를 두 곳에 흩어 놓지 않으려고 `sheetDetent` 파생 변수 하나로 뽑고, 오버레이·FAB이 그것을 본다. (초안에 있던 `showSearchOverlay` 파생 변수는 실제로 만들지 않았다 — 조건과 그것이 지배하는 JSX를 붙여 두는 편이 읽기 쉬워서 `sheetDetent !== 'full'`을 그 자리에서 직접 비교한다. **이 문서 안에서 그 이름을 더 찾지 마라.**)

근거: `full`에서 지도는 8%짜리 조각이라 검색·필터가 할 일이 거의 없고, `full`에 도달하는 경로는 대부분 상세/오늘의 서울이다. 되돌아올 길은 「목록으로」(half로 내림)와 손잡이 클릭(full→peek) 둘이 남는다. 키가 없어 `half`에 묶인 경우에는 계속 보인다 — 지도가 죽었을 때 검색은 유일하게 남은 길이라 닫으면 안 된다.

**실측으로 확인했다.** 개발 서버를 헤드리스 크롬으로 띄우고 `full`에서 `elementFromPoint`로 손잡이 히트 영역 위쪽 띠를 찍었다(뷰포트 500×713, 시트 상단 103px, 손잡이 83~127px):

| 찍은 x | 잡히는 것 |
|---|---|
| 왼쪽 10% | `시트 높이 조절, 현재 전체` |
| 가운데 | `시트 높이 조절, 현재 전체` |
| 오른쪽 끝(FAB 자리) | `내 주변` |

즉 손잡이는 `full`에서 실제로 잡힌다.

**`RecenterButton`(FAB)도 `full`에서 함께 감춘다 — 한 번 뒤집었다가 실측으로 되돌린 항목이다.**

처음에는 감추지 않기로 했다. 근거는 「`BOTTOM_CLASS`의 세 값이 모두 시트 상단보다 2%p 위라 손잡이와 겹치는 양이 세 단계 모두 같다(800px에서 4px)」였고, **그 근거 자체는 지금도 맞다.** 뒤집은 것은 그 검토에 없던 사실이 하나 더 나와서다: **`full`에는 48px 버튼이 들어갈 자리가 아예 없다.**

`full`(92%)에서 시트 위에 남는 지도 조각은 `0.08H`이고 2%p 간격을 주면 버튼 몫은 `0.06H`다. 버튼 높이가 48px이므로

```
FAB 상단 = 0.06H − 48        (음수면 홈 루트의 overflow-hidden이 잘라낸다)
안 잘릴 조건: 0.06H ≥ 48  ⟺  H ≥ 800px
```

즉 **경계가 정확히 800px**이고, 처음 계산에 800px을 쓴 것이 하필 그 경계였다. 실측(리뷰):

| 루트 높이 H | FAB 상단 | 보이는 높이 |
|---|---|---|
| 460px | −20.4px | **27.6px** |
| 637px | −9.8px | **38.2px** |
| 708px | −5.5px | **42.5px** |
| 793px | −0.4px | 47.6px |

컨테이너는 `100dvh − 7.5rem`이라 H가 800을 넘으려면 뷰포트가 920px이어야 한다. Task 10에서 `h-dvh`가 돼도 dvh 800 미만인 기기에서는 그대로 잘린다 — **실기기에서는 사실상 언제나 잘린다.**

대안으로 `top-1`처럼 위로 붙이는 길을 검토했으나 버렸다. 작은 화면에서 버튼이 시트 상단 모서리에 걸치고(`z-20 > z-10`이라 시트 위에 그려진다) 손잡이 히트 영역을 오른쪽 끝에서 통째로 덮는다 — 잘림을 겹침으로 바꿀 뿐이고 그 겹침은 테스트로 잡히지도 않는다.

감추는 쪽은 잠긴다. 그리고 규칙이 하나로 합쳐진다: **「전체로 펼치면 지도 위 조작부가 물러난다」** — 검색 바·칩 열과 FAB이 같은 조건 아래 놓여 예외가 사라졌다.

`BOTTOM_CLASS.full`이 도달 불가가 되므로 지웠고, prop 타입을 `RecenterDetent = Exclude<Detent, 'full'>`로 좁혔다. `HomeScreen`의 `sheetDetent !== 'full'` 안에서 값이 `RecenterDetent`로 좁혀지므로 **컴파일러가 불변식을 지킨다** — 좁혀지지 않은 값을 넘기면 `TS2322`가 난다(확인했다).

> **정정.** 한때 여기에 「파생 불리언(`const show = sheetDetent !== 'full'`)으로 감싸면 안 좁혀지므로 직접 비교해야 한다」고 적혀 있었다. **거짓이다.** 실제로 바꿔 `npx tsc -b --force`를 돌리면 에러 0이다 — TS 4.4의 aliased conditions and discriminants가 처리하고 이 저장소는 TS ~6.0.2다. 직접 비교하는 것은 조건과 그것이 지배하는 JSX가 붙어 있는 편이 읽기 쉬워서일 뿐, 쪼개도 타입 안전은 안 깨진다. 「왜」를 적는 규약을 가진 저장소에서 **틀린 「왜」는 없는 것보다 나쁘다** — 다음 사람이 못 만지게 만든다. 같은 종류가 직전 라운드의 `useCallback` 주석에서도 나왔다.

남은 두 단계에서 버튼 아래가 손잡이 히트 영역 오른쪽 끝과 겹치는 양은 `20px − 0.02H`다(800px에서 4px, 713px에서 8px). 폭 48px짜리 구석이고 손잡이의 보이는 띠는 가운데 36px이라 실제로 막지는 않는다고 봤지만, 확정은 실기기 몫이다.

**(D) 손잡이가 지도 위 20px을 삼킨다 — 미해결로 남긴다.** Task 3에서 히트 영역을 44px로 키우며 `touch-none` 상자가 시트 위로 20px 올라갔다. 그 띠에서는 마커 탭도 지도 팬도 안 먹는다. 의도한 교환이고 Google Maps도 같은 방식이지만, `peek`에서는 화면 84% 지점을 가로지르는 죽은 띠가 된다. **실기기 없이는 거슬리는지 알 수 없다.** 여기에 FAB이 그 띠의 오른쪽 끝 48px을 추가로 가져간다는 사실이 더해진다(위 (C) 참고).

**(F) `SummaryStrip`의 빈 상태 문구가 실패와 로딩을 구분하지 못한다.** `혼잡도 정보를 아직 받지 못했어요.`는 로딩을 뜻하는데, 조회가 **영구 실패**해도 같은 문구가 나온다. 그때 아래 목록은 `ErrorState`의 `혼잡도 정보를 가져오지 못했어요.`를 띄워 두 문장이 어긋난다. `CitySummary`에 실패를 표현할 수단이 없어 `SummaryStrip` 혼자서는 못 고친다 — 이 화면이 조회 상태를 알고 있으므로 여기서 정하라(스트립을 아예 감추든, 실패용 문구를 prop으로 넘기든).

**결론(했다): `snapshots.isError`면 `SummaryStrip`을 렌더하지 않는다.** `ErrorState`가 이미 실패를 말하고 재시도까지 준다. 스트립을 남기면 같은 자리에서 "아직 안 왔다"와 "못 가져왔다"가 동시에 보인다. 반대편(로딩·빈 응답일 때는 스트립이 남는다)도 함께 잠갔다 — 안 그러면 「스트립을 아예 안 그린다」로도 통과한다.

같은 항목의 **두 번째 문제(재난문자가 새로 뜬 것이 스크린리더에 안 알려진다)는 하지 않았다.** 코드로 확인한 결과 `useCachedCityAlerts`는 `useQueryClient().getQueryData()`를 렌더 중에 읽을 뿐 **구독하지 않는다.** 즉 캐시에 새 재난문자가 들어와도 그것만으로는 리렌더가 일어나지 않고, 다른 이유로 `HomeScreen`이 다시 그려질 때 우연히 딸려 온다. 이 상태에서 라이브 리전을 달면 "언제 읽힐지 모르는" 알림이 된다 — 고치려면 `useCachedCityAlerts`가 실제로 구독하도록 바꾸는 게 먼저다. **별도 태스크로 뺀다.**

**(G) 빈 목록 문구가 무엇을 풀어야 할지 안 알려준다.** 「★ 내 장소」를 켠 뒤 카테고리를 좁혀 0이 되면(칩은 선택돼 있어 활성이다 — Task 6이 갇힘을 막으려고 그렇게 뒀다) 목록이 비고 `조건에 맞는 명소가 없어요.`가 뜬다. 틀린 말은 아니지만 **어느 조건이 문제인지** 말하지 않는다.

**결론(했다).** 검색어가 없고 `filters.filter !== null`이면 그 필터 이름을 문구에 넣고(`「내 장소」에 해당하는 명소가 없어요.`) 「필터 해제」 버튼을 붙인다.

- 라벨의 정본을 `domain/presets.ts`의 **`filterLabel(key: FilterKey): string`**으로 올렸다. `FilterChips`도 그것을 쓴다 — `CHIPS`가 `{key, label}` 객체 배열에서 `FilterKey[]`로 줄었다. `fav`는 `PRESETS`에 없으므로 `find`가 비고 그대로 즐겨찾기 이름으로 떨어진다(분기를 따로 두지 않는 것은 폴백이 곧 정답인 유일한 키라서다).
- **검색어가 있으면 검색어를 지목하고 「필터 해제」를 권하지 않는다.** 검색어에는 검색 바의 지우기 버튼이라는 출구가 이미 있고, 두 원인을 한 문장에 담으면 길어진다. 검색어를 지우면 필터만 걸린 상태로 돌아가 그때 필터 문구가 뜬다.
- **카테고리는 지목하지 않는다.** 카테고리는 언제나 보이는 탭 줄이라 무엇이 골라져 있는지 눈에 있고, 「전체」로 돌아가는 자리가 그 줄 안에 이미 있다. 칩은 스스로 0이 되면 비활성으로 굳을 수 있어 끄는 버튼이 따로 필요했다. 그 경우 문구는 기존 `조건에 맞는 명소가 없어요.`로 남는다.

**(E) 시트 루트에 `overflow-hidden`을 걸지 마라 — 그대로 지켰다.** 걸면 (D)의 위쪽 20px 히트 영역이 조용히 잘린다. 시트 상단에 배경 있는 요소를 풀블리드로 넣어 `rounded-t-2xl` 모서리가 각져 보이면, 루트가 아니라 **그 요소 쪽에** 반경을 줘라.

**(H) 시트의 좌우 여백을 시트가 갖지 않기로 했다 — 계획서와 다르다.** 원래 Step 5는 "바깥 여백(`px-4`)은 시트가 이미 준다"며 `TodayScreen`에서 패딩을 걷으라고 했다. 그런데 시트에 들어가는 뷰 **셋 다** 이미 제 여백을 들고 있다 — `AreaDetail`(헤더 `px-4`, 절마다 `mx-4`)과 그 아래 6개 컴포넌트, `TodayScreen`과 그 아래 4개 컴포넌트, 목록 쪽 `LocationNotice`(`mx-4`)·`CategoryFilter`(`px-4`)까지. 시트가 한 겹 더 주면 전부 32px이 되므로, 고칠 곳은 **컴포넌트 12개가 아니라 시트 한 줄**이다. `BottomSheet` 내용 래퍼에서 `px-4 pb-6`을 걷었다. 덤으로 상세 히어로처럼 가로를 꽉 채워야 하는 요소가 표현 가능해지고, `TodayScreen`이 (Task 10 전까지 남아 있는) 「더보기」 탭에서도 그대로 선다. 실측: 시트 폭 500px에서 요약 스트립·명소 행·정렬 세그먼트 모두 left 16 / right 484 — 겹치지 않는다.

- [x] **Step 1: 실패 테스트를 쓴다**

`HomeScreen.test.tsx`에 추가한다. 아래 목록은 계획서가 적어 둔 것이고, 실제로는 (A)(C)(F)(G)를 잠그는 테스트가 더 붙었다. **총 30개, 전부 변이로 확인했다.**

두 가지가 계획서와 다르다.

1. **`focusArea` 테스트를 지우지 않았다.** 계획서는 이 태스크에서 prop을 없애라고 했지만, 탭바는 Task 10까지 살아 있고 `App`이 「즐겨찾기·오늘의 서울 탭에서 명소를 눌러 홈 상세로 이동」을 표현할 수단이 이 prop뿐이다. 지금 지우면 그 기능과 그것을 잡는 `App.test.tsx`의 테스트가 함께 죽는다. **Task 10에서 탭바와 같이 지운다.** 테스트는 "그 명소의 상세를 **가득 펼친다**"로 강화했다.
2. **`useCachedCityAlerts`를 목업해야 한다.** 「오늘의 서울」이 시트 안 뷰가 되면서 `HomeScreen`이 이 훅을 부르는데, 실제 훅은 `useQueryClient()`를 요구해 `QueryClientProvider` 없이 `render`하는 이 파일의 테스트를 **전부** 깨뜨린다. `TodayScreen.test.tsx`와 같은 방식으로 목업한다.

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

- [x] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/screens/HomeScreen.test.tsx`
결과: 14 failed | 15 passed — `data-map-layer`가 없고 요약 스트립이 없다

- [x] **Step 3: `SearchBar`에서 「내 주변」을 뺀다**

「내 주변」은 FAB으로 합친다. `SearchBar`는 검색만 한다.

```tsx
interface Props {
  readonly value: string
  readonly onChange: (next: string) => void
}
```

`onRecenter`·`canRecenter`와 그 버튼 JSX를 지운다.

`SearchBar.test.tsx`의 「내 주변」 테스트 셋 중 **콜백이 불린다/안 불린다**는 `RecenterButton.test.tsx`의 「누르면 콜백을 부른다」·「좌표가 없으면 비활성이고 눌러도 반응하지 않는다」가 그대로 잡는다.

**하지만 그것으로 충분하지 않았다 — 여기서 보호가 순감했다.** 넘어온 것은 「콜백이 불린다」뿐이고 **「콜백이 무엇을 하는가」는 아무 데도 안 옮겨졌다.** `handleRecenter`가 하는 네 가지(`setCenter`·`setZoom`·`setSort('distance')`·`setDetent('peek')`) 전부가 미커버였고, 넷 중 셋을 지우는 변이가 전부 살아남았다. 「검색 줄 버튼이 FAB으로 넘어오며 **하던 일도 함께 왔다**」가 이 태스크의 서사인데 정작 그 서사가 안 잠겨 있었던 것이다.

`HomeScreen.test.tsx`에 둘을 더해 막았다.
- 「내 주변을 누르면 목록이 거리순이 되고 시트가 내려간다」 — `setSort`·`setDetent`를 잡는다.
- 「내 주변을 누르면 지도가 내 위치로 옮겨간다」 — `setCenter`·`setZoom`을 잡는다. 이를 위해 **`Map` 목이 `center`·`zoom`을 `data-center`·`data-zoom`으로 DOM에 싣는다.** 목이 그 둘을 버리면 카메라 이동을 관찰할 통로가 없어진다. 검증 대상은 목이 아니라 「HomeScreen이 무엇을 넘기는가」이고 그건 이 화면의 진짜 책임이다.

**교훈: 테스트를 지울 때는 「같은 이름의 테스트가 저쪽에 있는가」가 아니라 「저쪽이 같은 것을 잡는가」를 봐야 한다.** 이 브랜치에서 두 번째다(Task 6의 `PresetFilter.test.tsx`에 이어). 대신 **「검색 말고 다른 버튼은 두지 않는다」**를 새로 넣었다(`getAllByRole('button')`이 지우기 버튼 하나뿐). 지도에 대고 하는 동작이 검색 줄에 다시 붙는 것을 막는 자리다.

버튼이 빠지면서 `gap-2`가 할 일이 없어져 걷었고, 지도 위에 홀로 뜨므로 입력 상자에 `shadow-floating`을 줬다.

- [x] **Step 4: `RecenterButton`의 위치를 시트에 맞춘다**

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

`className`의 `${raised ? 'bottom-64' : 'bottom-28'}`를 `${BOTTOM_CLASS[detent]}`로 바꾸고, `aria-label`을 `'내 위치로 이동'`에서 `'내 주변'`으로 바꾼다(「내 주변」 버튼을 흡수했으므로). `RecenterButton.test.tsx`는 **두 단계**(`full`은 타입에서 빠졌다)를 모두 확인하도록 `it.each`로 고쳤다 — 한 단계만 보면 위치를 상수로 박아 둔 구현도 통과한다. 리터럴 표와 별도로 **`bottom-[N%]`의 N이 `SHEET_RATIO[detent] + 0.02`에서 파생되는지**를 보는 테스트를 더했다. 런타임 조합은 Tailwind 정적 추출에 막히지만 **테스트 쪽 계산은 막을 것이 없어서**, 클래스에 적힌 수를 도로 꺼내 관계를 확인한다. it.each 제목에 `%`를 쓰면 vitest 포맷터가 자리표시자로 읽어 깨진다.

이름 변경 덕에 `App.test.tsx`의 「내 주변」 관련 테스트 둘이 그대로 산다(예전에는 `SearchBar`의 버튼을 잡던 것이 이제 FAB을 잡는다).

`full`에서 감출지는 위 (C)에서 숫자를 보고 **감추지 않기로** 정했다.

- [x] **Step 5: `TodayScreen`을 시트 안 뷰로 바꾼다**

**패딩은 걷지 않았다 — 대신 시트 쪽을 걷었다.** 근거는 위 (H). `TodayScreen`에서 실제로 한 것은 `onBack`을 더하고 「목록으로」 버튼을 최상단에 놓은 것, 그리고 첫 섹션의 `pt-4`를 버튼이 그 자리를 차지하므로 뺀 것뿐이다.

**「목록으로」 버튼은 조회 상태 분기 밖에 둔다.** 로딩·실패 분기 안에 넣으면 느린 응답을 기다리는 동안 이 뷰가 시트의 92%를 덮은 채 나갈 길이 없다. 테스트로 잠갔다(「로딩 중에도 목록으로 돌아갈 수 있다」).

- [x] **Step 6: `HomeScreen`을 재작성한다**

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
  //
  // Task 6이 `presetCounts` + `favorites.length`를 `filterCounts` 하나로 바꿨다.
  // `fav`를 따로 세면 안 된다 — `list`는 이미 카테고리로 걸러진 목록이라
  // 「공원」을 고르면 칩에 2, 목록에 0이 뜬다. `filterCounts`는 `filterAreas`를
  // 그대로 불러 개수와 필터가 같은 술어를 쓰는 것을 구조로 보장한다.
  const counts = useMemo(() => filterCounts(list, favorites), [list, favorites])

  const visible = useMemo(
    () => searchAreas(filterAreas(list, filters.filter, favorites), filters.query),
    [list, filters.filter, favorites, filters.query],
  )
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

      <AreaList>
        {visible.map((area) => (
          <AreaListItem
            key={area.entry.code}
            area={area}
            favorite={favorites.includes(area.entry.name)}
            onSelect={openArea}
          />
        ))}
      </AreaList>
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

`TodayScreen.test.tsx`의 모든 `render(<TodayScreen onSelectArea={...} />)`에 `onBack={() => {}}`를 더한다. **`App.tsx`의 「더보기」 탭에도 더해야 한다** — 그 탭은 Task 10까지 살아 있다. `onBack={() => setTab('home')}`으로 뒀다.

`AreaDetail`도 「목록으로」 버튼을 갖고 있지만, 시트 내용은 셋 중 하나만 그려지므로 두 버튼이 동시에 뜨지 않는다(`selectedName !== null`이 `view === 'today'`보다 앞선다 — 오늘의 서울에서 명소를 누르면 그 상세로 가야 하기 때문이다). `getByRole('button', { name: '목록으로' })`가 모호해지지 않는다.

### 계획서 코드에서 실제로 고친 것

- **(C)(F)(G)가 반영돼 있지 않았다.** 위 결정 사항대로 넣었다.
- **`HOME_HEIGHT_CLASS`를 지우지 않았다.** 계획서는 루트를 `size-full`로 바꿨는데, `App.tsx`가 이 화면을 `<div hidden={tab !== 'home'}>`로 감싸고 그 div에 높이를 주지 않는다 — `height: 100%`가 auto인 부모를 만나 **지도가 0px로 접힌다.** Task 10에서 셸이 `h-dvh`가 될 때 지운다. 임시 조치임을 상수 주석에 적었다. 실측(개발 서버 + 헤드리스 크롬): 뷰포트 713px에서 `[data-map-layer]` 높이 593px = `calc(100dvh − 7.5rem)`. 접히지 않는다.
- **`openArea`를 `useCallback`으로 감쌌다.** 지도를 팬할 때마다 `onCameraChanged`가 상태를 바꿔 리렌더가 나는데 마커가 30개다. 의존성은 `setSelectedName` 하나뿐이고 그것은 `useHomeFilters`가 돌려주는 `useState` 세터라 참조가 고정이다 — `filters` 객체를 넣으면 매 렌더 새것이라 memo가 통째로 무의미해진다.
- **`focusArea`는 effect가 아니라 렌더 중 상태 조정으로 처리한다.** `useEffect` 안에서 `setDetent`/`setView`를 부르면 `react-hooks/set-state-in-effect`가 막는다(`npm run lint` 실패). 함수로 감싸도 규칙이 따라 들어온다. React가 「prop이 바뀔 때 상태 맞추기」에 권하는 형태로 바꾸고 직전에 연 이름을 `openedFocus`로 들고 있는다 — 그 상세를 닫아도 `focusArea`는 그대로라 매 렌더 다시 열리기 때문이다.
- **`listPane`의 절 순서를 계획서와 다르게 뒀다.** 계획서는 `SortSegmented` → `CategoryFilter` 순인데 기존 코드가 `CategoryFilter` → `SortSegmented`였다. 이 태스크에서 바꿀 이유가 없어 기존 순서를 지켰다.
- **로딩 알약(`LOADING_LABEL = '혼잡도를 불러오는 중'`)을 지웠다.** 검사하는 테스트가 없음을 확인했고(`grep`), 시트 안 `SkeletonList`가 같은 말을 한다. 상수도 함께 지웠다.
- **`useHomeFilters`에서 `mapRatio`/`setMapRatio`를 걷었다.** `SplitPane` 전용이라 죽은 코드가 된다. `SHEET_RATIO` import와 해당 테스트 둘도 함께 지웠다.

- [x] **Step 7: `SplitPane`을 지운다**

```bash
git rm src/components/home/SplitPane.tsx src/components/home/SplitPane.test.tsx
```

지우기 전에 `SplitPane.test.tsx`가 잡던 열 가지를 세어 봤다. 여덟은 `BottomSheet.test.tsx`에 같은 것이 있다. 나머지 둘은 잃은 게 아니다:

- 「범위 밖으로 끌어도 한계 안에 머문다」 → `domain/sheet.test.ts`의 「범위 밖도 단계 하나로 떨어진다」가 잡는다.
- 「끄는 도중에는 스냅하지 않고 손끝을 따라간다」 → `BottomSheet`는 **의도적으로** 그렇게 하지 않는다(Task 3에서 결정, 컴포넌트 주석에 근거가 있다). 잃을 보호가 아니라 사라진 요구사항이다.
- 「더블클릭하면 기본값으로 돌아간다」 → 클릭 순환이 흡수했다((A) 참고).

- [ ] **Step 8: 통과를 확인한다**

Run: `npm test` 그리고 `npx tsc -b`
Expected: 전부 PASS

- [ ] **Step 9: 변이 확인**

**변이 30개를 돌려 29개가 죽었고 1개가 살아남았다.** 필수 둘:

1. `counts`를 걸러진 목록으로 센다 → 「프리셋 개수는 걸러진 목록이 아니라 전체로 센다」 1개 실패. ✅
   주의: `filterCounts(visible, ...)`로 그냥 바꾸면 `visible`이 아래에 선언돼 TDZ로 **30개 전부** 터진다 — 변이가 아니라 컴파일 실패다. `visible`의 정의를 인라인해 유효한 코드로 만들어야 판별력이 있다.
2. `filterCounts`의 `fav`를 `favorites.length`로 되돌린다 → 도메인 「개수와 필터 결과 길이가 항상 같다」 + 화면 「내 장소 개수는 지금 목록에 있는 것만 센다」 2개가 **함께** 실패. ✅

(A) 손잡이 6개 — button→separator 되돌리기 / 순환 방향 뒤집기 / 클릭 가드 제거 / 가드를 pointerdown에서 안 털기 / 이름에서 단계 빼기 / `w-full` 빼기.
(C) 3개 — 오버레이 항상 표시 / 아예 미표시 / `sheetDetent`에서 `mapReady` 무시.
(F) 2개 — 실패해도 스트립 표시 / 스트립 항상 미표시.
(G) 6개 — `filterLabel` 오답 / 항상 즐겨찾기 이름 / 옛 문구로 되돌리기 / 「필터 해제」 미표시 / 버튼이 아무 일도 안 함 / 검색어가 있어도 필터 지목.
그 밖 — `TodayScreen` 뒤로가기 제거, 오늘의 서울·상세에서 돌아올 때 시트 안 내리기, `RecenterButton` 이름·위치, `SearchBar`에 버튼 되살리기, 명소를 열어도 full로 안 올리기, `data-map-layer` 표식 제거.

**살아남은 변이 1개 — `BottomSheet.detentFromY`의 `clampSheetRatio` 호출은 죽은 코드다.**

```ts
return nearestDetent(clampSheetRatio((rect.bottom - clientY) / rect.height))
//                   ^^^^^^^^^^^^^^^ 빼도 68개 테스트가 전부 통과한다
```

`nearestDetent`가 첫 줄에서 `clampSheetRatio(ratio)`를 다시 부르고 클램프는 멱등이라, 바깥 호출은 결과를 바꿀 수 없다. 그래서 **어떤 테스트로도 잡을 수 없다** — 테스트를 더 쓸 게 아니라 호출을 지워야 하는 자리다. Task 3 코드라 이 태스크에서는 손대지 않았다. 지울 때 `clampSheetRatio` import도 함께 지워야 한다(안 그러면 lint가 막는다).

**변이 도구에 대한 주의 둘.** (1) `vitest --reporter=basic`은 vitest 4에서 없어졌다 — 리포터 로드에 실패하면서 조용히 0건으로 보고돼 **모든 변이가 살아남은 것처럼 보인다.** 기본 리포터의 `FAIL ... > 이름` 줄을 파싱해야 한다. (2) 변이는 **컴파일되는 코드**여야 한다. `filterCounts(list, …)` → `filterCounts(visible, …)`처럼 선언 순서를 어기면 TDZ로 30개가 전부 터지는데, 그건 "테스트가 잡았다"가 아니라 변이 실패다. `<button>`을 `<div>`로 바꾸면서 닫는 태그를 안 고치는 것도 같은 함정이다.

- [ ] **Step 10: 커밋**

```bash
git add -A src
git commit -m "feat: 지도를 전체 배경으로 깔고 오버레이 시트로 전환"
```

### Task 9가 Task 10에 넘기는 것

- **뷰가 갈릴 때 포커스가 `document.body`로 떨어진다.** jsdom으로 확인했다: 목록 행 → 상세, 「목록으로」 → 목록 모두 `document.activeElement === document.body`가 된다. **Task 9가 만든 문제가 아니다**(`SplitPane` 시절에도 같았다) — 다만 시트가 유일한 내용 영역이 되고 뷰가 셋으로 늘면서 이 왕복이 주 동선이 됐다. 키보드·스위치 사용자는 뷰를 바꿀 때마다 문서 맨 앞으로 돌아가 시트까지 다시 탭해 내려와야 한다.
  고칠 자리는 `HomeScreen`의 `sheetContent` 전환이다. 각 뷰의 맨 위 요소(상세의 「목록으로」, 오늘의 서울의 「목록으로」, 목록의 요약 스트립)에 `tabIndex={-1}`을 주고 뷰가 바뀔 때 `focus({ preventScroll: true })`를 부른다. `preventScroll`이 필요한 이유는 시트가 스크롤 컨테이너라 포커스가 시트를 튀게 만들 수 있어서다. 셸을 정리하는 Task 10에서 함께 다룬다.

- **`HomeScreen`의 `focusArea` prop과 `openedFocus` 상태.** 탭바가 사라지면 부르는 곳이 없어진다. `HomeScreen.test.tsx`의 「focusArea가 주어지면 그 명소의 상세를 가득 펼친다」도 함께 지운다.
- **`HOME_HEIGHT_CLASS`.** 셸이 `h-dvh`가 되고 `<main className="min-h-0 flex-1">`이 되면 루트를 `relative size-full overflow-hidden`으로 바꾸고 이 상수를 지운다.
- **`App.tsx`의 「더보기」 탭.** `TodayScreen`은 이미 시트 안에서 돌고 있으므로 탭 쪽만 걷어내면 된다.

### 실기기 없이는 확정 못 하는 것들 (STATE.md 미해결)

1. **(B)의 성능 논거** — `transition-[height]`가 매 프레임 리플로우를 일으킨다. 스크롤 보존은 실측으로 문제없음이 확인됐고, 남은 건 저사양 안드로이드 웹뷰에서 200ms 동안 목록이 재배치되는 체감뿐이다.
2. **(D)의 죽은 띠** — 시트 위 20px에서 마커 탭도 지도 팬도 안 먹는다. `peek`에서는 화면 84% 지점을 가로지른다.
3. **FAB과 손잡이의 구석 겹침**(peek·half) — `20px − 0.02×컨테이너높이`. 800px에서 4px, 713px에서 8px. 화면이 작을수록 는다. `full`에서는 FAB을 안 그리므로 해당 없다.
4. **시트 드래그와 지도 팬 제스처 충돌** (Task 3에서 이월).
5. **iOS 안전 영역을 포함한 실제 높이.**

---

## Task 10: 탭바·상단바 제거와 App 단순화 (완료)

**Files:**
- Modify: `src/App.tsx`, `src/App.test.tsx`, `src/screens/HomeScreen.tsx`, `src/screens/HomeScreen.test.tsx`, `src/components/home/FilterChips.tsx`, `src/components/home/FilterChips.test.tsx`, `src/components/map/RecenterButton.tsx`
- Delete: `src/components/layout/BottomTabBar.tsx`, **`src/components/layout/TopAppBar.tsx`**, `src/screens/FavoritesScreen.tsx`, `src/screens/FavoritesScreen.test.tsx`
- **`src/components/layout/`가 비어 디렉터리째 사라졌다.** (덤: 비어 있던 `src/components/nearby/`도 정리했다 — git이 추적하던 것은 아니다)

### 계획서와 달라진 것 (1) — 상단바도 없앴다

계획서 원안은 `TopAppBar title="Seoul Live"`를 남겼다. **사용자가 제거하기로 정했다.**

- 설계 §2.2가 탭바를 없앤 논리가 그대로 적용된다 — 오버레이 시트를 채택한 이상 세로 공간이 가장 귀한 자원이고, 상단바 3.5rem은 시트를 full로 올린 상태에서도 계속 깎인다.
- Google Maps에 상단바가 없다. **지도 위에 뜬 검색 바가 이미 그 층을 쓰고 있어** 같은 자리가 두 겹이었다.
- 토스가 미니앱에 자체 네이티브 헤더를 주므로 유지하면 세 겹이 된다.

**여파 — 계획서의 다음 두 줄은 무효다.**
- Step 4의 「`src/components/layout/`에 `TopAppBar`만 남는지 확인한다」 → 디렉터리가 통째로 없어졌다.
- Step 4의 「`h-dvh`에서 상단바(3.5rem)만 빼면 된다」 → 뺄 것이 없다. `<main className="h-dvh">`가 뷰포트 높이를 그대로 갖고 `HomeScreen` 루트가 `relative size-full overflow-hidden`으로 받는다. `HOME_HEIGHT_CLASS`는 삭제했다.
- Step 3의 `flex h-dvh flex-col` + `<main className="min-h-0 flex-1">` 구조도 쓰지 않았다. **자식이 하나면 높이를 나눌 형제가 없어 `min-h-0 flex-1`이 할 일이 없다.** `<main>`은 남겼다 — 랜드마크까지 잃을 이유는 없다.

**h1 판단: `sr-only` h1을 `App`에 뒀다.**
`TopAppBar`의 `<h1>{title}</h1>`이 앱의 유일한 h1이었고, 없애면 제목 층이 시트 안의 h2부터 시작해 **제목으로 훑는 스크린리더 사용자에게 뿌리 없는 트리**가 된다. WCAG가 h1을 요구하지는 않지만 `sr-only`는 세로 공간을 한 픽셀도 쓰지 않으므로(실측 높이 1px) 상단바를 없앤 이득과 상충하지 않는다 — 없앨 이유가 없다. 이름은 `index.html`의 `<title>`과 같은 **「서울 라이브」**로 맞췄다. `TopAppBar`는 「Seoul Live」였고 둘이 어긋나 있었다.

### 계획서와 달라진 것 (2) — 「내 장소 0」 칩을 누를 수 있게 했다

**문제.** `FavoritesScreen`의 빈 상태 안내(「지도에서 ☆를 눌러 담아보세요」 + 「지도로 가기」)가 파일과 함께 사라진다. 계획서가 든 후보 중 「빈 목록 문구에 섞기」만으로는 **신규 사용자가 그 문구에 닿을 수 없다** — `FilterChips`의 `disabled={count === 0 && !selected}` 때문에 「내 장소 0」 칩이 영구히 비활성이라 필터를 켤 수가 없기 때문이다.

**결정.** `FilterChips`의 0-비활성 규칙에서 `'fav'`를 면제했다(`disabled={count === 0 && !selected && chip !== 'fav'}`).

그 규칙의 근거는 「눌렀는데 아무 일도 안 일어나는 순간을 만들지 않는다」이고, 프리셋의 0에는 그대로 유효하다 — 「지금 그런 곳이 없다」는 데이터 사정이라 눌러도 나올 말이 없다. 그러나 **「내 장소」의 0은 아직 안 써 본 기능의 초기 상태**이고, 누르면 나올 말이 있다. 이 파일은 이미 ★ 렌더에서 `'fav'`를 특별 취급하고 있어 특례가 새로 생긴 것도 아니다.

**옮긴 문구 (그대로 옮기지 않았다).**

```
아직 담은 곳이 없어요. 명소를 열고 「저장」을 누르면 여기에 모여요.
```

- 옛 문구는 **이미 낡아 있었다.** Task 8에서 별이 상세 헤더를 떠나 액션 행의 「저장」 버튼이 됐으므로, 그대로 옮겼으면 사용자가 있지도 않은 ☆를 찾았다.
- 「지도로 가기」 버튼은 옮기지 않았다. 지도는 이미 이 문구 뒤에 깔려 있고, 빠져나올 길은 그 자리에 이미 있던 **「필터 해제」**다(Task 9가 만들었다).
- 조건은 `counts.fav === 0`이 아니라 **`favorites.length === 0`**이다. 카테고리로 좁혀 0이 된 것과 애초에 담은 게 없는 것은 사용자에게 다른 말이고, 전자는 기존 문구(「‘내 장소’에 해당하는 명소가 없어요」)가 맞다. 이 구분을 기존 테스트가 이미 잠그고 있었다(변이 M10).

**곁딸린 처리 하나.** 담은 게 없는 「내 장소」를 켜면 목록도 지도 마커도 함께 빈다(실측: 마커 0개). `peek`에서는 답을 적은 문구가 시트 안에 가려 있어 사용자에게는 「눌렀더니 다 사라졌다」만 남으므로, 그 경우에만 시트를 `half`로 올린다. **「목록이 비면 올린다」로 일반화하지 않았다** — 카테고리로 좁혀 비는 경우는 이 태스크와 무관하게 예전부터 있던 상태이고, 그쪽까지 손대면 필터를 만질 때마다 시트가 튀어오른다(변이 M12가 이 경계를 지킨다).

### 계획서와 달라진 것 (3) — 계획서 테스트 코드의 결함

계획서 Step 1의 세 테스트를 그대로 쓰지 않았다.

1. `queryByRole('button', { name: '즐겨찾기' })` — **탭바가 통째로 사라진 뒤에는 공허해진다.** `<nav>`가 없어져 Task 9식 「탭바 안으로 좁혀 묻기」도 불가능하다. 대신 `queryAllByRole('navigation')`이 비었다는 것과 **옛 탭이 가던 곳을 지금 무엇이 대신하는가**(내 장소 칩 · 요약 스트립)를 함께 잠갔다.
2. `getAllByRole('button', { name: /광화문·덕수궁/ })[0]` — Task 9에서 드러났듯 `[0]`은 목록 행이 아니라 **지도 마커**다(`data-map-layer`가 시트보다 DOM 앞). `App.test.tsx`에도 `sheetRow` 헬퍼를 두어 「목록에서 열었다」를 뜻하게 했다.
3. 상단바 제거를 잠그는 테스트가 없었다 → 「앱이 자체 헤더를 두지 않고 제목은 보조기술에만 남는다」를 추가했다(`banner` 없음 + h1 이름 + `main` 랜드마크).

### 지운 테스트가 잡던 것 — 어디로 갔나

**`FavoritesScreen.test.tsx` (6개)**

| 지운 테스트 | 잡던 것 | 간 곳 |
| --- | --- | --- |
| 비어 있으면 담는 방법을 알려주고 홈으로 가는 버튼을 준다 | 빈 상태 안내와 나가는 길 | **문구를 고쳐 옮겼다.** `HomeScreen.test`「담은 게 하나도 없으면 담는 방법을 알려준다」, `App.test`「담은 곳이 하나도 없어도 담는 방법에 닿을 수 있다」 |
| 담은 명소만 보여준다 | fav 필터가 즐겨찾기만 남긴다 | `HomeScreen.test`「내 장소 칩이 즐겨찾기만 남긴다」, `presets.test`「내 장소는 담아둔 이름만 남긴다」 |
| 항목을 누르면 명소를 올려보낸다 | 행 클릭이 이름을 올려보낸다 | `AreaListItem.test`「누르면 명소 이름을 올려보낸다」, `HomeScreen.test`「목록 행을 눌러도 그 명소의 상세가 열린다」 |
| 담은 게 여럿이면 모두 보여준다 | 하나만 보여주는 구현 | `presets.test`「내 장소는 담아둔 이름만 남긴다」가 **목록 전체를 비교**해 더 강하게 잡는다 |
| 카탈로그에 없는 이름이 저장돼 있어도 무시한다 | 유령 행 | `presets.test`「담아둔 이름이 목록에 없으면 그냥 빠진다」, `HomeScreen.test`「내 장소 개수는 지금 목록에 있는 것만 센다」 |
| 혼잡도 조회가 실패해도 담은 목록은 보여준다 | 실패해도 목록은 선다 | **저쪽이 안 잡고 있었다.** 기존 「혼잡도 조회가 실패하면 요약 스트립을 감춘다」는 스트립만 보므로 「실패하면 목록도 감춘다」가 통과했다 → `HomeScreen.test`「혼잡도 조회가 실패해도 명소 목록은 남는다」를 **새로 썼다**(변이 M25로 확인) |

**`App.test.tsx` (12개 → 12개)**

| 옛 테스트 | 결과 |
| --- | --- |
| 첫 화면이 지도이고 목록이 함께 채워진다 | 유지 (계획서의 「첫 화면이 지도다」를 이미 포함한다) |
| 탭이 셋이고 옛 탭은 없다 | → 「갈 곳을 고르는 탭바가 없다」 |
| 명소를 누르면 상세가 열리고 지도는 남는다 | 유지. `sheetRow`로 **어느 쪽을 눌렀는지 명시** |
| **탭을 오가도 홈의 상태가 남는다** | **삭제 → 시트 안 뷰 전환으로 옮겨 썼다.** 처음에 「언마운트시킬 주체가 없어졌으니 대체 불가」로 판정했는데 **그 판정이 틀렸다** — 메커니즘엔 참이지만 규칙엔 거짓이다. 상세·오늘의 서울을 열면 `detent`가 full이 되면서 **검색 바와 칩 열이 실제로 언마운트된다.** 탐침 변이 둘(상세에서 돌아올 때 `setQuery('')` / 오늘의 서울 열 때 카메라 리셋)이 **둘 다 생존**했다 → `HomeScreen.test`「시트 안에서 뷰를 오가도 검색어가 남는다」·「…지도 카메라가 남는다」 **둘을 새로 썼다**(P1·P2로 각각 사망 확인). 상태가 둘이라 테스트도 둘이다 |
| 더보기는 오늘의 서울이다 | → 「오늘의 서울은 탭이 아니라 시트 안 뷰다」(요약 스트립 경유 + 지도가 남는지까지) |
| 오늘의 서울에서 명소를 누르면 홈의 상세로 간다 | → 「…같은 시트가 그 상세로 바뀐다」. **강화했다**: 1위가 아니라 **둘째 줄**을 눌러 이름까지 확인한다. 옛 테스트는 「무엇을 눌렀든 1위를 연다」는 구현을 통과시켰다(변이 M16) |
| 저장을 누르면 즐겨찾기 탭에 나타난다 | → 「상세에서 저장한 곳이 내 장소 칩의 개수가 된다」 |
| 즐겨찾기가 비어 있으면 지도로 가는 길을 준다 | → 「담은 곳이 하나도 없어도 담는 방법에 닿을 수 있다」 |
| 위치 거부/허용, 정렬, 위치 재요청 (4개) | 유지 |
| — | **신설**: 「앱이 자체 헤더를 두지 않고 제목은 보조기술에만 남는다」 |

`HomeScreen.test.tsx`의 「focusArea가 주어지면 그 명소의 상세를 가득 펼친다」도 삭제했다. 잡던 것은 **탭 사이 이동**이라 대체할 것이 없다 — 명소를 열면 시트가 full이 된다는 부분은 「명소를 누르면 상세가 시트를 가득 채우고 지도는 뒤에 남는다」가 그대로 잡는다.

### 포커스 (Task 9의 I8) — 처방이 **버그를 하나 만들었고** 그 뒤에 고쳤다

**계획서 처방을 곧이곧대로 구현하면 검색이 깨진다.** 처방은 「뷰가 바뀔 때 맨 위 요소에 `focus()`」인데, 이 화면에서 **뷰는 사용자가 부르지 않아도 바뀐다** — `useHomeFilters.setQuery`가 검색어를 받을 때마다 `setSelectedName(null)`을 부르기 때문이다(걸러져 사라진 명소의 상세가 남지 않게 하려는 이전 규칙).

경로: 상세를 연다 → 손잡이로 시트를 내려 검색 바를 꺼낸다 → 타이핑한다.
첫 글자가 선택을 풀고 → 뷰가 상세→목록으로 갈리고 → 처방이 **입력에서 포커스를 가져간다.** 둘째 글자부터 사라진다. 모바일이면 소프트 키보드까지 내려간다.

**이걸 잡았어야 할 테스트가 이미 있었는데 공허했다.** 「상세가 열린 채로 검색하면 목록으로 돌아간다」가 정확히 이 경로를 걷는데 단언이 `areaButtons(/경복궁/).length > 0`이라 **`'경'` 한 글자만으로도 통과**했다. 앞 라운드에서 뽑은 교훈(「이쪽이 아직도 같은 것을 잡는가」)이 한 번 더 적용됐어야 할 자리다. `toHaveValue('경복궁')`를 더해 잠갔다.

**고친 방식 — 상태를 비교하지 않고 「옮겨 달라고 말한 조작」만 옮긴다.**

```tsx
const moveFocusRef = useRef(false)
function requestSheetFocus(): void { moveFocusRef.current = true }
useEffect(() => {                       // 의존성 배열 없음
  if (!moveFocusRef.current) return
  moveFocusRef.current = false
  viewRef.current?.focus({ preventScroll: true })
})
```

뷰를 바꾸는 조작 넷(`openArea` / 상세의 「목록으로」 / 오늘의 서울의 「목록으로」 / 요약 스트립)이 `requestSheetFocus()`를 부른다.

**`document.activeElement`가 입력인지 보는 길은 택하지 않았다.** 그건 원인이 아니라 **증상**을 보는 것이라 두 군데서 어긋난다. (1) 지도 마커를 눌러 상세를 여는 순간 포커스가 아직 검색창에 남아 있으면 처방이 통째로 건너뛰어진다. (2) 칩을 눌러 선택이 풀릴 때는 손이 칩 줄에 있는데 칩은 입력이 아니라서 **포커스를 뺏긴다** — 연달아 다른 칩을 누르려던 참인데. 요청 방식은 둘 다 옳게 처리한다.

부수 이득으로 `viewKey`·`focusedViewRef`·첫 렌더 가드가 통째로 사라졌다(요청이 없으면 안 옮기므로 첫 렌더는 공짜로 조용하다). **살아남았던 변이 M18(`viewKey` 접두사)도 함께 없어졌다** — 표현할 코드가 사라졌다.

### 포커스를 받는 상자 (계획서와 갈린 부분)

- **각 뷰의 맨 위 버튼이 아니라 감싸는 상자에 준다.** 계획서 처방은 「상세의 「목록으로」, 오늘의 서울의 「목록으로」, 목록의 요약 스트립」이었는데, **목록의 요약 스트립은 조회가 실패하면 아예 안 그려진다**(Task 9의 (F) 결정). 「맨 위 요소」가 뷰마다 있다고 말할 수가 없다. 상자는 뷰가 셋 중 무엇으로 갈리든 언제나 있고 **언마운트되지 않아** 「포커스를 옮긴 뒤 그 요소가 사라지면?」이 표현 불가능한 상태가 된다.
- **상자에 이름을 주지 않은 것은 고른 것이다.** `tabindex="-1"`인 div는 암묵 role이 `generic`이고 `generic`은 **이름 부여가 금지된** role이라 나중에 `aria-label`만 얹으면 조용히 무시된다. 이름을 주려면 `role="group"`이 함께 와야 한다. 안 준 이유는 이 상자가 뷰의 경계가 아니라 포커스 받침대일 뿐이고, 뷰의 정체는 안쪽 첫 요소(「목록으로」·요약 스트립)가 이미 말해서다. **포커스가 왔을 때 스크린리더가 실제로 무엇을 읽는지는 실기기 몫** — STATE.md 미해결.
- `preventScroll`은 jsdom에 레이아웃이 없어 **관측되지 않는다**(변이 M24 생존). 실기기 몫이다.
- 파급은 `HomeScreen` 한 파일에 그쳤다 — 시트 안 뷰 셋은 손대지 않았다.

### 빈 목록 안내를 소리로도 준다

「내 장소」를 0에서도 누를 수 있게 만든 이유가 「누르면 답이 나온다」인데, 칩을 눌러도 **포커스는 칩에 그대로** 있고 시트만 올라온다. 스크린리더에 가는 신호는 `aria-selected`의 「선택됨」 하나뿐이라 **접근성을 위해 만든 면제가 접근성 채널에서만 답을 안 주는** 꼴이었다. 빈 목록 문구 상자에 `role="status"`를 얹었다.

상자째 감싸므로 「필터 해제」 버튼의 존재까지 함께 낭독된다 — 그 버튼은 half에서 4.2px만 노출되는 자리라 소리로 먼저 알려주는 편이 오히려 낫다.

**대가**: 검색어를 한 글자씩 칠 때마다 문구가 바뀌어 낭독이 반복된다. 「내 장소일 때만」으로 좁히면 소음은 없어지지만 **규칙이 하나 더 늘고**, 어떤 빈 상태는 말하고 어떤 빈 상태는 침묵하는 화면이 된다. 검색 결과를 폴라이트 리전으로 알리는 것은 표준 패턴이기도 해서 일관성 쪽을 골랐다.


### 실측 (헤드리스 크롬 145, 390×844, `Emulation.setDeviceMetricsOverride`)

| 확인 항목 | 결과 |
| --- | --- |
| 지도가 화면을 꽉 채우는가 | `[data-map-layer]` = `top 0, left 0, 390×844` — **뷰포트와 정확히 같다** |
| 상단바가 없는가 | `<header>` 0개, `<nav>` 0개, `<main>` 1개, `<h1>` = 「서울 라이브」(높이 **1px** = `sr-only`) |
| 홈 루트 | `relative size-full overflow-hidden`, `top 0`, `height 844` |
| 3단 스냅 | half 388.2px(0.4600) → full 776.5px(0.9200) → peek 135.0px(0.1600) → half 388.2px. 라벨도 「절반/전체/살짝 열림」으로 따라온다 |
| 검색 바·칩이 지도 위에 | `[data-overlay]` **0~112px** (검색 바 64 + 간격 4 + 칩 줄 44), 검색창 1개, 칩 4개 |
| full에서 조작부가 물러나는가 | 오버레이 `false`, FAB `false` |
| 명소를 누르면 | 시트 0.9200, **지도 살아 있음**, 「목록으로」·「지금 누가 있나」·「저장」 모두 있음 |
| 저장 → 칩 | 「★내 장소 1」, 비활성 아님 |
| 요약 스트립 → 오늘의 서울 | 제목·「지금 가장 붐비는 곳」 모두 뜨고 **지도 살아 있음** |
| 포커스 | 상세 진입 시 `DIV[tabindex=-1]`, **시트 안**(`contains` = true). 오늘의 서울도 같다 |
| 하단 탭바 | 없음(`<nav>` 0개) |
| 콘솔 | `console.error` 0건, 미처리 예외 0건 |
| **C1 수정 실측** | 상세를 연 채 시트를 내려 **실제 키 이벤트**(CDP `Input.dispatchKeyEvent`)로 5글자를 쳤다 → 입력값 `gwang` **전부 남음**, 포커스 입력에 유지, 상세는 닫힘. 고치기 전에는 첫 글자만 남았다 |
| 상세 진입 포커스 | `DIV[tabindex="-1"]`, **시트 안**(I8 처방이 살아 있다) |
| 칩 탭 시 포커스 | 좌표를 눌러 실제 탭을 흉내 내니 포커스가 **칩에 남는다**(BUTTON/role=tab, 시트 밖) — `role="status"`가 필요한 이유를 그대로 확인 |
| 「내 장소 0」 경로 | 칩이 **비활성 아님** → peek에서 누르면 시트가 **half로 올라오고** 안내가 `top 779.8 / bottom 827.8`로 **온전히** 보인다(48px 전부). 마커 0개 → 해제하면 30개 복귀 |

**출구는 어디에 있나 — 문구만 재고 출구를 안 쟀던 것을 다시 쟀다**

리뷰가 「안내는 보이는데 **출구가 스크롤 뒤**」라고 지적했다. 절반만 맞다. half + 「내 장소 0」에서 실측:

| 요소 | 위치 | 보이는 높이 |
| --- | --- | --- |
| 안내 문구 | 779.8 ~ 827.8 | **48px 전부** |
| 「필터 해제」 버튼 | 839.8 ~ 887.8 | **4.2px** (시트 안 스크롤로 닿는다. `scrollHeight 484 > clientHeight 364`) |
| **선택된 「내 장소 0」 칩** | **68 ~ 108** | **40px 전부** |

**출구는 4.2px짜리가 아니다.** 켜는 순간 그 칩이 `aria-selected="true"`가 되고, `FilterChips`는 **선택된 칩을 다시 누르면 해제**한다(`onChange(selected ? null : chip)`). 칩 한가운데를 `elementFromPoint`로 찍어 **실제로 손에 닿는 것도 확인**했고(다른 요소에 안 덮인다), 다시 눌러 보니 목록 15행·마커 30개가 돌아왔다. 즉 화면 맨 위에 40px짜리 온전한 출구가 있고 「필터 해제」는 둘째 출구다.

**그래서 `full`로 올리자는 제안은 받지 않았다 — 그쪽이 오히려 나쁘다.** `full`에서는 칩 열 자체가 렌더되지 않으므로(Task 9의 결정) 방금 만진 칩이 손 밑에서 사라지고, 온전한 출구 하나를 **잃고** 「필터 해제」만 남는다. `half`는 문구·칩·목록·지도 위쪽을 한 화면에 두는 유일한 단계다.

남는 흠은 「필터 해제」가 4.2px만 노출된다는 것 하나이고, 그건 이 태스크가 만든 게 아니라 빈 목록 문구 위에 요약 스트립·위치 안내·카테고리·정렬이 얹혀 있는 Task 9의 목록 배치에서 온다. STATE.md 미해결로 넘긴다.

**되찾은 세로 공간 (뷰포트 844px, `1rem = 16px`)**

| | 컨테이너 | half | full |
| --- | --- | --- | --- |
| Task 9 (`100dvh − 7.5rem`) | 724.0 | 333.0 | 666.1 |
| 계획서 원안 (상단바 유지, `100dvh − 3.5rem`) | 788.0 | 362.5 | 725.0 |
| **지금 (`100dvh`)** | **844.0** | **388.2** | **776.5** |

**상단바를 없앤 몫만 따로 보면 컨테이너 +56px(정확히 3.5rem), half +25.7px, full +51.5px.** Task 9 대비로는 컨테이너 +120px(7.5rem), half +55.2px, full +110.4px다. 시트 높이는 컨테이너의 순수 비율이라(실측 388.234 = 0.46 × 844) 이 산술은 근사가 아니라 정확하다.

### 실측이 뒤집은 Task 9의 숫자 하나

Task 9의 주석은 「검색 바 + 칩 열」이 **0~88px**을 차지한다고 적었다. 실측은 **0~112px**이다(검색 바 64px + 간격 4px + 칩 줄 44px). 검색 바의 세로 패딩을 빠뜨린 오답이었다. **결론은 뒤집히지 않고 오히려 강해진다** — 컨테이너 800px 기준 full의 손잡이 히트 영역이 44~88px인데 112px짜리 열이 그것을 통째로 덮는다. `HomeScreen.tsx`와 `FilterChips.tsx`의 주석을 실측값으로 고쳤다. 이 열은 컨테이너 높이와 무관한 고정 높이라 기기가 달라져도 같다.

### 함께 지운 죽은 코드

`Icon.tsx`는 첫 줄에 **「쓰이지 않는 아이콘이 생기면 지울 것」이라고 스스로 규칙을 정해 뒀다.** `BottomTabBar`를 지우면서 `more`가 죽었는데 남겨 둬 파일이 제 규칙을 어긴 상태였다. `forecast`는 그보다 앞서(6cb3c18 시점에 이미) 죽어 있었다 — 둘 다 지웠다. 남은 13개는 사용처를 하나씩 확인했다. **`map`은 살아 있다** — 탭바 아이콘이기도 했지만 `ActionButtons`의 길찾기 링크가 쓴다. 탭바만 보고 지웠으면 화면이 깨졌다.

### 함께 고친 낡은 주석

컨테이너가 `100dvh − 7.5rem`에서 `100dvh`가 되면서 `RecenterButton`의 「**실기기에서는 언제나 잘린다**」가 거짓이 됐다. `0.06H ≥ 48 ⟺ H ≥ 800px`이라는 산식은 그대로지만, 예전에는 800px 컨테이너를 위해 뷰포트가 920px이어야 했고 지금은 800px이면 된다 — 세로가 긴 기기에서는 안 잘릴 수 있다. 그래도 `full`에서 안 그리는 결정은 유지했다: 화면 높이로 갈라 그리면 규칙이 둘로 늘고, 그 갈림은 jsdom이 못 잡는 기하라 회귀를 테스트로 막을 수도 없다. `HomeScreen.tsx`·`HomeScreen.test.tsx`의 같은 주장도 함께 고쳤다.

### 변이 테스트 (32건 중 30건 사망 / 2건 생존)

| # | 변이 | 잡은 테스트 |
| --- | --- | --- |
| M1 | `<main>` → `<div>` | 1개 — 앱이 자체 헤더를… |
| M2 | `sr-only` h1 삭제 | 1개 — 같음 |
| M3 | h1 이름을 「Seoul Live」로 | 1개 — 같음 |
| M4 | `<header>`(banner)를 되살린다 | 1개 — 같음 |
| M5 | `<nav>` 탭바를 되살린다 | 1개 — 갈 곳을 고르는 탭바가 없다 |
| M7 | 「내 장소」 0 면제를 되돌린다 | 6개 |
| M8 | 0-비활성 규칙을 통째로 제거 | 2개 — 0인 프리셋은 비활성이다 / 비활성인 칩을 눌러도 값이 안 올라간다 |
| M9 | 빈 상태 안내 분기 제거 | 2개 |
| M10 | `favorites.length` → `counts.fav` | 1개 — 필터 때문에 목록이 비면 그 필터를 이름으로 지목한다 |
| M11 | 안내가 보이게 시트를 올리는 처리 제거 | 1개 |
| M12 | 어떤 칩을 눌러도 half로 올린다 | 1개 — 다른 칩은 시트를 건드리지 않는다 |
| M15 | 포커스 상자의 `tabIndex` 제거 | 1개 |
| M16 | 순위 목록이 언제나 1위를 연다 | 1개 |
| M17 | 목록 행 선택 콜백 제거 | 7개 |
| M19 | 요약 스트립의 오늘의 서울 통로 제거 | 5개 |
| M22 | 「필터 해제」 버튼 제거 | 2개 |
| M25 | 실패하면 목록도 감춘다 | 1개 |
| P5 | `!selected` 예외 제거 | 1개 — 선택된 칩은 0이 돼도 해제할 수 있다 (소재를 `hot`으로 고친 뒤에야 죽는다) |
| P1 | 상세에서 돌아올 때 `setQuery('')` | 1개 — 시트 안에서 뷰를 오가도 검색어가 남는다 |
| P2 | 오늘의 서울 열 때 카메라 리셋 | 1개 — 시트 안에서 뷰를 오가도 지도 카메라가 남는다 |
| Q1 | 요청 없이 매 커밋 포커스 이동 (**C1 회귀**) | **7개** |
| Q2 | `openArea`의 포커스 요청 제거 | 1개 |
| Q4 | 상세→목록의 포커스 요청 제거 | 1개 |
| Q5 | 오늘의 서울→목록의 포커스 요청 제거 | 1개 (**처음엔 생존** — 아래) |
| Q6 | 스트립→오늘의 서울의 포커스 요청 제거 | 1개 |
| Q3 | 빈 목록 안내의 `role="status"` 제거 | 1개 |

M13(포커스 이동 제거)·M14(첫 렌더 가드 제거)는 옛 `viewKey` 구현 기준이라 표에서 뺐다 — 지금은 Q1·Q2·Q4~Q6이 같은 자리를 더 촘촘히 덮는다. 첫 렌더 침묵은 이제 구조가 보장한다(요청이 없으면 안 옮긴다).

**M12와 M16은 처음에 살아남았고, 원인은 구현이 아니라 내 테스트였다.**
- M12: 눌렀던 「지금 핫플」이 이 파일의 기본 목업(전부 '보통')에서 0이라 **비활성**이었다. 비활성 칩 클릭은 아무 일도 안 하므로 무엇을 넣든 통과한다. 활성인 「데이트」로 바꾸고 `toBeEnabled()`를 앞에 세웠다.
- M16: 순위 목록의 **첫 줄**을 눌렀는데, `areas[0]`을 여는 변이는 첫 줄에서 정답과 구별되지 않는다. **둘째 줄**로 바꿨다.

**Q5도 처음엔 살아남았다 — 세 번째로 내 테스트 탓이었다.** 포커스 테스트가 목록→상세→목록→오늘의 서울까지만 걸어서 **「오늘의 서울 → 목록」 복귀 경로**를 안 밟았다. 넷째 다리를 더해 잡았다. M12·M16과 같은 종류이고 세 번 반복됐다 — **변이가 살아남으면 구현보다 테스트를 먼저 의심하는 편이 맞다.**

**살아남은 변이 2건 — 둘 다 「테스트를 더 쓸 자리가 아니다」.** (M18은 목록에서 빠졌다 — `viewKey`가 통째로 사라져 변이시킬 코드가 없다.)

| # | 변이 | 왜 안 잡히나 |
| --- | --- | --- |
| M6 | `<main>`의 `h-dvh` 제거 | **jsdom에 레이아웃이 없다.** 이걸 빼면 `size-full`이 auto 높이 부모를 만나 지도가 0px로 접히는데, 그 붕괴는 기하다. 헤드리스 크롬 실측(지도 390×844)이 대신 지킨다 |
| M24 | `preventScroll` 제거 | jsdom이 옵션을 무시한다. 시트가 스크롤 컨테이너라는 사실 자체가 레이아웃이다 — 실기기 몫 |

### 리뷰가 잡은 순감 셋 — 「저쪽이 같은 것을 잡는가」의 **거울상**

계획서 교훈은 「테스트를 지울 때 **저쪽이 같은 것을 잡는가**를 봐라」였다. 세 건 모두 그 교훈의 **반대편**에서 나왔다.

1. **`FilterChips.test`「선택된 칩은 0이 돼도 해제할 수 있다」의 소재가 하필 `fav`였다.** 이 테스트가 지키던 것은 예외 (1) `!selected`인데, 내가 예외 (2) `chip !== 'fav'`를 더하는 순간 **같은 테스트가 다른 이유로 통과**하게 됐다. 변이 P5(`!selected` 삭제)가 생존했다 → 소재를 `hot`으로 바꿔 잡았다(P5 사망 확인). 테스트 안에 「소재가 `fav`이면 안 되는 이유」를 못 박아 뒀다.
2. **「탭을 오가도 홈의 상태가 남는다」를 「대체 불가」로 너무 빨리 판정했다.** 위 표 참조.
3. **`toBeDisabled()`를 `toBeInTheDocument()`로 약화**시켰다. 면제 이후의 대칭 단언은 `toBeEnabled()`다 — 고치고 나니 변이 M7이 잡는 테스트가 **4개에서 6개로** 늘었다.

**그래서 교훈에 한 면을 덧댄다:**

> 테스트를 **지울** 때는 「저쪽이 같은 것을 잡는가」를 물어라.
> 코드의 **조건을 넓힐** 때는 「**이쪽이 아직도 같은 것을 잡는가**」를 물어라.
> 예외를 하나 더하면, 그 예외에 걸리는 소재를 쓰던 기존 테스트는 **조용히 공허해진다.** 조건에 항을 더했으면 **그 조건을 지키던 테스트의 소재를 다시 골라라.**

기계적으로 확인하는 법: 항을 더한 뒤 **기존 항을 하나씩 지워 보고**(P5식) 여전히 죽는지 본다. 안 죽으면 그 항의 테스트가 소재를 잘못 골랐다는 뜻이다.

### 판단해서 **하지 않은 것**

**`emptyMessage`의 4단 삼항을 `domain/`으로 빼지 않았다.** 리뷰가 「순수 함수에 분기가 넷인데 화면을 통째로 렌더해야 닿는다」며 제안했고 판단을 넘겼다. 안 한 이유:

- 네 분기 중 **마지막 「조건에 맞는 명소가 없어요」는 지금 카탈로그로는 도달할 수 없다.** `filter === null`이면 `filterAreas`가 목록을 그대로 돌려주고 `query === ''`면 `searchAreas`도 그대로다. 즉 `list` 자체가 비어야 하는데 모든 카테고리에 명소가 있다. 빼서 단위 테스트를 붙여봐야 **도달 불가능한 분기를 테스트**하게 된다.
- 나머지 셋은 `HomeScreen.test`가 이미 각각 잠그고 있고 변이(M9·M10)로 확인했다.
- 이 분기를 설명하는 24줄짜리 UX 근거 주석은 **그것이 정당화하는 목록 창(listPane) 옆에 있을 때** 값이 있다. `domain/`으로 옮기면 「왜 카테고리는 지목하지 않는가」 같은 화면 이야기가 도메인 파일에 남는다.

카테고리가 비는 날이 오면(카탈로그 축소·API 화이트리스트 변경) 그때가 뺄 자리다.

**`HomeScreen`을 쪼개지 않았다.** 함수가 434줄로 「50줄 미만」 규약 밖이지만, Task 9에서 이미 계산한 대로 `listPane`을 빼면 prop이 10개인 컴포넌트가 생겨 결합이 늘기만 한다. 늘어난 줄의 대부분(158줄)은 근거 주석이다.

### 검증

- `npm test` — **616개 통과 + 1 todo** (Task 9의 612 + 1에서 순변화 **+4**: 지운 8개, 새로 쓴 12개)
  - 파일별(실행 기준): `FavoritesScreen` 6 → 0 / `HomeScreen` 38 → 47 / `FilterChips` 16 → 17(`it.each` 둘이 4건씩 펼쳐진다) / `App` 12 → 12. 합 72 → 76
- `npx tsc -b --force` / `npm run lint` / `npm run build:vite` — 전부 통과
- 변이 **32건 중 30건 사망**, 생존 2건은 jsdom이 못 보는 기하다

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

「구조」 절의 `src/screens/`를 `HomeScreen` 하나로 고치고, **`src/components/layout/` 줄을 지운다** — Task 10에서 `TopAppBar`까지 사라져 디렉터리가 비었다.

**상단바가 없다는 것도 적어라.** 앱에 자체 헤더가 없고(토스가 네이티브 헤더를 준다) 지도 위 검색 바가 그 자리를 쓴다. 제목은 `sr-only` h1 「서울 라이브」로만 남아 있다.

- [ ] **Step 2: `PLAN.md`**

- 1차 절의 탭 서술을 "2026-08-10 개편으로 단일 화면이 됐다"로 정정
- 2차 즐겨찾기 항목에 "탭이 아니라 필터 칩"을 적는다. **빈 상태 안내가 어디로 갔는지도 함께** — 「내 장소」 칩은 0에서도 눌리고, 누르면 빈 목록 문구가 「아직 담은 곳이 없어요. 명소를 열고 「저장」을 누르면 여기에 모여요.」로 답한다
- 3차에 **인구 구성이 추가 호출 없이 붙었다**를 적고, 미착수 항목에서 도로소통·사고통제만 남긴다

- [ ] **Step 3: `STATE.md`**

- 「한 줄 요약」을 단일 화면 구조로
- 「파일 구조」를 새 디렉터리로. **실행 중 계획서에 없던 파일이 셋 늘었다 — 빠뜨리지 마라:**
  - 추가: `domain/sheet.ts`, `domain/composition.ts`, `data/compositionSchema.ts`, `components/home/BottomSheet.tsx`, `components/home/SummaryStrip.tsx`, `components/home/FilterChips.tsx`, `components/home/PopulationCard.tsx`, **`components/list/AreaList.tsx`**(Task 4 — 구분선 목록의 행 간격 계약을 소유), **`hooks/favoritesStore.ts`**(Task 6 — 즐겨찾기 단일 출처)
  - 삭제: `domain/split.ts`, `components/home/SplitPane.tsx`, `components/map/PresetFilter.tsx`, `screens/FavoritesScreen.tsx`, `components/layout/BottomTabBar.tsx`, **`components/layout/TopAppBar.tsx`** — **`components/layout/` 디렉터리가 통째로 사라졌다.** 파일 구조 표에서 그 줄을 지워라
- 「검증 수치」 갱신
- **새 미해결 항목** (대부분 실기기로만 확인된다. 마지막 하나는 제품 결정이다):
  - 시트 드래그와 지도 팬 제스처 충돌
  - 시트 내용 스크롤과 시트 드래그 충돌
  - 인구 구성 필드의 실제 형태 (응답을 아직 본 적이 없다)
  - **손잡이 히트 영역이 지도 위 20px을 삼킨다** — `peek`에서 화면 84% 지점을 가로지르는 죽은 띠가 된다 (Task 3)
  - **FAB이 손잡이 히트 영역의 오른쪽 구석과 겹친다**(peek·half) — 겹치는 양이 `20px − 0.02×컨테이너높이`라 화면이 작을수록 는다(800px에서 4px, 713px에서 8px). 폭 48px짜리 구석이고 손잡이의 보이는 띠는 가운데 36px이라 실제로 막지는 않는다고 봤다. `full`은 아예 안 그리므로 해당 없다 (Task 9)
  - **`preventScroll` 없이 포커스를 옮기면 시트가 튀는지** — 시트 내용이 스크롤 컨테이너라 기본 `scrollIntoView`가 방금 연 뷰를 맨 위가 아닌 곳에서 시작시킬 수 있다. jsdom은 이 옵션을 무시하므로 테스트로 확인되지 않는다 (Task 10)
  - **`h-dvh`가 토스 웹뷰에서 실제로 뷰포트를 주는지** — 셸이 `<main className="h-dvh">` 하나가 되면서 지도 높이가 전부 여기 달려 있다. 이 값이 틀어지면 `size-full`인 홈 루트가 auto 부모를 만나 **지도가 0px로 접힌다.** 헤드리스 크롬(390×844)에서는 정확히 뷰포트를 받았지만 iOS 주소창·안전 영역이 낀 실기기는 미확인 (Task 10)
  - **포커스 상자에 포커스가 왔을 때 스크린리더가 무엇을 읽는지** — `tabindex="-1"`인 익명 div는 암묵 role이 `generic`이라 아무것도 안 읽거나 상자 안 텍스트를 통째로 읽을 수 있다(목록 뷰면 명소 30곳). 이름을 주려면 `role="group"`이 함께 와야 한다 — `generic`은 name-prohibited라 `aria-label`만 얹으면 조용히 무시된다 (Task 10)
  - **빈 목록 안내의 `role="status"`가 타이핑 중 얼마나 시끄러운지** — 검색어 한 글자마다 문구가 바뀌어 다시 낭독된다. 표준 패턴이지만 체감은 실기기 몫이다. 「내 장소일 때만」으로 좁히는 대안은 규칙이 하나 느는 쪽이라 택하지 않았다 (Task 10)
  - **빈 「내 장소」 안내의 「필터 해제」 버튼이 half에서 4.2px만 노출된다** — 문구(48px)와 선택된 칩(40px)은 온전히 보이고 칩을 다시 눌러 해제할 수 있으므로 갇히지는 않는다. 원인은 빈 목록 문구 위에 요약 스트립·위치 안내·카테고리·정렬이 얹힌 Task 9의 목록 배치다. 작은 기기에서 더 나빠지는지는 실기기 몫 (Task 10)
  - **필터 칩 이름 셋이 참고 앱 「서울 인파레이더」의 것과 같다** — 「아이와 나들이」·「데이트」·「지금 핫플」. 사용자가 **이번 브랜치에서는 그대로 두기로** 정했다. 바꿀 거면 `domain/presets.ts`의 `PRESETS`가 정본이고(칩·빈 목록 문구가 모두 `filterLabel`을 통해 읽는다) 이름을 박아둔 테스트가 `FilterChips.test.tsx`·`HomeScreen.test.tsx`에 있다 (Task 10 이월)
  - **`releasePointerCapture`가 던지는 브라우저가 있는지** — 던지면 손잡이가 영구히 죽는 경로를 `try/catch`로 막아 뒀지만 실제로 던지는지는 미확인 (Task 3)
  - **즐겨찾기 별의 접근성 이름이 실기기에서 들리는지** — `<span role="img" aria-label>`로 고쳤으나 jsdom은 `generic`의 name-prohibited를 모형화하지 않아 테스트로는 검증 불가 (Task 4)
- **해소된 항목**:
  - **뷰가 갈릴 때 포커스가 `document.body`로 떨어지던 것** — Task 10이 시트 내용을 `tabIndex={-1}` 상자로 감싸고 뷰가 갈릴 때 `focus({ preventScroll: true })`를 부른다. 첫 렌더에서는 뺏지 않는다. 다만 **`preventScroll`이 실제로 필요한지는 실기기 몫**이다(아래 미해결로 남긴다) (Task 9·10)
  - 별 아이콘 채움 상태 미검증 — 라벨 있는 「저장」 버튼이 되면서 사라짐
  - **`full`에서 손잡이가 `z-20` 오버레이 밑에 들어가던 것** — Task 9가 `full`에서 검색 바·칩 열을 렌더하지 않기로 정해 해소됐다. 개발 서버를 헤드리스 크롬으로 띄워 `elementFromPoint`로 확인: `full`에서 손잡이 위쪽 띠의 왼쪽·가운데 모두 손잡이가 잡힌다 (Task 3·9)
  - **필터 칩 높이 `min-h-10`(40px)** — Task 9에서 40px로 확정했다. 「검색 바 + 칩 열」 예산이 이 값에 달려 있고 그것이 곧 위 항목의 근거다. **Task 10 실측으로 그 예산을 0~88px에서 0~112px로 정정했다**(검색 바 64 + 간격 4 + 칩 줄 44 — Task 9가 검색 바의 세로 패딩을 빠뜨렸다). 결론은 강해졌을 뿐 바뀌지 않는다. 48px로 올리려면 `HomeScreen`의 오버레이 조건부 렌더 근거부터 다시 계산해야 한다 (Task 6·9·10)
  - **`transition-[height]`가 스크롤 위치를 버린다던 것** — 실측 결과 보존된다. 자세한 숫자는 Task 9의 (B) (Task 3·9)
  - **`useFavorites`가 인스턴스마다 따로 놀던 것** — `favoritesStore`로 단일 출처가 됐다. 이전에는 홈의 칩과 상세의 별이 서로를 못 봤다
- 「진행하며 실제로 잡은 문제」에 이번 개편 표를 더한다. **리뷰가 잡은 것 위주로 적어라** — 계획서 코드를 그대로 받아썼으면 남았을 결함들이다:
  - `residentLabel`이 못 읽은 0으로 「동네 생활권」을 단정하던 것
  - `Number('0x1f') === 31` — 관대한 파서가 그럴듯한 틀린 값을 만들던 것
  - `pointercancel`을 확정으로 다뤄 취소된 제스처가 시트를 `full`로 밀어 올리던 것
  - 목록 개수를 `favorites.length`로 세서 칩에 2, 목록에 0이 뜨던 것
  - 인구 구성 막대를 실제 합으로 정규화해 없는 분포를 지어내던 것
  - **Task 10이 실측으로 뒤집은 Task 9의 숫자** — 「검색 바 + 칩 열 = 0~88px」이 실은 0~112px이었다(검색 바 세로 패딩 누락). 결론은 그대로지만 근거 숫자가 틀려 있었다
  - **Task 10이 무효화한 Task 9의 주장** — `RecenterButton`의 「실기기에서는 언제나 잘린다」. 컨테이너가 `100dvh − 7.5rem`에서 `100dvh`가 되면서 필요 뷰포트가 920px에서 800px로 내려가 거짓이 됐다. 결정(`full`에서 안 그린다)은 유지하되 근거를 다시 썼다
  - **파일을 지우며 잃을 뻔한 보호** — `FavoritesScreen.test`의 「혼잡도 조회가 실패해도 담은 목록은 보여준다」를 저쪽이 잡고 있지 않았다. 「같은 이름의 테스트가 저쪽에 있는가」가 아니라 「저쪽이 **같은 것을** 잡는가」를 세어야 잡히는 종류다 (Task 10)

- [ ] **Step 4: `AGENTS.md`**

- 레이어 규칙의 화면 목록을 `HomeScreen` 하나로. **`src/components/layout/`은 더 이상 없다**
- **새 조항**: 앱 셸은 `<main className="h-dvh">` 하나다. 여기에 헤더·탭바를 다시 얹지 마라 — 세로 공간은 시트의 것이고, 토스가 네이티브 헤더를 준다. `h-dvh`를 빼면 지도가 0px로 접힌다
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
- [x] `npm run dev`로 띄워 Task 10의 실측 표(열한 항목)를 헤드리스 크롬 + CDP로 **숫자로** 확인 — 눈으로 못 보므로 좌표·높이·비율로 잰다
- [ ] 콘솔 에러 0건
- [ ] **인구 구성 필드를 목업에서 지워도 혼잡도 화면이 그대로 선다** (설계 §2.6의 핵심 안전망)
