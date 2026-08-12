import { congestionRank } from '../../domain/congestion'
import type { Forecast } from '../../domain/types'

const WIDTH = 400
const HEIGHT = 140
const PADDING_Y = 12
const MAX_RANK = 3
/** 시안처럼 여유~붐빔 4단계에 맞춰 가로선을 긋는다. */
const GRID_ROWS = MAX_RANK + 1

interface Props {
  readonly forecasts: readonly Forecast[]
}

function yOf(rank: number): number {
  const usable = HEIGHT - PADDING_Y * 2
  return HEIGHT - PADDING_Y - (rank / MAX_RANK) * usable
}

/** 위로 갈수록 붐빈다. 혼잡도 순위 0~3을 y축으로 그대로 쓴다. */
function toPoint(item: Forecast, index: number, total: number): string {
  const x = (index / (total - 1)) * WIDTH
  return `${x.toFixed(1)},${yOf(congestionRank(item.congestion)).toFixed(1)}`
}

// 처음·중간·끝만 라벨링한다. 예측이 2개뿐이면 중간과 끝이 같은 인덱스가 되므로
// 중복을 제거한다 — 안 하면 같은 key가 두 번 나와 React가 경고한다.
function labelIndexesOf(total: number): readonly number[] {
  return [...new Set([0, Math.floor(total / 2), total - 1])]
}

export function ForecastChart({ forecasts }: Props) {
  if (forecasts.length < 2) {
    return (
      <p className="py-8 text-center text-label-md text-on-surface-variant">
        예측 정보가 아직 없어요.
      </p>
    )
  }

  const points = forecasts.map((item, index) =>
    toPoint(item, index, forecasts.length),
  )

  return (
    // 왼쪽 여백은 축 라벨의 자리다. 라벨을 SVG 안에 넣을 수 없다 —
    // `preserveAspectRatio="none"`이 가로세로를 따로 늘려서 글자가 찌그러진다.
    <div className="relative pl-9">
      {/* 격자선 넷은 무엇을 뜻하는지 말해 주지 않으면 장식이다. 위아래 끝만
          짚어도 사이가 읽힌다 — 넷을 다 적으면 좁은 시트에서 겹친다.
          위치를 `yOf`에서 뽑는 이유: 같은 함수가 격자선을 그리므로 `PADDING_Y`나
          `HEIGHT`가 바뀌어도 라벨이 선을 벗어날 수 없다. 숫자를 여기 박으면
          그 순간 둘이 갈린다. */}
      {[
        { rank: MAX_RANK, label: '붐빔' },
        { rank: 0, label: '여유' },
      ].map(({ rank, label }) => (
        <span
          key={label}
          aria-hidden="true"
          style={{ top: `${(yOf(rank) / HEIGHT) * 100}%` }}
          className="absolute left-0 -translate-y-1/2 text-label-sm text-outline"
        >
          {label}
        </span>
      ))}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-36 w-full"
        role="img"
        aria-label="시간별 혼잡도 예측"
      >
        {/* 격자. 선이 없으면 곡선의 높이가 무엇을 뜻하는지 읽을 수 없다. */}
        {Array.from({ length: GRID_ROWS }, (_, rank) => (
          <line
            key={rank}
            x1={0}
            x2={WIDTH}
            y1={yOf(rank)}
            y2={yOf(rank)}
            stroke="var(--color-outline-variant)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={3}
          strokeDasharray="6 4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between text-label-sm text-on-surface-variant">
        {labelIndexesOf(forecasts.length).map((index) => (
          <span key={index}>{forecasts[index].hour}시</span>
        ))}
      </div>
      {/* 「위로 갈수록 붐빕니다」는 뺐다 — 축 라벨이 같은 말을 자리에서 한다.
          점선의 뜻은 라벨로 대신할 수 없어 남긴다. */}
      <p className="mt-2 text-label-sm text-outline">점선은 예측값이에요</p>
    </div>
  )
}
