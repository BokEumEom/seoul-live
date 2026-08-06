# 목적 프리셋 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지도 화면에 「아이와 나들이 / 데이트 / 지금 핫플」 세 칩을 올려, 카테고리와 실시간 혼잡도를 함께 써서 상황에 맞는 명소만 남긴다.

**Architecture:** 프리셋 정의와 필터링은 `src/domain/presets.ts`의 순수 함수로 둔다. 개수 세기가 필터링 함수를 그대로 호출하므로 칩 숫자와 실제 마커 수가 어긋날 수 없다. `MapScreen`은 상태 하나와 배선만 더한다. **서울 API 호출은 늘지 않는다** — 이미 가져온 목록을 거를 뿐이다.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vitest + Testing Library

**설계 문서:** [docs/superpowers/specs/2026-08-06-purpose-presets-design.md](../specs/2026-08-06-purpose-presets-design.md) — 결정의 근거는 전부 여기 있다.

---

## 시작 전에 반드시 읽을 것

`AGENTS.md`가 정본이다. 이 계획에 직접 걸리는 것만 추린다.

1. **TDD.** 실패하는 테스트 먼저 → 실패 확인 → 구현 → 통과 확인 → 커밋.
2. **통과한 테스트를 믿지 마라.** 새 테스트를 쓴 뒤 구현을 일부러 깨뜨려 그 테스트가 실제로 실패하는지 확인한다. 이 프로젝트는 그런 "항상 참인 테스트"를 세 번 잡았다. 각 태스크의 **변이 확인** 단계를 건너뛰지 말 것.
3. **Tailwind v4는 클래스명을 정적으로 추출한다.** `` `bg-${x}` `` 같은 동적 조합은 빌드에서 사라진다. 전체 클래스명을 리터럴로 적는다.
4. **불변성.** 입력 배열을 변경하지 않는다. `.sort()` 대신 `.toSorted()`.
5. **`console.log` 금지.** 진단은 `console.error`.

**현재 상태:** 테스트 231개 + todo 1개 통과(파일 26개), `tsc -b`·`lint`·`build:vite` 통과. 브랜치 `feat/nearby-forecast`.

