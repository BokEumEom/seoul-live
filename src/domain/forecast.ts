import type { CongestionLevel, Forecast } from './types'

/**
 * 예측에서 처음으로 '여유'가 되는 시각(0~23)을 찾는다. 없으면 null.
 *
 * `isUncrowded`(여유+보통)보다 좁게 '여유'만 센다. 화면 문구가 "N시엔 여유 예상"
 * 이라서 보통까지 포함하면 말과 값이 어긋난다.
 *
 * 서울 API는 예측을 시간 오름차순으로 준다. 그 순서가 곧 "가장 이른 시각"이다.
 */
export function findQuietTime(
  current: CongestionLevel,
  forecasts: readonly Forecast[],
): number | null {
  if (current === '여유') return null

  const quiet = forecasts.find((item) => item.congestion === '여유')
  // hour가 0(자정)일 수 있어서 `??`를 쓴다. `||`면 0시가 null이 된다.
  return quiet?.hour ?? null
}

/**
 * 막대 하나가 나타내는 인원.
 *
 * 서울 API는 인원을 **구간**으로 준다(`40,000~42,000명`). 화면 글은 구간 그대로
 * 말하지만 막대는 높이가 하나여야 한다 — 가운데가 그 구간을 대표하는, 어느
 * 쪽으로도 치우치지 않은 유일한 값이다. 최댓값을 쓰면 모든 막대가 위로 부풀고,
 * 최솟값을 쓰면 아래로 눌린다.
 *
 * 정수로 내리지 않는다. 화면에 적는 값이 아니라 높이를 정하는 값이라 소수여도
 * 되고, 내리면 막대끼리 견줄 때 1명씩 어긋난다.
 */
export function forecastPopulation(item: {
  readonly populationMin: number
  readonly populationMax: number
}): number {
  return (item.populationMin + item.populationMax) / 2
}

/**
 * 앞으로 가장 붐빌 시각. 예보가 없으면 null.
 *
 * **혼잡도 4단계가 아니라 인원으로 고른다.** 단계로 고르면 「붐빔」이 연달아
 * 있을 때 첫 번째가 뽑혀 정점이 아니라 **정점 구간의 시작**을 가리킨다.
 * 인원이 같으면 이른 쪽을 남긴다 — 「언제까지 피해야 하나」보다 「언제부터
 * 붐비나」가 행동으로 이어진다.
 */
export function peakForecast(forecasts: readonly Forecast[]): Forecast | null {
  return forecasts.reduce<Forecast | null>(
    (best, item) =>
      best === null || forecastPopulation(item) > forecastPopulation(best) ? item : best,
    null,
  )
}

/**
 * 축에서 「보기 좋은」 눈금 폭의 후보. 1·2·5만 쓰는 흔한 규칙 대신 1.5와 3을
 * 넣었다 — 샘플(서울 인파레이더)의 축이 0/1.5만/3만/4.5만/6만이라 그쪽도 이
 * 폭을 쓴다. 1·2·5만으로는 46,000에서 눈금 2만, 축 8만이 되어 위가 텅 빈다.
 */
const NICE_STEPS: readonly number[] = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

/** 격자선 개수. 샘플과 같다. */
export const AXIS_TICKS = 4

/**
 * 가장 높은 막대를 담으면서 눈금 넷으로 딱 떨어지는 축 최댓값.
 *
 * 막대가 천장에 닿으면 잘린 것처럼 보이므로 언제나 `peak`보다 크다.
 * `peak`가 0이어도(전 시간대 0인 응답) 0을 돌려주지 않는다 — 높이 계산이
 * 0으로 나눠 NaN이 되고 SVG가 통째로 사라진다.
 */
export function niceAxisMax(peak: number): number {
  const rough = Math.max(peak, 1) / AXIS_TICKS
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step =
    (NICE_STEPS.find((candidate) => candidate * magnitude >= rough) ?? 10) * magnitude
  return step * AXIS_TICKS
}

