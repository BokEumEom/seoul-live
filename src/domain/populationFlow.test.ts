import { describe, expect, it } from 'vitest'
import {
  EMPTY_POPULATION_FLOW,
  flowPeaks,
  hasPopulationFlow,
  hasUsualCurve,
  type PopulationFlowSlot,
} from './populationFlow'

function slot(overrides: Partial<PopulationFlowSlot> = {}): PopulationFlowSlot {
  return { hour: 13, people: 41_000, usual: 38_000, congestion: '보통', ...overrides }
}

describe('hasPopulationFlow', () => {
  it('인원이 하나라도 있으면 그린다', () => {
    expect(
      hasPopulationFlow({
        slots: [slot({ people: null }), slot()],
        nowIndex: 1,
      }),
    ).toBe(true)
  })

  // 칸 25개가 전부 빈 막대인 그래프는 축만 남는다.
  it('인원을 하나도 못 읽었으면 안 그린다', () => {
    expect(
      hasPopulationFlow({ slots: [slot({ people: null })], nowIndex: null }),
    ).toBe(false)
  })

  it('빈 흐름은 안 그린다', () => {
    expect(hasPopulationFlow(EMPTY_POPULATION_FLOW)).toBe(false)
  })
})

describe('hasUsualCurve', () => {
  it('평소 값이 둘 이상이면 선을 그린다', () => {
    expect(hasUsualCurve({ slots: [slot(), slot()], nowIndex: null })).toBe(true)
  })

  // 점 하나는 선이 아니다.
  it('평소 값이 하나뿐이면 안 그린다', () => {
    expect(
      hasUsualCurve({ slots: [slot(), slot({ usual: null })], nowIndex: null }),
    ).toBe(false)
  })

  /**
   * **인원과 따로 묻는다.** 서울의 프런트엔드도 `before_people_value`에 null
   * 검사를 두고 있다 — 인원은 오는데 평소만 안 오는 응답이 가능하다는 뜻이다.
   */
  it('인원이 있어도 평소가 없으면 선은 없다', () => {
    const flow = { slots: [slot({ usual: null }), slot({ usual: null })], nowIndex: null }

    expect(hasPopulationFlow(flow)).toBe(true)
    expect(hasUsualCurve(flow)).toBe(false)
  })
})

describe('flowPeaks', () => {
  /**
   * **평소 곡선까지 함께 본다.** 인원만으로 축을 정하면 평소가 오늘보다 높은
   * 시간대에서 곡선이 천장을 뚫는다 — 새벽에 실제로 그런 칸이 있었다.
   */
  it('인원과 평소를 모두 후보로 낸다', () => {
    expect(
      flowPeaks({ slots: [slot({ people: 100, usual: 900 })], nowIndex: null }),
    ).toEqual([100, 900])
  })

  it('못 읽은 값은 후보가 아니다', () => {
    expect(
      flowPeaks({ slots: [slot({ people: null, usual: null })], nowIndex: null }),
    ).toEqual([])
  })
})
