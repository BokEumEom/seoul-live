import { t } from '../../../i18n/t'
import { WeatherCard } from '../../cityinfo/WeatherCard'
import { WeatherWarningBanner } from '../../cityinfo/WeatherWarningBanner'
import { CityInfoBoundary } from '../CityInfoBoundary'

interface Props {
  readonly areaName: string
}

/**
 * 날씨 탭 — 기상특보 · 기온 · 대기질 · 습도/바람/자외선/일출일몰 · 시간대별 예보.
 *
 * 시안(stitch_ui_ux/_6)의 순서 그대로다. **기상특보만 카드 밖에 있다** —
 * 시안에서도 배너가 카드 위에 따로 서고, 그게 「지금 당장」과 「참고」를 가르는
 * 자리다. 나머지는 `WeatherCard` 한 장 안에 든다.
 *
 * 습도·바람·자외선·일출일몰은 **2026-08-25에 붙었다**. 이 자리 주석이 「시안에
 * 있지만 우리 파서가 아직 안 읽는다」였는데, 실호출을 다시 재 보니 전부 오고
 * 있었다(`WEATHER_STTS`의 HUMIDITY·WIND_*·SUNRISE·SUNSET·UV_*).
 */
export function WeatherPanel({ areaName }: Props) {
  return (
    <CityInfoBoundary
      areaName={areaName}
      has={(info) => info.weather !== null}
      empty={t('이 명소에는 지금 제공되는 날씨 정보가 없어요.')}
    >
      {(info) =>
        info.weather === null ? null : (
          <>
            <WeatherWarningBanner warnings={info.weather.warnings} />
            <WeatherCard weather={info.weather} />
          </>
        )
      }
    </CityInfoBoundary>
  )
}
