import { CONGESTION_LEVELS, type CongestionLevel } from './types'

export type CongestionTone = 'calm' | 'normal' | 'busy' | 'crowded'

const TONE_BY_LEVEL: Readonly<Record<CongestionLevel, CongestionTone>> = {
  여유: 'calm',
  보통: 'normal',
  '약간 붐빔': 'busy',
  붐빔: 'crowded',
}

export function parseCongestionLevel(raw: string): CongestionLevel | null {
  const trimmed = raw.trim()
  return CONGESTION_LEVELS.find((level) => level === trimmed) ?? null
}

export function congestionRank(level: CongestionLevel): number {
  return CONGESTION_LEVELS.indexOf(level)
}

export function congestionTone(level: CongestionLevel): CongestionTone {
  return TONE_BY_LEVEL[level]
}

/** 여유·보통을 한산한 것으로 본다. `congestionTone`의 'calm'보다 넓은 범위다. */
export function isUncrowded(level: CongestionLevel): boolean {
  return congestionRank(level) <= congestionRank('보통')
}
