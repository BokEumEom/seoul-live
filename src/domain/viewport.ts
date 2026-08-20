import type { AreaCategory, Coords, NearbyArea } from './types'

// 지도에 **지금 보이는 것**을 고른다. 121곳이 되면서 필요해진 절이다.
//
// **왜 있어야 하나.** 2026-08-20 헤드리스 실측: 390×844에서 시트가 안 가리는
// 띠가 371px인데 그 안에 마커가 **110개**가 들어왔고, 서로 겹치는 쌍이
// **269개**, 다른 마커와 겹치는 마커가 **103개(94%)**였다. 30곳에서는 성립하던
// 화면이 121곳에서 정보가 아니라 잡음이 된다.
//
// **클러스터링(핀을 숫자 뱃지로 묶기)을 안 고른 이유.** 그건 「몇 개 있다」를
// 알려주고 답은 한 번 더 누르게 한다 — 이 앱이 줄이려는 단계를 오히려 늘린다.
// 여기서는 **덜 그린다.** 목록이 완전한 답을 갖고 있으므로 지도는 읽히는 것이
// 먼저다.
//
// **줌 단계로 등급을 거르는 길도 안 골랐다**(「낮은 줌에선 붐빔만」). 이 앱의
// 질문 절반이 「어디가 한산한가」라, 여유를 감추면 그 절반이 죽는다. 여기서
// 거르는 기준은 등급이 아니라 **자리**다.

const TILE_SIZE = 256

/** 지도가 지금 무엇을 어떻게 비추고 있나. */
export interface MapViewport {
  readonly center: Coords
  readonly zoom: number
  /** 지도 레이어 전체 크기(CSS px). 시트가 덮기 전이다. */
  readonly width: number
  readonly height: number
  /**
   * 시트·패널에 **안 가린** 직사각형(CSS px, 지도 레이어 기준).
   *
   * 좁은 화면은 아래가 시트에 덮이고 넓은 화면은 왼쪽이 패널에 덮인다 —
   * 어느 쪽인지를 이 절이 알 필요가 없도록 직사각형 하나로 받는다.
   */
  readonly visible: Rect
}

export interface Rect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export interface ScreenPoint {
  readonly x: number
  readonly y: number
}

function latitudeToPixel(latitude: number, zoom: number): number {
  const worldPixels = TILE_SIZE * 2 ** zoom
  const sin = Math.sin((latitude * Math.PI) / 180)
  const mercator = Math.log((1 + sin) / (1 - sin)) / 2
  return (worldPixels / 2) * (1 - mercator / Math.PI)
}

function longitudeToPixel(longitude: number, zoom: number): number {
  const worldPixels = TILE_SIZE * 2 ** zoom
  return ((longitude + 180) / 360) * worldPixels
}

/**
 * 좌표 → 지도 레이어 안의 화면 좌표(CSS px).
 *
 * 지도 중심이 레이어 한가운데에 그려진다는 사실만 쓴다 — 그게 구글 지도가
 * 하는 일이고, `centerBelowSheet`가 기대는 것과 같은 전제다.
 */
export function screenPositionOf(
  target: Coords,
  view: MapViewport,
): ScreenPoint {
  return {
    x:
      view.width / 2 +
      (longitudeToPixel(target.lng, view.zoom) -
        longitudeToPixel(view.center.lng, view.zoom)),
    y:
      view.height / 2 +
      (latitudeToPixel(target.lat, view.zoom) -
        latitudeToPixel(view.center.lat, view.zoom)),
  }
}

/**
 * 마커 하나가 화면에서 차지하는 반경(px). 이 안에 다른 마커가 들어오면 겹친다.
 *
 * 핀 글리프가 `size-7`(28px)이고 알약·이름표가 그 위아래로 더 붙는다
 * (`CongestionMarker`). 28을 그대로 쓰면 딱 맞닿아 서로를 스치므로 여유를
 * 조금 둔다. **이 값은 실측으로 정할 것** — 늘리면 마커가 줄고 줄이면 겹친다.
 */
export const MARKER_GAP_PX = 34

/**
 * 아무리 널널해도 이보다 많이는 안 그린다. 간격 규칙이 이미 겹침을 막지만,
 * 줌을 아주 키우면 간격이 넉넉해져 121개가 다 통과할 수 있다 — 그때도 지도가
 * 핀 목록이 되지는 않게 하는 뒷문이다.
 */
export const MAX_MARKERS = 40

/**
 * 지도에서 「목적지」로서의 무게. **작을수록 먼저 그린다.**
 *
 * 121곳 중 **48곳이 인구밀집지역**이고 그 대부분이 역 이름이다. 자리를
 * 다투면 역이 경복궁을 가리는 일이 생기는데, 나들이 목적지를 찾는 화면에서
 * 그건 거꾸로다. 등급이 아니라 **무엇을 보러 가는가**로 매긴다.
 *
 * 목록은 이 순서를 안 쓴다 — 거기서는 전부 보이므로 가릴 일이 없다.
 */
const CATEGORY_WEIGHT: Readonly<Record<AreaCategory, number>> = {
  관광특구: 0,
  '고궁·문화유산': 1,
  공원: 2,
  발달상권: 3,
  인구밀집지역: 4,
}

function isInside(point: ScreenPoint, rect: Rect, margin: number): boolean {
  return (
    point.x >= rect.left - margin &&
    point.x <= rect.right + margin &&
    point.y >= rect.top - margin &&
    point.y <= rect.bottom + margin
  )
}

/**
 * 보이는 직사각형 안에 있는 명소만.
 *
 * `margin`만큼 밖도 들인다 — 마커는 좌표에 점으로 찍히는 게 아니라 그 둘레로
 * 그려지므로, 가장자리에서 딱 잘라내면 반쯤 보여야 할 핀이 통째로 사라진다.
 */
