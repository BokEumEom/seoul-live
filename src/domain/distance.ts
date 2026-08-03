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

export function walkingMinutes(meters: number): number {
  const minutes = Math.round((meters / 1000 / WALKING_SPEED_KM_PER_HOUR) * 60)
  return Math.max(1, minutes)
}
