import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AreaSnapshot, CongestionLevel, Forecast } from '../../domain/types'
import { ForecastChart } from './ForecastChart'

function forecast(
  hour: number,
  congestion: CongestionLevel,
  population: number,
): Forecast {
  return {
    time: `2026-08-13 ${String(hour).padStart(2, '0')}:00`,
    hour,
    congestion,
    populationMin: population - 1000,
    populationMax: population + 1000,
  }
}

function snapshot(overrides: Partial<AreaSnapshot> = {}): AreaSnapshot {
  return {
    code: 'POI009',
    name: '광화문·덕수궁',
    congestion: '보통',
    message: '조금 붐벼요.',
    populationMin: 39_000,
    populationMax: 41_000,
    observedAt: '2026-08-13 14:00',
    observedAtLabel: '14:00',
    forecasts: [
      forecast(15, '붐빔', 45_000),
      forecast(16, '약간 붐빔', 41_000),
      forecast(17, '보통', 30_000),
      forecast(18, '여유', 12_000),
    ],
    forecastProvided: null,
    composition: null,
    replaced: null,
    ...overrides,
  }
}

/** 막대 하나하나. 값이 소리로도 나가야 해서 각자 이름을 갖는다. */
function bars(): readonly HTMLElement[] {
  return screen.getAllByRole('listitem')
}

describe('ForecastChart', () => {
  it('지금과 앞으로의 시각을 모두 막대로 세운다', () => {
    // 샘플(서울 인파레이더)은 과거·현재·미래를 한 줄에 놓는다. 우리는 과거를
    // 가질 수 없지만(서울 API 요청 인자에 날짜가 없다) **지금은 가지고 있다** —
    // 예보만 그리면 사용자는 「지금 대비 앞으로」를 눈으로 못 견준다.
    render(<ForecastChart snapshot={snapshot()} />)

    expect(bars()).toHaveLength(5) // 지금 + 예보 4
  })

  it('지금 막대를 따로 짚어 준다', () => {
    // 25개 중 어느 것이 지금인지 모르면 그래프가 「앞으로」를 말하는지
    // 「하루 전체」를 말하는지 알 수 없다.
    render(<ForecastChart snapshot={snapshot()} />)

    // 의미 채널과 눈에 보이는 채널 둘 다 짚어야 한다. 테두리만 두면
    // 스크린리더에게는 25개 막대가 구별되지 않는다.
    expect(bars()[0]).toHaveAttribute('aria-current', 'time')
    expect(within(bars()[0]).getByText(/^지금/)).toBeInTheDocument()
    expect(bars()[1]).not.toHaveAttribute('aria-current')
  })

  it('막대 높이가 인원을 따른다', () => {
    // **이 테스트가 이 컴포넌트의 존재 이유다.** 예전 차트는 혼잡도 4단계를
    // y축에 그대로 썼는데, 그러면 40,000명과 46,000명이 같은 높이가 되어
    // 「어느 시각이 정점인가」를 그래프가 못 말했다.
    render(<ForecastChart snapshot={snapshot()} />)
    const heights = bars().map((bar) =>
      Number(bar.querySelector('[data-bar]')?.getAttribute('data-height')),
    )

    // 지금 40,000 → 45,000 → 41,000 → 30,000 → 12,000
    expect(heights[1]).toBeGreaterThan(heights[0]) // 15시가 지금보다 붐빈다
    expect(heights[1]).toBeGreaterThan(heights[2])
    expect(heights[3]).toBeGreaterThan(heights[4])
  })

  it('막대 색이 그 시각의 혼잡도를 따른다', () => {
    // 높이는 인원, 색은 단계다. 둘이 같은 것을 말하면 색이 낭비되고, 실제로
    // 어긋나는 경우가 있다 — 명소마다 「붐빔」의 절대 인원이 다르기 때문이다.
    render(<ForecastChart snapshot={snapshot()} />)
    const fill = (index: number): string =>
      bars()[index].querySelector('[data-bar]')?.className ?? ''

    expect(fill(1)).toContain('bg-heat-crowded') // 붐빔
    expect(fill(4)).toContain('bg-heat-calm') // 여유
  })

  it('값을 색만으로 전하지 않는다', () => {
    // 색각 이상·스크린리더 사용자에게 막대 그래프는 통째로 빈칸이다.
    // 각 막대가 제 시각·인원·단계를 글로도 들고 있어야 한다.
    render(<ForecastChart snapshot={snapshot()} />)

    expect(within(bars()[1]).getByText(/15시/)).toBeInTheDocument()
    expect(within(bars()[1]).getByText(/붐빔/)).toBeInTheDocument()
    expect(within(bars()[1]).getByText(/44,000~46,000명/)).toBeInTheDocument()
  })

  it('세로축 눈금을 적는다', () => {
    // 막대 높이가 무엇을 뜻하는지는 눈금이 없으면 읽을 수 없다.
    // 45,000이 정점이면 축은 60,000(1.5만 눈금 넷)이다.
    render(<ForecastChart snapshot={snapshot()} />)

    expect(screen.getByText('6만')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('가장 붐빌 시각을 글로도 말한다', () => {
    // 샘플에도 그래프 위에 이 한 줄이 있다. 그래프를 볼 수 없는 사용자에게는
    // 이 문장이 그래프를 **대신**하고, 볼 수 있는 사용자에게는 결론을 먼저 준다.
    render(<ForecastChart snapshot={snapshot()} />)

    // 문장 안에서 시각을 찾는다. `getByText(/15시/)`로는 막대의 낭독용 글자와
    // 가로축 글자까지 걸려 「여럿 찾음」으로 죽는다 — 잡을 것은 이 한 문장이다.
    const summary = screen.getByText(/가장 붐빌/)
    expect(summary).toHaveTextContent('15시')
    expect(summary).toHaveTextContent('붐빔')
  })

  it('예보가 없으면 지금만 세우지 않고 그 사실을 말한다', () => {
    // 막대 하나짜리 그래프는 그래프가 아니다. 「앞으로」를 말하는 자리인데
    // 앞이 없으면 빈 축만 남아 고장으로 보인다.
    render(<ForecastChart snapshot={snapshot({ forecasts: [] })} />)

    expect(screen.getByText(/예측 정보가 아직 없어요/)).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  // **「아직」과 「안 준다」는 다른 말이다.** 앞쪽은 잠시 뒤 다시 보면 있고
  // 뒤쪽은 기다려도 안 온다 — `FCST_YN`이 그걸 가른다.
  it('서울이 예측을 안 주는 명소는 그렇게 말한다', () => {
    render(
      <ForecastChart snapshot={snapshot({ forecasts: [], forecastProvided: false })} />,
    )

    expect(screen.getByText(/제공하지 않아요/)).toBeInTheDocument()
    expect(screen.queryByText(/아직 없어요/)).toBeNull()
  })

  // `FCST_YN`이 없거나 처음 보는 값이면 「모른다」다. 모르는 것을 「안 준다」로
  // 단정하면, 잠시 비었을 뿐인 명소에 「기다려도 안 온다」고 말하게 된다.
  it('제공 여부를 모르면 예전 문구로 떨어진다', () => {
    render(
      <ForecastChart snapshot={snapshot({ forecasts: [], forecastProvided: null })} />,
    )

    expect(screen.getByText(/아직 없어요/)).toBeInTheDocument()
  })
})
