import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { applyLanguage } from '../../i18n/t'
import type { PopulationTrend } from '../../domain/populationTrend'
import { PopulationTrendCard } from './PopulationTrendCard'

function trend(overrides: Partial<PopulationTrend> = {}): PopulationTrend {
  return {
    lastHour: { direction: 'up', percent: 7 },
    lastThreeHours: { direction: 'up', percent: 30.1 },
    lastMonth: { direction: 'down', percent: 15.3 },
    ...overrides,
  }
}

const UNREAD = { direction: null, percent: null } as const

afterEach(() => {
  applyLanguage('ko')
})

describe('PopulationTrendCard', () => {
  it('세 칸을 값과 함께 보여준다', () => {
    render(<PopulationTrendCard trend={trend()} />)

    expect(screen.getByText('1시간 전')).toBeInTheDocument()
    expect(screen.getByText('3시간 전')).toBeInTheDocument()
    expect(screen.getByText('한달 전')).toBeInTheDocument()
    expect(screen.getByText('7%')).toBeInTheDocument()
    expect(screen.getByText('30.1%')).toBeInTheDocument()
    expect(screen.getByText('15.3%')).toBeInTheDocument()
  })

  /**
   * **화살표는 그림이라 소리 채널에 안 실린다**(`Icon`은 언제나 `aria-hidden`).
   * 방향을 그림에만 맡기면 스크린리더 사용자에게는 「1시간 전 7%」가 되어 는
   * 건지 준 건지 알 수 없다 — 색으로도 방향을 말하지 않기로 했으므로(아래 테스트)
   * 이 낱말이 유일한 두 번째 채널이다.
   */
  it('증감을 낱말로도 말한다', () => {
    render(<PopulationTrendCard trend={trend()} />)
    const cells = screen.getAllByRole('listitem')

    expect(within(cells[0]).getByText('증가')).toBeInTheDocument()
    expect(within(cells[2]).getByText('감소')).toBeInTheDocument()
  })

  it('증가와 감소가 다른 그림이다', () => {
    const { container } = render(
      <PopulationTrendCard
        trend={trend({ lastThreeHours: { direction: 'down', percent: 5 } })}
      />,
    )
    const paths = [...container.querySelectorAll('svg path')].map((p) => p.getAttribute('d'))

    expect(new Set(paths).size).toBe(2)
  })

  /**
   * **한쪽만으로는 아무 말도 못 한다.** 「↑」만 그리면 얼마나인지 모르고,
   * 「7%」만 그리면 는 건지 준 건지 모른다. 도메인이 그 판정을 갖는다
   * (`isReadableChange`).
   */
  it('방향이나 값 한쪽이 없으면 그 칸을 안 만든다', () => {
    render(
      <PopulationTrendCard
        trend={trend({
          lastThreeHours: { direction: 'up', percent: null },
          lastMonth: { direction: null, percent: 15.3 },
        })}
      />,
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByText('3시간 전')).toBeNull()
    expect(screen.queryByText('한달 전')).toBeNull()
  })

  // 상류가 조용히 깨지는 종류라(문서화된 API가 아니다) 제목만 남은 절이
  // 생기는 길을 열어 두면 안 된다.
  it('셋 다 못 읽었으면 아무것도 그리지 않는다', () => {
    const { container } = render(
      <PopulationTrendCard
        trend={{ lastHour: UNREAD, lastThreeHours: UNREAD, lastMonth: UNREAD }}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  /**
   * **증감에 혼잡도 톤을 얹지 않는다.** 늘어난 것이 곧 나쁜 것이 아니다 —
   * 여유에서 여유로 7% 늘어도 여전히 여유다. 톤을 칠하면 이 앱의 4단계가
   * 말하지 않은 판정을 색이 대신 말하게 된다.
   */
  it('혼잡도 색을 쓰지 않는다', () => {
    const { container } = render(<PopulationTrendCard trend={trend()} />)

    expect(container.innerHTML).not.toMatch(/\b(?:text|bg)-(?:calm|normal|busy|crowded)\b/)
  })

  it('영어 화면에서 낱말이 영어다', () => {
    applyLanguage('en')
    render(<PopulationTrendCard trend={trend()} />)

    expect(screen.getByText('1 hour ago')).toBeInTheDocument()
    expect(screen.getByText('A month ago')).toBeInTheDocument()
    expect(screen.getAllByText('increase').length).toBeGreaterThan(0)
  })
})
