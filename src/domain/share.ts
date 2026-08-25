/**
 * 비율 막대의 칸 너비. 인구 구성(`PopulationCard`)과 상권 소비 구성이 나눠 쓴다.
 *
 * **왜 함수 하나를 따로 두나.** 아래 한 줄의 규칙이 이 파일의 전부인데, 그
 * 규칙을 두 화면이 각자 들고 있으면 한쪽만 고치는 날이 온다 — 그때 두 막대가
 * 같은 화면에서 서로 다른 셈을 하게 되고, 그건 눈으로는 안 보인다.
 */

/**
 * 막대 폭의 최소 분모. **서울 API가 합을 100으로 준다는 보장이 없다.**
 *
 * 실제 합으로만 정규화하면 절반만 읽힌 구성에서 남은 두 칸이 100%를 나눠 가져
 * 「10대와 30대가 이 장소의 전부」라고 그린다 — 바로 아래 글자는 25%·15%라고
 * 적으니 두 줄이 모순되고 막대 쪽이 거짓이다. 못 읽은 칸의 빈자리는 그대로 둔다.
 * 합이 99면 눈에 안 띄는 1% 여백만 남고, 100을 넘으면 실제 합으로 되돌아간다.
 */
const MIN_DENOMINATOR = 100

/**
 * 각 값이 차지할 백분율. 합이 100 미만이면 **여백이 남는다** — 그 여백이
 * 「못 읽은 칸」의 자리다.
 *
 * 넘칠 때의 이득은 지금 화면에 안 보인다. flex 기본 shrink가 폭 합이 100%를
 * 넘으면 basis에 비례해 압축해서 같은 픽셀을 낸다 — 브라우저로 재서 확인했다.
 * 이 분기가 값을 갖는 건 막대에 `shrink-0`이나 `flex-none`이 붙는 순간이다.
 */
export function shareWidths(values: readonly number[]): readonly number[] {
  const total = values.reduce((sum, value) => sum + value, 0)
  const denominator = Math.max(total, MIN_DENOMINATOR)
  return values.map((value) => (value / denominator) * 100)
}

/** 막대를 그릴 것이 있나. 합이 0이면 균등 칸을 그리는 대신 통째로 뺀다 —
 *  균등 막대는 「모든 칸이 고르게 있다」는 없는 사실을 그린다. */
export function hasShare(values: readonly number[]): boolean {
  return values.some((value) => value > 0)
}
