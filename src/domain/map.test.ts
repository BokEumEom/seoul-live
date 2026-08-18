import { describe, expect, it } from 'vitest'
import {
  centerBelowSheet,
  DEFAULT_ZOOM,
  LABEL_MIN_ZOOM,
  markerZIndex,
  SEOUL_CENTER,
  shiftCenterForSheet,
  shouldShowMarkerLabel,
  toMapMarkers,
  centerRightOfPanel,
} from './map'
import type { Coords } from './types'
import type { AreaCatalogEntry, AreaSnapshot, NearbyArea } from './types'

function entry(name: string, code: string): AreaCatalogEntry {
  return { code, name, lat: 37.5, lng: 127, category: '인구밀집지역' }
}

function snapshot(name: string): AreaSnapshot {
  return {
    code: 'POI000',
    name,
    congestion: '붐빔',
    message: '사람이 많아 붐빕니다.',
    populationMin: 42_000,
    populationMax: 44_000,
    observedAt: '2026-08-05 14:00',
    observedAtLabel: '14:00',
    forecasts: [],
    composition: null,
    replaced: null,
  }
}

function area(name: string, code: string, withSnapshot: boolean): NearbyArea {
  return {
    entry: entry(name, code),
    snapshot: withSnapshot ? snapshot(name) : null,
    distanceMeters: null,
  }
}

describe('기본 뷰 상수', () => {
  it('서울 전역이 들어오는 줌에서 시작한다', () => {
    // 11보다 크면 서울 외곽 명소가 초기 화면에서 잘린다.
    expect(DEFAULT_ZOOM).toBe(11)
  })

  it('초기 중심이 서울 안이다', () => {
    expect(SEOUL_CENTER.lat).toBeGreaterThan(37.4)
    expect(SEOUL_CENTER.lat).toBeLessThan(37.7)
    expect(SEOUL_CENTER.lng).toBeGreaterThan(126.8)
    expect(SEOUL_CENTER.lng).toBeLessThan(127.2)
  })

  it('라벨 표시 줌이 기본 줌보다 크다', () => {
    // 같거나 작으면 초기 화면에서 라벨이 전부 켜져 도심 명소끼리 겹친다.
    expect(LABEL_MIN_ZOOM).toBeGreaterThan(DEFAULT_ZOOM)
  })
})

describe('shouldShowMarkerLabel', () => {
  it('기본 줌에서는 라벨을 감춘다', () => {
    expect(shouldShowMarkerLabel(DEFAULT_ZOOM)).toBe(false)
  })

  it('경계값 바로 아래에서는 감춘다', () => {
    expect(shouldShowMarkerLabel(LABEL_MIN_ZOOM - 1)).toBe(false)
  })

  it('경계값에서는 보여준다', () => {
    expect(shouldShowMarkerLabel(LABEL_MIN_ZOOM)).toBe(true)
  })

  it('충분히 확대하면 보여준다', () => {
    expect(shouldShowMarkerLabel(16)).toBe(true)
  })
})

describe('toMapMarkers', () => {
  it('스냅샷이 있으면 혼잡도를 싣는다', () => {
    const markers = toMapMarkers([area('강남역', 'POI014', true)])

    expect(markers).toEqual([
      {
        entry: entry('강남역', 'POI014'),
        level: '붐빔',
        // 지도에 넘길 좌표를 여기서 한 번 만든다 — 호출부에서 만들면 매 렌더
        // 신원이 바뀌어 vis.gl이 마커마다 position을 다시 대입한다.
        position: { lat: 37.5, lng: 127 },
      },
    ])
  })

  it('스냅샷이 없는 명소도 마커를 만든다', () => {
    // 지도에서만 사라지면 사용자는 그 명소가 없다고 오인한다. 「내 주변」은
    // 같은 명소를 "정보 없음" 배지로 보여주고 있다.
    const markers = toMapMarkers([area('경복궁', 'POI007', false)])

    expect(markers).toHaveLength(1)
    expect(markers[0].level).toBeNull()
    expect(markers[0].entry.name).toBe('경복궁')
  })

  it('스냅샷 유무가 섞여도 전부 유지한다', () => {
    const markers = toMapMarkers([
      area('강남역', 'POI014', true),
      area('경복궁', 'POI007', false),
      area('남산공원', 'POI088', true),
    ])

    expect(markers.map((m) => m.entry.name)).toEqual([
      '강남역',
      '경복궁',
      '남산공원',
    ])
    expect(markers.map((m) => m.level)).toEqual(['붐빔', null, '붐빔'])
  })

  it('빈 목록은 빈 결과다', () => {
    expect(toMapMarkers([])).toEqual([])
  })
})

