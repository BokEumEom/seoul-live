# 지도 홈 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 화면 넷(내 주변·지도·혼잡예보·더보기)을 셋(지도·즐겨찾기·더보기)으로 바꾸고, 지도를 홈으로 올려 목록과 인플레이스 상세를 흡수시킨다.

**Architecture:** 지도 홈이 지도(위)와 목록(아래)을 드래그 손잡이로 나눠 갖는다. 명소를 누르면 지도는 남고 목록 자리만 상세로 바뀐다. 비워진 「더보기」는 이미 받는 스냅샷을 다르게 집계하는 「오늘의 서울」이 된다. 카테고리는 서울시 공식 5종으로 바꾸고, 프리셋은 카테고리에서 떼어내 독립 목적 태그로 옮긴다.

**Tech Stack:** React 19.2.8, TypeScript, Vite, TanStack Query, Tailwind v4, `@vis.gl/react-google-maps`, Vitest + Testing Library, 앱인토스 `@apps-in-toss/web-framework`

설계 문서: [`docs/superpowers/specs/2026-08-07-map-home-redesign-design.md`](../specs/2026-08-07-map-home-redesign-design.md)

## Global Constraints

- **TDD.** 실패하는 테스트 먼저 → 실패 확인 → 구현 → 통과 확인 → 커밋.
- **변이 테스트.** 새 테스트를 쓴 뒤 구현을 일부러 한 줄 깨뜨려 그 테스트가 실제로 실패하는지 확인한다. 이 프로젝트에서 "항상 참인 테스트"를 세 번 잡은 방법이다.
- **불변성.** 배열은 `.sort()` 대신 `.toSorted()`. TanStack Query 캐시 배열을 제자리 정렬하면 캐시가 오염된다.
- **`src/domain/`에서 React를 import하지 않는다.**
- **컴포넌트는 `fetch`를 직접 부르지 않는다.** `src/data/queries.ts`의 훅만 쓴다.
- **앱인토스 SDK는 `src/platform/`에서만 import 한다.**
- **Google Maps SDK는 지도를 그리는 화면에서만 import 한다.** 키·Map ID는 `src/platform/googleMaps.ts`가 유일하게 안다.
- **동적 Tailwind 클래스 금지.** Tailwind v4는 정적 추출이라 `` `bg-${tone}` `` 같은 조합은 빌드에서 사라진다. 리터럴 맵을 쓴다.
- **글자 크기는 토큰으로.** `text-sm` 대신 `text-label-md`처럼 시안 스케일을 쓴다.
- **`console.log` 금지.** 진단은 `console.error`.
- **파일은 200~400줄이 보통, 800줄이 상한.**
- 커버리지 임계: 라인·구문·함수 80%, 브랜치 75%.
- 작업을 마쳤다고 보고하기 전 `npm test`와 `npx tsc -b`를 통과시킬 것.

---

## File Structure

**신규**

| 파일 | 책임 |
|---|---|
| `src/domain/search.ts` | 명소명 부분일치 |
| `src/domain/summary.ts` | 「오늘의 서울」 집계 |
| `src/domain/split.ts` | 분할 비율 clamp·스냅 |
| `src/platform/favorites.ts` | 즐겨찾기 영속화 (앱인토스 스토리지 → localStorage 폴백) |
| `src/hooks/useFavorites.ts` | 즐겨찾기 상태 |
| `src/hooks/useHomeFilters.ts` | 홈의 필터 상태 여섯 |
| `src/components/home/SplitPane.tsx` | 드래그 분할 |
| `src/components/home/SearchBar.tsx` | 검색 입력 + 내 주변 |
| `src/components/home/AreaDetail.tsx` | 인플레이스 상세 |
| `src/components/list/SortSegmented.tsx` | 정렬 3종 분절 컨트롤 |
| `src/components/today/SummaryCard.tsx` | 혼잡도 분포 한 줄 |
| `src/components/today/RankList.tsx` | TOP N 목록 |
| `src/components/today/CategoryAverages.tsx` | 카테고리별 평균 |
| `src/components/today/AlertDigest.tsx` | 재난문자 모음 |
| `src/screens/HomeScreen.tsx` | 지도 홈 조립 |
| `src/screens/FavoritesScreen.tsx` | 즐겨찾기 탭 |
| `src/screens/TodayScreen.tsx` | 오늘의 서울 |

**이동**

| 이전 | 이후 |
|---|---|
| `src/components/nearby/` | `src/components/list/` (AreaListItem, CategoryFilter, LocationNotice) |
| `src/components/nearby/RecommendationCard.tsx` | `src/components/today/RecommendationCard.tsx` |
| `src/components/more/` | `src/components/cityinfo/` (AlertBanner, WeatherCard, ParkingList, BikeList, EventList, InfoSection) |

**삭제**

`src/components/map/AreaSheet.tsx`, `src/components/more/AreaPicker.tsx`, `src/components/nearby/SortSelect.tsx`, `src/screens/NearbyScreen.tsx`, `src/screens/ForecastScreen.tsx`, `src/screens/MapScreen.tsx`, `src/screens/MoreScreen.tsx` (그리고 각각의 테스트 파일)

**수정**

`src/domain/types.ts`, `src/domain/presets.ts`, `src/data/areas.ts`, `src/hooks/useNearbyAreas.ts`, `src/components/layout/BottomTabBar.tsx`, `src/App.tsx`

---

## Task 1: 카테고리를 공식 5종으로 교체

`AreaCategory`는 유니온 타입이라 값을 바꾸는 순간 소비처가 전부 컴파일 에러가 난다. 그래서 타입·카탈로그·프리셋·필터 칩을 한 태스크로 묶는다. 이 태스크가 끝나면 앱이 그대로 빌드되고 동작해야 한다.

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/data/areas.ts`
- Modify: `src/domain/presets.ts`
- Modify: `src/components/nearby/CategoryFilter.tsx`
- Test: `src/data/areas.test.ts`, `src/domain/presets.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `type AreaCategory = '관광특구' | '고궁·문화유산' | '인구밀집지역' | '발달상권' | '공원'`
  - `type Purpose = 'kids' | 'date'`
  - `const CATEGORY_LABEL: Readonly<Record<AreaCategory, string>>`
  - `interface AreaCatalogEntry` 에 `readonly purposes?: readonly Purpose[]` 추가

- [ ] **Step 1: 마이그레이션 성질을 고정하는 실패 테스트를 쓴다**

핵심은 **프리셋 결과가 교체 전후로 같아야 한다**는 것이다. 이전 정의(`카페 ∪ 문화재 ∪ 공원`)가 19곳이었으므로 태그로 옮긴 뒤에도 19곳이어야 한다. 이게 어긋나면 태그를 잘못 붙인 것이다.

`src/data/areas.test.ts`에 추가:

```ts
import { AREA_CATALOG } from './areas'
import { CATEGORY_LABEL } from '../domain/types'

describe('공식 카테고리 마이그레이션', () => {
  it('카탈로그 30곳이 공식 분류로만 이루어진다', () => {
    const counts = AREA_CATALOG.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.category] = (acc[entry.category] ?? 0) + 1
      return acc
    }, {})

    expect(counts).toEqual({
      발달상권: 12,
      공원: 10,
      관광특구: 3,
      '고궁·문화유산': 3,
      인구밀집지역: 2,
    })
  })

  it('「기타」가 사라진다', () => {
    expect(AREA_CATALOG.some((e) => (e.category as string) === '기타')).toBe(false)
  })

  it('이름에 관광특구가 든 명소는 관광특구로 분류된다', () => {
    const specials = AREA_CATALOG.filter((e) => e.name.includes('관광특구'))
    expect(specials).toHaveLength(3)
    for (const entry of specials) {
      expect(entry.category).toBe('관광특구')
    }
  })

  it('목적 태그가 이전 프리셋 범위를 그대로 옮긴다', () => {
    const kids = AREA_CATALOG.filter((e) => e.purposes?.includes('kids'))
    const date = AREA_CATALOG.filter((e) => e.purposes?.includes('date'))
    // 이전 정의: kids = 공원(10), date = 카페(3) ∪ 문화재(6) ∪ 공원(10) = 19
    expect(kids).toHaveLength(10)
    expect(date).toHaveLength(19)
  })

  it('모든 공식 분류에 화면 라벨이 있다', () => {
    for (const entry of AREA_CATALOG) {
      expect(CATEGORY_LABEL[entry.category]).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/data/areas.test.ts`
Expected: FAIL — `CATEGORY_LABEL`이 없어 import 에러, 그리고 카테고리 분포 불일치

- [ ] **Step 3: `src/domain/types.ts`를 고친다**

```ts
// 서울시 공식 분류. 출처는 저장소의 `실시간 도시데이터 매뉴얼.pdf` p9~10
// 「주요장소 목록」이다. 121곳 확장 시 매뉴얼에서 그대로 가져올 수 있다.
//
// 30곳 구간에서는 분포가 쏠린다(발달상권 12 / 공원 10 / 관광특구 3 /
// 고궁·문화유산 3 / 인구밀집지역 2). 121곳에서는 48/33/28/7/5로 균형이
// 잡히므로 이 쏠림은 임시 비용이다. 설계 문서 §2.5 참고 — 되돌리지 마라.
export const AREA_CATEGORIES = [
  '관광특구',
  '고궁·문화유산',
  '인구밀집지역',
  '발달상권',
  '공원',
] as const

export type AreaCategory = (typeof AREA_CATEGORIES)[number]

// 「인구밀집지역」·「발달상권」은 행정 용어라 화면에 그대로 쓰지 않는다.
// 데이터는 공식 값을 갖고 표시만 바꾼다.
export const CATEGORY_LABEL: Readonly<Record<AreaCategory, string>> = {
  관광특구: '관광특구',
  '고궁·문화유산': '고궁·유적',
  인구밀집지역: '역·번화가',
  발달상권: '상권·거리',
  공원: '공원',
}

// 프리셋용 목적 태그. 카테고리와 축이 다르다 — 카테고리는 "어떤 성격의
// 구역인가"이고 이건 "거기서 뭘 하려는가"다. 광장(전통)시장과 청담동
// 명품거리가 같은 발달상권인데 데이트 적합성은 정반대다.
//
// 'hot'은 없다. 「지금 핫플」은 혼잡도만 보므로 태그가 필요 없다.
export type Purpose = 'kids' | 'date'

export interface AreaCatalogEntry extends Coords {
  readonly code: string
  readonly name: string
  readonly category: AreaCategory
  /** 없으면 나들이·데이트 프리셋에 걸리지 않는다. 121곳 확장 시 태그가
   *  없는 명소가 조용히 오분류되지 않고 그냥 빠지게 하려는 것이다. */
  readonly purposes?: readonly Purpose[]
}
```

- [ ] **Step 4: `src/data/areas.ts`의 30곳을 재분류한다**

각 항목의 `category`를 아래 표대로 바꾸고 `purposes`를 붙인다. 매핑은 매뉴얼 p9~10과 기계 대조로 확정한 값이다.

| name | category | purposes |
|---|---|---|
| 강남역 | 인구밀집지역 | — |
| 홍대입구역(2호선) | 인구밀집지역 | — |
| 명동 관광특구 | 관광특구 | — |
| 광화문·덕수궁 | 고궁·문화유산 | `['date']` |
| 여의도한강공원 | 공원 | `['kids','date']` |
| 반포한강공원 | 공원 | `['kids','date']` |
| 뚝섬한강공원 | 공원 | `['kids','date']` |
| 성수카페거리 | 발달상권 | `['date']` |
| 북촌한옥마을 | 발달상권 | `['date']` |
| 경복궁 | 고궁·문화유산 | `['date']` |
| 창덕궁·종묘 | 고궁·문화유산 | `['date']` |
| DDP(동대문디자인플라자) | 발달상권 | — |
| 이태원 관광특구 | 관광특구 | — |
| 잠실 관광특구 | 관광특구 | — |
| 서울숲공원 | 공원 | `['kids','date']` |
| 남산공원 | 공원 | `['kids','date']` |
| 월드컵공원 | 공원 | `['kids','date']` |
| 어린이대공원 | 공원 | `['kids','date']` |
| 잠실한강공원 | 공원 | `['kids','date']` |
| 잠원한강공원 | 공원 | `['kids','date']` |
| 가로수길 | 발달상권 | — |
| 연남동 | 발달상권 | `['date']` |
| 인사동 | 발달상권 | `['date']` |
| 서촌 | 발달상권 | `['date']` |
| 압구정로데오거리 | 발달상권 | — |
| 청담동 명품거리 | 발달상권 | — |
| 영등포 타임스퀘어 | 발달상권 | — |
| 해방촌·경리단길 | 발달상권 | `['date']` |
| 광장(전통)시장 | 발달상권 | — |
| 북서울꿈의숲 | 공원 | `['kids','date']` |

