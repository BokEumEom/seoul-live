import type { NearbyArea } from './types'

// 주소 검색은 하지 않는다 — 지오코딩 API가 필요하고 이번 범위 밖이다.
// 명소명 부분일치만 본다.
//
// **한국어 이름과 영어 이름을 둘 다 본다.** 화면 언어로 가르지 않는 것이
// 일부러다: (1) 영어 화면에서 「Insa-dong」이라 읽은 사람이 그대로 칠 수
// 있어야 하고, (2) 한국어 화면을 쓰면서 「gangnam」이라 치는 사람도 있다.
// 언어에 따라 한쪽만 보면 **화면에 보이는 줄을 검색으로는 못 찾는** 경우가
// 생긴다. 도메인은 현재 언어를 모르는 편이 낫다(`i18n/areaName.ts` 참고).
export function searchAreas(
  areas: readonly NearbyArea[],
  query: string,
): readonly NearbyArea[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') {
    return areas
  }
  return areas.filter(
    (item) =>
      item.entry.name.toLowerCase().includes(needle) ||
      item.entry.nameEn.toLowerCase().includes(needle),
  )
}