// 30곳 중 12곳쯤이 종로·중구의 좁은 구역에 몰려 있어 기본 줌에서 핀이 서로를
// 덮는다(390px 렌더에서 60×60px 안에 겹친 것을 셌다). 겹치는 것 자체는 줌으로
// 풀 일이지만, **어느 핀이 위에 오는가**는 고를 수 있다 — 덮는 쪽이 「여유」면
// 사용자가 피해야 할 곳이 피할 수 있는 곳 뒤에 숨는다.
describe('markerZIndex', () => {
  it('붐빌수록 위에 온다', () => {
    // 네 단계를 다 세운다. 이웃 한 쌍만 보면 나머지 쌍이 뒤집혀도 산다.
    const ordered = [
      markerZIndex('여유'),
      markerZIndex('보통'),
      markerZIndex('약간 붐빔'),
      markerZIndex('붐빔'),
    ]

    expect(ordered).toEqual([...ordered].toSorted((a, b) => a - b))
    expect(new Set(ordered).size).toBe(4)
  })

  it('정보 없음이 가장 아래다', () => {
    // 회색 핀이 실제 값을 가진 핀을 덮으면, 아는 것이 모르는 것에 가린다.
    expect(markerZIndex(null)).toBeLessThan(markerZIndex('여유'))
  })
})

// 시트가 지도의 아래쪽 절반 이상을 덮는다. 명소를 열 때 그 명소를 지도 **한가운데**
// 놓으면 시트 뒤로 들어가 아무것도 안 보인다 — 390×844에서 지도 중심은 y=422이고
// 시트 상단이 y=371이다. 보이는 띠(0~371)의 한가운데로 끌어올리는 것이 이 계산이다.
/**
 * 화면 세로 1픽셀이 몇 도의 위도인가 — **검산자다.**
 *
 * 구현(`map.ts`)은 위도↔픽셀을 정확한 메르카토르로 오간다. 그 식을 테스트에
 * 그대로 베껴 쓰면 구현을 구현으로 검사하는 꼴이라, 여기서는 **다른 식**을
 * 쓴다: 그 점에서의 1차 근사(`360/(256·2^z) · cos φ`)다. 서울 규모의 이동
 * (수백 픽셀)에서 둘의 차이는 1e-6도 아래라 `toBeCloseTo`로 맞물리고,
 * 부호나 배율이 틀어지면 곧바로 벌어진다.
 */
function latitudeDegreesPerPixel(latitude: number, zoom: number): number {
  const degreesPerPixel = 360 / (256 * 2 ** zoom)
  return degreesPerPixel * Math.cos((latitude * Math.PI) / 180)
}

