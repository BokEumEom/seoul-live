import { t } from '../../i18n/t'
import {
  formatForecastTemperature,
  forecastHour,
  type HourlyForecast,
} from '../../domain/cityInfo'

interface Props {
  readonly hourly: readonly HourlyForecast[]
}

/**
 * 「14시」·「14:00」. **도메인은 숫자만 주고 글자는 여기서 짓는다** — 예전에는
 * 도메인이 완성된 「14시」를 돌려줘서 영어 화면의 이 줄이 통째로 한국어였다.
 *
 * 시각을 못 뽑았으면 원문을 그대로 적는다. FCST_DT의 형식이 공식 명세에 없어
 * 처음 보는 모양이 올 수 있는데, 짐작한 시각보다 원문이 낫다.
 */
function hourLabel(rawTime: string): string {
  const hour = forecastHour(rawTime)
  return hour === null ? rawTime : t('{시}시', { 시: hour })
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
              {hourLabel(entry.time)}
            </span>
            <span className="text-label-md font-bold text-on-surface">
              {formatForecastTemperature(entry.temperature)}
            </span>
            {/* 모르는 값은 줄을 통째로 뺀다. 「—%」는 0%로 오독된다.
                0은 실제로 확인된 값이라 남긴다 — 「비 안 온다」는 정보다. */}
            {entry.rainChance !== null && (
              <span className="text-label-sm text-primary">
                <span className="sr-only">{t('강수확률')} </span>
                {entry.rainChance}%
              </span>
            )}
            {/* **확률과 다른 값이다** — 「70%」는 올지 말지이고 이건 오면 얼마나
                오는지다. 우산이냐 우비냐가 여기서 갈린다.

                0보다 클 때만 적는다. 실호출 840칸 중 값이 있던 것은 75칸뿐이라
                (나머지는 `-`) 항상 그리면 타일 스물넉 장 중 스물한 장이 「0mm」로
                채워진다. 56px 타일에 그만한 자리가 없다. */}
            {entry.precipitation !== null && entry.precipitation > 0 && (
              <span className="text-label-sm text-on-surface-variant">
                <span className="sr-only">{t('강수량')} </span>
                {t('{양}mm', { 양: entry.precipitation })}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
