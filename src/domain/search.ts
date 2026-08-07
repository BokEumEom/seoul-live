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
