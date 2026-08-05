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
  }))
}
