import type { PopulationFlow } from './populationFlow'

/**
 * 명소 인구의 **시간 대비** — 1시간 전 · 3시간 전 · 한달 전.
 *
 * 출처가 다른 문이다. 이 앱의 나머지 인구 값은 공식 OpenAPI(`citydata_ppltn`)에서
 * 오는데, 그쪽은 **과거를 안 준다**(요청 인자 여섯에 날짜가 없다). 이 셋은
 * 서울시 실시간 도시데이터 웹(SeoulRtd)의 `/api/ppltn`이 이미 계산해서 주는
 * 값이고, **인증키를 안 쓰므로 하루 1,000회에서 1원도 안 나간다** —
 * CCTV·목록과 같은 상류이고 같은 성질이다(`api/_lib/seoulRtd.ts`).
 *
 * **문서화된 API가 아니다.** 언제든 조용히 깨질 수 있으므로 화면은 이 값이
 * 없어도 성립해야 한다 — 인구 탭의 본체는 여전히 공식 API에서 온다.
 */

/**
 * `ONEHOUR_RATE_UP_DOWN`류의 어휘. **명세가 없는 내부 엔드포인트라 실측이 전부다.**
 * 2026-08-27 실호출 10곳 × 3칸 = 30칸에서 나온 값은 둘뿐이었다.
 *
 * 「변화 없음」에 해당하는 값은 못 봤다. 그런 값이 오면 방향이 `null`이 되어
 * 그 칸이 안 그려진다 — 틀린 화살표를 그리는 것보다 낫다.
 */
export const POPULATION_DIRECTIONS = ['up', 'down'] as const

export type PopulationDirection = (typeof POPULATION_DIRECTIONS)[number]

export function isPopulationDirection(value: string): value is PopulationDirection {
  return (POPULATION_DIRECTIONS as readonly string[]).includes(value)
}

/** 대비 한 칸. */
export interface PopulationChange {
  /** `up`·`down`. 처음 보는 값이면 `null` */
  readonly direction: PopulationDirection | null
  /**
   * 퍼센트의 수. 「7.0%」의 7이다.
   *
   * **부호가 없다.** 서울이 증감을 숫자가 아니라 `UP_DOWN` 필드에 싣는다 —
   * 실호출 30칸이 전부 양수였고 「down 11.4%」처럼 온다. 그래서 이 수만으로는
   * 는 건지 준 건지 알 수 없고, 화면은 반드시 `direction`과 함께 읽어야 한다.
   */
  readonly percent: number | null
}

/**
 * 인구 탭이 SeoulRtd에서 받는 것 전부. **한 번의 조회로 함께 온다** — 둘이
 * 같은 화면에 나란히 서므로 왕복도 캐시도 하나다(`api/ppltn.ts`).
 */
export interface AreaPopulation {
  readonly trend: PopulationTrend
  readonly flow: PopulationFlow
}

export interface PopulationTrend {
  /** ONEHOUR_RATE */
  readonly lastHour: PopulationChange
  /** THREEHOUR_RATE */
  readonly lastThreeHours: PopulationChange
  /** ONEMONTH_RATE */
  readonly lastMonth: PopulationChange
}

/**
 * 한 칸이 말이 되는가. **둘 다 있어야 한다** — 「↑」만으로는 얼마나인지 모르고,
 * 「7.0%」만으로는 는 건지 준 건지 모른다.
 */
export function isReadableChange(change: PopulationChange): boolean {
  return change.direction !== null && change.percent !== null
}

/**
 * 하나라도 읽었는가. 셋 다 못 읽으면 제목만 남은 절이 생긴다 — 이 상류는
 * 조용히 깨지는 종류라 그 길을 열어 두면 안 된다.
 */
export function hasPopulationTrend(trend: PopulationTrend): boolean {
  return [trend.lastHour, trend.lastThreeHours, trend.lastMonth].some(
    isReadableChange,
  )
}