describe('검산자 latitudeDegreesPerPixel', () => {
  it('줌이 한 칸 깊어지면 픽셀당 위도가 절반이 된다', () => {
    // 검산자가 성립해야 아래 단언들이 의미를 갖는다.
    const shallow = latitudeDegreesPerPixel(37.5, 14)
    const deep = latitudeDegreesPerPixel(37.5, 15)
    expect(deep).toBeCloseTo(shallow / 2, 12)
  })

  it('위도가 높을수록 픽셀당 위도가 작다', () => {
    // 메르카토르는 극으로 갈수록 늘어난다.
    expect(latitudeDegreesPerPixel(60, 15)).toBeLessThan(
      latitudeDegreesPerPixel(0, 15),
    )
  })

  it('적도에서는 경도와 같은 비율이다', () => {
    // 세계 한 바퀴가 256 * 2^zoom 픽셀이라는 것을 고정한다. 상수를 잘못 적으면
    // 여기서 죽는다.
    expect(latitudeDegreesPerPixel(0, 0)).toBeCloseTo(360 / 256, 12)
  })
})

describe('centerBelowSheet', () => {
  const 경복궁 = { lat: 37.5796, lng: 126.977 }
  const HEIGHT = 844
  const ZOOM = 15

  /** 이 중심으로 그렸을 때 목표가 화면 세로 어디에 찍히나. 되돌려 계산한다. */
  function screenY(center: { lat: number; lng: number }): number {
    const perPixel = latitudeDegreesPerPixel(center.lat, ZOOM)
    return HEIGHT / 2 - (경복궁.lat - center.lat) / perPixel
  }

  it('시트가 덮은 만큼 목표가 보이는 띠 한가운데로 올라온다', () => {
    // 단언을 좌표 숫자가 아니라 **화면 위 위치**로 쓴다. 매직 넘버를 적으면
    // 구현을 그대로 베낀 테스트가 되어 부호를 뒤집어도 통과할 수 있다.
    const center = centerBelowSheet(경복궁, ZOOM, HEIGHT, 0.56)

    // 보이는 띠는 0 ~ 844*0.44 = 371.36px, 그 한가운데는 185.68px다.
    expect(screenY(center)).toBeCloseTo(185.68, 0)
  })

  it('경도는 건드리지 않는다', () => {
    // 시트는 아래쪽을 덮는다. 좌우로 밀 이유가 없다.
    expect(centerBelowSheet(경복궁, ZOOM, HEIGHT, 0.56).lng).toBe(126.977)
  })

  it('중심은 목표보다 남쪽이다', () => {
    // 부호가 뒤집히면 목표가 화면 **위로** 벗어난다. 위 테스트가 잡지만,
    // 방향은 한눈에 읽히는 자리에 따로 적어 둔다.
    expect(centerBelowSheet(경복궁, ZOOM, HEIGHT, 0.56).lat).toBeLessThan(
      경복궁.lat,
    )
  })

  it('시트가 없으면 목표가 그대로 중심이다', () => {
    expect(centerBelowSheet(경복궁, ZOOM, HEIGHT, 0)).toEqual(경복궁)
  })

  it('줌이 깊을수록 좌표를 덜 옮긴다', () => {
    // 옮기는 거리는 픽셀로 고정이고 픽셀당 위도가 줄어들기 때문이다. 줌을
    // 안 보고 상수로 옮기면 zoom 11에서 명소가 화면 밖으로 나간다.
    const near = 경복궁.lat - centerBelowSheet(경복궁, 16, HEIGHT, 0.56).lat
    const far = 경복궁.lat - centerBelowSheet(경복궁, 12, HEIGHT, 0.56).lat
    expect(near).toBeLessThan(far)
  })

  it('화면 높이를 모르면 목표를 그대로 쓴다', () => {
    // `window.innerHeight`가 0으로 오는 환경(측정 전 프레임, 일부 웹뷰)에서
    // NaN 좌표를 지도에 넘기면 지도가 통째로 죽는다. 안 옮기는 편이 낫다.
    expect(centerBelowSheet(경복궁, ZOOM, 0, 0.56)).toEqual(경복궁)
    expect(centerBelowSheet(경복궁, ZOOM, Number.NaN, 0.56)).toEqual(경복궁)
  })
})

