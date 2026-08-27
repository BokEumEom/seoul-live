import type { CongestionLevel } from './types'

/**
 * 24시간 인파 흐름 — **과거 12시간 + 지금 + 예보 12시간 = 25칸.**
 *
 * **공식 API로는 못 만든다.** `citydata_ppltn`은 요청 인자에 날짜가 없어 과거를
 * 안 주고, 예보 12칸만 준다. 이 25칸은 SeoulRtd `/api/ppltn_congest`에서 오고
 * **인증키를 안 쓴다**(`domain/populationTrend.ts`와 같은 문).
 *
 * **오른쪽 절반은 공식 API와 같은 값이다.** 2026-08-27에 8곳 × 12칸을 나란히
 * 재서 **인원 96/96 · 등급 96/96이 정확히 일치**했다. 그래서 이 상류가 죽으면
 * 화면은 오른쪽 절반만 그리면 되고, 곡선이 달라지지 않는다.
 */

/** 한 칸. 25칸이 한 시간 간격으로 이어진다. */
export interface PopulationFlowSlot {
  /**
   * 0~23. **「현재」 칸은 시각 글자가 없어서**(`time_cd`가 「현재」로 온다)
   * 이웃에서 잇는다 — 25칸이 빈틈없는 한 시간 간격이라 앞칸+1이 곧 이 칸이다.
   */
  readonly hour: number | null
  /**
   * 인원. **구간의 가운데다.** 서울이 `people_value`(하나)와
   * `people_interval`(「40/000~42/000명」)을 함께 주는데, 2026-08-27 실측
   * 200칸에서 `people_value`가 그 구간의 가운데와 **한 칸도 안 어긋났다.**
   * 지금 예보 그래프가 min~max의 가운데를 쓰는 규칙과 같아서 두 출처를 한 축에
   * 세울 수 있다(`domain/forecast.ts`의 `forecastPopulation`).
   */
  readonly people: number | null
  /**
   * **최근 4주 같은 요일·같은 시각의 평균 인원**(`before_people_value`).
   * 「지금이 평소보다 많은가」의 근거이고, 이 앱이 기기에 한 칸씩 쌓던 값을
   * (`domain/pattern.ts`) 서울이 이미 갖고 있던 자리다.
   */
  readonly usual: number | null
  /** 혼잡도 4단계. 처음 보는 값이면 `null` */
  readonly congestion: CongestionLevel | null
}

export interface PopulationFlow {
  readonly slots: readonly PopulationFlowSlot[]
  /**
   * 「지금」 칸의 자리. 이 앞이 실측이고 뒤가 예보다.
   *
   * 실측에서 언제나 12였지만(25칸의 한가운데) **자리를 상수로 박지 않는다** —
   * `time_cd`의 「현재」 표식에서 읽는다. 상류가 창을 바꾸면 상수는 조용히
   * 틀리고 표식은 함께 움직인다. 표식을 못 찾으면 `null`이다.
   */
  readonly nowIndex: number | null
}

export const EMPTY_POPULATION_FLOW: PopulationFlow = {
  slots: [],
  nowIndex: null,
}

/**
 * 그릴 것이 있는가. **인원을 하나도 못 읽었으면 없는 것과 같다** — 칸 25개가
 * 전부 빈 막대인 그래프는 축만 남는다.
 */
export function hasPopulationFlow(flow: PopulationFlow): boolean {
  return flow.slots.some((slot) => slot.people !== null)
}

/**
 * 「평소」 곡선을 그릴 수 있는가. 인원과 따로 묻는 이유는 **한쪽만 오는 경우가
 * 있어서다** — 서울의 프런트엔드도 `before_people_value`에 null 검사를 두고
 * 있다(`js/domain/population.js`). 실측 10곳에서는 전부 왔다.
 *
 * 두 칸 미만이면 선이 안 그려진다. 점 하나는 선이 아니다.
 */
export function hasUsualCurve(flow: PopulationFlow): boolean {
  return flow.slots.filter((slot) => slot.usual !== null).length >= 2
}

/**
 * 축의 최댓값을 정할 때 봐야 하는 값 전부. **평소 곡선까지 함께 본다** —
 * 인원만으로 축을 정하면 평소가 오늘보다 높은 시간대에서 곡선이 천장을 뚫는다.
 */
export function flowPeaks(flow: PopulationFlow): readonly number[] {
  return flow.slots.flatMap((slot) =>
    [slot.people, slot.usual].filter((value): value is number => value !== null),
  )
}
