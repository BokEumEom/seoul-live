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