**작업 트리 주의:** `.grok/`, `.hermes/`, `.kiro/`, `.windsurf/`, `OPEN_API/` 아래에 이번 작업과 무관한 기존 삭제분이 있다. 스테이징하지도, 되돌리지도 말 것. `.env`는 건드리지 않는다.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/domain/presets.ts` | **신규.** 프리셋 정의(술어), 필터링, 개수 세기. React도 SDK도 모른다 |
| `src/components/map/PresetFilter.tsx` | **신규.** 칩 3개. props만 받는다 |
| `src/screens/MapScreen.tsx` | **수정.** 프리셋 상태와 배선, 상단 겹침 정리 |
| `PLAN.md` / `STATE.md` | **수정.** 2차 진행 상황 |

---

### Task 1: `src/domain/presets.ts` — 프리셋 정의와 필터링

**Files:**
- Create: `src/domain/presets.ts`
- Test: `src/domain/presets.test.ts`

기존 타입은 `src/domain/types.ts`에 있다: `NearbyArea`는 `{ entry, snapshot, distanceMeters }`이고 `snapshot`은 `AreaSnapshot | null`. `AreaCategory`는 `'공원' | '쇼핑몰' | '카페' | '문화재' | '기타'`. `isUncrowded()`는 `src/domain/congestion.ts`에 있고 여유·보통을 참으로 본다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/domain/presets.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { filterByPreset, PRESETS, presetCounts } from './presets'
import type {
  AreaCategory,
  AreaSnapshot,
  CongestionLevel,
  NearbyArea,
} from './types'

function area(
  name: string,
  category: AreaCategory,
  congestion: CongestionLevel | null,
): NearbyArea {
  const snapshot: AreaSnapshot | null =
    congestion === null
      ? null
      : {
          code: 'POI000',
          name,
          congestion,
          message: '테스트',
          populationMin: 1_000,
          populationMax: 2_000,
          observedAt: '2026-08-06 14:00',
          observedAtLabel: '14:00',
          forecasts: [],
        }

  return {
    entry: { code: 'POI000', name, lat: 37.5, lng: 127, category },
    snapshot,
    distanceMeters: null,
  }
}

describe('PRESETS', () => {
  it('세 개이고 키가 겹치지 않는다', () => {
    expect(PRESETS).toHaveLength(3)
    expect(new Set(PRESETS.map((p) => p.key)).size).toBe(3)
  })
})

describe('아이와 나들이', () => {
  it('한산한 공원을 고른다', () => {
    expect(filterByPreset([area('남산공원', '공원', '여유')], 'kids')).toHaveLength(1)
  })

  it('보통인 공원도 고른다', () => {
    // isUncrowded의 범위가 여유+보통이다. 여유만으로 좁히면 주말 오후에
    // 갈 곳이 거의 없어진다.
    expect(filterByPreset([area('서울숲공원', '공원', '보통')], 'kids')).toHaveLength(1)
  })

  it('약간 붐비는 공원은 뺀다', () => {
    expect(filterByPreset([area('여의도한강공원', '공원', '약간 붐빔')], 'kids')).toHaveLength(0)
  })

  it('한산해도 공원이 아니면 뺀다', () => {
    expect(filterByPreset([area('성수카페거리', '카페', '여유')], 'kids')).toHaveLength(0)
  })
})

describe('데이트', () => {
  it('카페·문화재·공원을 고른다', () => {
    const areas = [
      area('성수카페거리', '카페', '보통'),
      area('북촌한옥마을', '문화재', '여유'),
      area('남산공원', '공원', '보통'),
    ]

    expect(filterByPreset(areas, 'date')).toHaveLength(3)
  })

  it('쇼핑몰과 기타는 뺀다', () => {
    const areas = [
      area('가로수길', '쇼핑몰', '여유'),
      area('강남역', '기타', '여유'),
    ]

    expect(filterByPreset(areas, 'date')).toHaveLength(0)
  })

  it('붐비는 곳은 뺀다', () => {
    // 카테고리만으로 잡으면 카탈로그상 항상 19곳으로 고정돼, 옆의 두 칩이
    // 시간대마다 바뀌는 사이에서 혼자 죽은 숫자가 된다.
    expect(filterByPreset([area('인사동', '문화재', '붐빔')], 'date')).toHaveLength(0)
  })

  it('약간 붐비는 곳은 남긴다', () => {
    expect(filterByPreset([area('인사동', '문화재', '약간 붐빔')], 'date')).toHaveLength(1)
  })
})

describe('지금 핫플', () => {
  it('붐비는 곳만 고른다', () => {
    const areas = [
      area('강남역', '기타', '붐빔'),
      area('남산공원', '공원', '여유'),
    ]

    const picked = filterByPreset(areas, 'hot')
    expect(picked).toHaveLength(1)
    expect(picked[0].entry.name).toBe('강남역')
  })

  it('약간 붐빔은 아직 핫플이 아니다', () => {
    expect(filterByPreset([area('명동 관광특구', '기타', '약간 붐빔')], 'hot')).toHaveLength(0)
  })

  it('카테고리를 가리지 않는다', () => {
    const areas = [
      area('강남역', '기타', '붐빔'),
      area('남산공원', '공원', '붐빔'),
    ]

    expect(filterByPreset(areas, 'hot')).toHaveLength(2)
  })
})

describe('스냅샷이 없는 명소', () => {
  it('어느 프리셋에도 걸리지 않는다', () => {
    // 혼잡도를 모르는데 "한산하다"고 말할 수 없다. 지도 전체 보기에서는
    // 회색 "정보 없음" 마커로 남지만 프리셋을 켜면 빠진다.
    const areas = [
      area('남산공원', '공원', null),
      area('성수카페거리', '카페', null),
      area('강남역', '기타', null),
    ]

    for (const key of ['kids', 'date', 'hot'] as const) {
      expect(filterByPreset(areas, key)).toHaveLength(0)
    }
  })
})

describe('filterByPreset', () => {
  it('프리셋이 없으면 전체를 돌려준다', () => {
    const areas = [
      area('강남역', '기타', '붐빔'),
      area('남산공원', '공원', '여유'),
    ]

    expect(filterByPreset(areas, null)).toHaveLength(2)
  })

  it('입력 배열을 변경하지 않는다', () => {
    const areas = [
      area('강남역', '기타', '붐빔'),
      area('남산공원', '공원', '여유'),
    ]

    filterByPreset(areas, 'hot')

    expect(areas).toHaveLength(2)
    expect(areas[1].entry.name).toBe('남산공원')
  })
})

describe('presetCounts', () => {
  it('프리셋별 개수를 센다', () => {
    const areas = [
      area('남산공원', '공원', '여유'),
      area('서울숲공원', '공원', '보통'),
      area('성수카페거리', '카페', '붐빔'),
      area('강남역', '기타', '붐빔'),
    ]

    expect(presetCounts(areas)).toEqual({ kids: 2, date: 2, hot: 2 })
  })

  it('해당 없으면 0이다', () => {
    expect(presetCounts([area('강남역', '기타', '붐빔')])).toEqual({
      kids: 0,
      date: 0,
      hot: 1,
    })
  })

  it('개수와 필터 결과 길이가 항상 같다', () => {
    // 둘이 어긋나면 칩에 "3"이라고 써놓고 마커는 5개가 뜬다. 같은 술어를
    // 쓰는지 여기서 고정한다.
    const areas = [
      area('남산공원', '공원', '여유'),
      area('여의도한강공원', '공원', '약간 붐빔'),
      area('인사동', '문화재', '보통'),
      area('강남역', '기타', '붐빔'),
      area('경복궁', '문화재', null),
    ]

    const counts = presetCounts(areas)
    for (const key of ['kids', 'date', 'hot'] as const) {
      expect(filterByPreset(areas, key)).toHaveLength(counts[key])
    }
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npx vitest run src/domain/presets.test.ts
```

