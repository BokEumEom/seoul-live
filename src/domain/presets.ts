import { congestionTone, isUncrowded, type CongestionTone } from './congestion'
import { CONGESTION_LEVELS, type NearbyArea, type Purpose } from './types'

export type PresetKey = CongestionTone | 'kids' | 'date'

/** 필터 하나의 값. 「내 장소」는 프리셋이 아니지만 같은 자리를 배타적으로
 * 나눠 쓴다 — 칩 줄에서 빠져 지도 FAB으로 옮겨 갔어도(2026-08-20) 켜지는
 * 슬롯은 여전히 하나다.
 *
 * 교집합(내 장소 ∩ 아이와 나들이)을 지원하지 않는 이유는 결과가 0이 되기
 * 쉬워서다. 목적 태그가 붙은 곳이 121곳 중 19곳뿐이라 **혼잡도 칩과 겹치면
 * 특히 그렇다** — 「여유 ∩ 데이트」는 시간대에 따라 실제로 0이 된다. */
export type FilterKey = 'fav' | PresetKey

export interface Preset {
  readonly key: PresetKey
  readonly label: string
  readonly matches: (area: NearbyArea) => boolean
}

function hasPurpose(area: NearbyArea, purpose: Purpose): boolean {
  return area.entry.purposes?.includes(purpose) ?? false
}

/**
 * 혼잡도 네 단계가 그대로 네 개의 프리셋이 된다.
 *
 * **표에서 파생시킨다.** `CONGESTION_LEVELS`에 단계가 하나 늘면 칩도 저절로
 * 하나 는다 — 손으로 적으면 등급은 다섯인데 칩은 넷인 화면이 조용히 만들어진다.
 *
 * **라벨이 등급 그 자체다.** 예전에는 「한적」(여유+보통)·「붐빔」(나머지) 둘로
 * 접어 뒀는데, 칩은 「한적」이라 말하고 바로 아래 목록의 배지는 「여유」라
 * 말했다. 같은 것을 두 낱말로 부르면 사용자는 그 둘이 다른 것이라고 읽는다.
 * 이제 칩·배지·지도 마커가 한 낱말을 쓴다.
 *
 * 키는 등급이 아니라 톤(`calm`/`normal`/`busy`/`crowded`)이다. 주소·저장소에
 * 실릴 수 있는 값이라 한국어를 안 쓰고, `CongestionTone`을 재사용하면 톤과
 * 프리셋이 어긋날 자리 자체가 없어진다.
 *
 * 스냅샷이 없거나 등급이 `null`인 명소는 어느 칩에도 안 걸린다. 혼잡도를
 * 모르는데 「여유」라고 말할 수 없다 — 전체 보기에서는 회색 「정보 없음」
 * 마커로 남지만 칩을 켜면 빠진다.
 */
const LEVEL_PRESETS: readonly Preset[] = CONGESTION_LEVELS.map((level) => ({
  key: congestionTone(level),
  label: level,
  matches: (area: NearbyArea) => area.snapshot?.congestion === level,
}))

/**
 * 혼잡도 칩의 키. **칩 줄이 어느 칩에 톤 점을 찍을지 이걸로 가른다.**
 *
 * `CongestionTone`을 그대로 좁혀 쓴다 — 목적 칩(kids·date)에는 톤이 없고,
 * 톤이 있는 것은 등급에서 나온 넷뿐이다.
 */
export function isLevelKey(key: FilterKey): key is CongestionTone {
  return LEVEL_PRESETS.some((preset) => preset.key === key)
}

export const PRESETS: readonly Preset[] = [
  // **혼잡도 넷이 목적 앞이다**(2026-08-20, 새 시안 stitch_ui_ux/_1 상단).
  //
  // 목적 칩(아이와 나들이·데이트)은 카탈로그의 `purposes` 태그에 기대는데,
  // 명소가 121곳으로 늘면서 **태그가 붙은 곳이 19곳뿐**이다 — 102곳은 어떤
  // 목적 칩에도 안 걸린다. 혼잡도 칩은 태그가 필요 없다: 등급은 121곳 전부에
  // 대해 매 5분 들어온다.
  //
  // 그리고 이게 이 앱의 첫 질문이다. 「어디가 한산한가」는 목적보다 먼저 묻는
  // 것이고, 예전 칩 줄에는 그 질문에 곧장 답하는 칩이 하나도 없었다.
  ...LEVEL_PRESETS,
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
    normal: count('normal'),
    busy: count('busy'),
    crowded: count('crowded'),
    kids: count('kids'),
    date: count('date'),
  }
}
