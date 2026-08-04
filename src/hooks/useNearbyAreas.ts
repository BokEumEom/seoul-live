import { useMemo } from 'react'
import { AREA_CATALOG } from '../data/areas'
import { congestionRank, isUncrowded } from '../domain/congestion'
import { haversineMeters } from '../domain/distance'
import type {
  AreaCatalogEntry,
  AreaSnapshot,
  Coords,
  NearbyArea,
} from '../domain/types'
import type { CategoryFilterValue } from '../components/nearby/CategoryFilter'

/** 도보 30분. 시안의 "800m · 도보 12분"이 시속 4km 기준이므로 그에 맞춘다. */
const RECOMMENDATION_RADIUS_METERS = 2_000
const MAX_RECOMMENDATIONS = 5

interface BuildInput {
  readonly entries: readonly AreaCatalogEntry[]
  readonly snapshots: readonly (AreaSnapshot | null)[]
  readonly coords: Coords | null
  readonly category: CategoryFilterValue
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

export function buildNearbyList(input: BuildInput): readonly NearbyArea[] {
  const { entries, snapshots, coords, category } = input

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
  return combined.toSorted(
    coords === null ? compareByCongestion : compareByDistance,
  )
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
    })
    return { list, recommended: pickRecommendations(list) }
  }, [snapshots, coords, category])
}
