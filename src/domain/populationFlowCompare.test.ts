import { describe, expect, it } from 'vitest'
import { compareFlowWithUsual, type PopulationFlowSlot } from './populationFlow'

function slot(overrides: Partial<PopulationFlowSlot> = {}): PopulationFlowSlot {
  return { hour: 13, people: 10_000, usual: 10_000, congestion: '보통', ...overrides }
}

/** 「지금」이 두 번째 칸인 흐름. 앞뒤 칸은 견줌에 안 쓰인다. */
function flowNow(now: Partial<PopulationFlowSlot>) {
  return { slots: [slot(), slot(now), slot()], nowIndex: 1 }
}

describe('compareFlowWithUsual', () => {
  /**
   * **문턱이 10%다.** 실측 104칸에서 오늘과 평소의 차이가 중앙값 3.1% ·
   * 90분위 10.4%였다 — 그래서 10%면 열 칸에 한 칸쯤 짚는다. 근거는
   * `populationFlow.ts`의 `USUAL_THRESHOLD`.
   */
  it('평소보다 10% 넘게 많으면 붐빈다고 본다', () => {
    expect(compareFlowWithUsual(flowNow({ people: 11_000, usual: 10_000 }))).toEqual({
      delta: 'busier',
      usual: 10_000,
    })
  })

  it('평소보다 10% 넘게 적으면 여유롭다고 본다', () => {
    expect(compareFlowWithUsual(flowNow({ people: 9_000, usual: 10_000 }))?.delta).toBe(
      'calmer',
    )
  })

  // 실측 칸의 절반이 3% 안쪽이다. 그 흔들림을 「평소보다」라고 부르면 매번
  // 다른 말을 하게 된다.
  it('문턱 안쪽 흔들림은 비슷하다고 본다', () => {
    for (const people of [10_300, 9_700, 10_999, 9_001]) {
      expect(compareFlowWithUsual(flowNow({ people, usual: 10_000 }))?.delta).toBe(
        'similar',
      )
    }
  })

  /**
   * **「지금」 칸만 본다.** 과거·예보 칸이 아무리 튀어도 이 문장은 지금에 대한
   * 것이다 — 그래야 바로 위에 적힌 인원수와 같은 순간을 말한다.
   */
  it('지금이 아닌 칸은 안 본다', () => {
    const flow = {
      slots: [
        slot({ people: 90_000, usual: 1_000 }),
        slot({ people: 10_000, usual: 10_000 }),
        slot({ people: 1, usual: 90_000 }),
      ],
      nowIndex: 1,
    }

    expect(compareFlowWithUsual(flow)?.delta).toBe('similar')
  })

  // 「지금」이 어느 칸인지 모르면 견줄 대상이 없다. 「비슷」으로 떨어뜨리지
  // 않는다 — 안 본 것과 비슷한 것은 정반대의 정보다(`pattern.ts`와 같은 규칙).
  it('「지금」을 모르면 판정하지 않는다', () => {
    expect(compareFlowWithUsual({ slots: [slot()], nowIndex: null })).toBeNull()
  })

  it('인원이나 평소를 못 읽었으면 판정하지 않는다', () => {
    expect(compareFlowWithUsual(flowNow({ people: null }))).toBeNull()
    expect(compareFlowWithUsual(flowNow({ usual: null }))).toBeNull()
  })

  // 나눗셈이 무한대가 되기 전에 막는다.
  it('평소가 0이면 판정하지 않는다', () => {
    expect(compareFlowWithUsual(flowNow({ usual: 0 }))).toBeNull()
  })

  it('빈 흐름은 판정하지 않는다', () => {
    expect(compareFlowWithUsual({ slots: [], nowIndex: 0 })).toBeNull()
  })
})
