import type { BikeStation } from './bike'
import { haversineMeters } from './distance'
import type { Coords } from './types'

/** 시설 하나에 「명소에서 몇 m인가」를 얹은 것. `null`은 좌표를 모른다는 뜻이다. */
export type WithDistance<T> = T & { readonly meters: number | null }

/**
 * 명소 중심에서의 거리를 붙인다.
 *
 * **기준점이 사용자 위치가 아니라 명소인 것은 고른 것이다.** 상세는 지금 내가
 * 있는 곳이 아니라 **가려는 곳**을 보는 화면이라, 부산에서 광화문을 열어도
 * 「120m」가 뜻을 가져야 한다. 사용자 위치를 쓰면 그 숫자가 「320km」가 되어
 * 아무 도움이 안 되고, 위치 권한 여부에 따라 있다 없다 한다.
 *
 * 원본을 건드리지 않는다 — 새 객체를 만들어 돌려준다.
 */
export function withDistanceFrom<T extends { readonly coords: Coords | null }>(
  items: readonly T[],
  origin: Coords | null,
): readonly WithDistance<T>[] {
  return items.map((item) => ({
    ...item,
    meters:
      origin === null || item.coords === null
        ? null
        : haversineMeters(origin, item.coords),
  }))
}

/** 지금 빌릴 수 있는가. 0대와 「모름」은 둘 다 헛걸음이라 같이 묶는다. */
function hasBikes(station: BikeStation): boolean {
  return station.bikes !== null && station.bikes > 0
}

/**
 * 걸어갈 순서로 대여소를 세운다.
 *
 * **주차장과 규칙이 다르다.** 주차장은 차로 가므로 빈 자리 수가 먼저지만
 * (`sortParkingByAvailable`), 따릉이는 걸어가므로 **500m 떨어진 20대보다
 * 120m의 5대가 낫다.** 샘플(서울 인파레이더)도 따릉이만 거리순이다.
 *
 * 다만 거리만으로 세우면 맨 앞이 「가장 가까운데 못 빌리는 곳」이 된다.
 * 그래서 두 단계다 — **빌릴 수 있는 곳이 먼저, 그 안에서 가까운 순.**
 *
 * 명소 좌표를 모르면(카탈로그에 없는 이름) 기준점이 없으므로 예전 규칙인
 * 대수 많은 순으로 떨어진다. 거리를 못 재는 것이지 순서가 없어진 건 아니다.
 */
export function sortBikesForWalking(
  stations: readonly BikeStation[],
  origin: Coords | null,
  limit?: number,
): readonly WithDistance<BikeStation>[] {
  const measured = withDistanceFrom(stations, origin)

  const sorted = measured.toSorted((a, b) => {
    // 빌릴 수 있는 곳이 먼저.
    if (hasBikes(a) !== hasBikes(b)) {
      return hasBikes(a) ? -1 : 1
    }
    if (origin === null) {
      // 기준점이 없으면 대수 많은 순. `null`은 0으로 세지 않고 뒤로 민다.
      return (b.bikes ?? -1) - (a.bikes ?? -1)
    }
    // 거리를 모르는 곳은 맨 뒤. 0m로 치면 가장 가까운 곳 행세를 한다.
    if ((a.meters === null) !== (b.meters === null)) {
      return a.meters === null ? 1 : -1
    }
    return (a.meters ?? 0) - (b.meters ?? 0)
  })

  return limit === undefined ? sorted : sorted.slice(0, limit)
}
