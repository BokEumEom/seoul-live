import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { recordObservation, type WeekPattern } from '../../domain/pattern'
import { WeeklyPatternCard } from './WeeklyPatternCard'

/** 2026-08-03(월) 14:35 → day 1, bucket 4 */
const MONDAY_14 = new Date(2026, 7, 3, 14, 35)

function withMonday12(): WeekPattern {
  return recordObservation({}, { day: 1, bucket: 4 }, '약간 붐빔')
}

describe('WeeklyPatternCard', () => {
  it('요일 머리글이 월요일부터 일요일까지다', () => {
    render(<WeeklyPatternCard pattern={{}} now={MONDAY_14} />)
    const days = screen.getAllByRole('rowheader').map((cell) => cell.textContent)
    expect(days).toEqual(['월', '화', '수', '목', '금', '토', '일'])
  })

  it('관측한 칸의 값을 읽을 수 있다', () => {
    render(<WeeklyPatternCard pattern={withMonday12()} now={MONDAY_14} />)
    expect(screen.getByText('월요일 12시 약간 붐빔')).toBeInTheDocument()
  })

  // **안 본 칸을 「여유」로 그리면 안 된다.** 관측이 없는 것과 한산한 것은
  // 정반대의 정보인데, 색만 보면 구분되지 않아 소리로도 구분돼야 한다.
  it('관측이 없는 칸은 여유가 아니라 관측 없음이다', () => {
    render(<WeeklyPatternCard pattern={withMonday12()} now={MONDAY_14} />)
    expect(screen.getByText('월요일 15시 관측 없음')).toBeInTheDocument()
    expect(screen.queryByText('월요일 15시 여유')).not.toBeInTheDocument()
  })

  it('오늘 요일을 짚어 준다', () => {
    // **7×8 표에서 어느 줄이 오늘인지 알 수 없었다.** 지금 시간대 열은
    // 짚어 주면서 오늘 행은 안 짚어서, 「지금 이 시각」이 일곱 요일에
    // 걸쳐 있는 것처럼 보였다 — 사용자가 표 안에서 제 위치를 못 찾는다.
    render(<WeeklyPatternCard pattern={{}} now={MONDAY_14} />)

    const monday = screen.getAllByRole('rowheader')[0]
    expect(monday).toHaveTextContent('월')
    expect(monday).toHaveAttribute('aria-current', 'date')

    // 오늘이 아닌 행에는 붙으면 안 된다. 전부에 붙으면 아무것도 안 짚는 것과 같다.
    expect(screen.getAllByRole('rowheader')[1]).not.toHaveAttribute('aria-current')
  })

  it('오늘 이 시각 칸을 하나만 짚는다', () => {
    // 행과 열이 만나는 칸이 「지금 여기」다. 열만 짚으면 일곱 칸이 함께
    // 강조되어 어느 것이 오늘인지 여전히 알 수 없다.
    render(<WeeklyPatternCard pattern={{}} now={MONDAY_14} />)

    const marked = screen
      .getAllByRole('cell')
      .filter((cell) => cell.querySelector('[data-now]') !== null)

    expect(marked).toHaveLength(1)
    // 2026-08-03(월) 14:35 → 월요일 12시 칸(bucket 4)이다.
    expect(marked[0]).toHaveTextContent('월요일 12시')
  })

  it('56칸을 모두 그린다', () => {
    render(<WeeklyPatternCard pattern={{}} now={MONDAY_14} />)
    expect(screen.getAllByText(/관측 없음$/)).toHaveLength(56)
  })

  // 쌓아서 만드는 패턴이라 「얼마나 봤는가」가 곧 신뢰도다. 감추면 한 번 본
  // 칸과 스무 번 본 칸이 같은 무게로 보인다.
  it('쌓인 관측 수를 알린다', () => {
    let pattern = withMonday12()
    pattern = recordObservation(pattern, { day: 2, bucket: 0 }, '여유')
    render(<WeeklyPatternCard pattern={pattern} now={MONDAY_14} />)
    expect(screen.getByText(/2번/)).toBeInTheDocument()
  })

  // 서울 API가 과거를 주지 않아 직접 쌓는다는 사실을 화면이 숨기지 않는다.
  it('하나도 없으면 아직 모으는 중이라고 말한다', () => {
    render(<WeeklyPatternCard pattern={{}} now={MONDAY_14} />)
    expect(screen.getByText(/모으는 중/)).toBeInTheDocument()
  })

  it('지금 시간대의 열을 짚어준다', () => {
    render(<WeeklyPatternCard pattern={{}} now={MONDAY_14} />)
    expect(screen.getByRole('columnheader', { name: /12시/ })).toHaveAttribute(
      'aria-current',
      'time',
    )
  })

  it('지금이 아닌 열에는 표시하지 않는다', () => {
    render(<WeeklyPatternCard pattern={{}} now={MONDAY_14} />)
    expect(screen.getByRole('columnheader', { name: /15시/ })).not.toHaveAttribute('aria-current')
  })
})
