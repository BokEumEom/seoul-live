import { congestionRank } from './congestion'
import type {
  AreaCatalogEntry,
  CongestionLevel,
  Coords,
  NearbyArea,
} from './types'

/** 서울시청. 지도 탭의 초기 중심이다. */
export const SEOUL_CENTER: Coords = { lat: 37.5665, lng: 126.978 }

/** 서울 전역이 화면에 들어오는 줌. */
export const DEFAULT_ZOOM = 11

/**
 * 알약 라벨을 붙이기 시작하는 줌.
 *
 * 카탈로그 30곳 중 강남역·가로수길·압구정로데오거리·청담동 명품거리가 반경
 * 2km 안에 몰려 있다. 서울 전역이 보이는 zoom 11에서 라벨을 전부 붙이면 서로를
 * 덮는다. 클러스터링 라이브러리를 넣는 대신 줌에 따라 표현을 바꾼다 —
 * 30곳 규모에서는 이걸로 충분하다.
 */
export const LABEL_MIN_ZOOM = 12

/** 웹 메르카토르 타일 한 변(px). 줌 z에서 세계는 `TILE_SIZE * 2^z` 픽셀이다. */
const TILE_SIZE = 256

/**
 * 위도 → 웹 메르카토르 세로 픽셀. 위로 갈수록 작고, 적도가 한가운데다.
 *
 * **「1픽셀 = cos(위도)×상수 도」로 근사하지 않는다.** 그 선형화는 왕복이
 * 안 닫힌다 — 되돌아올 때의 `cos`가 출발할 때와 다른 위도에서 계산되기
 * 때문이다. 시트를 끄는 동안 매 프레임 이 계산이 도는데, 왕복이 안 닫히면
 * 시트를 몇 번 오르내리는 것만으로 지도가 조금씩 흘러간다(실제로 그랬다:
 * half→full→peek→half 한 바퀴에 37.6이 37.60000029로 돌아왔다).
 * 픽셀로 갔다가 픽셀에서 돌아오면 부동소수점 오차만 남는다.
 */
function latitudeToPixel(latitude: number, zoom: number): number {
  const worldPixels = TILE_SIZE * 2 ** zoom
  const sin = Math.sin((latitude * Math.PI) / 180)
  const mercator = Math.log((1 + sin) / (1 - sin)) / 2
  return (worldPixels / 2) * (1 - mercator / Math.PI)
}

/** 그 역. */
function pixelToLatitude(pixel: number, zoom: number): number {
  const worldPixels = TILE_SIZE * 2 ** zoom
  const mercator = (1 - (2 * pixel) / worldPixels) * Math.PI
  return (Math.atan(Math.sinh(mercator)) * 180) / Math.PI
}

/**
 * 시트 비율이 `fromRatio`에서 `toRatio`로 바뀔 때, **보이는 띠 한가운데에 있던
 * 좌표가 그 자리에 그대로 남도록** 지도 중심을 옮긴다.
 *
 * 지도는 뷰포트를 꽉 채우고 시트가 그 위를 덮으므로, 지도의 중심은 언제나
 * 화면 한가운데다 — 390×844에서 y=422인데 half 시트의 상단이 y=371이다.
 * **시트가 커지면 보이는 띠가 위로 줄어드는데 지도가 가만히 있으면 보고 있던
 * 곳이 시트 뒤로 밀려 들어간다.** 「목록에서 고르면 지도가 그리로 간다」를
 * 만들어 놓고 시트를 올리면 도로 가리는 셈이라, 시트가 움직이는 동안 지도도
 * 함께 움직인다.
 *
 * 비율 r에서 지도 중심(y=H/2)과 보이는 띠 한가운데(y=H(1−r)/2)의 거리는
 * `H·r/2` 픽셀이다. 두 비율의 차만큼 중심을 밀면 그 좌표가 제자리에 남는다.
 *
 * `viewportHeight`가 0이나 NaN으로 오면(측정 전 프레임, 일부 웹뷰) 옮기지
 * 않는다 — NaN 좌표를 넘기면 지도가 통째로 죽는다. 덜 옮기는 편이 낫다.
 */
