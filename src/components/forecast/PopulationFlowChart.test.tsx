import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { applyLanguage } from '../../i18n/t'
import type { PopulationFlow, PopulationFlowSlot } from '../../domain/populationFlow'
import { PopulationFlowChart } from './PopulationFlowChart'

function slot(overrides: Partial<PopulationFlowSlot> = {}): PopulationFlowSlot {
  return { hour: 10, people: 10_000, usual: 8_000, congestion: '보통', ...overrides }
}

/** 실응답 모양대로 25칸, 「지금」은 한가운데다. */
function flow(overrides: Partial<PopulationFlow> = {}): PopulationFlow {
  return {
    slots: Array.from({ length: 25 }, (_, index) =>
      slot({ hour: (index + 1) % 24, people: 1_000 * (index + 1), usual: 900 * (index + 1) }),
    ),
    nowIndex: 12,
    ...overrides,
  }
}

const bars = (container: HTMLElement) => [...container.querySelectorAll('[data-bar]')]

afterEach(() => {
  applyLanguage('ko')
})

describe('PopulationFlowChart', () => {
  it('칸마다 막대를 하나씩 그린다', () => {
    const { container } = render(<PopulationFlowChart flow={flow()} />)

    expect(bars(container)).toHaveLength(25)
    expect(screen.getAllByRole('listitem')).toHaveLength(25)
  })

  /**
   * **높이가 인원이다.** 축 최댓값에 대한 비율이라, 가장 큰 칸이 100%에 닿아야
   * 그래프가 세로 공간을 다 쓴다. `niceAxisMax`가 올림을 하므로 정확히 100은
   * 아니고, 순서가 지켜지는지와 최댓값이 가장 높은지를 본다.
   */
  it('인원이 많은 칸이 더 높다', () => {
    const { container } = render(<PopulationFlowChart flow={flow()} />)
    const heights = bars(container).map((bar) => Number(bar.getAttribute('data-height')))

    expect(heights[24]).toBeGreaterThan(heights[0])
    expect(Math.max(...heights)).toBe(heights[24])
  })

  /**
   * **축은 평소 곡선까지 함께 본다.** 인원만으로 정하면 평소가 오늘보다 높은
   * 칸에서 곡선이 천장을 뚫는다 — 새벽 칸이 실제로 그렇다.
   */
  it('평소가 오늘보다 높아도 곡선이 천장을 안 넘는다', () => {
    const { container } = render(
      <PopulationFlowChart
        flow={{
          slots: [slot({ people: 100, usual: 900 }), slot({ people: 200, usual: 950 })],
          nowIndex: 0,
        }}
      />,
    )
    const points = container.querySelector('polyline')?.getAttribute('points') ?? ''
    const ys = points.split(' ').map((pair) => Number(pair.split(',')[1]))

    // y는 위가 0이고 아래가 100이다. 음수면 상자 위로 삐져나간 것이다.
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
  })

  /**
   * **곡선이 막대 가운데를 지나야 한다.** x가 칸 번호 그대로면 선이 왼쪽으로
   * 반 칸 밀려서, 봉우리가 실제보다 한 시간 이른 것처럼 보인다 — 눈으로는
   * 「대충 맞는」 그래프라 알아채기 어렵다.
   */
  it('곡선의 x가 칸의 가운데다', () => {
    const { container } = render(
      <PopulationFlowChart
        flow={{ slots: [slot(), slot(), slot()], nowIndex: null }}
      />,
    )
    const xs = (container.querySelector('polyline')?.getAttribute('points') ?? '')
      .split(' ')
      .map((pair) => Number(pair.split(',')[0]))

    expect(xs).toEqual([0.5, 1.5, 2.5])
  })

  /**
   * **아직 안 일어난 일을 눈으로도 가른다.** 막대 색은 혼잡도가 쓰고 있어서
   * 다른 채널이 필요하다. 바탕은 `nowIndex` **다음** 칸부터다 — 「지금」까지는
   * 실측이다.
   */
  it('예보 구간에만 바탕을 깐다', () => {
    const { container } = render(
      <PopulationFlowChart
        flow={{ slots: Array.from({ length: 4 }, () => slot()), nowIndex: 1 }}
      />,
    )
    const tint = container.querySelector('div[aria-hidden="true"].absolute')

    expect(tint).not.toBeNull()
    // 「지금」이 1번 칸이니 바탕은 2번 칸부터 — 네 칸 중 절반 지점이다.
    // jsdom이 `50.00%`를 `50%`로 정규화한다.
    expect((tint as HTMLElement).style.left).toBe('50%')
  })

  it('「지금」이 없으면 예보 바탕도 없다', () => {
    const { container } = render(
      <PopulationFlowChart flow={{ slots: [slot(), slot()], nowIndex: null }} />,
    )

    expect(container.querySelector('div[aria-hidden="true"].absolute')).toBeNull()
  })

  it('평소 곡선을 점선으로 그린다', () => {
    const { container } = render(<PopulationFlowChart flow={flow()} />)
    const line = container.querySelector('polyline')

    expect(line).not.toBeNull()
    expect(line?.getAttribute('stroke-dasharray')).not.toBeNull()
    expect(screen.getByText(/최근 4주 같은 요일의 평균/)).toBeInTheDocument()
  })

  // 점선은 그림이라 혼자서는 아무 뜻이 없다. 그리면 반드시 무엇인지 적는다.
  it('평소 값이 없으면 곡선도 설명도 없다', () => {
    const { container } = render(
      <PopulationFlowChart
        flow={{ slots: flow().slots.map((s) => ({ ...s, usual: null })), nowIndex: 12 }}
      />,
    )

    expect(container.querySelector('polyline')).toBeNull()
    expect(screen.queryByText(/최근 4주/)).toBeNull()
  })

  /**
   * **없는 값을 가로질러 잇지 않는다.** 이으면 관측이 없는 시간대에 곡선이
   * 그럴듯하게 지나가서, 그래프가 갖고 있지 않은 값을 말하게 된다.
   */
  it('평소 값이 빈 칸에서 곡선을 끊는다', () => {
    const { container } = render(
      <PopulationFlowChart
        flow={{
          slots: [slot(), slot(), slot({ usual: null }), slot(), slot()],
          nowIndex: 0,
        }}
      />,
    )

    expect(container.querySelectorAll('polyline')).toHaveLength(2)
  })

  it('「지금」을 글자와 의미 채널로 함께 짚는다', () => {
    render(<PopulationFlowChart flow={flow()} />)
    const now = screen.getAllByRole('listitem')[12]

    expect(now).toHaveAttribute('aria-current', 'time')
    expect(screen.getAllByText('지금').length).toBeGreaterThan(0)
  })

  /**
   * **소리 채널에 평소가 함께 실린다.** 곡선은 그림이라 스크린리더에 안 나가는데,
   * 이 그래프의 값은 「오늘 대 평소」의 견줌에 있다 — 빠지면 그 절반이 사라진다.
   */
  it('막대마다 오늘과 평소를 함께 읽어 준다', () => {
    render(
      <PopulationFlowChart
        flow={{ slots: [slot({ hour: 14, people: 41_000, usual: 38_000 })], nowIndex: null }}
      />,
    )

    expect(screen.getByText(/14시 보통 약 41,000명, 평소 약 38,000명/)).toBeInTheDocument()
  })

  // 예보 구간은 아직 안 일어난 일이다. 막대 색은 혼잡도가 쓰고 있어서 소리
  // 채널에서라도 갈려야 한다.
  it('예보 칸이라고 말한다', () => {
    render(
      <PopulationFlowChart
        flow={{ slots: [slot({ hour: 1 }), slot({ hour: 2 })], nowIndex: 0 }}
      />,
    )

    expect(screen.getByText(/2시 보통 약 10,000명, 평소 약 8,000명, 예상/)).toBeInTheDocument()
    expect(screen.queryByText(/1시 보통 약 10,000명, 평소 약 8,000명, 예상/)).toBeNull()
  })

  // 틀린 색은 없는 색보다 나쁘다 — 처음 보는 혼잡도에는 톤을 안 쓴다.
  it('혼잡도를 모르면 톤 색을 안 쓴다', () => {
    const { container } = render(
      <PopulationFlowChart
        flow={{ slots: [slot({ congestion: null }), slot()], nowIndex: null }}
      />,
    )

    expect(bars(container)[0].className).not.toMatch(/bg-heat-/)
    expect(bars(container)[1].className).toMatch(/bg-heat-/)
  })

  it('영어 화면에서 소리 값도 영어다', () => {
    applyLanguage('en')
    render(
      <PopulationFlowChart
        flow={{ slots: [slot({ hour: 14, people: 41_000, usual: 38_000 })], nowIndex: null }}
      />,
    )

    expect(screen.getByText(/about 41,000, usually about 38,000/)).toBeInTheDocument()
  })
})
