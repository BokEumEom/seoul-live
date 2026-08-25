import { t } from '../../i18n/t'
import { uvGradeTone, windDirectionLabel, type Weather } from '../../domain/cityInfo'
import { toneTextClass } from '../common/toneClass'

interface TileProps {
  readonly label: string
  readonly value: string
  readonly caption?: string
  readonly valueClassName?: string
}

function StatTile({ label, value, caption, valueClassName }: TileProps) {
  return (
    <div className="rounded-card bg-surface-container-low p-3">
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className={`mt-1 text-title-md ${valueClassName ?? 'text-on-surface'}`}>{value}</p>
      {caption !== undefined && caption !== '' && (
        <p className="mt-0.5 text-label-sm text-on-surface-variant">{caption}</p>
      )}
    </div>
  )
}

interface Props {
  readonly weather: Weather
}

/**
 * 습도 · 바람 · 자외선 · 일출일몰. 시안 `stitch_ui_ux/_6`의 2×2 격자다.
 *
 * **칸마다 따로 빠진다.** 서울 API는 필드 단위로 비워 보내므로 넷을 한 덩어리로
 * 묶으면 습도 하나 때문에 바람까지 사라진다. 넷 다 없으면 절 자체가 안 그려진다.
 *
 * **자외선에만 색이 붙는다.** 습도·풍속·일출은 좋고 나쁨의 눈금이 아니라 그냥
 * 수치다 — 톤을 붙이면 「습도 80%가 나쁜 것」이라고 앱이 단정하게 된다.
 * 자외선지수는 기상청이 이미 단계를 매겨 보내므로 그 판단을 옮기는 것뿐이다.
 */
export function WeatherStats({ weather }: Props) {
  const direction = windDirectionLabel(weather.windDirection)
  const hasWind = weather.windSpeed !== null || weather.windDirection !== ''
  const hasSun = weather.sunrise !== '' || weather.sunset !== ''
  const hasUv = weather.uvIndex !== null || weather.uvGrade !== ''

  if (weather.humidity === null && !hasWind && !hasSun && !hasUv) {
    return null
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      {weather.humidity !== null && (
        <StatTile label={t('습도')} value={`${weather.humidity}%`} />
      )}

      {hasWind && (
        <StatTile
          label={t('바람')}
          value={
            weather.windSpeed === null
              ? '—'
              : t('{속도}m/s', { 속도: weather.windSpeed })
          }
          // 모르는 약자는 원문을 그대로 적는다 — 지어낸 방위보다 `SSE`가 낫다.
          caption={direction === null ? weather.windDirection : t(direction)}
        />
      )}

      {hasUv && (
        <StatTile
          label={t('자외선지수')}
          value={weather.uvIndex === null ? '—' : String(weather.uvIndex)}
          caption={weather.uvGrade === '' ? '' : t(weather.uvGrade)}
          valueClassName={toneTextClass(uvGradeTone(weather.uvGrade))}
        />
      )}

      {hasSun && (
        // 일출과 일몰은 한 칸에 함께 든다. 따로 두면 2×2가 2×3이 되고, 둘은
        // 언제나 짝으로 읽히는 값이라 나눌 이유가 없다.
        <StatTile
          label={t('일출 · 일몰')}
          value={`${weather.sunrise || '—'} · ${weather.sunset || '—'}`}
        />
      )}
    </div>
  )
}
