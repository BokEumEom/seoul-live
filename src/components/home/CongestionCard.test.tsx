import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { recordObservation, type WeekPattern } from '../../domain/pattern'
import type { AreaSnapshot, CongestionLevel } from '../../domain/types'
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
    render(<CongestionCard pattern={{}} snapshot={snapshot({ replaced: true })} />)
    expect(screen.getByText(/대체값/)).toBeInTheDocument()
  })

  it('실측이면 아무것도 덧붙이지 않는다', () => {
    render(<CongestionCard pattern={{}} snapshot={snapshot({ replaced: false })} />)
    expect(screen.queryByText(/대체값/)).not.toBeInTheDocument()
  })

  // **모름을 「대체값」이라고 적으면 안 된다.** 서울 API가 말해 주지 않은 것을
  // 우리가 단정하는 셈이고, 정상 데이터에까지 경고가 붙는다.
  it('모름이면 아무것도 덧붙이지 않는다', () => {
    render(<CongestionCard pattern={{}} snapshot={snapshot({ replaced: null })} />)
    expect(screen.queryByText(/대체값/)).not.toBeInTheDocument()
  })

  // 대체값이어도 수치 자체는 숨기지 않는다. 서울 API가 주는 최선의 추정이고,
  // 감추면 화면에 남는 게 없다 — 우리가 하는 일은 출처를 밝히는 것뿐이다.
  it('대체값이어도 혼잡도와 추정 인구는 그대로 보여준다', () => {
    render(<CongestionCard pattern={{}} snapshot={snapshot({ replaced: true })} />)
    expect(screen.getByText('조금 붐벼요.')).toBeInTheDocument()
    expect(screen.getByText(/74,000~76,000명/)).toBeInTheDocument()
  })
})

describe('CongestionCard — 평소 대비', () => {
  const SLOT = { day: 0, bucket: 0 }
  const baseSnapshot = snapshot()

  /** 관측 시각이 SLOT(일요일 0~3시)에 떨어지는 스냅샷을 만든다. */
  function snapshotAt(level: CongestionLevel): AreaSnapshot {
    // 2026-08-02는 일요일이다. observationSlot이 이 문자열을 읽는다.
    return { ...baseSnapshot, congestion: level, observedAt: '2026-08-02 01:00' }
  }

  function patternOf(levels: readonly CongestionLevel[]): WeekPattern {
    return levels.reduce(
      (pattern, level) => recordObservation(pattern, SLOT, level),
      {} as WeekPattern,
    )
  }

  it('과거보다 붐비면 평소보다 붐빈다고 적는다', () => {
    render(
      <CongestionCard
        snapshot={snapshotAt('붐빔')}
        pattern={patternOf(['여유', '여유', '여유', '붐빔'])}
      />,
    )

    expect(screen.getByText(/평소보다 붐벼요/)).toBeInTheDocument()
  })

  it('과거보다 한산하면 평소보다 여유롭다고 적는다', () => {
    render(
      <CongestionCard
        snapshot={snapshotAt('여유')}
        pattern={patternOf(['붐빔', '붐빔', '붐빔', '여유'])}
      />,
    )

    expect(screen.getByText(/평소보다 여유로워요/)).toBeInTheDocument()
  })

  it('무엇과 견줬는지와 표본 수를 함께 적는다', () => {
    // 「평소」가 무엇인지 안 적으면 어제 대비인지 한 달 대비인지 알 수 없다.
    render(
      <CongestionCard
        snapshot={snapshotAt('붐빔')}
        pattern={patternOf(['여유', '여유', '여유', '붐빔'])}
      />,
    )

    expect(screen.getByText(/같은 요일·같은 시간대 관측 3번/)).toBeInTheDocument()
  })

  it('과거 관측이 모자라면 수치 대신 부족하다고 적는다', () => {
    // 「평소와 비슷」으로 떨어뜨리지 않는다 — 안 본 것과 비슷한 것은 다르다.
    render(
      <CongestionCard snapshot={snapshotAt('붐빔')} pattern={patternOf(['붐빔'])} />,
    )

    expect(screen.getByText(/아직 비교할 기록이 부족해요/)).toBeInTheDocument()
    expect(screen.queryByText(/평소보다/)).not.toBeInTheDocument()
  })

  it('관측 시각을 못 읽으면 그 줄을 통째로 뺀다', () => {
    render(
      <CongestionCard
        snapshot={{ ...baseSnapshot, congestion: '붐빔', observedAt: '알 수 없음' }}
        pattern={patternOf(['여유', '여유', '여유', '붐빔'])}
      />,
    )

    expect(screen.queryByText(/평소보다/)).not.toBeInTheDocument()
    expect(screen.queryByText(/아직 비교할 기록/)).not.toBeInTheDocument()
  })
})
