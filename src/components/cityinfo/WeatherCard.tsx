import { t } from '../../i18n/t'
import { airGradeTone, formatTemperature, type Weather } from '../../domain/cityInfo'
import { ToneBadge } from '../common/ToneBadge'
import { HourlyWeather } from './HourlyWeather'
import { WeatherStats } from './WeatherStats'

interface DustProps {
  readonly label: string
  readonly value: number | null
  readonly grade: string
}

function DustTile({ label, value, grade }: DustProps) {
  return (
    <div className="rounded-card bg-surface-container-low p-3">
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="mt-1 text-headline-sm text-on-surface">
        {value === null ? '—' : value}
        <span className="ml-1 text-label-sm text-on-surface-variant">㎍/㎥</span>
      </p>
      {grade !== '' && (
        <div className="mt-2">
          <ToneBadge tone={airGradeTone(grade)} label={t(grade)} />
        </div>
      )}
    </div>
  )
}

interface Props {
  readonly weather: Weather
}

export function WeatherCard({ weather }: Props) {
  const hasRange = weather.maxTemperature !== null || weather.minTemperature !== null

  return (
    <section className="mx-4 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-display-lg text-on-surface">
            {formatTemperature(weather.temperature)}
          </p>
          {hasRange && (
            <p className="mt-1 text-label-md text-on-surface-variant">
              {t('최고 {높} · 최저 {낮}', {
                높: formatTemperature(weather.maxTemperature),
                낮: formatTemperature(weather.minTemperature),
              })}
            </p>
          )}
        </div>
        {weather.airGrade !== '' && (
          <ToneBadge
            tone={airGradeTone(weather.airGrade)}
            label={t('통합대기 {등급}', { 등급: t(weather.airGrade) })}
          />
        )}
      </div>

      {weather.precipitationMessage !== '' && (
        <p className="mt-3 text-body-md leading-6 text-on-surface">
          {weather.precipitationMessage}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <DustTile label={t("미세먼지")} value={weather.pm10} grade={weather.pm10Grade} />
        <DustTile label={t("초미세먼지")} value={weather.pm25} grade={weather.pm25Grade} />
      </div>

      {/* 통합대기환경지수의 **수치**. 등급 배지는 위에 이미 있어 여기서는
          숫자와 결정물질만 보탠다 — 시안 `_6`의 「통합대기지수 (CAI)」 줄이다.
          결정물질은 실응답에서 빈 문자열로도 오므로 따로 빠진다. */}
      {weather.airIndexValue !== null && (
        <p className="mt-3 text-label-md text-on-surface-variant">
          {t('통합대기지수 {값}', { 값: weather.airIndexValue })}
          {weather.airIndexMain !== '' && ` · ${t(weather.airIndexMain)}`}
        </p>
      )}

      {weather.airMessage !== '' && (
        <p className="mt-3 text-label-md leading-5 text-on-surface-variant">
          {weather.airMessage}
        </p>
      )}

      <WeatherStats weather={weather} />

      {/* 자외선 안내는 기상청의 자유 문장이라 옮기지 않는다. 격자 바로 아래에
          두는 이유는 그 문장이 자외선 칸을 풀어 쓴 것이기 때문이다. */}
      {weather.uvMessage !== '' && (
        <p className="mt-3 text-label-md leading-5 text-on-surface-variant">
          {weather.uvMessage}
        </p>
      )}

      {/* 대기질 다음, 기준 시각 앞이다 — detail_page.png의 순서이고, 「지금」을
          말하는 값들이 끝난 뒤에 「앞으로」가 온다. 예보가 없으면 통째로 빠진다. */}
      <HourlyWeather hourly={weather.hourly} />

      {weather.updatedAt !== '' && (
        <p className="mt-3 text-label-sm text-outline">{t('기준 {시각}', { 시각: weather.updatedAt })}</p>
      )}
    </section>
  )
}
