/**
 * 명소 상세의 탭. **화면 하나가 통째로 길어지던 것을 여기서 가른다.**
 *
 * 2026-08-20 실측: 상세를 끝까지 펼친 높이가 **5,395px**(390×844)이었고, 주
 * 조작인 길찾기가 화면 열두 개 아래에 있었다. 도시 정보를 접이식에서 상시
 * 펼침으로 바꾼 대가였는데, 그때 얻은 것(「탭 한 번 뒤에 감추지 않는다」)을
 * 잃지 않으면서 길이를 줄이는 방법이 도메인별로 화면을 가르는 것이다 —
 * 새 시안(stitch_ui_ux/_2)의 구조이고, 요약 탭의 카드 여덟 칸이 목차 노릇을
 * 하므로 **무엇이 있는지는 여전히 한 화면에 다 보인다.**
 *
 * 접이식과 다른 점이 그것이다. 접힌 절은 「무엇이 있는지」조차 감추지만, 카드는
 * 값까지 보여준 뒤 자세히 볼 사람만 넘긴다.
 */
export type DetailTabId =
  | 'summary'
  | 'population'
  | 'traffic'
  | 'nearby'
  | 'weather'
  | 'events'
  | 'commerce'
  | 'safety'

export interface DetailTab {
  readonly id: DetailTabId
  /**
   * 탭 글자. **감싸지 않은 한국어다** — 도메인은 언어를 볼 수 없어서
   * (`t()`가 모듈 상태를 읽는다) 「무엇을 말할지」만 정하고 화면이 `t()`로
   * 감싼다. `i18n.test.ts`의 `dynamicKeys()`가 이 목록을 읽어 영어 사전
   * 완결성을 잠근다.
   */
  readonly label: string
}

/**
 * 순서가 곧 화면 순서다. **요약이 첫째**이고 나머지는 시안의 차례다 —
 * 인구 → 교통 → 주변 → 날씨 → 행사 → 상권 → 안전.
 *
 * **「상권」은 2026-08-25에 늘었다.** 시안(stitch_ui_ux/_2)의 탭 줄에 처음부터
 * 있었는데 `LIVE_CMRCL_STTS`를 안 읽고 있어 자리가 비어 있었다. 시안과의
 * 구조적 격차는 이것이 마지막이다.
 *
 * 「안전」이 맨 뒤인 것은 중요도가 낮아서가 아니다. 재난문자는 발령되면 요약
 * 탭 맨 위 배너로 **탭과 무관하게** 뜬다(`DetailAlertBanner`) — 이 탭은 그
 * 배너를 눌러 자세히 보러 오는 자리다.
 */
export const DETAIL_TABS: readonly DetailTab[] = [
  { id: 'summary', label: '요약' },
  { id: 'population', label: '인구' },
  { id: 'traffic', label: '교통' },
  { id: 'nearby', label: '주변' },
  { id: 'weather', label: '날씨' },
  { id: 'events', label: '행사' },
  { id: 'commerce', label: '상권' },
  { id: 'safety', label: '안전' },
]

export function isDetailTabId(value: string): value is DetailTabId {
  return DETAIL_TABS.some((tab) => tab.id === value)
}

/**
 * 줄에서 몇 번째인가. **전환 애니메이션의 방향이 여기서 나온다** — 오른쪽
 * 탭으로 가면 새 패널이 오른쪽에서 들어오고, 왼쪽이면 반대다. 방향이 없으면
 * 「탭을 옮겼다」와 「같은 탭이 새로 그려졌다」가 화면에서 구별되지 않는다.
 *
 * 화면 쪽이 `DETAIL_TABS.findIndex`를 직접 부르지 않게 여기 둔다. 두 곳이
 * 각자 찾으면 한쪽이 목록을 거른 뒤의 자리를 세는 실수가 생긴다.
 */
export function detailTabIndex(id: DetailTabId): number {
  return DETAIL_TABS.findIndex((tab) => tab.id === id)
}

/**
 * 탭 버튼과 패널이 서로를 가리키는 id. **양쪽이 이 함수를 나눠 써야 한다** —
 * 문자열을 각자 지으면 한쪽만 고쳤을 때 `aria-controls`가 조용히 아무 데도
 * 안 가리키고, 그 상태는 눈으로는 멀쩡해 보인다.
 */
export function detailTabButtonId(id: DetailTabId): string {
  return `detail-tab-${id}`
}

export function detailTabPanelId(id: DetailTabId): string {
  return `detail-panel-${id}`
}
