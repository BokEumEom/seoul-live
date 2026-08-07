import { airGradeTone, formatTemperature, type Weather } from '../../domain/cityInfo'
import { ToneBadge } from '../common/ToneBadge'

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
          <ToneBadge tone={airGradeTone(grade)} label={grade} />
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
              최고 {formatTemperature(weather.maxTemperature)} · 최저{' '}
              {formatTemperature(weather.minTemperature)}
            </p>
          )}
        </div>
        {weather.airGrade !== '' && (
          <ToneBadge
            tone={airGradeTone(weather.airGrade)}
            label={`통합대기 ${weather.airGrade}`}
          />
        )}
      </div>

      {weather.precipitationMessage !== '' && (
        <p className="mt-3 text-body-md leading-6 text-on-surface">
          {weather.precipitationMessage}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <DustTile label="미세먼지" value={weather.pm10} grade={weather.pm10Grade} />
        <DustTile label="초미세먼지" value={weather.pm25} grade={weather.pm25Grade} />
      </div>

      {weather.airMessage !== '' && (
        <p className="mt-3 text-label-md leading-5 text-on-surface-variant">
          {weather.airMessage}
        </p>
      )}

      {weather.updatedAt !== '' && (
        <p className="mt-3 text-label-sm text-outline">기준 {weather.updatedAt}</p>
      )}
    </section>
  )
}
