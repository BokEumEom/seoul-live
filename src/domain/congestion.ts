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

// 상세 히어로의 한 문장. **말을 거는 어조다** — 새 시안(stitch_ui_ux/_2)의
// 「지금은 약간 붐벼요」 그대로다.
//
// **예전에는 교통정보 어조였다**(매우 원활 / 원활 / 다소 혼잡 / 극심한 혼잡).
// 두 가지가 걸렸다. 하나는 「원활」이 같은 화면의 **도로소통 값**과 같은
// 말이라(`RoadTrafficCard`의 원활/서행/정체) 사람 혼잡도인지 차 흐름인지
// 구별되지 않았다. 다른 하나는 그 문구를 쓰던 자리가 배지 바로 아래여서 같은
// 말이 두 번 나오는 것으로 읽혔고, 그래서 화면에서 통째로 빠져 **아무 데서도
// 안 쓰이는 표**로 남아 있었다.
//
// 전체 화면 상세에서는 배지가 히어로에 없다 — 이 문장이 그 자리의 주인이라
// 등급을 되풀이하는 것이 아니라 **처음 말하는 것**이 됐다.
const SENTENCE_BY_LEVEL: Readonly<Record<CongestionLevel, string>> = {
  여유: '지금은 여유로워요',
  보통: '지금은 보통이에요',
  '약간 붐빔': '지금은 약간 붐벼요',
  붐빔: '지금은 붐벼요',
}

/** 상세 화면 맨 위에 크게 띄우는 한 문장. */
export function congestionSentence(level: CongestionLevel): string {
  return SENTENCE_BY_LEVEL[level]
}
