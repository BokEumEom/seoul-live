import { isUncrowded } from './congestion'
import type { NearbyArea, Purpose } from './types'

export type PresetKey = 'kids' | 'date' | 'hot'

/** 필터 칩 한 줄의 값. 즐겨찾기는 프리셋이 아니지만 같은 줄에서 배타적으로
 * 동작한다.
 *
 * 교집합(내 장소 ∩ 아이와 나들이)을 지원하지 않는 이유는 30곳 규모에서
 * 결과가 0이 되기 쉬워서다. */
export type FilterKey = 'fav' | PresetKey

export interface Preset {
  readonly key: PresetKey
  readonly label: string
  readonly matches: (area: NearbyArea) => boolean
}

function hasPurpose(area: NearbyArea, purpose: Purpose): boolean {
  return area.entry.purposes?.includes(purpose) ?? false
}

// 스냅샷이 없는 명소는 어느 프리셋에도 걸리지 않는다. 혼잡도를 모르는데
// "한산하다"고 말할 수 없다. 지도 전체 보기에서는 회색 "정보 없음" 마커로
// 남지만 프리셋을 켜면 빠진다.
export const PRESETS: readonly Preset[] = [
  {
    key: 'kids',
    label: '아이와 나들이',
    matches: (area) =>
      hasPurpose(area, 'kids') &&
      area.snapshot !== null &&
      isUncrowded(area.snapshot.congestion),
  },
  {
    key: 'date',
    label: '데이트',
    // 붐빔을 뺀다. 태그만으로 잡으면 카탈로그상 항상 19곳으로 고정돼,
    // 옆의 두 칩이 시간대마다 바뀌는 사이에서 혼자 죽은 숫자가 된다.
    // 데이트에 붐빔은 실제로 나쁜 조건이기도 하다.
    matches: (area) =>
      hasPurpose(area, 'date') &&
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

/** 즐겨찾기 칩의 이름. 프리셋이 아니라 사용자 상태라 `PRESETS`에 자리가 없다. */
const FAVORITE_LABEL = '내 장소'

/** 칩 줄과 빈 목록 문구가 같은 이름을 쓰게 하는 정본.
 *
 * 라벨을 화면 쪽에 복사해두면 이름을 고칠 때 한쪽만 옛 이름으로 남는다.
 * 빈 목록에서 "「내 장소」에 해당하는 명소가 없어요"라고 지목하는데 칩에는
 * 다른 이름이 적혀 있으면 무엇을 풀어야 할지 알려주려던 문구가 오히려
 * 헷갈리게 만든다.
 *
 * `fav`는 `PRESETS`에 없으므로 `find`가 비고 그대로 즐겨찾기 이름으로
 * 떨어진다 — 분기를 따로 두지 않는 것은 폴백이 곧 정답인 유일한 키라서다. */
export function filterLabel(key: FilterKey): string {
  return PRESETS.find((candidate) => candidate.key === key)?.label ?? FAVORITE_LABEL
}

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

/** 필터 칩 한 줄이 쓰는 유일한 술어. 즐겨찾기는 사용자 상태(저장된 이름)에
 * 달려 있어 `PRESETS`의 `matches`로는 표현할 수 없지만, 개수와 목록이 갈라지지
 * 않으려면 술어가 한 곳에 있어야 한다.
 *
 * `favorites`에 있는 이름이라도 `areas`에 없으면 그냥 빠진다 — 카테고리로
 * 좁혔거나 카탈로그에서 이름이 바뀐 경우다. */
export function filterAreas(
  areas: readonly NearbyArea[],
  filter: FilterKey | null,
  favorites: readonly string[],
): readonly NearbyArea[] {
  if (filter === 'fav') {
    return areas.filter((area) => favorites.includes(area.entry.name))
  }
  return filterByPreset(areas, filter)
}

// filterAreas를 그대로 부른다. 개수와 실제 필터가 같은 술어를 쓴다는 것이
// 구조로 보장돼야, 칩에 "3"이라고 써놓고 마커가 5개 뜨는 일이 없다.
export function filterCounts(
  areas: readonly NearbyArea[],
  favorites: readonly string[],
): Readonly<Record<FilterKey, number>> {
  const count = (key: FilterKey): number =>
    filterAreas(areas, key, favorites).length

  return {
    fav: count('fav'),
    kids: count('kids'),
    date: count('date'),
    hot: count('hot'),
  }
}
