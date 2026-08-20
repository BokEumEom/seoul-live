import { isUncrowded } from './congestion'
import type { NearbyArea, Purpose } from './types'

export type PresetKey = 'calm' | 'crowded' | 'kids' | 'date'

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
  // **상태 둘이 목적 앞이다**(2026-08-20, 새 시안 stitch_ui_ux/121·_1).
  //
  // 목적 칩(아이와 나들이·데이트)은 카탈로그의 `purposes` 태그에 기대는데,
  // 명소가 121곳으로 늘면서 **태그가 붙은 곳이 19곳뿐**이다 — 102곳은 어떤
  // 목적 칩에도 안 걸린다. 상태 칩은 태그가 필요 없다: 혼잡도는 121곳 전부에
  // 대해 매 5분 들어온다.
  //
  // 그리고 이게 이 앱의 첫 질문이다. 「어디가 한산한가」는 목적보다 먼저 묻는
  // 것이고, 예전 칩 줄에는 그 질문에 곧장 답하는 칩이 하나도 없었다.
  {
    key: 'calm',
    label: '한적',
    // `isUncrowded`가 여유와 보통을 함께 본다 — 「거기 가도 좋다」를 뜻하는
    // 자리에서 쓰는 술어다. 모르는 곳은 빠진다(그 함수의 주석).
    matches: (area) => area.snapshot !== null && isUncrowded(area.snapshot.congestion),
  },
  {
    key: 'crowded',
    label: '붐빔',
    // **예전 「지금 핫플」이 있던 자리다.** 그쪽은 `붐빔` 하나만 봤는데,
    // 상태 축의 반대편으로 세우려면 「한적」의 여집합이라야 짝이 맞는다 —
    // 두 칩을 합치면 혼잡도를 아는 곳 전부가 된다.
    //
    // 이름이 등급과 같은 낱말인 것은 시안의 것이고, 실제로 그 뜻이다.
    matches: (area) => area.snapshot !== null && !isUncrowded(area.snapshot.congestion),
  },
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
]

/** 프리셋이 아닌 칩의 이름. 즐겨찾기는 사용자 상태라 `PRESETS`에 자리가 없다.
 *
 * `Record<Exclude<FilterKey, PresetKey>, string>`인 것이 핵심이다. `FilterKey`에
 * 프리셋이 아닌 키를 하나 더 더하면 이 리터럴이 그 키를 빠뜨려 **컴파일이
 * 막힌다.** 폴백 한 줄로 두면 새 키가 조용히 「내 장소」라는 이름을 얻고,
 * 빈 목록 문구가 엉뚱한 필터를 지목하게 된다 — 무엇을 풀어야 할지 알려주려던
 * 문구가 오히려 헷갈리게 만드는 자리라 타입으로 막는다. */
const NON_PRESET_LABEL: Readonly<Record<Exclude<FilterKey, PresetKey>, string>> = {
  fav: '내 장소',
}

/** 칩 줄과 빈 목록 문구가 같은 이름을 쓰게 하는 정본.
 *
 * 라벨을 화면 쪽에 복사해두면 이름을 고칠 때 한쪽만 옛 이름으로 남는다.
 *
 * 프리셋 이름은 `PRESETS`에서 그대로 가져온다. 마지막 `?? key`는 도달하지
 * 않는다 — `PresetKey`가 `PRESETS`에서 나온 유니온이라서다. 그래도 두는 이유는
 * 혹시 어긋났을 때 「내 장소」로 둔갑하는 대신 원본 키가 그대로 드러나
 * 눈에 띄게 하려는 것이다. */
export function filterLabel(key: FilterKey): string {
  if (key === 'fav') {
    return NON_PRESET_LABEL[key]
  }
  return PRESETS.find((candidate) => candidate.key === key)?.label ?? key
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
    calm: count('calm'),
    crowded: count('crowded'),
    kids: count('kids'),
    date: count('date'),
  }
}
