import { congestionRank } from './congestion'
import {
  AREA_CATEGORIES,
  CONGESTION_LEVELS,
  type AreaCategory,
  type AreaSnapshot,
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

/** 스냅샷이 있다고 좁혀진 항목. `!` 없이 rank를 읽으려는 것뿐이다. */
type Observed = NearbyArea & { readonly snapshot: AreaSnapshot }

function isObserved(item: NearbyArea): item is Observed {
  return item.snapshot !== null
}

function emptyCounts(): Record<CongestionLevel, number> {
  return { 여유: 0, 보통: 0, '약간 붐빔': 0, 붐빔: 0 }
}

export function summarize(areas: readonly NearbyArea[]): CitySummary {
  const byLevel = emptyCounts()
  let counted = 0
  for (const item of areas) {
    if (!isObserved(item)) continue
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
    .filter(isObserved)
    .toSorted(
      (a, b) =>
        (congestionRank(a.snapshot.congestion) -
          congestionRank(b.snapshot.congestion)) *
        direction,
    )
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
  // AREA_CATEGORIES를 훑는다. 입력 순서를 따르면 같은 데이터로도 화면의
  // 줄 순서가 바뀐다.
  for (const category of AREA_CATEGORIES) {
    const ranks = areas
      .filter(isObserved)
      .filter((item) => item.entry.category === category)
      .map((item) => congestionRank(item.snapshot.congestion))
    if (ranks.length === 0) continue
    const mean = ranks.reduce((sum, value) => sum + value, 0) / ranks.length
    result.push({ category, level: CONGESTION_LEVELS[Math.round(mean)] })
  }
  return result
}
