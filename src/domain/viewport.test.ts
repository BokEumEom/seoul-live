import { describe, expect, it } from 'vitest'
import { AREA_CATALOG } from '../data/areas'
import { SEOUL_CENTER, DEFAULT_ZOOM, centerBelowSheet } from './map'
import { SHEET_RATIO } from './sheet'
import type { AreaCatalogEntry, AreaCategory, NearbyArea } from './types'
import {
  areasInView,
  MARKER_GAP_PX,
  MAX_MARKERS,
  screenPositionOf,
  sortByDistanceFromView,
  thinForLegibility,
  type MapViewport,
} from './viewport'

// 실측한 화면 그대로다(2026-08-20, 헤드리스 390×844). 시트가 half라 안 가린
// 띠가 371px이고, 지도 중심은 그 띠 한가운데로 비켜 잡혀 있다.
const W = 390
const H = 844
const BAND = 371

function seoulView(overrides: Partial<MapViewport> = {}): MapViewport {
  return {
    center: centerBelowSheet(SEOUL_CENTER, DEFAULT_ZOOM, H, SHEET_RATIO.half),
    zoom: DEFAULT_ZOOM,
    width: W,
    height: H,
    visible: { left: 0, top: 0, right: W, bottom: BAND },
    ...overrides,
  }
}

function nearby(entry: AreaCatalogEntry): NearbyArea {
  return { entry, snapshot: null, distanceMeters: null }
}

const ALL: readonly NearbyArea[] = AREA_CATALOG.map(nearby)

function at(
  lat: number,
  lng: number,
  category: AreaCategory = '공원',
  name = `${lat},${lng}`,
): NearbyArea {
  return nearby({ code: name, name, nameEn: name, lat, lng, category })
}

describe('screenPositionOf', () => {
  it('지도 중심은 레이어 한가운데에 찍힌다', () => {
    const view = seoulView()
    const point = screenPositionOf(view.center, view)
    expect(point.x).toBeCloseTo(W / 2, 6)
    expect(point.y).toBeCloseTo(H / 2, 6)
  })

  // 세로 픽셀은 아래로 갈수록 커진다(`map.ts`의 latitudeToPixel과 같은 규약).
  // 이게 뒤집히면 「보이는 띠」 판정이 통째로 반대가 된다.
  it('북쪽은 위, 동쪽은 오른쪽이다', () => {
    const view = seoulView()
    const north = screenPositionOf(
      { lat: view.center.lat + 0.05, lng: view.center.lng },
      view,
    )
    const east = screenPositionOf(
      { lat: view.center.lat, lng: view.center.lng + 0.05 },
      view,
    )
    expect(north.y).toBeLessThan(H / 2)
    expect(east.x).toBeGreaterThan(W / 2)
  })

  // **이 검사가 「의정부 버그」와 같은 자리를 지킨다.** 시트 보정을 받은
  // 중심이면 서울시청이 보이는 띠 안에 있어야 한다 — 보정을 빼면 y=422로
  // 내려가 371px 띠 밖으로 나간다.
  it('시트 보정을 받은 중심에서 서울시청이 보이는 띠 안에 있다', () => {
    const view = seoulView()
    const cityHall = screenPositionOf(SEOUL_CENTER, view)
    expect(cityHall.y).toBeGreaterThan(0)
    expect(cityHall.y).toBeLessThan(BAND)

    const unshifted = screenPositionOf(SEOUL_CENTER, {
      ...view,
      center: SEOUL_CENTER,
    })
    expect(unshifted.y).toBeGreaterThan(BAND)
  })
})

describe('areasInView', () => {
  it('보이는 띠 밖은 뺀다', () => {
    const view = seoulView()
    const far = at(37.9, 126.978) // 한참 북쪽
    expect(areasInView([far], view)).toHaveLength(0)
  })

  // 마커는 좌표에 점으로 찍히지 않고 그 둘레로 그려진다. 딱 잘라내면 반쯤
  // 보여야 할 핀이 통째로 사라진다.
  it('가장자리 바로 밖도 여유만큼은 들인다', () => {
    const view = seoulView()
    // 띠 아래 경계에서 살짝 밖에 놓는다.
    const belowEdge = pointAtScreenY(view, BAND + MARKER_GAP_PX / 2)
    expect(areasInView([belowEdge], view)).toHaveLength(1)
  })

  it('서울 전역에서는 121곳 대부분이 들어온다', () => {
    // 실측에서 110개였다 — 이 검사는 「거의 다 들어온다」만 잠근다.
    expect(areasInView(ALL, seoulView()).length).toBeGreaterThan(80)
  })
})

