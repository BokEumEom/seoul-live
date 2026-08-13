// 시트가 화면에서 차지하는 세로 비율. 지도는 뒤에 전체로 깔려 있고 시트가
// 그 위를 덮는다 — 공간을 나눠 갖지 않는다.
//
// peek을 0으로, full을 1로 두지 않는 이유: 한쪽이 완전히 사라지면 되돌릴
// 손잡이도 같이 사라진다.
export type Detent = 'peek' | 'half' | 'full'

export const SHEET_RATIO: Readonly<Record<Detent, number>> = {
  /** 요약 스트립과 목록 첫 항목만. 지도가 주인공 */
  peek: 0.16,
  /**
   * 목록. 기본값.
   *
   * **0.46에서 올렸다 — 그 값으로는 목록이 1.8행밖에 안 보였다.** 390×844에서
   * 시트를 픽셀로 재 보니 크롬이 284px을 먹는다: 손잡이 24 + 요약 스트립 36
   * + 위치 안내 72 + 카테고리 56 + 정렬 48, 사이 간격 12씩. 0.46이면 시트가
   * 388px이라 명소 행(58px)에 104px = 1.8행만 남았다. 「목록 단계」라는 이름이
   * 무색했다.
   *
   * 0.56이면 473px이라 189px = 3.3행이다. 위치 권한이 있으면 안내 84px이 빠져
   * 4.7행이 된다. 지도는 54%→44%로 줄지만 `peek`(16%)이 지도를 보는 단계로
   * 따로 있고, 화면 위 112px은 어차피 검색 바·칩 열이 덮고 있다.
   *
   * 이 값을 고치면 `RecenterButton`의 `BOTTOM_CLASS`가 따라와야 한다
   * (언제나 `SHEET_RATIO[detent] + 0.02`). 안 따라오면 그 파일의 파생 규칙
   * 테스트가 죽는다 — 실제로 여기서 죽여서 확인했다.
   */
  half: 0.56,
  /**
   * 오늘의 서울. 손잡이로도 온다.
   *
   * **상세는 여기 오지 않는다.** 지도가 8%짜리 조각이 되는 단계라, 명소를
   * 열었다고 여기까지 올리면 지도 위에 시트를 얹은 뜻이 없어진다 — `openArea`가
   * 언제나 half를 부르는 이유이고, 그 근거는 `HomeScreen`에 한 벌 있다.
   */
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
