import { describe, expect, it } from 'vitest'
import { residentLabel } from './composition'
import type { PopulationComposition } from './composition'

function make(nonResidentRate: number): PopulationComposition {
  return {
    maleRate: 50,
    femaleRate: 50,
    nonResidentRate,
    ageRates: [5, 10, 30, 20, 15, 10, 7, 3],
  }
}

// AGE_LABELS의 길이는 여기서 재지 않는다. 혼자 재면 compositionSchema.ts의 AGE_KEYS와
// 어긋나는 순간을 못 잡는다 — 두 길이를 묶는 단언은 compositionSchema.test.ts에 있다.

describe('residentLabel', () => {
  it('비상주가 많으면 외지인이 많다고 말한다', () => {
    expect(residentLabel(make(71))).toBe('외지인이 많아요')
  })

  it('비상주가 적으면 동네 생활권이라고 말한다', () => {
    expect(residentLabel(make(28))).toBe('동네 생활권이에요')
  })

  it('경계값 60은 외지인 쪽이 아니다', () => {
    // 60을 넘어야 "많다"고 말한다. 딱 60은 반반에 가깝다.
    expect(residentLabel(make(60))).toBe('동네 생활권이에요')
  })

  it('비상주가 0이면 아무 말도 하지 않는다', () => {
    // 0은 "실제로 0%"가 아니라 "읽지 못함"일 수 있다(compositionSchema.ts의 rate()).
    // 못 읽은 값을 근거로 "동네 생활권"이라고 단정하면 안 된다.
    expect(residentLabel(make(0))).toBeNull()
  })
})