기대: `Failed to resolve import "./presets"`로 전부 실패. **구현 전에 확인할 것.**

- [ ] **Step 3: 구현**

`src/domain/presets.ts`:

```ts
import { isUncrowded } from './congestion'
import type { AreaCategory, NearbyArea } from './types'

export type PresetKey = 'kids' | 'date' | 'hot'

export interface Preset {
  readonly key: PresetKey
  readonly label: string
  readonly matches: (area: NearbyArea) => boolean
}

const DATE_CATEGORIES: ReadonlySet<AreaCategory> = new Set([
  '카페',
  '문화재',
  '공원',
])

// 스냅샷이 없는 명소는 어느 프리셋에도 걸리지 않는다. 혼잡도를 모르는데
// "한산하다"고 말할 수 없다. 지도 전체 보기에서는 회색 "정보 없음" 마커로
// 남지만 프리셋을 켜면 빠진다.
export const PRESETS: readonly Preset[] = [
  {
    key: 'kids',
    label: '아이와 나들이',
    matches: (area) =>
      area.entry.category === '공원' &&
      area.snapshot !== null &&
      isUncrowded(area.snapshot.congestion),
  },
  {
    key: 'date',
    label: '데이트',
    // 붐빔을 뺀다. 카테고리만으로 잡으면 카탈로그상 항상 19곳으로 고정돼,
    // 옆의 두 칩이 시간대마다 바뀌는 사이에서 혼자 죽은 숫자가 된다.
    // 데이트에 붐빔은 실제로 나쁜 조건이기도 하다.
    matches: (area) =>
      DATE_CATEGORIES.has(area.entry.category) &&
      area.snapshot !== null &&
      area.snapshot.congestion !== '붐빔',
  },
  {
    key: 'hot',
    label: '지금 핫플',
    // 붐비는 것이 곧 지금 사람이 몰린다는 신호다. 이 앱의 다른 화면들이
    // 혼잡을 피하는 쪽이라면 이 프리셋만 반대 방향을 본다.
    matches: (area) => area.snapshot?.congestion === '붐빔',
  },
]

/** 프리셋이 `null`이면 입력을 그대로 돌려준다 — 호출부가 분기하지 않아도 된다. */
export function filterByPreset(
  areas: readonly NearbyArea[],
  preset: PresetKey | null,
): readonly NearbyArea[] {
  if (preset === null) {
    return areas
  }
  const found = PRESETS.find((candidate) => candidate.key === preset)
  return found === undefined ? areas : areas.filter(found.matches)
}

// filterByPreset을 그대로 부른다. 개수와 실제 필터가 같은 술어를 쓴다는 것이
// 구조로 보장돼야, 칩에 "3"이라고 써놓고 마커가 5개 뜨는 일이 없다.
function countMatching(
  areas: readonly NearbyArea[],
  key: PresetKey,
): number {
  return filterByPreset(areas, key).length
}

export function presetCounts(
  areas: readonly NearbyArea[],
): Readonly<Record<PresetKey, number>> {
  return {
    kids: countMatching(areas, 'kids'),
    date: countMatching(areas, 'date'),
    hot: countMatching(areas, 'hot'),
  }
}
```

