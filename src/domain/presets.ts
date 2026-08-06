import { isUncrowded } from './congestion'
import type { AreaCategory, NearbyArea } from './types'

export type PresetKey = 'kids' | 'date' | 'hot'

export interface Preset {
  readonly key: PresetKey
  readonly label: string
  readonly matches: (area: NearbyArea) => boolean
}

const DATE_CATEGORIES: ReadonlySet<AreaCategory> = new Set([
  '카페',
  '문화재',
  '공원',
])

// 스냅샷이 없는 명소는 어느 프리셋에도 걸리지 않는다. 혼잡도를 모르는데
// "한산하다"고 말할 수 없다. 지도 전체 보기에서는 회색 "정보 없음" 마커로
// 남지만 프리셋을 켜면 빠진다.
export const PRESETS: readonly Preset[] = [
  {
    key: 'kids',
    label: '아이와 나들이',
    matches: (area) =>
      area.entry.category === '공원' &&
      area.snapshot !== null &&
      isUncrowded(area.snapshot.congestion),
  },
  {
    key: 'date',
    label: '데이트',
    // 붐빔을 뺀다. 카테고리만으로 잡으면 카탈로그상 항상 19곳으로 고정돼,
    // 옆의 두 칩이 시간대마다 바뀌는 사이에서 혼자 죽은 숫자가 된다.
    // 데이트에 붐빔은 실제로 나쁜 조건이기도 하다.
    matches: (area) =>
      DATE_CATEGORIES.has(area.entry.category) &&
      area.snapshot !== null &&
      area.snapshot.congestion !== '붐빔',
  },
  {
    key: 'hot',
    label: '지금 핫플',
    // 붐비는 것이 곧 지금 사람이 몰린다는 신호다. 이 앱의 다른 화면들이
    // 혼잡을 피하는 쪽이라면 이 프리셋만 반대 방향을 본다.
    matches: (area) => area.snapshot?.congestion === '붐빔',
  },
]

/** 프리셋이 `null`이면 입력을 그대로 돌려준다 — 호출부가 분기하지 않아도 된다. */
export function filterByPreset(
  areas: readonly NearbyArea[],
  preset: PresetKey | null,
): readonly NearbyArea[] {
  if (preset === null) {
    return areas
  }
  const found = PRESETS.find((candidate) => candidate.key === preset)
  return found === undefined ? areas : areas.filter(found.matches)
}

// filterByPreset을 그대로 부른다. 개수와 실제 필터가 같은 술어를 쓴다는 것이
// 구조로 보장돼야, 칩에 "3"이라고 써놓고 마커가 5개 뜨는 일이 없다.
function countMatching(
  areas: readonly NearbyArea[],
  key: PresetKey,
): number {
  return filterByPreset(areas, key).length
}

export function presetCounts(
  areas: readonly NearbyArea[],
): Readonly<Record<PresetKey, number>> {
  return {
    kids: countMatching(areas, 'kids'),
    date: countMatching(areas, 'date'),
    hot: countMatching(areas, 'hot'),
  }
}
