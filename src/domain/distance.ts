import type { Coords } from './types'

const EARTH_RADIUS_METERS = 6_371_000
const WALKING_SPEED_KM_PER_HOUR = 4

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

export function haversineMeters(from: Coords, to: Coords): number {
  const dLat = toRadians(to.lat - from.lat)
  const dLng = toRadians(to.lng - from.lng)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function formatDistance(meters: number): string {
  // 10m 단위로 먼저 반올림한 뒤 분기한다.
  // 분기를 먼저 하면 997m가 "1000m"으로 나온다.
  const rounded = Math.round(meters / 10) * 10
  if (rounded < 1000) {
    return `${rounded}m`
  }
  return `${(rounded / 1000).toFixed(1)}km`
}

// 「더보기」는 명소를 하나 골라야 성립하는 화면이라 기본값이 필요하다. 정렬 대신
// 한 번 훑어 최소값만 고른다 — 목록 전체를 정렬할 이유가 없고, 정렬하면 입력
// 배열을 건드리지 않으려고 복사부터 해야 한다.
export function nearestEntry<T extends Coords>(
  entries: readonly T[],
  from: Coords | null,
): T | null {
  if (from === null) {
    return null
  }
  let nearest: T | null = null
  let shortest = Number.POSITIVE_INFINITY
  for (const entry of entries) {
    const meters = haversineMeters(from, entry)
    if (meters < shortest) {
      shortest = meters
      nearest = entry
    }
  }
  return nearest
}

export function walkingMinutes(meters: number): number {
  const minutes = Math.round((meters / 1000 / WALKING_SPEED_KM_PER_HOUR) * 60)
  return Math.max(1, minutes)
}

/** 도보 시간을 적을 만한 상한. 한 시간(시속 4km로 4km)을 넘으면 걸어갈
 *  거리가 아니라서 "도보 160분" 같은 수치가 화면의 신뢰만 깎는다. */
const MAX_WALKING_MINUTES = 60

/** 걸어갈 만한 거리면 분, 아니면 null. 상한을 화면마다 따로 두면 같은 값이
 *  자리마다 다르게 잘린다 — 판정은 도메인이 갖는다. */
export function walkableMinutes(meters: number): number | null {
  const minutes = walkingMinutes(meters)
  return minutes > MAX_WALKING_MINUTES ? null : minutes
}