- [ ] **Step 4: 통과 확인**

```bash
npx vitest run src/domain/presets.test.ts
```

기대: 18개 통과.

- [ ] **Step 5: 변이 확인 — 필수, 건너뛰지 말 것**

하나씩 바꾸고 되돌린다.

**5a.** 「데이트」의 `area.snapshot.congestion !== '붐빔'` 줄을 지운다(`DATE_CATEGORIES.has(...) && area.snapshot !== null`만 남긴다).
기대: **"붐비는 곳은 뺀다" 실패.** 되돌린다.

**5b.** 「아이와 나들이」의 `isUncrowded(area.snapshot.congestion)`를 `area.snapshot.congestion === '여유'`로 바꾼다.
기대: **"보통인 공원도 고른다" 실패.** 되돌린다.

**5c.** 「지금 핫플」의 `area.snapshot?.congestion === '붐빔'`을 `area.snapshot !== null`로 바꾼다.
기대: **"붐비는 곳만 고른다", "약간 붐빔은 아직 핫플이 아니다" 실패.** 되돌린다.

**5d.** `countMatching`이 `filterByPreset`을 부르지 않게 바꾼다 — `presetCounts`의 `kids`를 `areas.length`로 고정한다.
기대: **"프리셋별 개수를 센다", "해당 없으면 0이다", "개수와 필터 결과 길이가 항상 같다" 실패.** 되돌린다.

어느 하나라도 예상대로 실패하지 않으면 그 테스트는 무의미하다 — 진행하지 말고 보고할 것.

되돌린 뒤 다시 돌려 18개 통과를 확인한다.

- [ ] **Step 6: 타입 검사와 린트**

```bash
npx tsc -b
npm run lint
```

둘 다 깨끗해야 한다.

- [ ] **Step 7: 커밋**

```bash
git add src/domain/presets.ts src/domain/presets.test.ts
git commit -m "feat: 목적 프리셋 도메인 함수 추가"
```

---

### Task 2: `PresetFilter` — 칩 3개

**Files:**
- Create: `src/components/map/PresetFilter.tsx`
- Test: `src/components/map/PresetFilter.test.tsx`

참고할 기존 패턴은 `src/components/nearby/CategoryFilter.tsx`다 — `role="tablist"` + `role="tab"` + `aria-selected`. 여기서는 개수 표시와 재클릭 해제가 더 붙는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/map/PresetFilter.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PresetFilter } from './PresetFilter'

const COUNTS = { kids: 3, date: 12, hot: 5 } as const