/** 화면 세로 y에 놓이는 명소를 만든다. */
function pointAtScreenY(view: MapViewport, y: number): NearbyArea {
  // 이분법으로 찾는다 — 역함수를 여기 또 쓰면 검사가 구현을 베끼는 꼴이 된다.
  let low = view.center.lat - 1
  let high = view.center.lat + 1
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2
    if (screenPositionOf({ lat: mid, lng: view.center.lng }, view).y > y) {
      low = mid
    } else {
      high = mid
    }
  }
  return at((low + high) / 2, view.center.lng)
}

describe('thinForLegibility', () => {
  // **이 파일이 존재하는 이유다.** 실측에서 110개가 371px 띠에 들어와 269쌍이
  // 겹쳤다(94%). 솎아낸 뒤에는 겹치는 쌍이 0이어야 한다.
  it('남은 마커끼리는 겹치지 않는다', () => {
    const view = seoulView()
    const kept = thinForLegibility(areasInView(ALL, view), view)
    const points = kept.map((area) => screenPositionOf(area.entry, view))

    let clashes = 0
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        if (
          Math.abs(points[i].x - points[j].x) < MARKER_GAP_PX &&
          Math.abs(points[i].y - points[j].y) < MARKER_GAP_PX
        ) {
          clashes += 1
        }
      }
    }
    expect(clashes).toBe(0)
  })

  it('그래도 볼 만큼은 남긴다', () => {
    const view = seoulView()
    const kept = thinForLegibility(areasInView(ALL, view), view)
    expect(kept.length).toBeGreaterThan(10)
    expect(kept.length).toBeLessThanOrEqual(MAX_MARKERS)
  })

  // 자리를 다투면 「무엇을 보러 가는가」가 이긴다. 역이 경복궁을 가리면
  // 나들이 목적지를 찾는 화면에서 거꾸로다.
  it('같은 자리를 다투면 관광특구가 인구밀집지역을 이긴다', () => {
    const view = seoulView()
    const spot = { lat: view.center.lat, lng: view.center.lng }
    const station = at(spot.lat, spot.lng, '인구밀집지역', '역')
    const tourist = at(spot.lat + 0.0001, spot.lng, '관광특구', '특구')

    const kept = thinForLegibility([station, tourist], view)
    expect(kept).toHaveLength(1)
    expect(kept[0].entry.name).toBe('특구')
  })

  // 줌을 키우면 같은 두 곳이 화면에서 멀어지므로 둘 다 남아야 한다.
  // **거르는 기준이 자리라는 것이 여기서 드러난다** — 명소도 등급도 안 바뀌고
  // 화면에서의 거리만 바뀌는데 결과가 달라진다.
  it('가까운 두 곳이 낮은 줌에선 하나로, 높은 줌에선 둘 다 남는다', () => {
    const view = seoulView()
    // 위도로 0.004°다. 줌 11에서는 약 25px이라 간격(34px) 안이고,
    // 줌 15에서는 그 16배라 넉넉히 떨어진다.
    const a = at(view.center.lat, view.center.lng, '공원', '가')
    const b = at(view.center.lat + 0.004, view.center.lng, '공원', '나')

    expect(thinForLegibility([a, b], view)).toHaveLength(1)

    const zoomed = seoulView({ zoom: DEFAULT_ZOOM + 4 })
    expect(thinForLegibility([a, b], zoomed)).toHaveLength(2)
  })

  it('빈 목록은 빈 목록이다', () => {
    expect(thinForLegibility([], seoulView())).toEqual([])
  })
})

describe('sortByDistanceFromView', () => {
  // 위치 권한이 없어도 뜻이 있는 순서가 나온다 — 121행이 카탈로그 순서로
  // 떨어지던 것을 대신한다.
  it('보이는 영역 한가운데에서 가까운 순이다', () => {
    const view = seoulView()
    const sorted = sortByDistanceFromView(areasInView(ALL, view), view)
    const focusY = BAND / 2
    const first = screenPositionOf(sorted[0].entry, view)
    const last = screenPositionOf(sorted.at(-1)!.entry, view)

    const near = Math.hypot(first.x - W / 2, first.y - focusY)
    const far = Math.hypot(last.x - W / 2, last.y - focusY)
    expect(near).toBeLessThan(far)
  })

  it('원본을 제자리에서 건드리지 않는다', () => {
    const view = seoulView()
    const input = areasInView(ALL, view)
    const before = input.map((area) => area.entry.name)
    sortByDistanceFromView(input, view)
    expect(input.map((area) => area.entry.name)).toEqual(before)
  })
})
