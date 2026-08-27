import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { recordObservation, type WeekPattern } from '../../domain/pattern'
import type { AreaSnapshot, CongestionLevel } from '../../domain/types'
import { PopulationLead } from './PopulationLead'

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

// **이 줄이 상세에서 가장 큰 글씨다.** 예전에는 그 자리를 「다소 혼잡」이
// 32px로 차지하고 사람 수는 14px로 안내 문구 밑에 깔려 있었다. 등급은 제목
// 줄의 배지가 이미 말하므로 큰 글씨는 숫자에 간다 — 근거는 컴포넌트 주석.
describe('PopulationLead — 사람 수', () => {
  it('추정 인구를 사람 수로 적는다', () => {
    render(<PopulationLead pattern={{}} snapshot={snapshot()} flow={undefined} />)
    expect(screen.getByText(/74,000~76,000명/)).toBeInTheDocument()
  })

  // 대체값이어도 수를 지우지 않는다. 서울 API가 주는 최선의 추정이고, 감추면
  // 이 줄에 남는 게 없다 — 출처를 밝히는 일은 아래 카드가 맡는다.
  it('대체값이어도 사람 수를 지우지 않는다', () => {
    render(<PopulationLead pattern={{}} snapshot={snapshot({ replaced: true })} flow={undefined} />)
    expect(screen.getByText(/74,000~76,000명/)).toBeInTheDocument()
  })

  // 등급을 여기서 또 적으면 제목 줄의 배지와 같은 말이 두 번 나온다.
  // 「약간 붐빔」의 헤드라인은 「다소 혼잡」이다(`domain/congestion.ts`).
  it('혼잡도 등급을 글자로 되풀이하지 않는다', () => {
    render(<PopulationLead pattern={{}} snapshot={snapshot()} flow={undefined} />)
    expect(screen.queryByText('다소 혼잡')).toBeNull()
    expect(screen.queryByText('약간 붐빔')).toBeNull()
  })
})

describe('PopulationLead — 평소 대비', () => {
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
      <PopulationLead
        snapshot={snapshotAt('붐빔')}
        pattern={patternOf(['여유', '여유', '여유', '붐빔'])} flow={undefined}
      />,
    )

    expect(screen.getByText(/평소보다 붐벼요/)).toBeInTheDocument()
  })

  it('과거보다 한산하면 평소보다 여유롭다고 적는다', () => {
    render(
      <PopulationLead
        snapshot={snapshotAt('여유')}
        pattern={patternOf(['붐빔', '붐빔', '붐빔', '여유'])} flow={undefined}
      />,
    )

    expect(screen.getByText(/평소보다 여유로워요/)).toBeInTheDocument()
  })

  it('무엇과 견줬는지와 표본 수를 함께 적는다', () => {
    // 「평소」가 무엇인지 안 적으면 어제 대비인지 한 달 대비인지 알 수 없다.
    render(
      <PopulationLead
        snapshot={snapshotAt('붐빔')}
        pattern={patternOf(['여유', '여유', '여유', '붐빔'])} flow={undefined}
      />,
    )

    expect(screen.getByText(/같은 요일·같은 시간대 관측 3번/)).toBeInTheDocument()
  })

  it('과거 관측이 모자라면 수치 대신 부족하다고 적는다', () => {
    // 「평소와 비슷」으로 떨어뜨리지 않는다 — 안 본 것과 비슷한 것은 다르다.
    render(
      <PopulationLead snapshot={snapshotAt('붐빔')} pattern={patternOf(['붐빔'])} flow={undefined} />,
    )

    expect(screen.getByText(/아직 비교할 기록이 부족해요/)).toBeInTheDocument()
    expect(screen.queryByText(/평소보다/)).not.toBeInTheDocument()
  })

  it('관측 시각을 못 읽으면 그 줄을 통째로 뺀다', () => {
    render(
      <PopulationLead
        snapshot={{ ...baseSnapshot, congestion: '붐빔', observedAt: '알 수 없음' }}
        pattern={patternOf(['여유', '여유', '여유', '붐빔'])} flow={undefined}
      />,
    )

    expect(screen.queryByText(/평소보다/)).not.toBeInTheDocument()
    expect(screen.queryByText(/아직 비교할 기록/)).not.toBeInTheDocument()
  })
})