describe('PresetFilter', () => {
  it('세 프리셋을 개수와 함께 보여준다', () => {
    render(<PresetFilter counts={COUNTS} value={null} onChange={vi.fn()} />)

    expect(screen.getByRole('tab', { name: '아이와 나들이 3' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '데이트 12' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '지금 핫플 5' })).toBeInTheDocument()
  })

  it('개수가 0이면 비활성이다', () => {
    // 눌렀는데 아무 일도 안 일어나는 순간을 만들지 않는다. 새벽에는
    // 붐비는 곳이 없어 「지금 핫플」이 실제로 0이 된다.
    render(
      <PresetFilter
        counts={{ kids: 10, date: 19, hot: 0 }}
        value={null}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('tab', { name: '지금 핫플 0' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: '아이와 나들이 10' })).not.toBeDisabled()
  })

  it('누르면 그 키를 올려보낸다', async () => {
    const onChange = vi.fn()
    render(<PresetFilter counts={COUNTS} value={null} onChange={onChange} />)

    await userEvent.click(screen.getByRole('tab', { name: '데이트 12' }))

    expect(onChange).toHaveBeenCalledWith('date')
  })

  it('선택된 칩을 다시 누르면 해제한다', async () => {
    // 「전체」 칩을 따로 두면 지도 상단을 한 칸 더 먹는다. 재클릭이 해제다.
    const onChange = vi.fn()
    render(<PresetFilter counts={COUNTS} value="date" onChange={onChange} />)

    await userEvent.click(screen.getByRole('tab', { name: '데이트 12' }))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('선택된 칩만 강조한다', () => {
    render(<PresetFilter counts={COUNTS} value="hot" onChange={vi.fn()} />)

    expect(screen.getByRole('tab', { name: '지금 핫플 5' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: '데이트 12' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('비활성 칩은 눌러도 반응하지 않는다', async () => {
    const onChange = vi.fn()
    render(
      <PresetFilter
        counts={{ kids: 0, date: 0, hot: 0 }}
        value={null}
        onChange={onChange}
      />,
    )

    await userEvent.click(screen.getByRole('tab', { name: '아이와 나들이 0' }))

    expect(onChange).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npx vitest run src/components/map/PresetFilter.test.tsx
```

기대: `Failed to resolve import "./PresetFilter"`.

- [ ] **Step 3: 구현**

`src/components/map/PresetFilter.tsx`:

```tsx
import { PRESETS, type PresetKey } from '../../domain/presets'

interface Props {
  readonly counts: Readonly<Record<PresetKey, number>>
  readonly value: PresetKey | null
  readonly onChange: (next: PresetKey | null) => void
}

// 지도 위에 떠 있으므로 바깥 컨테이너에 pointer-events-auto가 필요하다.
// RecenterButton과 같은 제약이다.
export function PresetFilter({ counts, value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="목적별 필터"
      className="pointer-events-auto absolute inset-x-0 top-4 z-20 flex gap-2 overflow-x-auto px-4"
    >
      {PRESETS.map((preset) => {
        const count = counts[preset.key]
        const selected = value === preset.key

        return (
          <button
            key={preset.key}
            type="button"
            role="tab"
            aria-selected={selected}
            // 0이면 누를 수 없다. 눌렀는데 아무 일도 안 일어나는 순간을 만들지
            // 않는다 — 프리셋은 실시간 혼잡도를 쓰므로 실제로 0이 된다.
            disabled={count === 0}
            // 선택된 칩을 다시 누르면 해제된다. 「전체」 칩을 따로 두면 지도
            // 상단을 한 칸 더 먹는다.
            onClick={() => onChange(selected ? null : preset.key)}
            className={`min-h-12 shrink-0 rounded-full px-4 text-label-md font-semibold shadow-floating disabled:opacity-50 ${
              selected
                ? 'bg-primary text-on-primary'
                : 'bg-surface text-on-surface-variant'
            }`}
          >
            {preset.label} {count}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: 통과 확인**

```bash
npx vitest run src/components/map/PresetFilter.test.tsx
```

기대: 6개 통과.

- [ ] **Step 5: 변이 확인 — 필수**

**5a.** `disabled={count === 0}`을 `disabled={false}`로 바꾼다.
기대: **"개수가 0이면 비활성이다", "비활성 칩은 눌러도 반응하지 않는다" 실패.** 되돌린다.

**5b.** `onChange(selected ? null : preset.key)`를 `onChange(preset.key)`로 바꾼다.
기대: **"선택된 칩을 다시 누르면 해제한다" 실패.** 되돌린다.

예상대로 실패하지 않으면 보고할 것.

- [ ] **Step 6: 타입 검사, 린트, 전체 스위트**

```bash
npx tsc -b
npm run lint
npm test
```

전체는 255개 + todo 1개여야 한다(231 + 18 + 6). 다르면 원인을 찾아 보고할 것.

- [ ] **Step 7: 커밋**

```bash
git add src/components/map/PresetFilter.tsx src/components/map/PresetFilter.test.tsx
git commit -m "feat: 목적 프리셋 칩 컴포넌트 추가"
```

---

### Task 3: `MapScreen` 배선

**Files:**
- Modify: `src/screens/MapScreen.tsx`
- Test: `src/screens/MapScreen.test.tsx`

현재 `MapScreen`은 `list`(전체 30곳)를 만들어 `toMapMarkers(list)`로 마커를 그린다. 여기에 프리셋 상태와 필터를 끼운다.

**상단 겹침 주의:** 프리셋 칩이 `top-4`에 들어가는데, 지금 로딩 안내와 에러 배너도 `top-4`다. 칩 아래로 내린다.

- [ ] **Step 1: 테스트 헬퍼 추가**

`src/screens/MapScreen.test.tsx`의 기존 `allSnapshots()` 함수 **아래**에 더한다. 기존 `snapshotFor()`는 모든 명소를 `'붐빔'`으로 만들기 때문에 프리셋 테스트에는 쓸 수 없다 — 세 프리셋이 각기 다른 수를 내는 조합이 필요하다.

파일 상단 import에 `CongestionLevel` 타입을 추가한다:

```tsx
import type { AreaSnapshot, CongestionLevel } from '../domain/types'
```

그리고 헬퍼:

```tsx
function snapshotOf(name: string, congestion: CongestionLevel): AreaSnapshot {
  return {
    code: 'POI000',
    name,
    congestion,
    message: '사람이 많아 붐빕니다.',
    populationMin: 42_000,
    populationMax: 44_000,
    observedAt: '2026-08-06 14:35',
    observedAtLabel: '14:35',
    forecasts: [],
  }
}

/**
 * 공원 10곳은 여유, 나머지 20곳은 붐빔.
 * 프리셋별 기대값 — 아이와 나들이 10, 데이트 10(공원만; 카페·문화재는 붐빔),
 * 지금 핫플 20. 셋이 서로 다른 수라 어느 술어가 잘못됐는지 구분된다.
 */
function mixedSnapshots(): readonly (AreaSnapshot | null)[] {
  return AREA_CATALOG.map((entry) =>
    snapshotOf(entry.name, entry.category === '공원' ? '여유' : '붐빔'),
  )
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`describe('MapScreen', ...)` 안에 더한다:

```tsx
  it('프리셋 칩에 해당 개수를 보여준다', () => {
    mockSnapshots(mixedSnapshots())

    render(<MapScreen onSelectArea={vi.fn()} />)

    expect(screen.getByRole('tab', { name: '아이와 나들이 10' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '데이트 10' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '지금 핫플 20' })).toBeInTheDocument()
  })

  it('프리셋을 고르면 해당 명소만 남는다', async () => {
    mockSnapshots(mixedSnapshots())

    render(<MapScreen onSelectArea={vi.fn()} />)
    expect(screen.getAllByRole('img')).toHaveLength(AREA_CATALOG.length)

    await userEvent.click(screen.getByRole('tab', { name: '아이와 나들이 10' }))

    expect(screen.getAllByRole('img')).toHaveLength(10)
  })

  it('개수는 걸러진 목록이 아니라 전체로 센다', async () => {
    // visible로 세면 하나를 고르는 순간 나머지 두 칩이 0이 되어 비활성으로
    // 굳고, 다른 목적으로 갈아탈 방법이 사라진다.
    mockSnapshots(mixedSnapshots())

    render(<MapScreen onSelectArea={vi.fn()} />)
    await userEvent.click(screen.getByRole('tab', { name: '아이와 나들이 10' }))

    expect(screen.getByRole('tab', { name: '지금 핫플 20' })).not.toBeDisabled()
  })

  it('프리셋을 바꾸면 열려 있던 바텀시트가 닫힌다', async () => {
    // 걸러져 사라진 명소의 요약이 지도 위에 남으면, 지도에 없는 곳의 정보를
    // 보고 있는 상태가 된다.
    mockSnapshots(mixedSnapshots())

    render(<MapScreen onSelectArea={vi.fn()} />)
    await userEvent.click(screen.getByRole('img', { name: /강남역/ }))
    expect(screen.getByRole('region', { name: '강남역 요약' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: '아이와 나들이 10' }))

    expect(screen.queryByRole('region', { name: '강남역 요약' })).not.toBeInTheDocument()
  })

  it('프리셋을 해제하면 전체가 돌아온다', async () => {
    mockSnapshots(mixedSnapshots())

    render(<MapScreen onSelectArea={vi.fn()} />)
    const chip = screen.getByRole('tab', { name: '아이와 나들이 10' })

    await userEvent.click(chip)
    expect(screen.getAllByRole('img')).toHaveLength(10)

    await userEvent.click(chip)
    expect(screen.getAllByRole('img')).toHaveLength(AREA_CATALOG.length)
  })

  it('현재 위치 표시는 프리셋의 영향을 받지 않는다', async () => {
    useLocation.mockReturnValue({
      coords: { lat: 37.5709, lng: 126.9769 },
      status: 'granted',
      retry: vi.fn(),
    })
    mockSnapshots(mixedSnapshots())

    render(<MapScreen onSelectArea={vi.fn()} />)
    await userEvent.click(screen.getByRole('tab', { name: '지금 핫플 20' }))

    expect(screen.getByRole('img', { name: '현재 위치' })).toBeInTheDocument()
  })
```

**주의:** 기존 테스트 `'카탈로그의 모든 명소에 마커를 세운다'`는 `beforeEach`의 `allSnapshots()`(전부 붐빔)를 쓴다. 그 상태에서 프리셋 칩은 kids 0 / date 0 / hot 30이 되지만, 그 테스트는 `getAllByRole('img')` 개수만 보므로 영향이 없다. 칩은 `role="tab"`이라 `img`로 안 세어진다.

- [ ] **Step 3: 실패 확인**

```bash
npx vitest run src/screens/MapScreen.test.tsx
```

기대: 새 테스트 6개가 전부 실패한다(`role="tab"` 요소가 없음). 기존 테스트는 통과. **다른 게 깨지면 보고할 것.**

- [ ] **Step 4: `MapScreen` 수정**

import에 추가:

```tsx
import { PresetFilter } from '../components/map/PresetFilter'
import {
  filterByPreset,
  presetCounts,
  type PresetKey,
} from '../domain/presets'
```

상태 추가 — `loadFailed` 아래:

```tsx
  const [preset, setPreset] = useState<PresetKey | null>(null)
```

`markers` 계산부를 교체한다. 기존:

```tsx
  const markers = snapshots.isPending ? [] : toMapMarkers(list)
```

새로:

```tsx
  // 개수는 visible이 아니라 list로 센다. 걸러진 목록으로 세면 프리셋 하나를
  // 고르는 순간 나머지 두 칩이 0이 되어 비활성으로 굳고, 다른 목적으로
  // 갈아탈 방법이 사라진다.
  const counts = presetCounts(list)
  const visible = filterByPreset(list, preset)
  const markers = snapshots.isPending ? [] : toMapMarkers(visible)
```

`handleRecenter` 아래에 핸들러를 추가한다:

```tsx
  function handlePreset(next: PresetKey | null): void {
    setPreset(next)
    // 걸러져 사라진 명소의 요약이 지도 위에 남지 않게 한다. 프리셋을 바꾼
    // 사람은 다시 고를 준비가 돼 있다.
    setSelectedName(null)
  }
```

`</APIProvider>` 바로 아래에 칩을 넣는다:

```tsx
      <PresetFilter counts={counts} value={preset} onChange={handlePreset} />
```

**상단 겹침 정리** — 로딩 안내와 에러 배너를 칩 아래로 내린다. `top-4`를 `top-20`으로 바꾼다(두 곳):

```tsx
      {snapshots.isPending && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex justify-center">
```

```tsx
        <div className="pointer-events-none absolute inset-x-4 top-20 z-20">
```

- [ ] **Step 5: 통과 확인**

```bash
npx vitest run src/screens/MapScreen.test.tsx
```

기대: 23개 통과(기존 17 + 신규 6).

- [ ] **Step 6: 변이 확인 — 필수**

**6a.** `handlePreset`에서 `setSelectedName(null)`을 지운다.
기대: **"프리셋을 바꾸면 열려 있던 바텀시트가 닫힌다" 실패.** 되돌린다.

**6b.** `const counts = presetCounts(list)`를 `presetCounts(visible)`로 바꾼다. (`visible`이 아래에 선언돼 있으므로 두 줄의 순서를 바꿔야 한다.)
기대: **"개수는 걸러진 목록이 아니라 전체로 센다" 실패** — 프리셋을 고른 뒤 「지금 핫플」이 0이 되어 비활성이 된다. 되돌린다.

**6c.** `toMapMarkers(visible)`을 `toMapMarkers(list)`로 되돌린다.
기대: **"프리셋을 고르면 해당 명소만 남는다", "프리셋을 해제하면 전체가 돌아온다" 실패.** 되돌린다.

예상대로 실패하지 않는 게 있으면 진행하지 말고 보고할 것.

- [ ] **Step 7: 타입 검사, 린트, 전체 스위트**

```bash
npx tsc -b
npm run lint
npm test
```

전체는 261개 + todo 1개여야 한다(255 + 6).

- [ ] **Step 8: 커밋**

```bash
git add src/screens/MapScreen.tsx src/screens/MapScreen.test.tsx
git commit -m "feat: 지도에 목적 프리셋 필터 연결"
```

---

### Task 4: 문서 갱신

**Files:**
- Modify: `PLAN.md`
- Modify: `STATE.md`

- [ ] **Step 1: `PLAN.md`의 2차 항목 갱신**

「2차 — 지도와 프리셋」의 목적 프리셋 줄을 아래로 교체한다:

```markdown
- ~~**목적 프리셋** — 아이와 나들이 / 데이트 / 지금 핫플, 탭 하나로 필터~~
  **완료 (2026-08-06).** 지도 화면에 칩 3개. 카테고리와 실시간 혼잡도를 함께 쓰므로 시간대마다 결과가 바뀐다. 칩에 해당 개수를 표시하고 0이면 비활성이라 빈 화면을 만나지 않는다. 설계: `docs/superpowers/specs/2026-08-06-purpose-presets-design.md`
```

- [ ] **Step 2: `STATE.md` 갱신**

- **최종 갱신** → `2026-08-06`
- **마지막 커밋** → `git log --oneline -1`의 실제 값
- **한 줄 요약** — 지도에 목적 프리셋이 붙었다는 사실 반영
- **검증 수치** — `npm test`와 `npm run test:coverage`를 실제로 돌려 나온 값을 쓴다. **지어내지 말 것.**
- **파일 구조** — `src/domain/`에 `presets` 추가, `src/components/map/`에 `PresetFilter` 추가

「알고 있지만 아직 안 고친 것 (지도)」 절에 아래를 더한다:

```markdown
- **프리셋 정의가 사용자 기대와 맞는지 확인되지 않았다** — 「데이트」를 카페·문화재·공원으로 잡은 것은 가정이다(쇼핑몰을 기대할 수도 있다). 「지금 핫플」도 `붐빔`만이라 좁을 수 있는데, 실데이터에서 `붐빔`이 하루 중 몇 시간이나 나오는지 봐야 `약간 붐빔`까지 넓힐지 정할 수 있다. 목업으로는 판단할 수 없다.
```

- [ ] **Step 3: 검증**

```bash
npx tsc -b
npm run lint
npm test
```

문서만 고쳤으므로 영향이 없어야 한다.

- [ ] **Step 4: 커밋**

```bash
git add PLAN.md STATE.md
git commit -m "docs: 목적 프리셋 완료 반영"
```

---

### Task 5: 최종 검증

- [ ] **Step 1: 전체 검증**

```bash
npm test
npx tsc -b
npm run lint
npm run test:coverage
npm run build:vite
```

전부 통과해야 한다. 커버리지는 임계값(라인·구문·함수 80%, 브랜치 75%)을 넘어야 한다.

- [ ] **Step 2: 개발 서버에서 눈으로 확인**

```bash
npm run dev
```

`http://localhost:5173/` 지도 탭에서:

1. 상단에 칩 3개가 개수와 함께 보인다
2. 칩이 로딩 안내·에러 배너와 겹치지 않는다
3. 칩을 누르면 마커가 줄고, 다시 누르면 돌아온다
4. 마커를 눌러 시트를 연 뒤 칩을 누르면 시트가 닫힌다
5. 개수가 0인 칩은 눌리지 않는다
6. 프리셋을 켜도 현재 위치 표시는 남는다

- [ ] **Step 3: 서버 정리**

확인이 끝나면 개발 서버를 종료한다.

---

## 완료 조건

- [ ] `npm test` 통과 (261 + todo 1 예상)
- [ ] `npx tsc -b` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run test:coverage` 임계값 통과
- [ ] `npm run build:vite` 성공
- [ ] 개발 서버에서 Task 5 Step 2의 6가지 확인
- [ ] 모든 변이 확인 단계에서 테스트가 실제로 실패하는 것을 봤다
