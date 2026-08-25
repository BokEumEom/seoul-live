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
    forecastProvided: null,
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
  //
  // 사람 수와 안내 문구는 이제 상세 히어로(`DetailHero`)가 갖는다. 이 카드가
  // 그것들을 되풀이하지 않는지는 `AreaDetailScreen.test.tsx`가 잠근다.
  it('대체값 주의를 붙여도 카드는 선다', () => {
    render(<CongestionCard snapshot={snapshot({ replaced: true })} />)
    expect(screen.getByRole('heading', { name: '지금 얼마나 붐비나' })).toBeInTheDocument()
  })

  // **셋이 다 없으면 카드를 아예 안 만든다.** 제목만 남은 빈 상자는 여백만
  // 먹고 화면에 아무 말도 안 한다 — 예보가 없고 구성비를 못 읽은 명소에서
  // 실제로 생긴다.
  it('여유 예상도 대체값도 구성비도 없으면 카드가 없다', () => {
    const { container } = render(
      <CongestionCard
        snapshot={snapshot({ replaced: null, forecasts: [], composition: null })}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