describe('PopulationLead — 서울이 준 평소', () => {
  const now = { hour: 13, people: 41_000, usual: 38_000, congestion: '보통' as const }
  const SLOT = { day: 0, bucket: 0 }

  /** 기기 패턴만 보면 「평소보다 여유로워요」가 나오는 짝. */
  const calmSnapshot: AreaSnapshot = {
    ...snapshot(),
    congestion: '여유',
    // 2026-08-02는 일요일이라 관측 시각이 SLOT에 떨어진다.
    observedAt: '2026-08-02 01:00',
  }
  const calmerPattern = (): WeekPattern =>
    (['붐빔', '붐빔', '붐빔', '여유'] as const).reduce(
      (pattern, level) => recordObservation(pattern, SLOT, level),
      {} as WeekPattern,
    )
  const flowWith = (people: number) => ({
    slots: [{ ...now }, { ...now, people }, { ...now }],
    nowIndex: 1,
  })

  /**
   * **서울 쪽을 먼저 쓴다.** 기기에 쌓인 패턴이 「여유롭다」고 해도 4주 평균이
   * 「붐빈다」면 뒤쪽이 이긴다 — 근거의 질이 다르다(4단계 등급 서넛 대 연속값
   * 4주 평균). 이 테스트가 그 우선순위를 잠근다.
   */
  it('기기 패턴보다 서울이 준 평균을 먼저 쓴다', () => {
    render(
      <PopulationLead
        snapshot={calmSnapshot}
        pattern={calmerPattern()}
        flow={flowWith(50_000)}
      />,
    )

    expect(screen.getByText('평소보다 붐벼요')).toBeInTheDocument()
    expect(screen.queryByText(/관측 .*번과 견줬어요/)).toBeNull()
  })

  // 표본 수 대신 평소 인원을 적는다 — 「4주 평균과 견줬다」보다 이쪽이 판정을
  // 스스로 설명한다.
  it('무엇과 견줬는지를 평소 인원으로 적는다', () => {
    render(
      <PopulationLead snapshot={calmSnapshot} pattern={{}} flow={flowWith(41_000)} />,
    )

    expect(screen.getByText(/평소는 약 38,000명이에요/)).toBeInTheDocument()
  })

  /**
   * **못 받으면 기기 패턴으로 떨어진다.** SeoulRtd는 조용히 깨지는 상류라,
   * 이 줄이 통째로 사라지면 인원수가 다시 「많은지 적은지 알 수 없는 숫자」로
   * 돌아간다.
   */
  it('흐름을 못 받으면 기기 패턴을 쓴다', () => {
    render(
      <PopulationLead snapshot={calmSnapshot} pattern={calmerPattern()} flow={undefined} />,
    )

    expect(screen.getByText('평소보다 여유로워요')).toBeInTheDocument()
  })

  /**
   * **관측 시각을 못 읽어도 서울 쪽은 선다.** 예전에는 이 줄이 통째로
   * `observationSlot`에 매여 있었다 — 기기 패턴의 칸을 못 찾으면 판정도 없었다.
   * 지금은 근거가 둘이라 한쪽이 못 서도 다른 쪽이 답한다.
   */
  it('관측 시각을 못 읽어도 서울이 준 평균으로 적는다', () => {
    render(
      <PopulationLead
        snapshot={{ ...snapshot(), observedAt: '알 수 없음' }}
        pattern={{}}
        flow={flowWith(50_000)}
      />,
    )

    expect(screen.getByText('평소보다 붐벼요')).toBeInTheDocument()
  })

  // 「지금」을 모르면 서울 쪽으로 판정할 수 없다. 그때도 기기 쪽이 남아 있다.
  it('흐름에 「지금」이 없으면 기기 패턴을 쓴다', () => {
    render(
      <PopulationLead
        snapshot={calmSnapshot}
        pattern={calmerPattern()}
        flow={{ slots: [{ ...now }], nowIndex: null }}
      />,
    )

    expect(screen.getByText('평소보다 여유로워요')).toBeInTheDocument()
  })
})
