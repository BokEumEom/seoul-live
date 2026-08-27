import { describe, expect, it } from 'vitest'
import { parsePopulationFlow } from './ppltnCongestSchema'

/** 실호출 모양 그대로의 다섯 칸. 세 번째가 「현재」다. */
function payload(overrides: Record<string, unknown> = {}) {
  return [
    {
      hotspot_nm: '광화문·덕수궁',
      time_cd: '11시|12시|현재|14시|8/28 0시',
      people_value: '35000|37000|39000|41000|8250',
      people_interval:
        '34/000~36/000명|36/000~38/000명|38/000~40/000명|40/000~42/000명|8/000~8/500명',
      before_people_value: '32481|36098|38284|43728|7710',
      congestion_label_list: '약간 붐빔|보통|보통|약간 붐빔|여유',
      ...overrides,
    },
  ]
}

describe('parsePopulationFlow', () => {
  it('칸마다 시각·인원·평소·혼잡도를 읽는다', () => {
    const flow = parsePopulationFlow(payload())

    expect(flow.slots).toHaveLength(5)
    expect(flow.slots[0]).toEqual({
      hour: 11,
      people: 35_000,
      usual: 32_481,
      congestion: '약간 붐빔',
    })
  })

  /**
   * **「현재」 칸에는 시각 글자가 없다.** 25칸이 빈틈없는 한 시간 간격이라
   * 앞칸+1이 이 칸이다. 이걸 안 이으면 가로축에 구멍이 난다.
   */
  it('「현재」 칸의 시각을 앞칸에서 잇는다', () => {
    const flow = parsePopulationFlow(payload())

    expect(flow.slots[2].hour).toBe(13)
    expect(flow.nowIndex).toBe(2)
  })

  /**
   * **앞칸과 뒷칸 둘 다 필요하다.** 시각이 연속이면 「앞칸+1」과 「뒷칸−1」이
   * 같은 답을 내서, 한쪽만 있어도 실응답 모양에서는 티가 안 난다(변이 실험에서
   * 실제로 살아남았다). 갈리는 자리는 「현재」가 양 끝에 설 때다.
   */
  it('「현재」가 맨 앞이면 뒷칸에서 잇는다', () => {
    const flow = parsePopulationFlow(
      payload({
        time_cd: '현재|14시',
        people_value: '39000|41000',
        before_people_value: '38284|43728',
        congestion_label_list: '보통|약간 붐빔',
      }),
    )

    expect(flow.slots[0].hour).toBe(13)
  })

  it('「현재」가 맨 뒤면 앞칸에서 잇는다', () => {
    const flow = parsePopulationFlow(
      payload({
        time_cd: '11시|현재',
        people_value: '35000|39000',
        before_people_value: '32481|38284',
        congestion_label_list: '약간 붐빔|보통',
      }),
    )

    expect(flow.slots[1].hour).toBe(12)
  })

  it('자정을 넘으면 24가 아니라 0이다', () => {
    const flow = parsePopulationFlow(
      payload({ time_cd: '22시|23시|현재|01시|02시' }),
    )

    expect(flow.slots[2].hour).toBe(0)
  })

  // 「8/28 0시」처럼 날짜가 붙어 오는 칸이 하루에 하나 있다.
  it('날짜가 붙은 칸에서도 시각만 읽는다', () => {
    expect(parsePopulationFlow(payload()).slots[4].hour).toBe(0)
  })

  /**
   * **표식에서 읽지 자리를 박지 않는다.** 실측에서 「현재」는 언제나 25칸의
   * 한가운데(12)였지만, 상류가 창을 바꾸면 상수는 조용히 틀리고 표식은 함께
   * 움직인다.
   */
  it('「현재」가 없으면 nowIndex가 비어 있다', () => {
    const flow = parsePopulationFlow(payload({ time_cd: '11시|12시|13시|14시|15시' }))

    expect(flow.nowIndex).toBeNull()
    expect(flow.slots[2].hour).toBe(13)
  })

  it('칸 수가 어긋나면 짧은 쪽에 맞춘다', () => {
    // 필드마다 개수가 다르게 오면 짝이 어긋난 칸이 생긴다. 그런 칸은 안 만든다.
    const flow = parsePopulationFlow(payload({ people_value: '35000|37000' }))

    expect(flow.slots).toHaveLength(2)
  })

  it('배열이 아니면 빈 흐름이다', () => {
    for (const bad of [null, [], {}, 'x']) {
      expect(parsePopulationFlow(bad)).toEqual({ slots: [], nowIndex: null })
    }
  })

  /**
   * **`Number()`를 맨몸으로 쓰지 않는다**(AGENTS.md). 인원은 막대 높이가 되므로
   * 틀린 값이 그럴듯한 그래프를 그린다.
   */
  it('숫자가 아닌 인원은 비운다', () => {
    const flow = parsePopulationFlow(
      payload({ people_value: '0x1f|1e1| |-5|41000' }),
    )

    expect(flow.slots.slice(0, 4).map((s) => s.people)).toEqual([null, null, null, null])
    expect(flow.slots[4].people).toBe(41_000)
  })

  it('처음 보는 혼잡도는 비운다', () => {
    const flow = parsePopulationFlow(
      payload({ congestion_label_list: '매우 붐빔|보통|보통|보통|보통' }),
    )

    expect(flow.slots[0].congestion).toBeNull()
    expect(flow.slots[1].congestion).toBe('보통')
  })

  // 서울의 프런트엔드도 이 필드에 null 검사를 두고 있다.
  it('평소 값이 통째로 없어도 나머지는 읽는다', () => {
    const flow = parsePopulationFlow(payload({ before_people_value: null }))

    expect(flow.slots).toHaveLength(5)
    expect(flow.slots.every((s) => s.usual === null)).toBe(true)
    expect(flow.slots[0].people).toBe(35_000)
  })
})
