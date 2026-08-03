export interface Coords {
  readonly lat: number
  readonly lng: number
}

export const CONGESTION_LEVELS = ['여유', '보통', '약간 붐빔', '붐빔'] as const

export type CongestionLevel = (typeof CONGESTION_LEVELS)[number]

export type AreaCategory = '공원' | '쇼핑몰' | '카페' | '문화재' | '기타'

export interface AreaCatalogEntry extends Coords {
  readonly code: string
  readonly name: string
  readonly category: AreaCategory
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
  readonly observedAt: string
  readonly forecasts: readonly Forecast[]
}

export interface NearbyArea {
  readonly entry: AreaCatalogEntry
  readonly snapshot: AreaSnapshot | null
  readonly distanceMeters: number | null
}
