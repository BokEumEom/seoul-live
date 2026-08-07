export interface Coords {
  readonly lat: number
  readonly lng: number
}

export const CONGESTION_LEVELS = ['여유', '보통', '약간 붐빔', '붐빔'] as const

export type CongestionLevel = (typeof CONGESTION_LEVELS)[number]

// 서울시 공식 분류. 출처는 저장소의 `실시간 도시데이터 매뉴얼.pdf` p9~10
// 「주요장소 목록」이다. 121곳 확장 시 매뉴얼에서 그대로 가져올 수 있다.
//
// 30곳 구간에서는 분포가 쏠린다(발달상권 12 / 공원 10 / 관광특구 3 /
// 고궁·문화유산 3 / 인구밀집지역 2). 121곳에서는 48/33/28/7/5로 균형이
// 잡히므로 이 쏠림은 임시 비용이다. 설계 문서 §2.5 참고 — 되돌리지 마라.
export const AREA_CATEGORIES = [
  '관광특구',
  '고궁·문화유산',
  '인구밀집지역',
  '발달상권',
  '공원',
] as const

export type AreaCategory = (typeof AREA_CATEGORIES)[number]

// 「인구밀집지역」·「발달상권」은 행정 용어라 화면에 그대로 쓰지 않는다.
// 데이터는 공식 값을 갖고 표시만 바꾼다.
export const CATEGORY_LABEL: Readonly<Record<AreaCategory, string>> = {
  관광특구: '관광특구',
  '고궁·문화유산': '고궁·유적',
  인구밀집지역: '역·번화가',
  발달상권: '상권·거리',
  공원: '공원',
}

// 프리셋용 목적 태그. 카테고리와 축이 다르다 — 카테고리는 "어떤 성격의
// 구역인가"이고 이건 "거기서 뭘 하려는가"다. 광장(전통)시장과 청담동
// 명품거리가 같은 발달상권인데 데이트 적합성은 정반대다.
//
// 'hot'은 없다. 「지금 핫플」은 혼잡도만 보므로 태그가 필요 없다.
export type Purpose = 'kids' | 'date'

export interface AreaCatalogEntry extends Coords {
  readonly code: string
  readonly name: string
  readonly category: AreaCategory
  /** 없으면 나들이·데이트 프리셋에 걸리지 않는다. 121곳 확장 시 태그가
   *  없는 명소가 조용히 오분류되지 않고 그냥 빠지게 하려는 것이다. */
  readonly purposes?: readonly Purpose[]
}

export interface Forecast {
  /** 서울 API 원본 형식. `"2026-08-03 16:00"` — ISO 아님, 타임존 없음 */
  readonly time: string
  /** `time`에서 뽑은 0~23. 화면이 원본 형식을 파싱하지 않게 하려는 것 */
  readonly hour: number
  readonly congestion: CongestionLevel
  readonly populationMin: number
  readonly populationMax: number
}

export interface AreaSnapshot {
  readonly code: string
  readonly name: string
  readonly congestion: CongestionLevel
  readonly message: string
  readonly populationMin: number
  readonly populationMax: number
  /** 서울 API 원본 형식. `"2026-08-03 14:35"` — ISO 아님, 타임존 없음 */
  readonly observedAt: string
  /** `observedAt`에서 뽑은 "HH:MM". 화면이 원본 형식을 파싱하지 않게 하려는 것 */
  readonly observedAtLabel: string
  readonly forecasts: readonly Forecast[]
}

export interface NearbyArea {
  readonly entry: AreaCatalogEntry
  readonly snapshot: AreaSnapshot | null
  readonly distanceMeters: number | null
}