예시 (첫 두 줄):

```ts
{ code: 'POI014', name: '강남역', lat: 37.498, lng: 127.0276, category: '인구밀집지역' },
{ code: 'POI009', name: '광화문·덕수궁', lat: 37.5709, lng: 126.9769, category: '고궁·문화유산', purposes: ['date'] },
```

- [ ] **Step 5: `src/domain/presets.ts`를 목적 태그 기반으로 고친다**

`DATE_CATEGORIES` 상수를 지우고 `matches`를 바꾼다.

```ts
import { isUncrowded } from './congestion'
import type { NearbyArea, Purpose } from './types'

export type PresetKey = 'kids' | 'date' | 'hot'

export interface Preset {
  readonly key: PresetKey
  readonly label: string
  readonly matches: (area: NearbyArea) => boolean
}

function hasPurpose(area: NearbyArea, purpose: Purpose): boolean {
  return area.entry.purposes?.includes(purpose) ?? false
}

// 스냅샷이 없는 명소는 어느 프리셋에도 걸리지 않는다. 혼잡도를 모르는데
// "한산하다"고 말할 수 없다. 지도 전체 보기에서는 회색 "정보 없음" 마커로
// 남지만 프리셋을 켜면 빠진다.
export const PRESETS: readonly Preset[] = [
  {
    key: 'kids',
    label: '아이와 나들이',
    matches: (area) =>
      hasPurpose(area, 'kids') &&
      area.snapshot !== null &&
      isUncrowded(area.snapshot.congestion),
  },
  {
    key: 'date',
    label: '데이트',
    // 붐빔을 뺀다. 태그만으로 잡으면 카탈로그상 항상 19곳으로 고정돼,
    // 옆의 두 칩이 시간대마다 바뀌는 사이에서 혼자 죽은 숫자가 된다.
    matches: (area) =>
      hasPurpose(area, 'date') &&
      area.snapshot !== null &&
      area.snapshot.congestion !== '붐빔',
  },
  {
    key: 'hot',
    label: '지금 핫플',
    matches: (area) => area.snapshot?.congestion === '붐빔',
  },
]
```

`filterByPreset`·`countMatching`·`presetCounts`는 그대로 둔다.

- [ ] **Step 6: `presets.test.ts`에 태그 없는 명소 규칙을 추가한다**

```ts
it('목적 태그가 없는 명소는 나들이·데이트에 안 걸리고 핫플에는 걸린다', () => {
  const untagged: NearbyArea = {
    entry: { code: 'X', name: '태그없음', lat: 0, lng: 0, category: '발달상권' },
    snapshot: makeSnapshot('붐빔'),
    distanceMeters: null,
  }
  expect(filterByPreset([untagged], 'kids')).toHaveLength(0)
  expect(filterByPreset([untagged], 'date')).toHaveLength(0)
  expect(filterByPreset([untagged], 'hot')).toHaveLength(1)
})
```

기존 테스트에서 `category: '카페'`·`'문화재'`·`'기타'`를 쓰는 곳은 공식 값으로 바꾸고, 프리셋 대상이어야 하는 항목에는 `purposes`를 붙인다.

- [ ] **Step 7: `CategoryFilter.tsx`가 공식 분류와 라벨을 쓰게 한다**

```ts
import { AREA_CATEGORIES, CATEGORY_LABEL } from '../../domain/types'
import type { CategoryFilterValue } from '../../hooks/useNearbyAreas'

const OPTIONS: readonly CategoryFilterValue[] = ['전체', ...AREA_CATEGORIES]

function labelOf(option: CategoryFilterValue): string {
  return option === '전체' ? '전체' : CATEGORY_LABEL[option]
}
```

`{option}`을 그리던 자리를 `{labelOf(option)}`으로 바꾼다.

- [ ] **Step 8: 테스트와 타입 검사를 통과시킨다**

Run: `npm test` 그리고 `npx tsc -b`
Expected: 전부 PASS

- [ ] **Step 9: 변이 확인**

`areas.ts`에서 「어린이대공원」의 `purposes`를 지운다 → `kids`가 9곳이 되어 Step 1의 테스트가 실패해야 한다. 확인 후 되돌린다.

- [ ] **Step 10: 커밋**

```bash
git add src/domain/types.ts src/data/areas.ts src/domain/presets.ts src/components/nearby/CategoryFilter.tsx src/data/areas.test.ts src/domain/presets.test.ts
git commit -m "feat: 카테고리를 서울시 공식 5종으로 교체하고 프리셋을 목적 태그로 분리"
```

---

## Task 2: `domain/search.ts`

**Files:**
- Create: `src/domain/search.ts`
- Test: `src/domain/search.test.ts`

**Interfaces:**
- Consumes: `NearbyArea` (Task 1에서 바뀐 `AreaCatalogEntry` 포함)
- Produces: `function searchAreas(areas: readonly NearbyArea[], query: string): readonly NearbyArea[]`

- [ ] **Step 1: 실패 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest'
import { searchAreas } from './search'
import type { NearbyArea } from './types'

function area(name: string): NearbyArea {
  return {
    entry: { code: name, name, lat: 0, lng: 0, category: '발달상권' },
    snapshot: null,
    distanceMeters: null,
  }
}

const AREAS = [area('성수카페거리'), area('연남동'), area('DDP(동대문디자인플라자)')]

