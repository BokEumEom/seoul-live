import { describe, expect, it } from 'vitest'
import { parseComposition } from './compositionSchema'

function payload(area: Record<string, unknown>): unknown {
  return { 'SeoulRtd.citydata_ppltn': [{ AREA_NM: '강남역', ...area }] }
}

const FULL = {
  MALE_PPLTN_RATE: '48.2',
  FEMALE_PPLTN_RATE: '51.8',
  NON_RESNT_PPLTN_RATE: '71.4',
  PPLTN_RATE_0: '3.1',
  PPLTN_RATE_10: '8.0',
  PPLTN_RATE_20: '31.2',
  PPLTN_RATE_30: '22.5',
  PPLTN_RATE_40: '14.0',
  PPLTN_RATE_50: '11.2',
  PPLTN_RATE_60: '6.0',
  PPLTN_RATE_70: '4.0',
}

describe('parseComposition', () => {
  it('전부 있으면 숫자로 읽는다', () => {
    const c = parseComposition(payload(FULL), '강남역')
    expect(c).not.toBeNull()
    expect(c?.maleRate).toBe(48.2)
    expect(c?.femaleRate).toBe(51.8)
    expect(c?.nonResidentRate).toBe(71.4)
    expect(c?.ageRates).toEqual([3.1, 8, 31.2, 22.5, 14, 11.2, 6, 4])
  })

  it('필드가 통째로 없으면 null이다', () => {
    expect(parseComposition(payload({}), '강남역')).toBeNull()
  })

  it('요청한 명소가 없으면 null이다', () => {
    expect(parseComposition(payload(FULL), '경복궁')).toBeNull()
  })

  it('payload가 엉뚱한 모양이어도 던지지 않는다', () => {
    // 이 함수는 절대 던지면 안 된다 — 던지면 혼잡도까지 같이 죽는다.
    expect(parseComposition(null, '강남역')).toBeNull()
    expect(parseComposition('문자열', '강남역')).toBeNull()
    expect(parseComposition({ RESULT: {} }, '강남역')).toBeNull()
  })

  it('성별만 이상하면 성별만 버리고 나머지는 산다', () => {
    const c = parseComposition(
      payload({ ...FULL, MALE_PPLTN_RATE: '', FEMALE_PPLTN_RATE: 'N/A' }),
      '강남역',
    )
    expect(c).not.toBeNull()
    expect(c?.maleRate).toBe(0)
    expect(c?.femaleRate).toBe(0)
    expect(c?.ageRates[2]).toBe(31.2)
  })

  it('범위를 벗어난 값은 0으로 떨어뜨린다', () => {
    const c = parseComposition(
      payload({ ...FULL, NON_RESNT_PPLTN_RATE: '250' }),
      '강남역',
    )
    expect(c?.nonResidentRate).toBe(0)
  })

  it('연령대가 일부만 와도 여덟 칸을 채운다', () => {
    const c = parseComposition(
      payload({ MALE_PPLTN_RATE: '50', PPLTN_RATE_20: '40' }),
      '강남역',
    )
    expect(c?.ageRates).toHaveLength(8)
    expect(c?.ageRates[2]).toBe(40)
    expect(c?.ageRates[0]).toBe(0)
  })
})
