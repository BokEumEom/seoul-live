import { describe, expect, it } from 'vitest'
import { parsePopulationTrend } from './ppltnSchema'

function payload(overrides: Record<string, unknown> = {}) {
  return [
    {
      hotspot_nm: '광화문·덕수궁',
      ONEHOUR_RATE_UP_DOWN: 'up',
      ONEHOUR_RATE: '7.0%',
      THREEHOUR_RATE_UP_DOWN: 'up',
      THREEHOUR_RATE: '30.1%',
      ONEMONTH_RATE_UP_DOWN: 'down',
      ONEMONTH_RATE: '15.3%',
      ...overrides,
    },
  ]
}

describe('parsePopulationTrend', () => {
  it('세 칸을 방향과 값으로 읽는다', () => {
    expect(parsePopulationTrend(payload())).toEqual({
      lastHour: { direction: 'up', percent: 7 },
      lastThreeHours: { direction: 'up', percent: 30.1 },
      lastMonth: { direction: 'down', percent: 15.3 },
    })
  })

  /**
   * **응답이 배열이다.** 한 명소를 물어도 `[{...}]`로 온다 — 첫 줄만 쓴다.
   * 배열이 아니거나 비어 있으면 세 칸이 전부 빈 값이다.
   */
  it('배열이 아니면 통째로 빈 값이다', () => {
    const empty = {
      lastHour: { direction: null, percent: null },
      lastThreeHours: { direction: null, percent: null },
      lastMonth: { direction: null, percent: null },
    }

    expect(parsePopulationTrend(null)).toEqual(empty)
    expect(parsePopulationTrend([])).toEqual(empty)
    expect(parsePopulationTrend({ ONEHOUR_RATE: '7.0%' })).toEqual(empty)
  })

  it('처음 보는 방향은 비운다', () => {
    const trend = parsePopulationTrend(payload({ ONEHOUR_RATE_UP_DOWN: 'flat' }))
    expect(trend.lastHour.direction).toBeNull()
    // 값은 읽힌 채로 남는다 — 화면이 「둘 다 있을 때만」 그린다.
    expect(trend.lastHour.percent).toBe(7)
  })

  /**
   * **`Number()`를 맨몸으로 쓰지 않는다**(AGENTS.md). `Number('0x1f')`는 31,
   * `Number('1e1')`은 10, `Number('')`은 0이다 — 「없는 값」이 아니라 **그럴듯한
   * 틀린 값**이 화면에 뜬다. 퍼센트 기호가 붙은 자리라 더 위험하다.
   */
  it('퍼센트 모양이 아니면 비운다', () => {
    for (const raw of ['', '-', '0x1f%', '1e1%', '7.0', '%', '점검중']) {
      expect(parsePopulationTrend(payload({ ONEHOUR_RATE: raw })).lastHour.percent).toBeNull()
    }
  })

  it('정수 퍼센트도 읽는다', () => {
    expect(parsePopulationTrend(payload({ ONEHOUR_RATE: '12%' })).lastHour.percent).toBe(12)
  })

  // 실호출에서 값은 언제나 양수이고 부호는 `UP_DOWN`이 진다. 음수가 오면
  // 방향과 두 번 부호가 붙어 「down -5%」가 되므로 그 값은 안 읽는다.
  it('음수 퍼센트는 안 읽는다', () => {
    expect(parsePopulationTrend(payload({ ONEHOUR_RATE: '-5.0%' })).lastHour.percent).toBeNull()
  })

  it('칸 하나가 통째로 없어도 나머지는 읽는다', () => {
    const trend = parsePopulationTrend(
      payload({ ONEMONTH_RATE_UP_DOWN: undefined, ONEMONTH_RATE: undefined }),
    )

    expect(trend.lastHour).toEqual({ direction: 'up', percent: 7 })
    expect(trend.lastMonth).toEqual({ direction: null, percent: null })
  })
})
