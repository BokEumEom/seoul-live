import { useMemo } from 'react'
import { AREA_CATALOG } from '../data/areas'
import { congestionRank, isUncrowded } from '../domain/congestion'
import { haversineMeters } from '../domain/distance'
import type {
  AreaCatalogEntry,
  AreaCategory,
  AreaCongestion,
  Coords,
  NearbyArea,
} from '../domain/types'

/** 카탈로그의 카테고리 + 필터를 걸지 않은 상태. */
export type CategoryFilterValue = AreaCategory | '전체'

/** 도보 30분. 시안의 "800m · 도보 12분"이 시속 4km 기준이므로 그에 맞춘다. */
const RECOMMENDATION_RADIUS_METERS = 2_000
const MAX_RECOMMENDATIONS = 5

interface BuildInput {
  readonly entries: readonly AreaCatalogEntry[]
  /** 이름을 키로 맞춘다 — 순서도 개수도 `entries`와 같을 필요가 없다. */
  readonly snapshots: readonly AreaCongestion[]
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

  // **자리(index)가 아니라 이름으로 맞춘다.** 예전에는 `snapshots[index]`였다 —
  // 호출부가 넘긴 배열이 `entries`와 같은 순서·같은 길이라는 약속에 기대고
  // 있었고, 어긋나면 **명소 A의 혼잡도가 B에 붙는다**(조용히, 그럴듯하게).
  // 출처가 「이름을 키로 주는 한 번의 일괄 조회」로 바뀌면서 그 약속을 지킬
  // 방법 자체가 없어졌고, 이름으로 맞추면 애초에 지킬 것이 없다.
  const byName = new Map(snapshots.map((row) => [row.name, row]))

  const combined = entries
    .map(
      (entry): NearbyArea => ({
        entry,
        snapshot: byName.get(entry.name) ?? null,
        distanceMeters: coords === null ? null : haversineMeters(coords, entry),
      }),
    )
    .filter((item) => category === '전체' || item.entry.category === category)

  // toSorted를 쓴다. TanStack Query 캐시에서 온 배열을 제자리 정렬하면 캐시가 오염된다.
  //
  // **순서가 하나다: 가까운 순, 좌표가 없으면 여유로운 순.**
  //
  // 예전에는 사용자가 「거리순 / 여유한 순 / 붐비는 순」을 고르는 줄이 시트
  // 안에 있었다(`SortSegmented`, 48px — **2026-08-21에 지웠다.** 되살릴 일이
  // 생기면 `git log -- src/components/list/SortSegmented.tsx`).
  // 혼잡도 칩이 네 등급으로 갈리면서
  // (2026-08-20, 시안 stitch_ui_ux/_1 상단) **그 줄의 뒤 둘이 칩과 같은 말을
  // 하게 됐다.** 겹치는 쪽을 지웠고, 남긴 것은 칩으로는 못 하는 일 — 「가까운
  // 곳부터」 — 이라서 고르게 할 이유가 없다. 「여유」 칩을 켜면 여유로운
  // 곳들이 **가까운 순으로** 나온다: 두 축이 겹치지 않고 곱해진다.
  //
  // 거르기가 줄 세우기보다 낫기도 하다. 「여유한 순」은 붐비는 곳을 아래에
  // 남겨 스크롤해야 알 수 있지만, 칩은 목록에서 아예 뺀다.
  return coords === null
    ? combined.toSorted(compareByCongestion)
    : combined.toSorted(compareByDistance)
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
  snapshots: readonly AreaCongestion[],
  coords: Coords | null,
  category: CategoryFilterValue,
): {
  readonly list: readonly NearbyArea[]
  readonly recommended: readonly NearbyArea[]
} {
  return useMemo(() => {
    // 목록과 추천이 **같은 배열**을 쓴다. 정렬 축이 하나가 되면서 「추천은
    // 목록 정렬과 무관하게 늘 가까운 순」이라고 적어 두고 같은 계산을 한 번
    // 더 돌리던 이유가 없어졌다 — `pickRecommendations`는 거리 조건으로
    // 거르므로 좌표가 없으면 어차피 빈 배열이다.
    const list = buildNearbyList({
      entries: AREA_CATALOG,
      snapshots,
      coords,
      category,
    })
    return { list, recommended: pickRecommendations(list) }
  }, [snapshots, coords, category])
}
