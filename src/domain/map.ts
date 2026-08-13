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
 * 화면 세로 1픽셀이 몇 도의 위도인가.
 *
 * 경도는 세계 한 바퀴(360°)가 `TILE_SIZE * 2^zoom` 픽셀에 균등하게 펴지므로
 * 위도와 무관하지만, **위도는 메르카토르라 극으로 갈수록 늘어난다** — 같은
 * 1픽셀이 서울(37.5°)에서는 적도의 79%에 해당하는 위도만 덮는다. `cos`를
 * 빼먹으면 서울에서 21% 어긋난 자리에 지도를 잡는다.
 */
export function latitudeDegreesPerPixel(latitude: number, zoom: number): number {
  const degreesPerPixel = 360 / (TILE_SIZE * 2 ** zoom)
  return degreesPerPixel * Math.cos((latitude * Math.PI) / 180)
}

/**
 * 시트가 아래를 덮은 지도에서, `target`이 **보이는 띠의 한가운데**에 놓이도록
 * 지도 중심을 남쪽으로 비켜 잡는다.
 *
 * 지도는 뷰포트를 꽉 채우고 시트가 그 위를 덮으므로, 지도의 중심은 언제나
 * 화면 한가운데다 — 390×844에서 y=422인데 half 시트의 상단이 y=371이다.
 * 명소를 그냥 중심에 놓으면 **시트 뒤로 들어가 하나도 안 보인다.** 「목록에서
 * 고르면 지도가 그리로 간다」가 눈에 보이려면 이 보정이 있어야 한다.
 *
 * `viewportHeight`가 0이나 NaN으로 오면(측정 전 프레임, 일부 웹뷰) 옮기지
 * 않는다 — NaN 좌표를 넘기면 지도가 통째로 죽는다. 덜 옮기는 편이 낫다.
 */
export function centerBelowSheet(
  target: Coords,
  zoom: number,
  viewportHeight: number,
  sheetRatio: number,
): Coords {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return target
  }
  const visibleHeight = viewportHeight * (1 - sheetRatio)
  const offsetPixels = (viewportHeight - visibleHeight) / 2
  return {
    lat: target.lat - offsetPixels * latitudeDegreesPerPixel(target.lat, zoom),
    lng: target.lng,
  }
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