export function areasInView(
  areas: readonly NearbyArea[],
  view: MapViewport,
  margin = MARKER_GAP_PX,
): readonly NearbyArea[] {
  return areas.filter((area) =>
    isInside(screenPositionOf(area.entry, view), view.visible, margin),
  )
}

/**
 * 겹치지 않을 만큼만 남긴다.
 *
 * **탐욕적으로 고른다.** 우선순위대로 훑으면서 이미 놓은 마커에서
 * `gap`보다 가까우면 건너뛴다. 최적해는 아니지만 이 문제의 성질에 맞는다 —
 * 「가장 많이 놓기」가 목표가 아니라 **「중요한 것부터 놓되 겹치지 않기」**가
 * 목표이고, 탐욕법은 그 우선순위를 그대로 지킨다.
 *
 * 우선순위는 (1) 카테고리 무게, (2) 보이는 영역 한가운데에서 가까운 순이다.
 * 둘째 기준이 필요한 이유는 같은 카테고리끼리 자리를 다툴 때 **사용자가
 * 화면을 맞춰 둔 곳**이 이겨야 하기 때문이다.
 */
export function thinForLegibility(
  areas: readonly NearbyArea[],
  view: MapViewport,
  /**
   * 무슨 일이 있어도 남길 명소 이름. **사용자가 지금 열어 둔 곳**이다.
   *
   * 이게 없으면 목록에서 명소를 열었을 때 지도에 그 핀이 없을 수 있다 —
   * 이웃한 더 「무거운」 명소에 밀려 솎였기 때문이다. 상세를 보고 있는데
   * 지도가 그 자리를 안 가리키면 두 화면이 서로 다른 말을 하는 셈이다.
   * 간격 규칙보다 **먼저** 자리를 잡으므로 이웃을 밀어낸다.
   */
  pinnedName: string | null = null,
  gap = MARKER_GAP_PX,
  max = MAX_MARKERS,
): readonly NearbyArea[] {
  const focus = {
    x: (view.visible.left + view.visible.right) / 2,
    y: (view.visible.top + view.visible.bottom) / 2,
  }

  const placed: ScreenPoint[] = []
  const kept: NearbyArea[] = []

  const ranked = areas
    .map((area) => {
      const at = screenPositionOf(area.entry, view)
      return {
        area,
        at,
        weight: CATEGORY_WEIGHT[area.entry.category],
        // 제곱근을 안 씌운다 — 정렬에만 쓰므로 순서가 같다.
        distance: (at.x - focus.x) ** 2 + (at.y - focus.y) ** 2,
      }
    })
    .toSorted(
      (a, b) =>
        Number(b.area.entry.name === pinnedName) -
          Number(a.area.entry.name === pinnedName) ||
        a.weight - b.weight ||
        a.distance - b.distance,
    )

  for (const candidate of ranked) {
    if (kept.length >= max) break
    const clashes = placed.some(
      (point) =>
        Math.abs(point.x - candidate.at.x) < gap &&
        Math.abs(point.y - candidate.at.y) < gap,
    )
    if (clashes) continue
    placed.push(candidate.at)
    kept.push(candidate.area)
  }

  return kept
}

/**
 * 보이는 영역 한가운데에서 가까운 순.
 *
 * **목록이 쓴다.** 위치 권한이 없으면 「거리순」이 카탈로그 순서로 떨어져
 * 121행이 사실상 무작위였다(실측: 첫 세 줄이 홍대 관광특구 → 서울 암사동
 * 유적 → 김포공항). 화면 한가운데를 기준점으로 삼으면 **권한 없이도** 언제나
 * 뜻이 있는 순서가 된다 — 사용자가 지도를 맞춰 둔 그 자리가 기준이다.
 */
export function sortByDistanceFromView(
  areas: readonly NearbyArea[],
  view: MapViewport,
): readonly NearbyArea[] {
  const focus = {
    x: (view.visible.left + view.visible.right) / 2,
    y: (view.visible.top + view.visible.bottom) / 2,
  }
  return areas
    .map((area) => {
      const at = screenPositionOf(area.entry, view)
      return { area, distance: (at.x - focus.x) ** 2 + (at.y - focus.y) ** 2 }
    })
    .toSorted((a, b) => a.distance - b.distance)
    .map((ranked) => ranked.area)
}

/**
 * 목록에 세울 명소. **보이는 영역 안이 원칙이되, 너무 적으면 밖에서 채운다.**
 *
 * 이 하한이 없으면 목록이 갇힌다. 명소를 열면 지도가 그 자리로 **줌인**하는데
 * (`focusMapOn`), 그 줌에서 보이는 영역에는 방금 연 곳 하나뿐일 수 있다.
 * 그러면 「여기 말고 근처 어디?」에 화면이 답할 방법이 없어진다 — 다른 데로
 * 가려면 지도를 손으로 줌아웃해야 하는데, 그건 목록이 해 줘야 할 일이다.
 *
 * 채우는 순서는 화면 한가운데에서 가까운 순이다. 즉 **보이는 것 + 그 언저리**가
 * 되고, 이게 「근처 쾌적한 장소」가 원래 하려던 일과 같은 방향이다.
 */
export const MIN_LIST_AREAS = 12

export function areasForList(
  areas: readonly NearbyArea[],
  view: MapViewport,
  min = MIN_LIST_AREAS,
): readonly NearbyArea[] {
  const inView = areasInView(areas, view)
  if (inView.length >= min) {
    return inView
  }
  return sortByDistanceFromView(areas, view).slice(0, min)
}