export function shiftCenterForSheet(
  center: Coords,
  zoom: number,
  viewportHeight: number,
  fromRatio: number,
  toRatio: number,
): Coords {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return center
  }
  // 세로 픽셀은 아래로 갈수록 커진다. 시트가 커지면(to > from) 중심이 남쪽,
  // 곧 픽셀이 커지는 쪽으로 간다 — 그래야 보고 있던 곳이 화면 위로 올라온다.
  const offsetPixels = ((toRatio - fromRatio) * viewportHeight) / 2
  // 옮길 것이 없으면 손대지 않는다. 픽셀로 갔다 오는 것만으로도 부동소수점
  // 끝자리가 흔들려(37.5665 → 37.566500000000005) 「안 움직였다」가 거짓이 된다.
  if (offsetPixels === 0) {
    return center
  }
  return {
    lat: pixelToLatitude(latitudeToPixel(center.lat, zoom) + offsetPixels, zoom),
    lng: center.lng,
  }
}

/**
 * 시트가 아래를 덮은 지도에서, `target`이 **보이는 띠의 한가운데**에 놓이도록
 * 지도 중심을 남쪽으로 비켜 잡는다. 명소를 열 때 쓴다.
 *
 * 「시트가 없는 상태(0)에서 지금 비율로 옮긴다」와 같은 말이라 위 함수에
 * 맡긴다. 식을 두 벌로 적으면 한쪽만 고쳐지는 날이 온다.
 */
export function centerBelowSheet(
  target: Coords,
  zoom: number,
  viewportHeight: number,
  sheetRatio: number,
): Coords {
  return shiftCenterForSheet(target, zoom, viewportHeight, 0, sheetRatio)
}

export interface MapMarker {
  readonly entry: AreaCatalogEntry
  readonly level: CongestionLevel | null
  /**
   * 지도에 넘길 좌표. `entry`에 lat·lng이 이미 있는데 따로 두는 이유는
   * **객체 신원** 때문이다.
   *
   * vis.gl의 `usePropBinding`은 `useEffect(..., [object, prop, value])`로
   * `marker.position = value`를 건다. 호출부에서 `position={{ lat, lng }}`처럼
   * 새 객체를 만들면 매 렌더 `value`의 신원이 바뀌어 effect가 다시 돌고,
   * 지도를 팬할 때마다 마커 30개에 대입이 나간다. 여기서 한 번 만들어 두면
   * `toMapMarkers`의 결과가 memo되는 한 신원이 유지된다.
   */
  readonly position: Coords
}

export function shouldShowMarkerLabel(zoom: number): boolean {
  return zoom >= LABEL_MIN_ZOOM
}

/**
 * 마커를 쌓는 순서. 붐빌수록 위에 온다.
 *
 * 30곳 중 12곳쯤이 종로·중구의 좁은 구역에 몰려 있어 기본 줌에서 핀이 서로를
 * 덮는다. 겹침 자체는 줌으로 푸는 것이고 `LABEL_MIN_ZOOM`이 라벨 쪽을 이미
 * 그렇게 다루지만, **어느 핀이 위에 오는가**는 겹친 채로도 고를 수 있다.
 * 덮는 쪽이 「여유」면 사용자가 피해야 할 곳이 피할 수 있는 곳 뒤에 숨는다.
 *
 * `null`(정보 없음)이 0이라 가장 아래다. 아는 것이 모르는 것에 가리지 않는다.
 *
 * **선택된 마커는 여기서 다루지 않는다.** 선택은 혼잡도와 다른 축이고,
 * 넣으면 탭할 때마다 쌓임 순서가 바뀌어 근거가 둘이 된다. 선택된 핀은
 * `CongestionMarker`가 크기로(`size-9` vs `size-7`) 이미 구분한다.
 */
export function markerZIndex(level: CongestionLevel | null): number {
  return level === null ? 0 : congestionRank(level) + 1
}

/**
 * 스냅샷이 없는 명소도 마커를 만든다 — `level`이 `null`인 회색 마커가 된다.
 * 조회에 실패한 명소가 지도에서만 사라지면 사용자는 그 명소가 존재하지
 * 않는다고 오인한다. 「내 주변」이 같은 명소를 "정보 없음" 배지로 보여주는
 * 것과 맞춘다.
 */
export function toMapMarkers(
  areas: readonly NearbyArea[],
): readonly MapMarker[] {
  return areas.map((area) => ({
    entry: area.entry,
    level: area.snapshot?.congestion ?? null,
    position: { lat: area.entry.lat, lng: area.entry.lng },
  }))
}
