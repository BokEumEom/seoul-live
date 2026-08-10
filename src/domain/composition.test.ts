import { describe, expect, it } from 'vitest'
import { hasGenderSplit, hasReadableComposition, residentLabel } from './composition'
import type { PopulationComposition } from './composition'

function make(nonResidentRate: number): PopulationComposition {
  return {
    maleRate: 50,
    femaleRate: 50,
    nonResidentRate,
    ageRates: [5, 10, 30, 20, 15, 10, 7, 3],
  }
}

const NOTHING: PopulationComposition = {
  maleRate: 0,
  femaleRate: 0,
  nonResidentRate: 0,
  ageRates: [0, 0, 0, 0, 0, 0, 0, 0],
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

describe('hasGenderSplit', () => {
  it('남녀가 둘 다 읽혔으면 true', () => {
    expect(hasGenderSplit({ ...NOTHING, maleRate: 48, femaleRate: 52 })).toBe(true)
  })

  // rate()는 칸마다 따로 0을 떨어뜨린다. 한쪽만 실패하는 게 둘 다 실패하는
  // 것보다 흔한데, 그 0을 "여 0%"로 적으면 없는 사실을 적는 것이다.
  it('여자 쪽이 0이면 false', () => {
    expect(hasGenderSplit({ ...NOTHING, maleRate: 48 })).toBe(false)
  })

  it('남자 쪽이 0이면 false', () => {
    expect(hasGenderSplit({ ...NOTHING, femaleRate: 52 })).toBe(false)
  })
})

describe('hasReadableComposition', () => {
  it('전부 0이면 false', () => {
    expect(hasReadableComposition(NOTHING)).toBe(false)
  })

  it('연령대 한 칸만 읽혀도 true', () => {
    expect(
      hasReadableComposition({ ...NOTHING, ageRates: [0, 0, 31, 0, 0, 0, 0, 0] }),
    ).toBe(true)
  })

  it('비상주만 읽혀도 true', () => {
    expect(hasReadableComposition({ ...NOTHING, nonResidentRate: 71 })).toBe(true)
  })

  it('남녀가 둘 다 읽혔으면 true', () => {
    expect(
      hasReadableComposition({ ...NOTHING, maleRate: 48, femaleRate: 52 }),
    ).toBe(true)
  })

  // 성별을 쌍으로만 말할 수 있으므로 한쪽만 읽힌 것은 "말할 수 있는 게 있다"가
  // 아니다. ||로 두면 남자만 읽힌 구성에서 제목만 뜨는 빈 카드가 남는다.
  it('남자만 읽히고 나머지가 전부 0이면 false', () => {
    expect(hasReadableComposition({ ...NOTHING, maleRate: 48 })).toBe(false)
  })
})
