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

// 교통정보 같은 어조로 네 단계를 나란히 맞췄다. '극심한 혼잡'만 시안(stitch_ui/_3)의
// 문구를 그대로 쓴다. API 원문(여유/보통/약간 붐빔/붐빔)은 배지가 따로 보여주므로,
// 이 문구는 원문을 대체하는 게 아니라 큰 제목으로 한 번 더 요약하는 역할이다.
const HEADLINE_BY_LEVEL: Readonly<Record<CongestionLevel, string>> = {
  여유: '매우 원활',
  보통: '원활',
  '약간 붐빔': '다소 혼잡',
  붐빔: '극심한 혼잡',
}

/** 상세 화면 맨 위에 크게 띄우는 한 줄 요약. */
export function congestionHeadline(level: CongestionLevel): string {
  return HEADLINE_BY_LEVEL[level]
}
