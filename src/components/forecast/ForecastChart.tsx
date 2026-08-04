import { congestionRank } from '../../domain/congestion'
import type { Forecast } from '../../domain/types'

const WIDTH = 400
const HEIGHT = 120
const PADDING = 8
const MAX_RANK = 3

interface Props {
  readonly forecasts: readonly Forecast[]
}

/** 위로 갈수록 붐빈다. 혼잡도 순위 0~3을 y축으로 그대로 쓴다. */
function toPoint(item: Forecast, index: number, total: number): string {
  const x = (index / (total - 1)) * WIDTH
  const usable = HEIGHT - PADDING * 2
  const y = HEIGHT - PADDING - (congestionRank(item.congestion) / MAX_RANK) * usable
  return `${x.toFixed(1)},${y.toFixed(1)}`
}

// 처음·중간·끝만 라벨링한다. 예측이 2개뿐이면 중간과 끝이 같은 인덱스가 되므로
// 중복을 제거한다 — 안 하면 같은 key가 두 번 나와 React가 경고한다.
function labelIndexesOf(total: number): readonly number[] {
  return [...new Set([0, Math.floor(total / 2), total - 1])]
}

export function ForecastChart({ forecasts }: Props) {
  if (forecasts.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-on-surface-variant">
        예측 정보가 아직 없어요.
      </p>
    )
  }

  const points = forecasts.map((item, index) =>
    toPoint(item, index, forecasts.length),
  )

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-32 w-full"
        role="img"
        aria-label="시간별 혼잡도 예측"
      >
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={3}
          strokeDasharray="6 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-on-surface-variant">
        {labelIndexesOf(forecasts.length).map((index) => (
          <span key={index}>{forecasts[index].hour}시</span>
        ))}
      </div>
    </div>
  )
}