describe('searchAreas', () => {
  it('빈 문자열이면 전체를 그대로 돌려준다', () => {
    expect(searchAreas(AREAS, '')).toEqual(AREAS)
  })

  it('공백만 있어도 전체를 돌려준다', () => {
    expect(searchAreas(AREAS, '   ')).toEqual(AREAS)
  })

  it('부분일치로 거른다', () => {
    expect(searchAreas(AREAS, '성수').map((a) => a.entry.name)).toEqual(['성수카페거리'])
  })

  it('대소문자를 구분하지 않는다', () => {
    expect(searchAreas(AREAS, 'ddp')).toHaveLength(1)
  })

  it('입력의 앞뒤 공백을 무시한다', () => {
    expect(searchAreas(AREAS, '  연남  ')).toHaveLength(1)
  })

  it('맞는 게 없으면 빈 배열이다', () => {
    expect(searchAreas(AREAS, '없는곳')).toEqual([])
  })

  it('입력 배열을 변경하지 않는다', () => {
    const before = [...AREAS]
    searchAreas(AREAS, '성수')
    expect(AREAS).toEqual(before)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/domain/search.test.ts`
Expected: FAIL — `Failed to resolve import "./search"`

- [ ] **Step 3: 구현한다**

```ts
import type { NearbyArea } from './types'

// 주소 검색은 하지 않는다 — 지오코딩 API가 필요하고 이번 범위 밖이다.
// 명소명 부분일치만 본다.
export function searchAreas(
  areas: readonly NearbyArea[],
  query: string,
): readonly NearbyArea[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') {
    return areas
  }
  return areas.filter((item) => item.entry.name.toLowerCase().includes(needle))
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/domain/search.test.ts`
Expected: PASS

- [ ] **Step 5: 변이 확인**

`needle === ''` 분기를 지운다 → "빈 문자열이면 전체" 테스트가 실패해야 한다. 되돌린다.

- [ ] **Step 6: 커밋**

```bash
git add src/domain/search.ts src/domain/search.test.ts
git commit -m "feat: 명소명 검색 도메인 함수 추가"
```

---

## Task 3: `domain/summary.ts`

「오늘의 서울」이 쓰는 집계다. 값을 잘못 세도 통과하기 쉬운 자리라 변이 확인을 특히 신경 쓴다.

**Files:**
- Create: `src/domain/summary.ts`
- Test: `src/domain/summary.test.ts`

**Interfaces:**
- Consumes: `NearbyArea`, `CongestionLevel`, `AreaCategory`, `congestionRank`
- Produces:
  - `interface CitySummary { readonly total: number; readonly counted: number; readonly byLevel: Readonly<Record<CongestionLevel, number>> }`
  - `function summarize(areas: readonly NearbyArea[]): CitySummary`
  - `function topBusiest(areas: readonly NearbyArea[], limit: number): readonly NearbyArea[]`
  - `function topCalmest(areas: readonly NearbyArea[], limit: number): readonly NearbyArea[]`
  - `function categoryAverages(areas: readonly NearbyArea[]): readonly { readonly category: AreaCategory; readonly level: CongestionLevel }[]`

- [ ] **Step 1: 실패 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest'
import {
  categoryAverages,
  summarize,
  topBusiest,
  topCalmest,
} from './summary'
import type { AreaCategory, AreaSnapshot, CongestionLevel, NearbyArea } from './types'

function snap(name: string, congestion: CongestionLevel): AreaSnapshot {
  return {
    code: name,
    name,
    congestion,
    message: '',
    populationMin: 0,
    populationMax: 0,
    observedAt: '2026-08-07 11:00',
    observedAtLabel: '11:00',
    forecasts: [],
  }
}

function area(
  name: string,
  congestion: CongestionLevel | null,
  category: AreaCategory = '공원',
): NearbyArea {
  return {
    entry: { code: name, name, lat: 0, lng: 0, category },
    snapshot: congestion === null ? null : snap(name, congestion),
    distanceMeters: null,
  }
}

describe('summarize', () => {
  it('혼잡도 분포를 센다', () => {
    const result = summarize([
      area('a', '여유'),
      area('b', '여유'),
      area('c', '붐빔'),
      area('d', null),
    ])
    expect(result.total).toBe(4)
    expect(result.counted).toBe(3)
    expect(result.byLevel).toEqual({
      여유: 2,
      보통: 0,
      '약간 붐빔': 0,
      붐빔: 1,
    })
  })

  it('전부 스냅샷이 없으면 counted가 0이다', () => {
    const result = summarize([area('a', null)])
    expect(result.counted).toBe(0)
    expect(result.byLevel.여유).toBe(0)
  })
})

describe('topBusiest / topCalmest', () => {
  const areas = [
    area('여유1', '여유'),
    area('붐빔1', '붐빔'),
    area('보통1', '보통'),
    area('약간1', '약간 붐빔'),
    area('없음', null),
  ]

  it('붐비는 순으로 뽑고 스냅샷 없는 곳은 제외한다', () => {
    expect(topBusiest(areas, 2).map((a) => a.entry.name)).toEqual(['붐빔1', '약간1'])
  })

  it('여유로운 순으로 뽑는다', () => {
    expect(topCalmest(areas, 2).map((a) => a.entry.name)).toEqual(['여유1', '보통1'])
  })

  it('limit보다 적으면 있는 만큼만 준다', () => {
    expect(topBusiest([area('a', '여유')], 5)).toHaveLength(1)
  })

  it('입력 배열을 변경하지 않는다', () => {
    const input = [...areas]
    topBusiest(areas, 2)
    expect(areas).toEqual(input)
  })
})

describe('categoryAverages', () => {
  it('카테고리별 평균 혼잡도를 낸다', () => {
    const result = categoryAverages([
      area('p1', '여유', '공원'),
      area('p2', '보통', '공원'),
      area('s1', '붐빔', '발달상권'),
    ])
    // 공원 평균 rank = (0+1)/2 = 0.5 → 반올림 1 → '보통'
    expect(result).toContainEqual({ category: '공원', level: '보통' })
    expect(result).toContainEqual({ category: '발달상권', level: '붐빔' })
  })

  it('스냅샷이 하나도 없는 카테고리는 빠진다', () => {
    expect(categoryAverages([area('x', null, '공원')])).toEqual([])
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/domain/summary.test.ts`
Expected: FAIL — `Failed to resolve import "./summary"`

- [ ] **Step 3: 구현한다**

```ts
import { congestionRank } from './congestion'
import {
  AREA_CATEGORIES,
  CONGESTION_LEVELS,
  type AreaCategory,
  type CongestionLevel,
  type NearbyArea,
} from './types'

export interface CitySummary {
  /** 카탈로그 전체 개수 */
  readonly total: number
  /** 그중 스냅샷이 있는 개수. total과 다를 수 있다 */
  readonly counted: number
  readonly byLevel: Readonly<Record<CongestionLevel, number>>
}

function emptyCounts(): Record<CongestionLevel, number> {
  return { 여유: 0, 보통: 0, '약간 붐빔': 0, 붐빔: 0 }
}

export function summarize(areas: readonly NearbyArea[]): CitySummary {
  const byLevel = emptyCounts()
  let counted = 0
  for (const item of areas) {
    if (item.snapshot === null) continue
    byLevel[item.snapshot.congestion] += 1
    counted += 1
  }
  return { total: areas.length, counted, byLevel }
}

// 스냅샷이 없는 명소는 순위에 넣지 않는다. 모르는 것을 "여유롭다"고도
// "붐빈다"고도 말할 수 없다.
function ranked(
  areas: readonly NearbyArea[],
  direction: 1 | -1,
  limit: number,
): readonly NearbyArea[] {
  return areas
    .filter((item) => item.snapshot !== null)
    .toSorted((a, b) => {
      const left = congestionRank(a.snapshot!.congestion)
      const right = congestionRank(b.snapshot!.congestion)
      return (left - right) * direction
    })
    .slice(0, limit)
}

export function topBusiest(
  areas: readonly NearbyArea[],
  limit: number,
): readonly NearbyArea[] {
  return ranked(areas, -1, limit)
}

export function topCalmest(
  areas: readonly NearbyArea[],
  limit: number,
): readonly NearbyArea[] {
  return ranked(areas, 1, limit)
}

export function categoryAverages(
  areas: readonly NearbyArea[],
): readonly { readonly category: AreaCategory; readonly level: CongestionLevel }[] {
  const result: { category: AreaCategory; level: CongestionLevel }[] = []
  for (const category of AREA_CATEGORIES) {
    const ranks = areas
      .filter((item) => item.entry.category === category && item.snapshot !== null)
      .map((item) => congestionRank(item.snapshot!.congestion))
    if (ranks.length === 0) continue
    const mean = ranks.reduce((sum, value) => sum + value, 0) / ranks.length
    result.push({ category, level: CONGESTION_LEVELS[Math.round(mean)] })
  }
  return result
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/domain/summary.test.ts`
Expected: PASS

- [ ] **Step 5: 변이 확인 (이 태스크에서 특히 중요)**

세 가지를 각각 해보고 대응하는 테스트가 실패하는지 본다. 실패하지 않으면 그 테스트가 "항상 참인 테스트"다.

1. `summarize`에서 `counted += 1`을 지운다 → 분포 테스트가 실패해야 한다
2. `ranked`의 `direction` 곱을 지운다 → `topCalmest` 테스트가 실패해야 한다
3. `categoryAverages`의 `Math.round`를 `Math.floor`로 바꾼다 → 공원 평균이 '여유'가 되어 실패해야 한다

셋 다 확인한 뒤 되돌린다.

- [ ] **Step 6: 커밋**

```bash
git add src/domain/summary.ts src/domain/summary.test.ts
git commit -m "feat: 오늘의 서울 집계 도메인 함수 추가"
```

---

## Task 4: `domain/split.ts`

**Files:**
- Create: `src/domain/split.ts`
- Test: `src/domain/split.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `const MIN_MAP_RATIO = 0.15`, `const DEFAULT_MAP_RATIO = 0.35`, `const MAX_MAP_RATIO = 0.75`
  - `const SNAP_POINTS: readonly number[]`
  - `function clampRatio(ratio: number): number`
  - `function snapRatio(ratio: number): number`

- [ ] **Step 1: 실패 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest'
import {
  clampRatio,
  DEFAULT_MAP_RATIO,
  MAX_MAP_RATIO,
  MIN_MAP_RATIO,
  snapRatio,
} from './split'

describe('clampRatio', () => {
  it('최소 아래는 최소로 올린다', () => {
    expect(clampRatio(0)).toBe(MIN_MAP_RATIO)
    expect(clampRatio(-1)).toBe(MIN_MAP_RATIO)
  })

  it('최대 위는 최대로 내린다', () => {
    expect(clampRatio(1)).toBe(MAX_MAP_RATIO)
  })

  it('범위 안은 그대로 둔다', () => {
    expect(clampRatio(0.5)).toBe(0.5)
  })

  it('경계값은 그대로 둔다', () => {
    expect(clampRatio(MIN_MAP_RATIO)).toBe(MIN_MAP_RATIO)
    expect(clampRatio(MAX_MAP_RATIO)).toBe(MAX_MAP_RATIO)
  })

  it('NaN은 기본값으로 떨어뜨린다', () => {
    expect(clampRatio(Number.NaN)).toBe(DEFAULT_MAP_RATIO)
  })
})

describe('snapRatio', () => {
  it('가장 가까운 스냅점에 붙는다', () => {
    expect(snapRatio(0.17)).toBe(MIN_MAP_RATIO)
    expect(snapRatio(0.33)).toBe(DEFAULT_MAP_RATIO)
    expect(snapRatio(0.72)).toBe(MAX_MAP_RATIO)
  })

  it('중간값은 더 가까운 쪽에 붙는다', () => {
    // 0.15와 0.35의 중간은 0.25. 0.26은 0.35 쪽이 가깝다.
    expect(snapRatio(0.26)).toBe(DEFAULT_MAP_RATIO)
    expect(snapRatio(0.24)).toBe(MIN_MAP_RATIO)
  })

  it('범위 밖 입력도 먼저 clamp된다', () => {
    expect(snapRatio(2)).toBe(MAX_MAP_RATIO)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/domain/split.test.ts`
Expected: FAIL — `Failed to resolve import "./split"`

- [ ] **Step 3: 구현한다**

```ts
// 지도가 차지하는 세로 비율. 0이나 1로 완전히 접히지 않게 한다 — 한쪽이
// 사라지면 되돌릴 손잡이도 같이 사라진다.
export const MIN_MAP_RATIO = 0.15
export const DEFAULT_MAP_RATIO = 0.35
export const MAX_MAP_RATIO = 0.75

export const SNAP_POINTS: readonly number[] = [
  MIN_MAP_RATIO,
  DEFAULT_MAP_RATIO,
  MAX_MAP_RATIO,
]

export function clampRatio(ratio: number): number {
  if (Number.isNaN(ratio)) {
    return DEFAULT_MAP_RATIO
  }
  return Math.min(MAX_MAP_RATIO, Math.max(MIN_MAP_RATIO, ratio))
}

export function snapRatio(ratio: number): number {
  const bounded = clampRatio(ratio)
  return SNAP_POINTS.reduce((best, point) =>
    Math.abs(point - bounded) < Math.abs(best - bounded) ? point : best,
  )
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/domain/split.test.ts`
Expected: PASS

- [ ] **Step 5: 변이 확인**

`clampRatio`의 `Number.isNaN` 분기를 지운다 → NaN 테스트가 실패해야 한다. 되돌린다.

- [ ] **Step 6: 커밋**

```bash
git add src/domain/split.ts src/domain/split.test.ts
git commit -m "feat: 지도·목록 분할 비율 계산 추가"
```

---

## Task 5: 즐겨찾기 영속화

**Files:**
- Create: `src/platform/favorites.ts`
- Create: `src/hooks/useFavorites.ts`
- Test: `src/platform/favorites.test.ts`, `src/hooks/useFavorites.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `function loadFavorites(): Promise<readonly string[]>`
  - `function saveFavorites(names: readonly string[]): Promise<void>`
  - `function useFavorites(): { readonly favorites: readonly string[]; readonly isFavorite: (name: string) => boolean; readonly toggle: (name: string) => void }`

`links.ts`와 같은 폴백 패턴이다 — 브리지를 먼저 시도하고 실패하면 웹 표준으로 떨어진다. 앱인토스 스토리지 API 이름은 세션마다 문서를 새로 받아 확인할 것(`.claude/skills/apps-in-toss/`의 라우팅 규칙). 문서에서 확인되지 않으면 **`localStorage`만 쓰고 그 사실을 파일 머리말에 적는다** — 없는 API를 추측해 부르면 브리지가 있는 환경에서 조용히 깨진다.

- [ ] **Step 1: 실패 테스트를 쓴다**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadFavorites, saveFavorites, STORAGE_KEY } from './favorites'

describe('favorites', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('저장한 목록을 그대로 읽는다', async () => {
    await saveFavorites(['강남역', '경복궁'])
    expect(await loadFavorites()).toEqual(['강남역', '경복궁'])
  })

  it('저장된 게 없으면 빈 배열이다', async () => {
    expect(await loadFavorites()).toEqual([])
  })

  it('깨진 JSON이면 빈 배열로 떨어지고 로그를 남긴다', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem(STORAGE_KEY, '{{{')
    expect(await loadFavorites()).toEqual([])
    expect(spy).toHaveBeenCalled()
  })

  it('배열이 아닌 값이 저장돼 있으면 빈 배열이다', async () => {
    localStorage.setItem(STORAGE_KEY, '{"a":1}')
    expect(await loadFavorites()).toEqual([])
  })

  it('문자열이 아닌 원소는 걸러낸다', async () => {
    localStorage.setItem(STORAGE_KEY, '["강남역",42,null]')
    expect(await loadFavorites()).toEqual(['강남역'])
  })

  it('저장 실패는 예외를 올리지 않는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    await expect(saveFavorites(['강남역'])).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/platform/favorites.test.ts`
Expected: FAIL — `Failed to resolve import "./favorites"`

- [ ] **Step 3: `src/platform/favorites.ts`를 구현한다**

```ts
// 즐겨찾기는 기기에 남는다. PLAN.md가 "무료고 로그인도 없다"고 정해둔 이상
// 서버 저장은 익명 기기 ID 발급·보관을 부르고, api/는 상태를 갖지 않는 순수
// 중계기다. 기기를 바꾸면 즐겨찾기가 사라지는 것은 이 선택의 알려진 대가다.
//
// 저장 실패로 화면을 막지 않는다. 즐겨찾기는 부가 기능이고, 별이 안 눌리는
// 것보다 저장이 안 되는 편이 낫다.
export const STORAGE_KEY = 'seoul-live:favorites'

export async function loadFavorites(): Promise<readonly string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch (error) {
    // "저장된 게 없음"과 "읽지 못함"은 다르다. 전자는 정상이고 후자는 남긴다.
    console.error('즐겨찾기를 읽지 못했습니다:', error)
    return []
  }
}

export async function saveFavorites(names: readonly string[]): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(names))
  } catch (error) {
    console.error('즐겨찾기를 저장하지 못했습니다:', error)
  }
}
```

- [ ] **Step 4: `useFavorites` 테스트를 쓴다**

```ts
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useFavorites } from './useFavorites'

describe('useFavorites', () => {
  beforeEach(() => localStorage.clear())

  it('토글하면 담기고 다시 누르면 빠진다', async () => {
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.favorites).toEqual([]))

    act(() => result.current.toggle('강남역'))
    await waitFor(() => expect(result.current.isFavorite('강남역')).toBe(true))

    act(() => result.current.toggle('강남역'))
    await waitFor(() => expect(result.current.isFavorite('강남역')).toBe(false))
  })

  it('저장이 막혀도 화면 상태는 바뀐다', async () => {
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.favorites).toEqual([]))
    act(() => result.current.toggle('경복궁'))
    await waitFor(() => expect(result.current.isFavorite('경복궁')).toBe(true))
  })
})
```

- [ ] **Step 5: `src/hooks/useFavorites.ts`를 구현한다**

```ts
import { useCallback, useEffect, useState } from 'react'
import { loadFavorites, saveFavorites } from '../platform/favorites'

export function useFavorites(): {
  readonly favorites: readonly string[]
  readonly isFavorite: (name: string) => boolean
  readonly toggle: (name: string) => void
} {
  const [favorites, setFavorites] = useState<readonly string[]>([])

  useEffect(() => {
    let alive = true
    void loadFavorites().then((stored) => {
      if (alive) setFavorites(stored)
    })
    return () => {
      alive = false
    }
  }, [])

  const toggle = useCallback((name: string) => {
    // 저장 결과를 기다리지 않고 화면부터 바꾼다. 저장이 막혀도 별은 눌린다.
    setFavorites((current) => {
      const next = current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name]
      void saveFavorites(next)
      return next
    })
  }, [])

  const isFavorite = useCallback(
    (name: string) => favorites.includes(name),
    [favorites],
  )

  return { favorites, isFavorite, toggle }
}
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npx vitest run src/platform/favorites.test.ts src/hooks/useFavorites.test.ts`
Expected: PASS

- [ ] **Step 7: 변이 확인**

`loadFavorites`의 `filter((item): item is string => ...)`를 지운다 → "문자열이 아닌 원소는 걸러낸다"가 실패해야 한다. 되돌린다.

- [ ] **Step 8: 커밋**

```bash
git add src/platform/favorites.ts src/platform/favorites.test.ts src/hooks/useFavorites.ts src/hooks/useFavorites.test.ts
git commit -m "feat: 즐겨찾기 로컬 저장과 훅 추가"
```

---

## Task 6: 정렬 3종

토글 버튼 하나로는 셋을 표현할 수 없다. `SortSelect`를 지우고 분절 컨트롤을 만든다.

**Files:**
- Modify: `src/hooks/useNearbyAreas.ts`
- Create: `src/components/nearby/SortSegmented.tsx`
- Delete: `src/components/nearby/SortSelect.tsx`, `src/components/nearby/SortSelect.test.tsx`
- Test: `src/hooks/useNearbyAreas.test.ts`, `src/components/nearby/SortSegmented.test.tsx`

**Interfaces:**
- Consumes: `buildNearbyList`, `NearbyArea`
- Produces:
  - `type SortMode = 'distance' | 'calm' | 'busy'`
  - `function SortSegmented(props: { value: SortMode; canSortByDistance: boolean; onChange: (next: SortMode) => void })`

`'congestion'`이 `'calm'`으로 이름이 바뀌고 `'busy'`가 는다. 「붐비는 순」을 더하는 이유는 「지금 핫플」 프리셋과 「오늘의 서울」의 붐빔 TOP이 같은 관심사를 이미 다루고 있어서다.

- [ ] **Step 1: 실패 테스트를 쓴다**

`src/hooks/useNearbyAreas.test.ts`에 추가:

```ts
it('붐비는 순은 여유로운 순의 역순이다', () => {
  const list = buildNearbyList({
    entries: ENTRIES,          // 기존 테스트 픽스처
    snapshots: SNAPSHOTS,
    coords: null,
    category: '전체',
    sort: 'busy',
  })
  const calm = buildNearbyList({
    entries: ENTRIES,
    snapshots: SNAPSHOTS,
    coords: null,
    category: '전체',
    sort: 'calm',
  })
  // 스냅샷 없는 항목은 양쪽 모두 뒤로 가므로 그 앞부분만 비교한다
  const withSnapshot = (items: readonly NearbyArea[]) =>
    items.filter((i) => i.snapshot !== null).map((i) => i.entry.name)
  expect(withSnapshot(list)).toEqual(withSnapshot(calm).toReversed())
})

it('좌표가 없으면 거리순을 골라도 여유로운 순으로 내려간다', () => {
  const list = buildNearbyList({
    entries: ENTRIES,
    snapshots: SNAPSHOTS,
    coords: null,
    category: '전체',
    sort: 'distance',
  })
  expect(list.filter((i) => i.snapshot !== null)[0]?.snapshot?.congestion).toBe('여유')
})

it('스냅샷이 없는 명소는 붐비는 순에서도 뒤로 간다', () => {
  const list = buildNearbyList({
    entries: ENTRIES,
    snapshots: SNAPSHOTS,
    coords: null,
    category: '전체',
    sort: 'busy',
  })
  expect(list.at(-1)?.snapshot).toBeNull()
})
```

`src/components/nearby/SortSegmented.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SortSegmented } from './SortSegmented'

describe('SortSegmented', () => {
  it('세 기준을 모두 보여준다', () => {
    render(<SortSegmented value="calm" canSortByDistance onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '거리순' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '여유한 순' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '붐비는 순' })).toBeInTheDocument()
  })

  it('선택된 기준을 표시한다', () => {
    render(<SortSegmented value="busy" canSortByDistance onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '붐비는 순' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('좌표가 없으면 거리순이 비활성이다', () => {
    render(<SortSegmented value="calm" canSortByDistance={false} onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '거리순' })).toBeDisabled()
  })

  it('누르면 값을 올려보낸다', async () => {
    const onChange = vi.fn()
    render(<SortSegmented value="calm" canSortByDistance onChange={onChange} />)
    await userEvent.click(screen.getByRole('tab', { name: '붐비는 순' }))
    expect(onChange).toHaveBeenCalledWith('busy')
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/hooks/useNearbyAreas.test.ts src/components/nearby/SortSegmented.test.tsx`
Expected: FAIL — `'busy'`가 `SortMode`에 없고 `SortSegmented` 모듈이 없다

- [ ] **Step 3: `useNearbyAreas.ts`를 고친다**

```ts
export type SortMode = 'distance' | 'calm' | 'busy'

function compareByCongestion(a: NearbyArea, b: NearbyArea): number {
  if (a.snapshot === null) return 1
  if (b.snapshot === null) return -1
  return (
    congestionRank(a.snapshot.congestion) - congestionRank(b.snapshot.congestion)
  )
}
```

`buildNearbyList`의 정렬 선택을 바꾼다.

```ts
export function buildNearbyList(input: BuildInput): readonly NearbyArea[] {
  const { entries, snapshots, coords, category, sort = 'distance' } = input

  const combined = entries
    .map(/* 기존 그대로 */)
    .filter((item) => category === '전체' || item.entry.category === category)

  // 좌표가 없으면 거리순을 고를 수 없다. 여유한 순으로 내려간다.
  if (sort === 'distance' && coords !== null) {
    return combined.toSorted(compareByDistance)
  }
  if (sort === 'busy') {
    // 스냅샷 없는 항목은 양쪽 모두 뒤로 가야 하므로 단순 역순이 아니다.
    return combined.toSorted((a, b) => {
      if (a.snapshot === null) return 1
      if (b.snapshot === null) return -1
      return -compareByCongestion(a, b)
    })
  }
  return combined.toSorted(compareByCongestion)
}
```

`useNearbyAreas`의 기본 인자와 `pickRecommendations` 호출부의 `sort: 'distance'`는 그대로 둔다.

- [ ] **Step 4: `SortSegmented.tsx`를 만든다**

```tsx
import type { SortMode } from '../../hooks/useNearbyAreas'

// 리터럴 배열로 둔다. Tailwind v4는 정적 추출이라 클래스를 조합하지 않는다.
const OPTIONS: readonly { readonly mode: SortMode; readonly label: string }[] = [
  { mode: 'distance', label: '거리순' },
  { mode: 'calm', label: '여유한 순' },
  { mode: 'busy', label: '붐비는 순' },
]

interface Props {
  readonly value: SortMode
  /** 좌표가 없으면 거리순을 고를 수 없다 */
  readonly canSortByDistance: boolean
  readonly onChange: (next: SortMode) => void
}

export function SortSegmented({ value, canSortByDistance, onChange }: Props) {
  return (
    <div className="flex gap-1 rounded-full bg-surface-container p-1" role="tablist">
      {OPTIONS.map((option) => {
        const disabled = option.mode === 'distance' && !canSortByDistance
        return (
          <button
            key={option.mode}
            type="button"
            role="tab"
            disabled={disabled}
            aria-selected={value === option.mode}
            onClick={() => onChange(option.mode)}
            className={`min-h-10 flex-1 rounded-full px-3 text-label-md font-semibold ${
              value === option.mode
                ? 'bg-surface-container-lowest text-primary shadow-floating'
                : disabled
                  ? 'text-outline-variant'
                  : 'text-on-surface-variant'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: `SortSelect`를 지우고 소비처를 바꾼다**

```bash
git rm src/components/nearby/SortSelect.tsx src/components/nearby/SortSelect.test.tsx
```

`src/screens/NearbyScreen.tsx`가 `SortSelect`와 `'congestion'`을 쓰고 있다. `SortSegmented`와 `'calm'`으로 바꾼다. (이 화면은 Task 14에서 지워지지만 그때까지 빌드가 깨지면 안 된다.)

- [ ] **Step 6: 통과를 확인한다**

Run: `npm test` 그리고 `npx tsc -b`
Expected: 전부 PASS

- [ ] **Step 7: 변이 확인**

`buildNearbyList`의 `busy` 분기에서 `-`를 지운다 → "붐비는 순은 여유로운 순의 역순" 테스트가 실패해야 한다. 되돌린다.

- [ ] **Step 8: 커밋**

```bash
git add -A src/hooks/useNearbyAreas.ts src/hooks/useNearbyAreas.test.ts src/components/nearby src/screens/NearbyScreen.tsx
git commit -m "feat: 목록 정렬을 거리·여유·붐빔 셋으로 확장"
```

---

## Task 7: 컴포넌트 디렉터리 재배치

동작 변경 없이 파일만 옮긴다. 테스트가 그대로 통과하는 것이 이 태스크의 검증이다.

**Files:**
- Move: `src/components/nearby/{AreaListItem,CategoryFilter,LocationNotice,SortSegmented}.tsx` (+ 테스트) → `src/components/list/`
- Move: `src/components/nearby/RecommendationCard.tsx` (+ 테스트) → `src/components/today/`
- Move: `src/components/more/{AlertBanner,WeatherCard,ParkingList,BikeList,EventList,InfoSection}.tsx` (+ 테스트) → `src/components/cityinfo/`

**Interfaces:**
- Consumes: Task 6의 `SortSegmented`
- Produces: 같은 컴포넌트들, 새 경로

- [ ] **Step 1: `git mv`로 옮긴다**

```bash
mkdir -p src/components/list src/components/cityinfo src/components/today
git mv src/components/nearby/AreaListItem.tsx src/components/list/
git mv src/components/nearby/AreaListItem.test.tsx src/components/list/
git mv src/components/nearby/CategoryFilter.tsx src/components/list/
git mv src/components/nearby/CategoryFilter.test.tsx src/components/list/
git mv src/components/nearby/LocationNotice.tsx src/components/list/
git mv src/components/nearby/LocationNotice.test.tsx src/components/list/
git mv src/components/nearby/SortSegmented.tsx src/components/list/
git mv src/components/nearby/SortSegmented.test.tsx src/components/list/
git mv src/components/nearby/RecommendationCard.tsx src/components/today/
git mv src/components/nearby/RecommendationCard.test.tsx src/components/today/
git mv src/components/more/AlertBanner.tsx src/components/cityinfo/
git mv src/components/more/AlertBanner.test.tsx src/components/cityinfo/
git mv src/components/more/WeatherCard.tsx src/components/cityinfo/
git mv src/components/more/WeatherCard.test.tsx src/components/cityinfo/
git mv src/components/more/ParkingList.tsx src/components/cityinfo/
git mv src/components/more/ParkingList.test.tsx src/components/cityinfo/
git mv src/components/more/BikeList.tsx src/components/cityinfo/
git mv src/components/more/BikeList.test.tsx src/components/cityinfo/
git mv src/components/more/EventList.tsx src/components/cityinfo/
git mv src/components/more/EventList.test.tsx src/components/cityinfo/
git mv src/components/more/InfoSection.tsx src/components/cityinfo/
git mv src/components/more/InfoSection.test.tsx src/components/cityinfo/
```

- [ ] **Step 2: import 경로를 고친다**

`src/screens/NearbyScreen.tsx`·`MoreScreen.tsx`·`ForecastScreen.tsx`와 옮겨진 파일들끼리의 상대 경로를 고친다. 남은 참조를 찾는다.

Run: `npx tsc -b`
Expected: 남은 잘못된 경로가 에러로 전부 드러난다. 하나씩 고친다.

- [ ] **Step 3: 통과를 확인한다**

Run: `npm test` 그리고 `npx tsc -b`
Expected: 전부 PASS. **테스트 개수가 이동 전과 같아야 한다** — 줄었으면 파일을 빠뜨린 것이다.

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "refactor: 컴포넌트 디렉터리를 새 화면 구조에 맞춰 재배치"
```

---

## Task 8: `SplitPane`

**Files:**
- Create: `src/components/home/SplitPane.tsx`
- Test: `src/components/home/SplitPane.test.tsx`

**Interfaces:**
- Consumes: `clampRatio`, `snapRatio`, `DEFAULT_MAP_RATIO` (Task 4)
- Produces: `function SplitPane(props: { ratio: number; onRatioChange: (next: number) => void; top: ReactNode; bottom: ReactNode })`

- [ ] **Step 1: 실패 테스트를 쓴다**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MAP_RATIO, MAX_MAP_RATIO } from '../../domain/split'
import { SplitPane } from './SplitPane'

function setup(onRatioChange = vi.fn()) {
  render(
    <SplitPane
      ratio={DEFAULT_MAP_RATIO}
      onRatioChange={onRatioChange}
      top={<div>지도영역</div>}
      bottom={<div>목록영역</div>}
    />,
  )
  const handle = screen.getByRole('separator')
  // jsdom은 레이아웃을 계산하지 않아 높이가 0이다. 비율 계산이 0으로 나누지
  // 않도록 컨테이너 높이를 심는다.
  const container = handle.parentElement as HTMLElement
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    height: 800,
    bottom: 800,
    left: 0,
    right: 0,
    width: 400,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
  return { handle, onRatioChange }
}

describe('SplitPane', () => {
  it('위아래 내용을 모두 그린다', () => {
    setup()
    expect(screen.getByText('지도영역')).toBeInTheDocument()
    expect(screen.getByText('목록영역')).toBeInTheDocument()
  })

  it('손잡이를 끌면 비율이 바뀐다', () => {
    const { handle, onRatioChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 280, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 560, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 560, pointerId: 1 })
    // 560 / 800 = 0.7 → 가장 가까운 스냅점은 0.75
    expect(onRatioChange).toHaveBeenLastCalledWith(MAX_MAP_RATIO)
  })

  it('끌지 않고 누르기만 하면 비율이 안 바뀐다', () => {
    const { handle, onRatioChange } = setup()
    fireEvent.pointerDown(handle, { clientY: 280, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 280, pointerId: 1 })
    expect(onRatioChange).not.toHaveBeenCalled()
  })

  it('더블클릭하면 기본값으로 돌아간다', () => {
    const { handle, onRatioChange } = setup()
    fireEvent.doubleClick(handle)
    expect(onRatioChange).toHaveBeenCalledWith(DEFAULT_MAP_RATIO)
  })

  it('손잡이에 접근 가능한 이름이 있다', () => {
    const { handle } = setup()
    expect(handle).toHaveAccessibleName('지도·목록 비율 조절')
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/components/home/SplitPane.test.tsx`
Expected: FAIL — `Failed to resolve import "./SplitPane"`

- [ ] **Step 3: 구현한다**

```tsx
import { useRef, type PointerEvent, type ReactNode } from 'react'
import { clampRatio, DEFAULT_MAP_RATIO, snapRatio } from '../../domain/split'

interface Props {
  readonly ratio: number
  readonly onRatioChange: (next: number) => void
  readonly top: ReactNode
  readonly bottom: ReactNode
}

// 드래그 로직은 여기 있고 비율 계산은 domain/split.ts에 있다. 나눠 둔 이유는
// clamp·스냅을 제스처 없이 테스트하려는 것이다.
//
// 토스 웹뷰에서 이 손잡이 드래그와 지도 팬 제스처가 충돌하는지는 실기기로만
// 확인된다 — STATE.md의 미해결 가정.
export function SplitPane({ ratio, onRatioChange, top, bottom }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  function ratioFromY(clientY: number): number | null {
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect === undefined || rect.height === 0) {
      return null
    }
    return clampRatio((clientY - rect.top) / rect.height)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    draggingRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return
    }
    const next = ratioFromY(event.clientY)
    if (next === null) return
    draggingRef.current = true
    onRatioChange(next)
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>): void {
    event.currentTarget.releasePointerCapture(event.pointerId)
    // 누르기만 하고 끌지 않았으면 아무 일도 일어나면 안 된다. 손잡이를
    // 스치기만 해도 레이아웃이 튀면 목록을 스크롤하기 무서워진다.
    if (!draggingRef.current) {
      return
    }
    draggingRef.current = false
    const next = ratioFromY(event.clientY)
    if (next === null) return
    onRatioChange(snapRatio(next))
  }

  return (
    <div ref={containerRef} className="flex size-full flex-col overflow-hidden">
      <div style={{ height: `${ratio * 100}%` }} className="relative shrink-0">
        {top}
      </div>

      <div
        role="separator"
        aria-label="지도·목록 비율 조절"
        aria-orientation="horizontal"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={() => onRatioChange(DEFAULT_MAP_RATIO)}
        className="flex h-5 shrink-0 cursor-row-resize touch-none items-center justify-center border-y border-outline-variant bg-surface-container"
      >
        <span className="h-1 w-9 rounded-full bg-outline" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">{bottom}</div>
    </div>
  )
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/components/home/SplitPane.test.tsx`
Expected: PASS

- [ ] **Step 5: 변이 확인**

`handlePointerUp`의 `if (!draggingRef.current) return`을 지운다 → "끌지 않고 누르기만 하면 비율이 안 바뀐다"가 실패해야 한다. 되돌린다.

- [ ] **Step 6: 커밋**

```bash
git add src/components/home/SplitPane.tsx src/components/home/SplitPane.test.tsx
git commit -m "feat: 지도·목록 드래그 분할 컴포넌트 추가"
```

---

## Task 9: `SearchBar`

**Files:**
- Create: `src/components/home/SearchBar.tsx`
- Test: `src/components/home/SearchBar.test.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: `function SearchBar(props: { value: string; onChange: (next: string) => void; onRecenter: () => void; canRecenter: boolean })`

- [ ] **Step 1: 실패 테스트를 쓴다**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SearchBar } from './SearchBar'

describe('SearchBar', () => {
  it('입력하면 값을 올려보낸다', async () => {
    const onChange = vi.fn()
    render(
      <SearchBar value="" onChange={onChange} onRecenter={() => {}} canRecenter />,
    )
    await userEvent.type(screen.getByRole('searchbox'), '성')
    expect(onChange).toHaveBeenCalledWith('성')
  })

  it('값이 있으면 지우기 버튼이 나온다', async () => {
    const onChange = vi.fn()
    render(
      <SearchBar value="성수" onChange={onChange} onRecenter={() => {}} canRecenter />,
    )
    await userEvent.click(screen.getByRole('button', { name: '검색어 지우기' }))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('값이 없으면 지우기 버튼이 없다', () => {
    render(<SearchBar value="" onChange={() => {}} onRecenter={() => {}} canRecenter />)
    expect(screen.queryByRole('button', { name: '검색어 지우기' })).toBeNull()
  })

  it('좌표가 없으면 내 주변이 비활성이다', () => {
    render(
      <SearchBar
        value=""
        onChange={() => {}}
        onRecenter={() => {}}
        canRecenter={false}
      />,
    )
    expect(screen.getByRole('button', { name: '내 주변' })).toBeDisabled()
  })

  it('내 주변을 누르면 콜백이 불린다', async () => {
    const onRecenter = vi.fn()
    render(
      <SearchBar value="" onChange={() => {}} onRecenter={onRecenter} canRecenter />,
    )
    await userEvent.click(screen.getByRole('button', { name: '내 주변' }))
    expect(onRecenter).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/components/home/SearchBar.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현한다**

```tsx
import { Icon } from '../common/Icon'

interface Props {
  readonly value: string
  readonly onChange: (next: string) => void
  /** 지도를 내 위치로 옮기고 목록을 거리순으로 바꾼다 */
  readonly onRecenter: () => void
  readonly canRecenter: boolean
}

export function SearchBar({ value, onChange, onRecenter, canRecenter }: Props) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex min-h-12 flex-1 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3">
        <Icon name="search" className="size-4 text-on-surface-variant" />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="명소 검색"
          aria-label="명소 검색"
          className="min-w-0 flex-1 bg-transparent text-body-md text-on-surface outline-none"
        />
        {value !== '' && (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={() => onChange('')}
            className="text-on-surface-variant"
          >
            <Icon name="close" className="size-4" />
          </button>
        )}
      </div>

      <button
        type="button"
        disabled={!canRecenter}
        onClick={onRecenter}
        className={`flex min-h-12 shrink-0 items-center gap-1 rounded-lg px-3 text-label-md font-semibold ${
          canRecenter
            ? 'bg-secondary-container text-primary'
            : 'bg-surface-container text-outline-variant'
        }`}
      >
        <Icon name="near" className="size-4" />
        내 주변
      </button>
    </div>
  )
}
```

`Icon.tsx`에 `search`와 `close`를 추가한다. 현재 정의된 이름은 `back near map forecast more info share pin` 여덟뿐이라 **둘 다 없다.** 기존 정의 형식(`name: <path .../>`)을 그대로 따를 것.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/components/home/SearchBar.test.tsx`
Expected: PASS

- [ ] **Step 5: 변이 확인**

`{value !== '' && ...}` 조건을 `{true && ...}`로 바꾼다 → "값이 없으면 지우기 버튼이 없다"가 실패해야 한다. 되돌린다.

- [ ] **Step 6: 커밋**

```bash
git add src/components/home/SearchBar.tsx src/components/home/SearchBar.test.tsx src/components/common/Icon.tsx
git commit -m "feat: 홈 검색 바 추가"
```

---

## Task 10: `AreaDetail` — 인플레이스 상세

`ForecastScreen`의 내용에 접이식 도시 정보를 더한 것이다. 상단바와 뒤로가기는 `ForecastScreen`이 직접 그렸지만, 여기서는 목록 자리에만 들어가므로 "← 목록으로" 한 줄이면 된다.

**Files:**
- Create: `src/components/home/AreaDetail.tsx`
- Test: `src/components/home/AreaDetail.test.tsx`
- Reference: `src/screens/ForecastScreen.tsx` (내용을 옮겨온다), `src/screens/MoreScreen.tsx` (도시정보 섹션 조립)

**Interfaces:**
- Consumes: `useAreaSnapshot`, `useCityInfo` (`src/data/queries.ts`), `ForecastChart`, `ActionButtons`, `cityinfo/*`, `useFavorites` (Task 5)
- Produces: `function AreaDetail(props: { areaName: string; onBack: () => void; onSelectArea: (name: string) => void })`

**핵심 규칙:** 도시 정보는 **접힌 상태로 시작하고 펼칠 때 조회한다.** `useCityInfo(expanded ? areaName : undefined)`로 `enabled`를 끈다 — `queries.ts`의 `useCityInfo`가 이미 `enabled: Boolean(areaName)`이라 `undefined`를 넘기면 호출하지 않는다.

- [ ] **Step 1: 실패 테스트를 쓴다**

**이 저장소는 `renderWithProviders` 같은 헬퍼를 쓰지 않는다.** `MoreScreen.test.tsx`처럼 `vi.mock('../../data/queries')`로 훅을 직접 목업한다. 그 패턴을 따른다 — 덕분에 지연 로딩을 `useCityInfo`가 무엇으로 불렸는지로 직접 단언할 수 있다.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UseQueryResult } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CityInfo } from '../../domain/cityInfo'
import type { AreaSnapshot } from '../../domain/types'
import { AreaDetail } from './AreaDetail'

vi.mock('../../data/queries', () => ({
  useAreaSnapshot: vi.fn(),
  useCityInfo: vi.fn(),
}))

const queries = await import('../../data/queries')
const useAreaSnapshot = vi.mocked(queries.useAreaSnapshot)
const useCityInfo = vi.mocked(queries.useCityInfo)

const SNAPSHOT: AreaSnapshot = {
  code: 'POI014',
  name: '강남역',
  congestion: '약간 붐빔',
  message: '조금 붐벼요.',
  populationMin: 74_000,
  populationMax: 76_000,
  observedAt: '2026-08-07 11:00',
  observedAtLabel: '11:00',
  forecasts: [],
}

function ok<T>(data: T): UseQueryResult<T> {
  return { data, isPending: false, isError: false } as UseQueryResult<T>
}
function failed<T>(): UseQueryResult<T> {
  return { data: undefined, isPending: false, isError: true } as UseQueryResult<T>
}

beforeEach(() => {
  localStorage.clear()
  useAreaSnapshot.mockReturnValue(ok(SNAPSHOT))
  useCityInfo.mockReturnValue(ok({} as CityInfo))
})

describe('AreaDetail', () => {
  it('명소 이름과 혼잡도를 보여준다', () => {
    render(<AreaDetail areaName="강남역" onBack={() => {}} onSelectArea={() => {}} />)
    expect(screen.getByRole('heading', { name: '강남역' })).toBeInTheDocument()
    expect(screen.getByText('약간 붐빔')).toBeInTheDocument()
  })

  it('도시 정보는 접힌 채로 시작하고 조회하지 않는다', () => {
    render(<AreaDetail areaName="강남역" onBack={() => {}} onSelectArea={() => {}} />)
    expect(screen.getByRole('button', { name: /이곳의 도시 정보/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    // 접힌 동안은 undefined를 넘겨 useCityInfo의 enabled를 끈다.
    expect(useCityInfo).toHaveBeenCalledWith(undefined)
    expect(useCityInfo).not.toHaveBeenCalledWith('강남역')
  })

  it('펼치면 그때 조회한다', async () => {
    render(<AreaDetail areaName="강남역" onBack={() => {}} onSelectArea={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /이곳의 도시 정보/ }))
    expect(useCityInfo).toHaveBeenCalledWith('강남역')
  })

  it('도시 정보가 실패해도 혼잡도는 그대로 남는다', async () => {
    useCityInfo.mockReturnValue(failed<CityInfo>())
    render(<AreaDetail areaName="강남역" onBack={() => {}} onSelectArea={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /이곳의 도시 정보/ }))
    expect(screen.getByText('약간 붐빔')).toBeInTheDocument()
    expect(screen.getByText('도시 정보를 가져오지 못했어요.')).toBeInTheDocument()
  })

  it('뒤로 버튼이 콜백을 부른다', async () => {
    const onBack = vi.fn()
    render(<AreaDetail areaName="강남역" onBack={onBack} onSelectArea={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('즐겨찾기를 토글한다', async () => {
    render(<AreaDetail areaName="강남역" onBack={() => {}} onSelectArea={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: '즐겨찾기에 추가' }))
    expect(
      await screen.findByRole('button', { name: '즐겨찾기에서 빼기' }),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/components/home/AreaDetail.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현한다**

`ForecastScreen.tsx`의 본문(현재 상태 카드 · 한산 시간 안내 · `ForecastChart` · `ActionButtons`)을 그대로 옮기고, 상단바 대신 "← 목록으로" 버튼과 즐겨찾기 별을 붙인다. 그 아래에 접이식 도시 정보 섹션을 둔다.

```tsx
import { useState } from 'react'
import { useAreaSnapshot, useCityInfo } from '../../data/queries'
import { useFavorites } from '../../hooks/useFavorites'
import { Icon } from '../common/Icon'
// ...ForecastScreen이 쓰던 import와 cityinfo/* 컴포넌트

interface Props {
  readonly areaName: string
  readonly onBack: () => void
  readonly onSelectArea: (name: string) => void
}

export function AreaDetail({ areaName, onBack, onSelectArea }: Props) {
  const snapshot = useAreaSnapshot(areaName)
  const { isFavorite, toggle } = useFavorites()
  // 접힌 동안은 areaName을 넘기지 않아 useCityInfo의 enabled가 false가 된다.
  // 하루 1,000회 제한을 혼잡도와 나눠 쓰므로 상세를 열 때마다 부르면 안 된다.
  // 설계 문서 §2.8 참고.
  const [cityInfoOpen, setCityInfoOpen] = useState(false)
  const cityInfo = useCityInfo(cityInfoOpen ? areaName : undefined)

  const starred = isFavorite(areaName)

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between px-4 py-2">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-12 items-center gap-1 text-label-md font-semibold text-primary"
        >
          <Icon name="back" className="size-4" />
          목록으로
        </button>
        <button
          type="button"
          aria-label={starred ? '즐겨찾기에서 빼기' : '즐겨찾기에 추가'}
          aria-pressed={starred}
          onClick={() => toggle(areaName)}
          className="min-h-12 px-2 text-primary"
        >
          <Icon name={starred ? 'star-filled' : 'star'} className="size-5" />
        </button>
      </div>

      {/* 아래 넷을 ForecastScreen.tsx에서 그대로 옮긴다. 옮길 때 상단바
          관련 JSX와 onBack 처리는 빼고 본문만 가져온다:
            1. 현재 상태 카드 — 배지, congestionHeadline, message, 마지막 갱신,
               추정 인구 범위
            2. 한산 시간 안내 — "N시엔 여유 예상" 박스
            3. <ForecastChart forecasts={...} />
            4. <ActionButtons areaName={...} /> — 카카오·네이버·공유
          로딩·에러 처리도 함께 옮긴다(SkeletonCard, ErrorState). */}

      <section className="mx-4 mt-3 rounded-lg border border-outline-variant">
        <button
          type="button"
          aria-expanded={cityInfoOpen}
          onClick={() => setCityInfoOpen((open) => !open)}
          className="flex min-h-12 w-full items-center justify-between px-4 text-label-md font-semibold text-on-surface"
        >
          이곳의 도시 정보
          <Icon name={cityInfoOpen ? 'chevron-up' : 'chevron-down'} className="size-4" />
        </button>
        {cityInfoOpen && (
          <div className="px-4 pb-4">
            {/* MoreScreen이 조립하던 순서 그대로:
                재난문자 → 날씨·대기 → 주차장 → 따릉이 → 문화행사.
                도시 정보 조회가 실패해도 위쪽 혼잡도·예측은 유지된다. */}
          </div>
        )}
      </section>
    </div>
  )
}
```

`Icon.tsx`에 `star`·`star-filled`·`chevron-up`·`chevron-down`을 추가한다. 넷 다 현재 없다.

도시 정보 조회가 실패했을 때는 펼친 영역 안에만 "도시 정보를 가져오지 못했어요."를 그린다. 위쪽 혼잡도·예측·길찾기는 건드리지 않는다 — `cityInfoSchema.ts`가 관대한 파싱을 하는 이유와 같은 방향이다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/components/home/AreaDetail.test.tsx`
Expected: PASS

- [ ] **Step 5: 변이 확인 (지연 로딩이 핵심이다)**

`useCityInfo(cityInfoOpen ? areaName : undefined)`를 `useCityInfo(areaName)`으로 바꾼다 → "도시 정보는 접힌 채로 시작하고 조회하지 않는다"가 실패해야 한다. 실패하지 않으면 그 테스트가 쿼터 방어를 전혀 지키지 못하고 있는 것이다. 되돌린다.

- [ ] **Step 6: 커밋**

```bash
git add src/components/home/AreaDetail.tsx src/components/home/AreaDetail.test.tsx src/components/common/Icon.tsx
git commit -m "feat: 인플레이스 명소 상세 추가 (도시 정보는 펼칠 때 조회)"
```

---

## Task 11: `HomeScreen` + `useHomeFilters`

**Files:**
- Create: `src/hooks/useHomeFilters.ts`
- Create: `src/screens/HomeScreen.tsx`
- Test: `src/hooks/useHomeFilters.test.ts`, `src/screens/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: Task 2·4·6·8·9·10의 전부, `MapScreen.tsx`의 지도 조립 코드
- Produces:
  - `interface HomeFilters { query, category, preset, sort, selectedName, mapRatio }` 와 각 setter
  - `function HomeScreen(props: { readonly focusArea?: string | null }): JSX.Element`

`focusArea`는 즐겨찾기·오늘의 서울에서 명소를 눌러 홈으로 넘어올 때 쓴다(Task 14). 값이 바뀌면 `useEffect`로 `setSelectedName`을 맞춘다. 홈 상태를 `App`으로 끌어올리지 않으려는 것이다 — 설계 §3.5.

- [ ] **Step 1: `useHomeFilters` 실패 테스트를 쓴다**

```ts
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useHomeFilters } from './useHomeFilters'

describe('useHomeFilters', () => {
  it('프리셋을 바꾸면 선택이 해제된다', () => {
    const { result } = renderHook(() => useHomeFilters())
    act(() => result.current.setSelectedName('강남역'))
    expect(result.current.selectedName).toBe('강남역')
    act(() => result.current.setPreset('kids'))
    expect(result.current.selectedName).toBeNull()
  })

  it('카테고리를 바꿔도 선택이 해제된다', () => {
    const { result } = renderHook(() => useHomeFilters())
    act(() => result.current.setSelectedName('강남역'))
    act(() => result.current.setCategory('공원'))
    expect(result.current.selectedName).toBeNull()
  })

  it('검색어를 바꿔도 선택이 해제된다', () => {
    const { result } = renderHook(() => useHomeFilters())
    act(() => result.current.setSelectedName('강남역'))
    act(() => result.current.setQuery('공원'))
    expect(result.current.selectedName).toBeNull()
  })

  it('정렬을 바꾸면 선택은 유지된다', () => {
    const { result } = renderHook(() => useHomeFilters())
    act(() => result.current.setSelectedName('강남역'))
    act(() => result.current.setSort('busy'))
    expect(result.current.selectedName).toBe('강남역')
  })
})
```

걸러진 명소의 상세가 남으면 목록에 없는 곳의 요약이 떠 있게 된다. 정렬은 목록에서 빼지 않으므로 선택을 지울 이유가 없다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/hooks/useHomeFilters.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: `useHomeFilters.ts`를 구현한다**

```ts
import { useCallback, useState } from 'react'
import { DEFAULT_MAP_RATIO } from '../domain/split'
import type { PresetKey } from '../domain/presets'
import type { CategoryFilterValue, SortMode } from './useNearbyAreas'

export function useHomeFilters() {
  const [query, setQueryRaw] = useState('')
  const [category, setCategoryRaw] = useState<CategoryFilterValue>('전체')
  const [preset, setPresetRaw] = useState<PresetKey | null>(null)
  const [sort, setSort] = useState<SortMode>('distance')
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [mapRatio, setMapRatio] = useState(DEFAULT_MAP_RATIO)

  // 목록에서 빠질 수 있는 조작은 선택을 해제한다. 걸러져 사라진 명소의
  // 상세가 남으면 목록에 없는 곳의 요약이 떠 있는 상태가 된다.
  const setQuery = useCallback((next: string) => {
    setQueryRaw(next)
    setSelectedName(null)
  }, [])
  const setCategory = useCallback((next: CategoryFilterValue) => {
    setCategoryRaw(next)
    setSelectedName(null)
  }, [])
  const setPreset = useCallback((next: PresetKey | null) => {
    setPresetRaw(next)
    setSelectedName(null)
  }, [])

  return {
    query, setQuery,
    category, setCategory,
    preset, setPreset,
    sort, setSort,          // 정렬은 목록에서 빼지 않으므로 선택을 지우지 않는다
    selectedName, setSelectedName,
    mapRatio, setMapRatio,
  }
}
```

- [ ] **Step 4: `HomeScreen` 실패 테스트를 쓴다**

Task 10과 같은 목업 패턴을 쓴다. 지도 SDK와 위치도 목업한다.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AreaSnapshot } from '../domain/types'
import { HomeScreen } from './HomeScreen'

// jsdom에 Google Maps가 없다. App.test.tsx가 토스 SDK에 쓰는 방식과 같다.
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Map: ({ children }: { children: ReactNode }) => (
    <div role="region" aria-label="지도">{children}</div>
  ),
  AdvancedMarker: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}))

vi.mock('../data/queries', () => ({ useAreaSnapshots: vi.fn() }))
vi.mock('../app/locationContext', () => ({ useLocation: vi.fn() }))
vi.mock('../platform/googleMaps', () => ({
  googleMapsApiKey: vi.fn(() => 'test-key'),
  googleMapsMapId: vi.fn(() => 'DEMO_MAP_ID'),
  isMapAvailable: vi.fn(() => true),
}))

const queries = await import('../data/queries')
const locationContext = await import('../app/locationContext')
const googleMaps = await import('../platform/googleMaps')
const useAreaSnapshots = vi.mocked(queries.useAreaSnapshots)
const useLocation = vi.mocked(locationContext.useLocation)
const isMapAvailable = vi.mocked(googleMaps.isMapAvailable)

function snapshotFor(name: string): AreaSnapshot {
  return {
    code: name, name, congestion: '보통', message: '',
    populationMin: 0, populationMax: 0,
    observedAt: '2026-08-07 11:00', observedAtLabel: '11:00', forecasts: [],
  }
}

beforeEach(async () => {
  localStorage.clear()
  isMapAvailable.mockReturnValue(true)
  useLocation.mockReturnValue({ coords: null, status: 'unavailable', request: vi.fn() })
  const { AREA_NAMES } = await import('../data/areas')
  useAreaSnapshots.mockReturnValue({
    data: AREA_NAMES.map(snapshotFor),
    isPending: false,
    isError: false,
  } as UseQueryResult<readonly (AreaSnapshot | null)[]>)
})

describe('HomeScreen', () => {
  it('목록과 지도를 함께 보여준다', () => {
    render(<HomeScreen />)
    expect(screen.getByRole('region', { name: '지도' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /강남역/ }).length).toBeGreaterThan(0)
  })

  it('명소를 누르면 상세가 목록 자리에 들어오고 지도는 남는다', async () => {
    render(<HomeScreen />)
    await userEvent.click(screen.getAllByRole('button', { name: /강남역/ })[0])
    expect(screen.getByRole('button', { name: '목록으로' })).toBeInTheDocument()
    // 핵심: 지도가 사라지지 않는다. 현재 구조에서는 상세로 가면 사라졌다.
    expect(screen.getByRole('region', { name: '지도' })).toBeInTheDocument()
  })

  it('목록으로를 누르면 다시 목록이 나온다', async () => {
    render(<HomeScreen />)
    await userEvent.click(screen.getAllByRole('button', { name: /강남역/ })[0])
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))
    expect(screen.getAllByRole('button', { name: /경복궁/ }).length).toBeGreaterThan(0)
  })

  it('검색하면 목록이 줄어든다', async () => {
    render(<HomeScreen />)
    await userEvent.type(screen.getByRole('searchbox'), '경복궁')
    expect(screen.queryByRole('button', { name: /강남역/ })).toBeNull()
    expect(screen.getAllByRole('button', { name: /경복궁/ }).length).toBeGreaterThan(0)
  })

  it('검색 결과가 없으면 찾은 말을 되돌려 보여준다', async () => {
    render(<HomeScreen />)
    await userEvent.type(screen.getByRole('searchbox'), '없는곳')
    expect(screen.getByText(/「없는곳」/)).toBeInTheDocument()
  })

  // 설계 §4가 가장 중요하다고 한 실패 경로다. 지금은 지도가 독립 탭이라
  // 실패해도 「내 주변」이 멀쩡했지만, 이제 지도가 홈의 절반이다.
  it('지도 키가 없어도 검색과 목록은 정상 동작한다', async () => {
    isMapAvailable.mockReturnValue(false)
    render(<HomeScreen />)
    expect(screen.queryByRole('region', { name: '지도' })).toBeNull()
    expect(screen.getAllByRole('button', { name: /강남역/ }).length).toBeGreaterThan(0)
    await userEvent.type(screen.getByRole('searchbox'), '경복궁')
    expect(screen.queryByRole('button', { name: /강남역/ })).toBeNull()
  })

  it('지도 키가 없어도 명소 상세를 열 수 있다', async () => {
    isMapAvailable.mockReturnValue(false)
    render(<HomeScreen />)
    await userEvent.click(screen.getAllByRole('button', { name: /강남역/ })[0])
    expect(screen.getByRole('button', { name: '목록으로' })).toBeInTheDocument()
  })

  it('focusArea가 주어지면 그 명소의 상세로 연다', () => {
    render(<HomeScreen focusArea="경복궁" />)
    expect(screen.getByRole('button', { name: '목록으로' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '경복궁' })).toBeInTheDocument()
  })
})
```

`useLocation`의 반환 형태는 `src/app/locationContext.ts`에서 확인해 맞출 것 — 위 목업의 `{ coords, status, request }`가 실제와 다르면 그 파일 기준으로 고친다.

- [ ] **Step 5: `HomeScreen.tsx`를 구현한다**

`MapScreen.tsx`의 지도 조립(APIProvider·Map·마커·RecenterButton·PresetFilter)을 `SplitPane`의 `top`으로, 검색·필터·정렬·목록 또는 상세를 `bottom`으로 넣는다. 상태는 `useHomeFilters`가 든다.

파이프라인 순서가 중요하다.

```tsx
const list = useMemo(
  () => buildNearbyList({ entries: AREA_CATALOG, snapshots: snapshots.data ?? [], coords: location.coords, category: filters.category, sort: filters.sort }),
  [snapshots.data, location.coords, filters.category, filters.sort],
)
// 개수는 걸러지기 전 목록으로 센다. 걸러진 목록으로 세면 프리셋 하나를
// 고르는 순간 나머지 두 칩이 0이 되어 비활성으로 굳는다.
const counts = presetCounts(list)
const visible = searchAreas(filterByPreset(list, filters.preset), filters.query)
const markers = snapshots.isPending ? [] : toMapMarkers(visible)
```

키가 없을 때 **지도 영역만** 대체한다.

```tsx
const mapPane = !isMapAvailable() ? (
  <MapUnavailableNotice reason="no-key" />
) : loadFailed ? (
  <MapUnavailableNotice reason="load-failed" />
) : (
  <APIProvider /* ... */>{/* MapScreen과 동일 */}</APIProvider>
)
```

키가 없으면 초기 비율을 `MIN_MAP_RATIO`로 둔다 — 안내 문구가 화면 절반을 차지할 이유가 없다.

- [ ] **Step 6: 통과를 확인한다**

Run: `npm test` 그리고 `npx tsc -b`
Expected: 전부 PASS

- [ ] **Step 7: 변이 확인**

`useHomeFilters`의 `setPreset`에서 `setSelectedName(null)`을 지운다 → "프리셋을 바꾸면 선택이 해제된다"가 실패해야 한다. 되돌린다.

- [ ] **Step 8: 커밋**

```bash
git add src/hooks/useHomeFilters.ts src/hooks/useHomeFilters.test.ts src/screens/HomeScreen.tsx src/screens/HomeScreen.test.tsx
git commit -m "feat: 지도 홈 화면 추가 (지도+목록+인플레이스 상세)"
```

---

## Task 12: `TodayScreen` — 오늘의 서울

**Files:**
- Create: `src/components/today/SummaryCard.tsx`, `RankList.tsx`, `CategoryAverages.tsx`, `AlertDigest.tsx`
- Create: `src/hooks/useCachedCityAlerts.ts`
- Create: `src/screens/TodayScreen.tsx`
- Test: 각 컴포넌트 테스트 + `src/screens/TodayScreen.test.tsx`

**Interfaces:**
- Consumes: Task 3의 `summarize`·`topBusiest`·`topCalmest`·`categoryAverages`, `useAreaSnapshots`, `CATEGORY_LABEL`, `RecommendationCard`(Task 7에서 이동), `pickRecommendations`
- Produces: `function TodayScreen(props: { onSelectArea: (name: string) => void })`

- [ ] **Step 1: `SummaryCard` 실패 테스트를 쓴다**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SummaryCard } from './SummaryCard'

describe('SummaryCard', () => {
  it('붐빔 개수를 한 줄로 보여준다', () => {
    render(
      <SummaryCard
        summary={{
          total: 30,
          counted: 30,
          byLevel: { 여유: 20, 보통: 5, '약간 붐빔': 4, 붐빔: 1 },
        }}
      />,
    )
    expect(screen.getByText(/30곳 중 붐빔 1곳/)).toBeInTheDocument()
  })

  it('아직 아무것도 안 왔으면 그렇게 말한다', () => {
    render(
      <SummaryCard
        summary={{
          total: 30,
          counted: 0,
          byLevel: { 여유: 0, 보통: 0, '약간 붐빔': 0, 붐빔: 0 },
        }}
      />,
    )
    expect(screen.getByText('혼잡도 정보를 아직 받지 못했어요.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/components/today/SummaryCard.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 네 컴포넌트를 구현한다**

```tsx
// SummaryCard.tsx
import type { CitySummary } from '../../domain/summary'

interface Props {
  readonly summary: CitySummary
}

export function SummaryCard({ summary }: Props) {
  if (summary.counted === 0) {
    return (
      <section className="mx-4 rounded-lg bg-surface-container-lowest p-4">
        <h2 className="text-headline-sm text-on-surface">지금 서울</h2>
        <p className="mt-1 text-body-md text-on-surface-variant">
          혼잡도 정보를 아직 받지 못했어요.
        </p>
      </section>
    )
  }
  return (
    <section className="mx-4 rounded-lg bg-surface-container-lowest p-4">
      <h2 className="text-label-md text-on-surface-variant">지금 서울</h2>
      <p className="mt-1 text-headline-md font-bold text-on-surface">
        {summary.counted}곳 중 붐빔 {summary.byLevel.붐빔}곳
      </p>
    </section>
  )
}
```

```tsx
// RankList.tsx
import { CongestionBadge } from '../common/CongestionBadge'
import { CATEGORY_LABEL } from '../../domain/types'
import type { NearbyArea } from '../../domain/types'

interface RankListProps {
  readonly title: string
  readonly areas: readonly NearbyArea[]
  readonly onSelect: (name: string) => void
}

export function RankList({ title, areas, onSelect }: RankListProps) {
  if (areas.length === 0) return null
  return (
    <section className="mx-4 mt-3 rounded-lg bg-surface-container-lowest p-4">
      <h3 className="text-label-md text-on-surface-variant">{title}</h3>
      <ul className="mt-2">
        {areas.map((area, index) => (
          <li key={area.entry.code}>
            <button
              type="button"
              onClick={() => onSelect(area.entry.name)}
              className="flex min-h-12 w-full items-center justify-between gap-2 text-left"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="text-label-sm text-outline">{index + 1}</span>
                <span className="truncate text-body-md text-on-surface">
                  {area.entry.name}
                </span>
                <span className="shrink-0 text-label-sm text-on-surface-variant">
                  {CATEGORY_LABEL[area.entry.category]}
                </span>
              </span>
              <CongestionBadge level={area.snapshot?.congestion ?? null} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

```tsx
// CategoryAverages.tsx
import { CongestionBadge } from '../common/CongestionBadge'
import { CATEGORY_LABEL, type AreaCategory, type CongestionLevel } from '../../domain/types'

interface AveragesProps {
  readonly rows: readonly { readonly category: AreaCategory; readonly level: CongestionLevel }[]
}

export function CategoryAverages({ rows }: AveragesProps) {
  if (rows.length === 0) return null
  return (
    <section className="mx-4 mt-3 rounded-lg bg-surface-container-lowest p-4">
      <h3 className="text-label-md text-on-surface-variant">카테고리별 평균</h3>
      <ul className="mt-2">
        {rows.map((row) => (
          <li key={row.category} className="flex items-center justify-between py-1.5">
            <span className="text-body-md text-on-surface">
              {CATEGORY_LABEL[row.category]}
            </span>
            <CongestionBadge level={row.level} />
          </li>
        ))}
      </ul>
    </section>
  )
}
```

```tsx
// AlertDigest.tsx
import type { CityAlert } from '../../domain/cityInfo'

interface DigestProps {
  readonly alerts: readonly CityAlert[]
}

export function AlertDigest({ alerts }: DigestProps) {
  // 같은 경보가 여러 명소에 실려 온다. 중복을 지우지 않으면 화면이 같은
  // 문장으로 도배된다 — 폭염 경보 하나가 30줄이 된다.
  const unique = Array.from(new Map(alerts.map((a) => [a.message, a])).values())
  if (unique.length === 0) return null
  return (
    <section className="mx-4 mt-3 rounded-lg bg-error-container p-4" role="alert">
      <h3 className="text-label-md font-semibold text-on-error-container">
        재난문자 {unique.length}건
      </h3>
      <ul className="mt-1">
        {unique.map((alert) => (
          <li key={alert.message} className="py-1 text-body-md text-on-error-container">
            {alert.message}
          </li>
        ))}
      </ul>
    </section>
  )
}
```

`CityAlert`의 실제 필드 이름은 `src/domain/cityInfo.ts`에서 확인해 맞춘다. `message`가 아니면 그 이름으로 바꾸고 `key`도 함께 바꾼다. `CongestionBadge`가 `level={null}`을 받는지도 확인할 것 — 안 받으면 `RankList`에서 `area.snapshot`이 있는 항목만 넘어오므로 `!`를 쓰지 말고 조건부로 그린다.

- [ ] **Step 4: `TodayScreen`을 조립한다**

`useAreaSnapshots(AREA_NAMES)`를 쓴다. **`useCityInfo`를 부르지 않는다.** 추가 호출이 0이라는 것이 이 화면의 존재 근거인데, 재난문자를 위해 30곳의 `cityInfo`를 새로 부르면 하루 720회가 그대로 더해진다.

재난문자는 **홈 상세에서 이미 받아둔 캐시에 있는 것만** 모은다. 캐시 접근을 화면에 직접 두면 테스트가 `QueryClientProvider`를 세워야 하므로 훅으로 뺀다.

```ts
// src/hooks/useCachedCityAlerts.ts
import { useQueryClient } from '@tanstack/react-query'
import { AREA_NAMES } from '../data/areas'
import type { CityAlert, CityInfo } from '../domain/cityInfo'

// 캐시에 있는 것만 읽는다. 없으면 조회하지 않는다 — 이 화면은 추가 호출이
// 0이어야 한다. 사용자가 상세에서 도시 정보를 펼친 명소만 여기 잡힌다.
export function useCachedCityAlerts(): readonly CityAlert[] {
  const client = useQueryClient()
  return AREA_NAMES.flatMap((name) => {
    const cached = client.getQueryData<CityInfo>(['cityInfo', name])
    return cached?.alerts ?? []
  })
}
```

`TodayScreen`은 이 훅과 `useAreaSnapshots`만 쓴다. 테스트에서는 둘 다 `vi.mock`으로 대체한다.

- [ ] **Step 5: `TodayScreen` 테스트를 쓰고 통과시킨다**

```tsx
vi.mock('../data/queries', () => ({ useAreaSnapshots: vi.fn() }))
vi.mock('../hooks/useCachedCityAlerts', () => ({ useCachedCityAlerts: vi.fn() }))
vi.mock('../app/locationContext', () => ({ useLocation: vi.fn() }))

// beforeEach에서 HomeScreen.test.tsx와 같은 방식으로 스냅샷을 심되,
// 명소마다 혼잡도를 다르게 준다 — 전부 같으면 TOP 순서 테스트가 무의미하다.

it('붐비는 곳과 여유로운 곳을 모두 보여준다', () => {
  render(<TodayScreen onSelectArea={() => {}} />)
  expect(screen.getByRole('heading', { name: /지금 가장 붐비는 곳/ })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /여유로운 곳/ })).toBeInTheDocument()
})

it('항목을 누르면 명소를 올려보낸다', async () => {
  const onSelectArea = vi.fn()
  render(<TodayScreen onSelectArea={onSelectArea} />)
  await userEvent.click(screen.getByRole('button', { name: /성수카페거리/ }))
  expect(onSelectArea).toHaveBeenCalledWith('성수카페거리')
})

it('캐시에 재난문자가 없으면 배너를 그리지 않는다', () => {
  vi.mocked(useCachedCityAlerts).mockReturnValue([])
  render(<TodayScreen onSelectArea={() => {}} />)
  expect(screen.queryByRole('alert')).toBeNull()
})

it('같은 재난문자가 여러 명소에 실려도 한 번만 그린다', () => {
  const alert = { message: '호우 주의보' } as CityAlert
  vi.mocked(useCachedCityAlerts).mockReturnValue([alert, alert, alert])
  render(<TodayScreen onSelectArea={() => {}} />)
  expect(screen.getAllByText('호우 주의보')).toHaveLength(1)
})
```

Run: `npm test`
Expected: PASS

- [ ] **Step 6: 변이 확인**

`AlertDigest`의 중복 제거를 지운다 → 같은 문구가 여러 번 나와 관련 테스트가 실패해야 한다. 되돌린다.

- [ ] **Step 7: 커밋**

```bash
git add src/components/today src/screens/TodayScreen.tsx src/screens/TodayScreen.test.tsx
git commit -m "feat: 오늘의 서울 화면 추가"
```

---

## Task 13: `FavoritesScreen`

**Files:**
- Create: `src/screens/FavoritesScreen.tsx`
- Test: `src/screens/FavoritesScreen.test.tsx`

**Interfaces:**
- Consumes: `useFavorites`(Task 5), `useAreaSnapshots`, `buildNearbyList`, `AreaListItem`
- Produces: `function FavoritesScreen(props: { onSelectArea: (name: string) => void; onGoHome: () => void })`

- [ ] **Step 1: 실패 테스트를 쓴다**

```tsx
vi.mock('../data/queries', () => ({ useAreaSnapshots: vi.fn() }))
vi.mock('../app/locationContext', () => ({ useLocation: vi.fn() }))
// beforeEach는 HomeScreen.test.tsx와 같다. localStorage.clear()를 잊지 말 것.

it('비어 있으면 담는 방법을 알려주고 홈으로 가는 버튼을 준다', async () => {
  const onGoHome = vi.fn()
  render(<FavoritesScreen onSelectArea={() => {}} onGoHome={onGoHome} />)
  expect(
    await screen.findByText('지도에서 ☆를 눌러 담아보세요'),
  ).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '지도로 가기' }))
  expect(onGoHome).toHaveBeenCalledTimes(1)
})

it('담은 명소만 보여준다', async () => {
  localStorage.setItem('seoul-live:favorites', JSON.stringify(['경복궁']))
  render(<FavoritesScreen onSelectArea={() => {}} onGoHome={() => {}} />)
  expect(await screen.findByRole('button', { name: /경복궁/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /강남역/ })).toBeNull()
})

it('항목을 누르면 명소를 올려보낸다', async () => {
  localStorage.setItem('seoul-live:favorites', JSON.stringify(['경복궁']))
  const onSelectArea = vi.fn()
  render(<FavoritesScreen onSelectArea={onSelectArea} onGoHome={() => {}} />)
  await userEvent.click(await screen.findByRole('button', { name: /경복궁/ }))
  expect(onSelectArea).toHaveBeenCalledWith('경복궁')
})
```

`useFavorites`가 비동기로 읽으므로 빈 상태 단언에도 `findBy*`를 쓴다. `getBy*`를 쓰면 로드 전 렌더를 잡아 통과했다가 나중에 깨진다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/screens/FavoritesScreen.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현한다**

`buildNearbyList`로 전체를 만든 뒤 `favorites.includes(entry.name)`로 거른다. 빈 상태는 안내 문구와 「지도로 가기」 버튼을 그린다 — 빈 화면만 두면 이 탭이 고장 난 것으로 읽힌다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/screens/FavoritesScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/screens/FavoritesScreen.tsx src/screens/FavoritesScreen.test.tsx
git commit -m "feat: 즐겨찾기 화면 추가"
```

---

## Task 14: 탭 셋으로 전환하고 옛 화면을 지운다

**Files:**
- Modify: `src/components/layout/BottomTabBar.tsx`
- Modify: `src/App.tsx`
- Delete: `src/screens/{NearbyScreen,ForecastScreen,MapScreen,MoreScreen}.tsx` (+ 테스트)
- Delete: `src/components/map/AreaSheet.tsx` (+ 테스트), `src/components/more/AreaPicker.tsx` (+ 테스트)
- Test: `src/App.test.tsx`, `src/components/layout/BottomTabBar.test.tsx`

**Interfaces:**
- Consumes: `HomeScreen`, `FavoritesScreen`, `TodayScreen`
- Produces: `type TabKey = 'home' | 'favorites' | 'more'`

- [ ] **Step 1: 실패 테스트를 쓴다**

```tsx
// BottomTabBar.test.tsx
it('탭이 셋이다', () => {
  render(<BottomTabBar active="home" onSelect={() => {}} />)
  expect(screen.getAllByRole('button')).toHaveLength(3)
})

it('혼잡예보 탭이 없다', () => {
  render(<BottomTabBar active="home" onSelect={() => {}} />)
  expect(screen.queryByRole('button', { name: /혼잡예보/ })).toBeNull()
})

it('내 주변 탭이 없다', () => {
  render(<BottomTabBar active="home" onSelect={() => {}} />)
  expect(screen.queryByRole('button', { name: /내 주변/ })).toBeNull()
})
```

```tsx
// App.test.tsx
it('처음 화면은 지도다', async () => {
  render(<App />)
  expect(await screen.findByRole('region', { name: '지도' })).toBeInTheDocument()
})

it('탭을 바꿔도 홈이 언마운트되지 않아 지도 상태가 남는다', async () => {
  render(<App />)
  await screen.findByRole('region', { name: '지도' })
  await userEvent.click(screen.getByRole('button', { name: '더보기' }))
  await userEvent.click(screen.getByRole('button', { name: '지도' }))
  expect(await screen.findByRole('region', { name: '지도' })).toBeInTheDocument()
})
```

두 번째 테스트는 홈을 `hidden`으로 남겨 두는 구현을 요구한다. 탭을 오갈 때 지도가 매번 다시 만들어지면 타일을 다시 받고 카메라가 초기화된다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/components/layout/BottomTabBar.test.tsx src/App.test.tsx`
Expected: FAIL — 탭이 넷이다

- [ ] **Step 3: `BottomTabBar.tsx`를 고친다**

```ts
export type TabKey = 'home' | 'favorites' | 'more'

const TABS: readonly Tab[] = [
  { key: 'home', label: '지도', icon: 'map', enabled: true },
  { key: 'favorites', label: '즐겨찾기', icon: 'star', enabled: true },
  { key: 'more', label: '더보기', icon: 'more', enabled: true },
]
```

- [ ] **Step 4: `App.tsx`를 고친다**

```tsx
function AppShell() {
  const [tab, setTab] = useState<TabKey>('home')
  // 즐겨찾기·오늘의 서울에서 명소를 누르면 홈으로 옮겨 상세를 연다.
  // 여기 있는 건 "어디로 보낼 것인가"뿐이고 홈의 필터·카메라 상태는
  // 여전히 HomeScreen 안에 있다 — 설계 §3.5.
  const [focusArea, setFocusArea] = useState<string | null>(null)

  function openArea(name: string): void {
    setFocusArea(name)
    setTab('home')
  }

  return (
    <div className="flex min-h-full flex-col bg-surface">
      <TopAppBar title={tab === 'more' ? '오늘의 서울' : 'Seoul Live'} />
      <main className="flex-1">
        {/* 홈은 언제나 마운트된 채로 둔다. 탭을 오갈 때마다 새로 만들면
            google.maps.Map이 다시 생성돼 타일을 다시 받고 카메라가 서울
            전역으로 돌아간다. 선택·검색·분할 비율도 함께 날아간다. */}
        <div hidden={tab !== 'home'}>
          <HomeScreen focusArea={focusArea} />
        </div>
        {tab === 'favorites' && (
          <FavoritesScreen onSelectArea={openArea} onGoHome={() => setTab('home')} />
        )}
        {tab === 'more' && <TodayScreen onSelectArea={openArea} />}
      </main>
      <BottomTabBar active={tab} onSelect={setTab} />
    </div>
  )
}
```

`HomeScreen`의 `focusArea` 처리는 값이 **바뀔 때만** 선택을 옮긴다.

```tsx
useEffect(() => {
  if (focusArea !== null) {
    filters.setSelectedName(focusArea)
  }
}, [focusArea])
```

의존성에 `filters`를 넣지 마라 — 매 렌더마다 새 객체라 무한 루프가 된다. `focusArea`만 본다. 같은 명소를 두 번 눌러도 다시 열리게 하려면 `App`에서 `setFocusArea(null)` 후 다시 세팅하지 말고, 홈에서 「목록으로」를 눌렀을 때 `focusArea`가 그대로 남아도 재실행되지 않는 현재 동작을 그대로 둔다 — 사용자가 즐겨찾기 탭을 다시 거치면 새 값이 들어온다.

- [ ] **Step 5: 옛 화면과 컴포넌트를 지운다**

```bash
git rm src/screens/NearbyScreen.tsx src/screens/NearbyScreen.test.tsx
git rm src/screens/ForecastScreen.tsx src/screens/ForecastScreen.test.tsx
git rm src/screens/MapScreen.tsx src/screens/MapScreen.test.tsx
git rm src/screens/MoreScreen.tsx src/screens/MoreScreen.test.tsx
git rm src/components/map/AreaSheet.tsx src/components/map/AreaSheet.test.tsx
git rm src/components/more/AreaPicker.tsx src/components/more/AreaPicker.test.tsx
```

`src/components/more/`와 `src/components/nearby/`가 비었는지 확인한다. 남은 파일이 있으면 Task 7에서 빠뜨린 것이다.

- [ ] **Step 6: 통과를 확인한다**

Run: `npm test`, `npx tsc -b`, `npm run lint`, `npm run build:vite`
Expected: 전부 PASS

- [ ] **Step 7: 실제로 띄워 본다**

Run: `npm run dev -- --port 5174 --strictPort`

브라우저에서 확인할 것:
1. 첫 화면이 지도다
2. 손잡이를 끌면 지도·목록 비율이 바뀌고, 놓으면 스냅된다
3. 명소를 누르면 지도가 남은 채 아래만 상세로 바뀐다
4. 「이곳의 도시 정보」가 접혀 있고, 펼쳐야 내용이 나온다
5. 별을 누르면 즐겨찾기 탭에 나타난다
6. 더보기가 「오늘의 서울」이다
7. **콘솔에 에러가 없다**

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat: 하단 탭을 지도·즐겨찾기·더보기 셋으로 전환하고 옛 화면 제거"
```

---

## Task 15: 문서 갱신

**Files:**
- Modify: `README.md`, `PLAN.md`, `STATE.md`, `AGENTS.md`

- [ ] **Step 1: `README.md`**

화면 표를 넷에서 셋으로 고친다.

```markdown
| 탭 | 내용 |
| --- | --- |
| **지도** | Google Maps 위 혼잡도 마커 + 명소 목록. 검색·목적 프리셋·카테고리·정렬. 명소를 누르면 지도는 그대로 두고 아래만 상세로 바뀐다 |
| **즐겨찾기** | 담아둔 명소만. 기기에 저장된다 |
| **더보기** | 오늘의 서울 — 혼잡도 분포, 붐빔·여유 TOP, 카테고리별 평균, 재난문자, 추천 |
```

「구조」 절의 `src/screens/`·`src/components/` 설명도 새 디렉터리에 맞춘다.

- [ ] **Step 2: `PLAN.md`**

- 1차 절의 "하단 탭은 시안대로 4개" 서술을 셋으로 정정하고, 지도가 홈이 된 사실을 적는다
- 2차의 **즐겨찾기를 완료**로 바꾸고 저장소가 기기 로컬임을 적는다
- 3차 「더보기」 항목이 명소 상세로 이동했음을 적는다

- [ ] **Step 3: `STATE.md`**

- 「한 줄 요약」과 화면 구성
- 「파일 구조」를 새 디렉터리로
- **해소된 항목을 옮긴다**: "지도 카메라가 상세를 다녀오면 초기화된다"는 홈이 언마운트되지 않아 사라졌다
- **새 미해결 항목**: 드래그 손잡이와 지도 팬 제스처의 충돌 여부(실기기)
- 「다음에 할 일」을 새 상태로 갱신 — 도로소통·사고통제 섹션 추가, 121곳 확장, `REPLACE_YN`

- [ ] **Step 4: `AGENTS.md`**

- 레이어 규칙의 화면 목록을 새 구조로
- 바텀시트 조항: `AreaSheet`가 없어졌으므로 "진입 시 시트 자동 노출 금지"의 근거는 남기되 현재 코드에 시트가 없다는 사실을 적는다
- [ ] **Step 5: 커밋**

```bash
git add README.md PLAN.md STATE.md AGENTS.md
git commit -m "docs: 지도 홈 개편을 문서에 반영"
```

---

## 완료 기준

- [ ] `npm test` 통과, 커버리지 임계(라인·구문·함수 80%, 브랜치 75%) 유지
- [ ] `npx tsc -b` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run build:vite` 통과
- [ ] `npm run dev`로 띄워 Task 14 Step 7의 일곱 항목을 눈으로 확인
- [ ] 콘솔 에러 0건
