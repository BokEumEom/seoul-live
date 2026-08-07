import { useMemo } from 'react'
import { AREA_CATALOG } from '../data/areas'
import { congestionRank, isUncrowded } from '../domain/congestion'
import { haversineMeters } from '../domain/distance'
import type {
  AreaCatalogEntry,
  AreaCategory,
  AreaSnapshot,
  Coords,
  NearbyArea,
} from '../domain/types'

/** 카탈로그의 카테고리 + 필터를 걸지 않은 상태. */
export type CategoryFilterValue = AreaCategory | '전체'

// 'calm'은 예전 'congestion'이다. 셋이 되면서 "혼잡도순"이 어느 방향인지
// 이름만으로는 알 수 없게 됐다.
export type SortMode = 'distance' | 'calm' | 'busy'

/** 도보 30분. 시안의 "800m · 도보 12분"이 시속 4km 기준이므로 그에 맞춘다. */
const RECOMMENDATION_RADIUS_METERS = 2_000
const MAX_RECOMMENDATIONS = 5

interface BuildInput {
  readonly entries: readonly AreaCatalogEntry[]
  readonly snapshots: readonly (AreaSnapshot | null)[]
  readonly coords: Coords | null
  readonly category: CategoryFilterValue
  /** 기본은 거리순. 좌표가 없으면 무엇을 골라도 혼잡도순으로 내려간다. */
  readonly sort?: SortMode
}

// 스냅샷이 없는 명소는 항상 뒤로 보낸다. "정보 없음" 카드가 목록 위쪽을 차지하면
// 화면을 열었을 때 쓸 수 있는 정보가 안 보인다.
function compareByCongestion(a: NearbyArea, b: NearbyArea): number {
  if (a.snapshot === null) return 1
  if (b.snapshot === null) return -1
  return (
    congestionRank(a.snapshot.congestion) - congestionRank(b.snapshot.congestion)
  )
}

function compareByDistance(a: NearbyArea, b: NearbyArea): number {
  if (a.distanceMeters === null) return 1
  if (b.distanceMeters === null) return -1
  return a.distanceMeters - b.distanceMeters
}

// 붐비는 순은 여유로운 순을 단순히 뒤집은 게 아니다. 스냅샷이 없는 명소는
// 양쪽 모두 뒤로 가야 한다 — "모름"은 붐비는 쪽에도 여유로운 쪽에도 속하지
// 않는다. 그래서 null 처리는 그대로 두고 rank 비교만 뒤집는다.
function compareByBusiest(a: NearbyArea, b: NearbyArea): number {
  if (a.snapshot === null) return 1
  if (b.snapshot === null) return -1
  return -compareByCongestion(a, b)
}

export function buildNearbyList(input: BuildInput): readonly NearbyArea[] {
  const { entries, snapshots, coords, category, sort = 'distance' } = input

  const combined = entries
    .map(
      (entry, index): NearbyArea => ({
        entry,
        snapshot: snapshots[index] ?? null,
        distanceMeters: coords === null ? null : haversineMeters(coords, entry),
      }),
    )
    .filter((item) => category === '전체' || item.entry.category === category)

  // toSorted를 쓴다. TanStack Query 캐시에서 온 배열을 제자리 정렬하면 캐시가 오염된다.
  //
  // 좌표가 없으면 거리순을 고를 수 없다. 여유로운 순으로 내려간다.
  if (sort === 'distance' && coords !== null) {
    return combined.toSorted(compareByDistance)
  }
  if (sort === 'busy') {
    return combined.toSorted(compareByBusiest)
  }
  return combined.toSorted(compareByCongestion)
}

export function pickRecommendations(
  list: readonly NearbyArea[],
): readonly NearbyArea[] {
  return list
    .filter(
      (item) =>
        item.distanceMeters !== null &&
        item.distanceMeters <= RECOMMENDATION_RADIUS_METERS &&
        item.snapshot !== null &&
        isUncrowded(item.snapshot.congestion),
    )
    .slice(0, MAX_RECOMMENDATIONS)
}

export function useNearbyAreas(
  snapshots: readonly (AreaSnapshot | null)[],
  coords: Coords | null,
  category: CategoryFilterValue,
  sort: SortMode = 'distance',
): {
  readonly list: readonly NearbyArea[]
  readonly recommended: readonly NearbyArea[]
} {
  return useMemo(() => {
    const list = buildNearbyList({
      entries: AREA_CATALOG,
      snapshots,
      coords,
      category,
      sort,
    })
    // 추천은 목록 정렬과 무관하게 항상 가까운 순으로 뽑는다 — "가까우면서
    // 여유로운 곳"이라는 섹션 이름이 곧 정렬 기준이다.
    return {
      list,
      recommended: pickRecommendations(
        buildNearbyList({
          entries: AREA_CATALOG,
          snapshots,
          coords,
          category,
          sort: 'distance',
        }),
      ),
    }
  }, [snapshots, coords, category, sort])
}