// 시트를 끄는 동안 지도가 손끝을 따라 팬한다. 시트가 커지면 보이는 띠가
// 위로 줄어드는데, 지도가 가만히 있으면 보고 있던 곳이 시트 뒤로 밀려 들어간다.
// 「목록 누르면 지도가 그리로 간다」를 만들어 놓고 시트를 올리면 도로 가리는 셈이다.
describe('shiftCenterForSheet', () => {
  const HERE = { lat: 37.5665, lng: 126.978 }
  const HEIGHT = 844
  const ZOOM = 15

  /** 그 중심·그 시트 비율에서 **보이는 띠 한가운데**에 놓이는 좌표. */
  function focalOf(center: { lat: number; lng: number }, ratio: number): number {
    const offsetPixels = (HEIGHT * ratio) / 2
    return center.lat + offsetPixels * latitudeDegreesPerPixel(center.lat, ZOOM)
  }

  it('시트가 커져도 보고 있던 곳이 보이는 띠 한가운데에 남는다', () => {
    // 이 테스트가 이 함수의 존재 이유 전부다. 좌표 매직 넘버 대신 **불변식**을
    // 적는다 — half에서 띠 한가운데였던 좌표가 full에서도 띠 한가운데다.
    const moved = shiftCenterForSheet(HERE, ZOOM, HEIGHT, 0.56, 0.92)

    expect(focalOf(moved, 0.92)).toBeCloseTo(focalOf(HERE, 0.56), 5)
  })

  it('시트를 내려도 마찬가지다', () => {
    // 반대 방향도 봐야 한다. 한쪽만 보면 부호를 절댓값으로 감싼 구현이 통과한다.
    const moved = shiftCenterForSheet(HERE, ZOOM, HEIGHT, 0.56, 0.16)

    expect(focalOf(moved, 0.16)).toBeCloseTo(focalOf(HERE, 0.56), 5)
  })

  it('시트가 커지면 중심이 남쪽으로 간다', () => {
    // 방향은 한눈에 읽히는 자리에 따로 적어 둔다. 위 불변식이 잡지만,
    // 읽는 사람이 부호를 되짚지 않아도 되게 한다.
    expect(shiftCenterForSheet(HERE, ZOOM, HEIGHT, 0.16, 0.92).lat).toBeLessThan(
      HERE.lat,
    )
  })

  it('비율이 그대로면 중심도 그대로다', () => {
    expect(shiftCenterForSheet(HERE, ZOOM, HEIGHT, 0.56, 0.56)).toEqual(HERE)
  })

  it('왕복하면 제자리로 돌아온다', () => {
    // 끄는 동안 매 프레임 이 함수를 부른다. 왕복이 안 닫히면 시트를 몇 번
    // 오르내리는 것만으로 지도가 조금씩 흘러간다.
    const up = shiftCenterForSheet(HERE, ZOOM, HEIGHT, 0.56, 0.92)
    const back = shiftCenterForSheet(up, ZOOM, HEIGHT, 0.92, 0.56)

    expect(back.lat).toBeCloseTo(HERE.lat, 5)
    expect(back.lng).toBe(HERE.lng)
  })

  it('경도는 건드리지 않는다', () => {
    expect(shiftCenterForSheet(HERE, ZOOM, HEIGHT, 0.16, 0.92).lng).toBe(126.978)
  })

  it('화면 높이를 모르면 옮기지 않는다', () => {
    expect(shiftCenterForSheet(HERE, ZOOM, 0, 0.16, 0.92)).toEqual(HERE)
    expect(shiftCenterForSheet(HERE, ZOOM, Number.NaN, 0.16, 0.92)).toEqual(HERE)
  })

  it('시트가 없는 상태에서 옮기는 것이 곧 centerBelowSheet다', () => {
    // 둘은 같은 식이다. 따로 적으면 한쪽만 고쳐지는 날이 온다 —
    // 이 테스트가 그 두 벌을 하나로 묶어 둔다.
    expect(shiftCenterForSheet(HERE, ZOOM, HEIGHT, 0, 0.56)).toEqual(
      centerBelowSheet(HERE, ZOOM, HEIGHT, 0.56),
    )
  })
})

