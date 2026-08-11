// 시트가 화면에서 차지하는 세로 비율. 지도는 뒤에 전체로 깔려 있고 시트가
// 그 위를 덮는다 — 공간을 나눠 갖지 않는다.
//
// peek을 0으로, full을 1로 두지 않는 이유: 한쪽이 완전히 사라지면 되돌릴
// 손잡이도 같이 사라진다.
export type Detent = 'peek' | 'half' | 'full'

export const SHEET_RATIO: Readonly<Record<Detent, number>> = {
  /** 요약 스트립과 목록 첫 항목만. 지도가 주인공 */
  peek: 0.16,
  /** 목록. 기본값 */
  half: 0.46,
  /** 상세 또는 오늘의 서울 */
  full: 0.92,
}

const DETENTS: readonly Detent[] = ['peek', 'half', 'full']

export function clampSheetRatio(ratio: number): number {
  if (Number.isNaN(ratio)) {
    return SHEET_RATIO.half
  }
  return Math.min(SHEET_RATIO.full, Math.max(SHEET_RATIO.peek, ratio))
}

export function nearestDetent(ratio: number): Detent {
  const bounded = clampSheetRatio(ratio)
  return DETENTS.reduce((best, detent) =>
    Math.abs(SHEET_RATIO[detent] - bounded) < Math.abs(SHEET_RATIO[best] - bounded)
      ? detent
      : best,
  )
}
