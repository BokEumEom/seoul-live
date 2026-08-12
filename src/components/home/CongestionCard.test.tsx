import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AreaSnapshot } from '../../domain/types'
import { CongestionCard } from './CongestionCard'

function snapshot(overrides: Partial<AreaSnapshot> = {}): AreaSnapshot {
  return {
    code: 'POI014',
    name: '강남역',
    congestion: '약간 붐빔',
    message: '조금 붐벼요.',
    populationMin: 74_000,
    populationMax: 76_000,
    observedAt: '2026-08-07 11:00',
    observedAtLabel: '11:00',
    forecasts: [],
    composition: null,
    replaced: null,
    ...overrides,
  }
}

describe('CongestionCard — 대체값 표시', () => {
  it('대체값이면 수치가 실측이 아니라고 알린다', () => {
    render(<CongestionCard snapshot={snapshot({ replaced: true })} />)
    expect(screen.getByText(/대체값/)).toBeInTheDocument()
  })

  it('실측이면 아무것도 덧붙이지 않는다', () => {
    render(<CongestionCard snapshot={snapshot({ replaced: false })} />)
    expect(screen.queryByText(/대체값/)).not.toBeInTheDocument()
  })

  // **모름을 「대체값」이라고 적으면 안 된다.** 서울 API가 말해 주지 않은 것을
  // 우리가 단정하는 셈이고, 정상 데이터에까지 경고가 붙는다.
  it('모름이면 아무것도 덧붙이지 않는다', () => {
    render(<CongestionCard snapshot={snapshot({ replaced: null })} />)
    expect(screen.queryByText(/대체값/)).not.toBeInTheDocument()
  })

  // 대체값이어도 수치 자체는 숨기지 않는다. 서울 API가 주는 최선의 추정이고,
  // 감추면 화면에 남는 게 없다 — 우리가 하는 일은 출처를 밝히는 것뿐이다.
  it('대체값이어도 혼잡도와 추정 인구는 그대로 보여준다', () => {
    render(<CongestionCard snapshot={snapshot({ replaced: true })} />)
    expect(screen.getByText('조금 붐벼요.')).toBeInTheDocument()
    expect(screen.getByText(/74,000~76,000명/)).toBeInTheDocument()
  })
})
