import {
  formatForecastTemperature,
  forecastHourLabel,
  type HourlyForecast,
} from '../../domain/cityInfo'

interface Props {
  readonly hourly: readonly HourlyForecast[]
}

/**
 * 시간대별 예보 한 줄. `citydata`의 FCST24HOURS를 그대로 그린다.
 *
 * **자르지 않고 가로로 스크롤한다.** 상위 다섯 개만 보여주는 주차장·따릉이와
 * 다른 이유는 이 목록이 순위가 아니라 시간축이기 때문이다 — 「7시간 뒤에 비가
 * 오는가」를 묻는 사용자에게 앞 다섯 칸만 주면 답이 안 나온다. 좁은 화면은
 * 가로 스크롤이 받는다.
 */
export function HourlyWeather({ hourly }: Props) {
  if (hourly.length === 0) {
    return null
  }

  return (
    // -mx-4로 카드 패딩 밖까지 넓혀 타일이 카드 가장자리까지 흐르게 한다.
    // px-4가 그 자리를 안쪽 여백으로 되돌려 첫 타일이 글자와 같은 선에서 선다.
    <div className="-mx-4 mt-4 overflow-x-auto px-4">
      {/* role="list"를 명시하는 이유: preflight의 list-style:none이 WebKit에서
          목록 시맨틱을 지운다. 토스 iOS 웹뷰가 WebKit이다(PopulationCard와 같다). */}
      <ul role="list" className="flex gap-2">
        {hourly.map((entry) => (
          <li
            key={entry.time}
            className="flex w-14 shrink-0 flex-col items-center gap-1 rounded-card bg-surface-container-low py-2"
          >
            <span className="text-label-sm text-on-surface-variant">
              {forecastHourLabel(entry.time)}
            </span>
            <span className="text-label-md font-bold text-on-surface">
              {formatForecastTemperature(entry.temperature)}
            </span>
            {/* 모르는 값은 줄을 통째로 뺀다. 「—%」는 0%로 오독된다.
                0은 실제로 확인된 값이라 남긴다 — 「비 안 온다」는 정보다. */}
            {entry.rainChance !== null && (
              <span className="text-label-sm text-primary">
                <span className="sr-only">강수확률 </span>
                {entry.rainChance}%
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
