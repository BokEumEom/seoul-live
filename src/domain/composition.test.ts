import { describe, expect, it } from 'vitest'
import { AGE_LABELS, residentLabel } from './composition'
import type { PopulationComposition } from './composition'

function make(nonResidentRate: number): PopulationComposition {
  return {
    maleRate: 50,
    femaleRate: 50,
    nonResidentRate,
    ageRates: [5, 10, 30, 20, 15, 10, 7, 3],
  }
}

describe('AGE_LABELS', () => {
  it('여덟 단계다', () => {
    // 서울 API의 PPLTN_RATE_0 ~ PPLTN_RATE_70과 1:1이다.
    expect(AGE_LABELS).toHaveLength(8)
  })
})

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
})