// ── 넓은 화면: 시트가 왼쪽 패널이 된다 ────────────────────────────────────
//
// 세로가 긴 화면에서는 시트가 아래를 덮으므로 지도 중심을 **남쪽**으로 비켜
// 잡았다. PC에서는 패널이 **왼쪽**을 덮으므로 같은 논리가 축만 바뀐다 —
// 중심을 서쪽으로 밀어야 명소가 패널 오른쪽 띠 한가운데 온다.
describe('centerRightOfPanel', () => {
  const TARGET: Coords = { lat: 37.5665, lng: 126.978 }

  it('패널이 가린 만큼 중심을 서쪽으로 옮긴다', () => {
    const moved = centerRightOfPanel(TARGET, 15, 400)

    expect(moved.lng).toBeLessThan(TARGET.lng)
    // 위도는 건드리지 않는다. 패널은 세로를 가리지 않는다.
    expect(moved.lat).toBe(TARGET.lat)
  })

  it('패널이 넓을수록 더 옮긴다', () => {
    const narrow = centerRightOfPanel(TARGET, 15, 300)
    const wide = centerRightOfPanel(TARGET, 15, 600)

    expect(TARGET.lng - wide.lng).toBeGreaterThan(TARGET.lng - narrow.lng)
  })

  it('줌이 깊을수록 같은 픽셀이 더 작은 각도다', () => {
    // 픽셀은 화면의 것이고 경도는 지도의 것이다. 줌 한 단계마다 세계 픽셀 폭이
    // 두 배가 되므로 같은 400px이 절반의 경도가 된다 — 안 그러면 확대할수록
    // 명소가 화면 밖으로 밀린다.
    const near = TARGET.lng - centerRightOfPanel(TARGET, 15, 400).lng
    const far = TARGET.lng - centerRightOfPanel(TARGET, 16, 400).lng

    expect(near / far).toBeCloseTo(2, 1)
  })

  it('400px 패널에서 옮기는 양이 화면 200px과 같다', () => {
    // 독립 계산으로 견준다. 줌 z에서 세계 픽셀 폭은 256·2^z이고 경도는
    // 그 폭에 -180~180이 고르게 퍼진다. 구현을 구현으로 검산하지 않으려고
    // 여기서 식을 다시 세운다.
    const zoom = 15
    const degreesPerPixel = 360 / (256 * 2 ** zoom)
    const moved = centerRightOfPanel(TARGET, zoom, 400)

    expect(TARGET.lng - moved.lng).toBeCloseTo(200 * degreesPerPixel, 8)
  })

  it('패널이 없으면 그대로 둔다', () => {
    // 좁은 화면에서는 패널 폭이 0이다. 부동소수점 끝자리가 흔들리면
    // 「안 움직였다」가 거짓이 된다.
    expect(centerRightOfPanel(TARGET, 15, 0)).toEqual(TARGET)
  })

  it('폭이 음수면 반대로 옮긴다', () => {
    // 패널이 **사라질 때** 쓰인다(400 → 0의 차이는 −400). 좁은 화면으로
    // 돌아가면 아까 서쪽으로 민 만큼 동쪽으로 되돌려야 제자리다.
    const west = centerRightOfPanel(TARGET, 15, 400)
    const back = centerRightOfPanel(west, 15, -400)

    expect(back.lng).toBeCloseTo(TARGET.lng, 10)
  })

  it('폭이 이상하면 손대지 않는다', () => {
    // 측정 전 프레임에서 0·NaN이 올 수 있다. NaN 좌표를 넘기면 지도가 죽는다.
    expect(centerRightOfPanel(TARGET, 15, Number.NaN)).toEqual(TARGET)
  })
})
