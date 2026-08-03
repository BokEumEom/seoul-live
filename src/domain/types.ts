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
  readonly time: string
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
