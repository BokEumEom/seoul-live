import { describe, expect, it } from 'vitest'
import {
  commerceLevelTone,
  COMMERCE_AGE_LABELS,
  COMMERCE_LEVELS,
  hasReadableCommerce,
  scaleMoney,
  type Commerce,
} from './commerce'

function commerce(overrides: Partial<Commerce> = {}): Commerce {
  return {
    level: '',
    paymentCount: null,
    paymentMin: null,
    paymentMax: null,
    categories: [],
    maleRate: null,
    femaleRate: null,
    ageRates: [0, 0, 0, 0, 0, 0],
    personalRate: null,
    corporationRate: null,
    updatedAt: '',
    ...overrides,
  }
}

describe('commerceLevelTone', () => {
  // **실호출 7곳에서 이 넷만 봤다**(2026-08-25): 가락시장 한산한 · 쌍문역 보통 ·
  // 광화문 분주한 · 강남역/홍대/북촌 바쁜. 넷을 한꺼번에 세는 이유는
  // `roadIndexTone`과 같다 — 하나만 보면 표를 지우고 그 하나만 남겨도 통과한다.
  it('네 단계를 혼잡도와 같은 톤으로 옮긴다', () => {
    expect(commerceLevelTone('한산한')).toBe('calm')
    expect(commerceLevelTone('보통')).toBe('normal')
    expect(commerceLevelTone('분주한')).toBe('busy')
    expect(commerceLevelTone('바쁜')).toBe('crowded')
  })

  it('앞뒤 공백을 무시한다', () => {
    expect(commerceLevelTone(' 바쁜 ')).toBe('crowded')
  })

  // 명세에 값 목록이 없어 이 넷이 전부라고 단언할 수 없다. 표에 없는 값에
  // 아무 톤이나 붙이면 색이 안 붙는 게 아니라 **틀린 색**이 붙는다.
  it('모르는 단계는 null이다', () => {
    expect(commerceLevelTone('북적이는')).toBeNull()
    expect(commerceLevelTone('')).toBeNull()
  })

  it('사전과 검사가 보는 목록이 표와 같다', () => {
    expect(COMMERCE_LEVELS).toEqual(['한산한', '보통', '분주한', '바쁜'])
  })
})

describe('COMMERCE_AGE_LABELS', () => {
  // **인구 구성의 여덟 칸과 다르다** — 양끝이 「이하」·「이상」으로 묶여 있다.
  // 파서가 여섯 칸을 만들고 화면이 여섯 색을 든다. 셋이 어긋나면 색 없는
  // 막대나 이름 없는 칸이 조용히 생긴다.
  it('여섯 칸이고 양끝이 묶여 있다', () => {
    expect(COMMERCE_AGE_LABELS).toHaveLength(6)
    expect(COMMERCE_AGE_LABELS[0]).toBe('10대 이하')
    expect(COMMERCE_AGE_LABELS[5]).toBe('60대 이상')
  })
})

describe('hasReadableCommerce', () => {
  it('아무 값도 없으면 false다', () => {
    expect(hasReadableCommerce(commerce())).toBe(false)
  })

  it('값이 하나라도 있으면 true다', () => {
    expect(hasReadableCommerce(commerce({ level: '바쁜' }))).toBe(true)
    expect(hasReadableCommerce(commerce({ paymentCount: 0 }))).toBe(true)
    expect(hasReadableCommerce(commerce({ ageRates: [0, 0, 12, 0, 0, 0] }))).toBe(true)
    expect(hasReadableCommerce(commerce({ maleRate: 50 }))).toBe(true)
  })

  // 0은 「실제로 0%」와 「못 읽음」을 구분하지 못한다(`hasGenderSplit`과 같은
  // 규칙). 전부 0인 구성으로는 아무 말도 할 수 없다.
  it('비율이 전부 0이면 false다', () => {
    expect(hasReadableCommerce(commerce({ maleRate: 0, femaleRate: 0 }))).toBe(false)
  })
})

describe('scaleMoney', () => {
  it('억 단위는 소수 한 자리로 접는다', () => {
    expect(scaleMoney(390_000_000)).toEqual({ value: 3.9, scale: 'billion' })
    expect(scaleMoney(100_000_000)).toEqual({ value: 1, scale: 'billion' })
  })

  it('만 단위는 정수로 접는다', () => {
    expect(scaleMoney(950_000)).toEqual({ value: 95, scale: 'tenThousand' })
  })

  it('만 미만은 원 그대로다', () => {
    expect(scaleMoney(800)).toEqual({ value: 800, scale: 'won' })
  })

  it('경계에서 눈금이 바뀐다', () => {
    expect(scaleMoney(99_999_999)?.scale).toBe('tenThousand')
    expect(scaleMoney(9_999)?.scale).toBe('won')
  })

  // 0원은 실제 값이다 — 「결제가 없었다」는 정보다. null과 구분한다.
  it('0원과 모름을 구분한다', () => {
    expect(scaleMoney(0)).toEqual({ value: 0, scale: 'won' })
    expect(scaleMoney(null)).toBeNull()
  })

  it('음수는 모름으로 접는다', () => {
    expect(scaleMoney(-1)).toBeNull()
  })
})
