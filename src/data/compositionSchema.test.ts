import { describe, expect, it } from 'vitest'
import { AGE_LABELS } from '../domain/composition'
import { parseComposition } from './compositionSchema'

// citydata 응답 모양으로 고정한다. 옛 citydata_ppltn 봉투는 2026-08-27에 프록시와
// 함께 저장소에서 지웠다 — populationRows가 더는 그 키를 안 읽는다.
function payload(area: Record<string, unknown>): unknown {
  return { CITYDATA: { LIVE_PPLTN_STTS: [{ AREA_NM: '강남역', ...area }] } }
}

const FULL = {
  MALE_PPLTN_RATE: '48.2',
  FEMALE_PPLTN_RATE: '51.8',
  NON_RESNT_PPLTN_RATE: '71.4',
  RESNT_PPLTN_RATE: '28.6',
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
    expect(c?.residentRate).toBe(28.6)
    expect(c?.ageRates).toEqual([3.1, 8, 31.2, 22.5, 14, 11.2, 6, 4])
  })

  // **상주 비율을 함께 읽는 이유는 0의 뜻을 가르기 위해서다.** `rate()`가 못
  // 읽은 값을 0으로 떨어뜨리는데, 비상주만 보면 「진짜 0%」와 「못 읽음」이
  // 같은 값이 된다. 둘을 함께 읽으면 갈린다 — `hasResidenceSplit`이 그 판정이다.
  it('상주 100 · 비상주 0은 읽힌 값이다', () => {
    const c = parseComposition(
      payload({ ...FULL, RESNT_PPLTN_RATE: '100', NON_RESNT_PPLTN_RATE: '0' }),
      '강남역',
    )
    expect(c?.residentRate).toBe(100)
    expect(c?.nonResidentRate).toBe(0)
  })

  it('상주만 이상하면 상주만 버리고 나머지는 산다', () => {
    const c = parseComposition(payload({ ...FULL, RESNT_PPLTN_RATE: '250' }), '강남역')
    expect(c?.residentRate).toBe(0)
    expect(c?.nonResidentRate).toBe(71.4)
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

  it('연령대 칸 수가 AGE_LABELS와 정확히 맞는다', () => {
    // PopulationCard가 AGE_LABELS[index]를 라벨과 key로 쓴다. AGE_KEYS에 한 칸을 더하고
    // AGE_LABELS를 안 고치면 undefined 라벨이 된다 — 두 길이를 여기서 묶어 잠근다.
    const c = parseComposition(payload(FULL), '강남역')
    expect(c?.ageRates).toHaveLength(AGE_LABELS.length)
  })

  it('음수는 0으로 떨어뜨린다', () => {
    // 상한(250)만 막고 하한을 지우면 음수 막대가 반대로 그려진다.
    const c = parseComposition(payload({ ...FULL, MALE_PPLTN_RATE: '-5' }), '강남역')
    expect(c?.maleRate).toBe(0)
  })

  it('문자열이 아니라 숫자로 와도 읽는다', () => {
    // 서울 API는 숫자를 문자열로 주지만, 프록시나 JSON 파서를 거치며 숫자 타입으로
    // 바뀔 여지가 있다. 그때 값을 통째로 버리면 안 된다.
    const c = parseComposition(payload({ ...FULL, MALE_PPLTN_RATE: 48.2 }), '강남역')
    expect(c?.maleRate).toBe(48.2)
  })

  it('숫자처럼 생겼지만 아닌 값을 그럴듯한 숫자로 읽지 않는다', () => {
    // Number()를 맨몸으로 쓰면 '0x1f' → 31, '1e1' → 10, '+50' → 50이 된다.
    // "없는 값"이 아니라 "틀린 값"이 화면에 뜨는 쪽이 나쁘다.
    for (const bad of ['0x1f', '1e1', '+50', '5 0', '50%', 'Infinity']) {
      const c = parseComposition(payload({ ...FULL, MALE_PPLTN_RATE: bad }), '강남역')
      expect(c?.maleRate).toBe(0)
    }
  })

  it('여러 명소가 담긴 payload에서 요청한 명소의 것을 고른다', () => {
    const multi = {
      CITYDATA: {
        LIVE_PPLTN_STTS: [
          { AREA_NM: '경복궁', ...FULL, MALE_PPLTN_RATE: '10' },
          { AREA_NM: '강남역', ...FULL, MALE_PPLTN_RATE: '90' },
        ],
      },
    }
    expect(parseComposition(multi, '강남역')?.maleRate).toBe(90)
    expect(parseComposition(multi, '경복궁')?.maleRate).toBe(10)
  })
})
