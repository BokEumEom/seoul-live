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
