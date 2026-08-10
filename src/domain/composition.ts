/** 서울 API `citydata_ppltn`의 인구 구성. 혼잡도와 같은 응답에 실려 온다.
 *
 * 모든 값이 백분율이다. 응답을 실제로 본 적이 없어 합이 정확히 100인지는
 * 확인되지 않았다 — 화면은 합을 가정하지 않는다.
 *
 * **0은 "실제로 0%"와 "읽지 못함"을 구분하지 못한다.** 파서(`data/compositionSchema.ts`의
 * `rate()`)가 읽을 수 없는 칸을 0으로 떨어뜨리기 때문이다. 칸마다 `number | null`로 두면
 * 화면이 칸마다 분기해야 해서 이 쪽을 택했다. 그래서 **0을 근거로 장소를 단정하지 마라** —
 * 막대를 0 길이로 그리는 건 괜찮지만 문구로 뭔가를 주장하면 안 된다.
 * `residentLabel()`이 그 규칙을 지키는 예다. */
export interface PopulationComposition {
  readonly maleRate: number
  readonly femaleRate: number
  /** 비상주(외지인) 비율. 높으면 관광지, 낮으면 생활권이다. */
  readonly nonResidentRate: number
  /** PPLTN_RATE_0 ~ PPLTN_RATE_70 순서대로 여덟 개. */
  readonly ageRates: readonly number[]
}

export const AGE_LABELS: readonly string[] = [
  '0~9세',
  '10대',
  '20대',
  '30대',
  '40대',
  '50대',
  '60대',
  '70대+',
]

/** 남녀는 한 쌍으로만 말할 수 있다. `rate()`는 칸마다 따로 0을 떨어뜨리므로 한쪽만
 * 읽히는 일이 둘 다 실패하는 것보다 흔한데, 그 0을 그대로 적으면 「남 100% · 여 0%」처럼
 * 못 읽은 값을 사실로 적게 된다. `residentLabel`과 같은 규칙이다. */
export function hasGenderSplit(composition: PopulationComposition): boolean {
  return composition.maleRate > 0 && composition.femaleRate > 0
}

/** 말할 수 있는 값이 하나도 없으면 `false`. 0은 "못 읽음"일 수 있어(`compositionSchema.ts`의
 * `rate()`) 전부 0인 구성으로는 아무 말도 할 수 없다.
 *
 * **성별은 `hasGenderSplit`으로 센다** — 한쪽만 읽힌 것은 그릴 수 있는 값이 아니라서,
 * 여기서 `||`로 세면 소비처가 제목만 있는 빈 카드를 그리게 된다. 이 술어가 「그릴 게
 * 있나」의 유일한 소유자다. 화면마다 다시 판정하면 판정이 갈린다. */
export function hasReadableComposition(composition: PopulationComposition): boolean {
  return (
    hasGenderSplit(composition) ||
    composition.nonResidentRate > 0 ||
    composition.ageRates.some((rate) => rate > 0)
  )
}

/** 60%를 넘어야 "외지인이 많다"고 말한다. 반반에 가까운 곳을 단정하지 않으려는 것이다. */
const NON_RESIDENT_THRESHOLD = 60

/** 말할 근거가 없으면 `null`이다. 소비처는 JSX에 그대로 넣으면 된다 — null은 아무것도
 * 그리지 않는다. */
export function residentLabel(composition: PopulationComposition): string | null {
  // 0은 "비상주가 0%"가 아니라 "읽지 못함"일 수 있다. 못 읽은 값으로 단정하지 않는다 —
  // 아래 임계값이 반반에 가까운 곳을 단정하지 않으려는 것과 같은 이유다.
  if (composition.nonResidentRate === 0) {
    return null
  }
  return composition.nonResidentRate > NON_RESIDENT_THRESHOLD
    ? '외지인이 많아요'
    : '동네 생활권이에요'
}
