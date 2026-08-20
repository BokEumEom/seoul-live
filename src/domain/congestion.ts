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

/**
 * 낮을수록 한산하다. **모르는 것(`null`)은 맨 뒤다.**
 *
 * 목록이 121곳으로 늘면서 `null`이 실제로 생긴다 — 상류가 모르는 등급 문자열을
 * 주면 짐작해서 끼워 넣지 않고 `null`로 둔다(`hotspotsSchema.ts`). 그걸 여기서
 * 0으로 접으면 **정보가 없는 명소가 「여유」인 척 목록 맨 위**로 올라온다.
 * `compareByCongestion`이 스냅샷 자체가 없는 경우를 뒤로 보내는 것과 같은 규칙을
 * 한 단계 안쪽에도 세운다.
 */
export function congestionRank(level: CongestionLevel | null): number {
  return level === null ? CONGESTION_LEVELS.length : CONGESTION_LEVELS.indexOf(level)
}

export function congestionTone(level: CongestionLevel): CongestionTone {
  return TONE_BY_LEVEL[level]
}

/**
 * 여유·보통을 한산한 것으로 본다. `congestionTone`의 'calm'보다 넓은 범위다.
 *
 * **모르면 거짓이다.** 이 함수는 「거기 가도 좋다」를 뜻하는 자리에서 쓰인다
 * (프리셋, 「근처 쾌적한 장소」). 모르는 것을 한산하다고 답하면 앱이 확인하지
 * 않은 것을 권하게 된다 — 위 `congestionRank`가 `null`을 맨 뒤에 두므로
 * 비교식만으로도 거짓이 되지만, 그게 우연이 아니라 의도임을 여기 적어 둔다.
 */
export function isUncrowded(level: CongestionLevel | null): boolean {
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
