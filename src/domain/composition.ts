/** 서울 API `citydata_ppltn`의 인구 구성. 혼잡도와 같은 응답에 실려 온다.
 *
 * 모든 값이 백분율이다. 응답을 실제로 본 적이 없어 합이 정확히 100인지는
 * 확인되지 않았다 — 화면은 합을 가정하지 않는다. */
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

/** 60%를 넘어야 "외지인이 많다"고 말한다. 반반에 가까운 곳을 단정하지 않으려는 것이다. */
const NON_RESIDENT_THRESHOLD = 60

export function residentLabel(composition: PopulationComposition): string {
  return composition.nonResidentRate > NON_RESIDENT_THRESHOLD
    ? '외지인이 많아요'
    : '동네 생활권이에요'
}
