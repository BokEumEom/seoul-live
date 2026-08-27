import { describe, expect, it } from 'vitest'
import {
  hasPopulationTrend,
  isPopulationDirection,
  isReadableChange,
  type PopulationChange,
  type PopulationTrend,
} from './populationTrend'

function change(overrides: Partial<PopulationChange> = {}): PopulationChange {
  return { direction: 'up', percent: 7, ...overrides }
}

function trend(overrides: Partial<PopulationTrend> = {}): PopulationTrend {
  return {
    lastHour: change(),
    lastThreeHours: change(),
    lastMonth: change(),
    ...overrides,
  }
}

const UNREAD: PopulationChange = { direction: null, percent: null }

describe('isPopulationDirection', () => {
  // 실호출 10곳 30칸에서 나온 값은 둘뿐이다(2026-08-27). 「flat」·「same」은 없다.
  it('실호출에서 본 두 값만 방향이다', () => {
    expect(isPopulationDirection('up')).toBe(true)
    expect(isPopulationDirection('down')).toBe(true)
    expect(isPopulationDirection('flat')).toBe(false)
    expect(isPopulationDirection('')).toBe(false)
  })
})

describe('isReadableChange', () => {
  it('방향과 값이 둘 다 있어야 읽은 것이다', () => {
    expect(isReadableChange(change())).toBe(true)
  })

  /**
   * **한쪽만으로는 아무 말도 못 한다.** 「↑」만 있으면 얼마나 늘었는지 모르고,
   * 「7.0%」만 있으면 는 건지 준 건지 모른다 — 서울이 부호를 숫자가 아니라
   * `UP_DOWN` 필드에 싣기 때문이다(실호출에서 값은 언제나 양수다).
   */
  it('방향만 있으면 못 읽은 것이다', () => {
    expect(isReadableChange(change({ percent: null }))).toBe(false)
  })

  it('값만 있으면 못 읽은 것이다', () => {
    expect(isReadableChange(change({ direction: null }))).toBe(false)
  })
})

describe('hasPopulationTrend', () => {
  it('하나라도 읽었으면 그린다', () => {
    expect(
      hasPopulationTrend(trend({ lastHour: UNREAD, lastThreeHours: UNREAD })),
    ).toBe(true)
  })

  // 셋 다 못 읽었으면 제목만 남은 절이 생긴다. 상류가 조용히 깨지는 종류라
  // (SeoulRtd는 문서화된 API가 아니다) 빈 절이 뜨는 길을 열어 두면 안 된다.
  it('셋 다 못 읽었으면 안 그린다', () => {
    expect(
      hasPopulationTrend({
        lastHour: UNREAD,
        lastThreeHours: UNREAD,
        lastMonth: UNREAD,
      }),
    ).toBe(false)
  })
})
