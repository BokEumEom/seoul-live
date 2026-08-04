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
