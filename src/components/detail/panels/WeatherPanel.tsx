import { t } from '../../../i18n/t'
import { WeatherCard } from '../../cityinfo/WeatherCard'
import { CityInfoBoundary } from '../CityInfoBoundary'

interface Props {
  readonly areaName: string
}

/**
 * 날씨 탭 — 기온 · 대기질 · 시간대별 예보.
 *
 * `WeatherCard` 하나가 이 탭의 전부다. 카드를 쪼개지 않는 이유는 시안
 * (stitch_ui_ux/_6)의 순서가 이미 그 카드 안에 있어서다 — 기온·최고최저 →
 * 미세먼지 두 칸 → 통합대기 → 시간대별. 습도·풍속·자외선·일출일몰은 시안에
 * 있지만 우리 파서가 아직 안 읽는다(`seoul_realdata.md`의 미구현 필드).
 */
export function WeatherPanel({ areaName }: Props) {
  return (
    <CityInfoBoundary
      areaName={areaName}
      has={(info) => info.weather !== null}
      empty={t('이 명소에는 지금 제공되는 날씨 정보가 없어요.')}
    >
      {(info) =>
        info.weather === null ? null : <WeatherCard weather={info.weather} />
      }
    </CityInfoBoundary>
  )
}
