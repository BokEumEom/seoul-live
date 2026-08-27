import { describe, expect, it } from 'vitest'
// JSON을 import로 읽는다. jsdom에서는 `import.meta.url`이 file: 스킴이 아니라
// http:라 `readFileSync(new URL(...))`가 죽는다 — `citydataFixture.test.ts`와 같다.
import fixture from '../../docs/fixtures/ppltn-congest-광화문덕수궁.json'
import { CONGESTION_LEVELS } from '../domain/types'
import { parsePopulationFlow } from './ppltnCongestSchema'

/**
 * **실응답으로 잰다.** `citydataFixture.test.ts`와 같은 이유다 — 손으로 지어낸
 * 목업은 우리가 상상한 모양만 담고 있어서, 키 이름이나 구조를 잘못 읽은 것을
 * 절대 못 잡는다. 이 서비스는 **명세가 아예 없는 내부 엔드포인트**라 그 위험이
 * 공식 API보다 크다.
 *
 * 픽스처는 2026-08-27 13시의 광화문·덕수궁 실호출이다.
 */
const PAYLOAD: unknown = fixture

const flow = parsePopulationFlow(PAYLOAD)

describe('parsePopulationFlow — 실응답', () => {
  /**
   * **25칸이 이 절의 골격이다.** 과거 12 + 지금 + 예보 12. 이 수가 달라지면
   * 「24시간 흐름」이라는 제목이 거짓이 되므로 여기서 못 박는다.
   */
  it('25칸을 읽는다', () => {
    expect(flow.slots).toHaveLength(25)
  })

  it('「지금」이 한가운데다', () => {
    expect(flow.nowIndex).toBe(12)
    // 앞이 실측이고 뒤가 예보다. 그 경계가 곧 「지금」이다.
    expect(flow.slots.slice(0, 12).every((s) => s.people !== null)).toBe(true)
    expect(flow.slots.slice(13).every((s) => s.people !== null)).toBe(true)
  })

  // 「현재」 칸에 시각 글자가 없어서 이웃에서 이어야 하는 자리다. 25칸이
  // 빈틈없는 한 시간 간격인지가 그 전제이므로 함께 잰다.
  it('시각이 한 시간씩 빈틈없이 이어진다', () => {
    const hours = flow.slots.map((slot) => slot.hour)

    expect(hours.every((hour) => hour !== null)).toBe(true)
    for (let index = 1; index < hours.length; index += 1) {
      expect(hours[index]).toBe((Number(hours[index - 1]) + 1) % 24)
    }
  })

  it('평소(4주 평균)를 25칸 모두 읽는다', () => {
    expect(flow.slots.every((slot) => slot.usual !== null)).toBe(true)
  })

  /**
   * **혼잡도 어휘가 이 앱의 4단계와 같다.** 다른 문에서 오는 값인데 낱말이
   * 같아서 `CongestionLevel`로 바로 받는다 — 어긋나면 전부 `null`이 되어 막대가
   * 회색으로 떨어지므로 여기서 확인한다.
   */
  it('혼잡도가 이 앱의 4단계로 읽힌다', () => {
    expect(flow.slots.every((slot) => slot.congestion !== null)).toBe(true)
    for (const slot of flow.slots) {
      expect(CONGESTION_LEVELS).toContain(slot.congestion)
    }
  })

  /**
   * **인원이 구간의 가운데다.** 실측 200칸에서 한 칸도 안 어긋났고, 그래야
   * 공식 API의 예보(min~max의 가운데)와 같은 축에 설 수 있다. 픽스처의 첫 칸으로
   * 그 규칙을 잠근다.
   */
  it('인원이 구간의 가운데와 맞는다', () => {
    const intervals = String(
      (PAYLOAD as { people_interval: string }[])[0].people_interval,
    ).split('|')

    flow.slots.forEach((slot, index) => {
      const matched = intervals[index].match(/^([\d/]+)~([\d/]+)명$/)
      expect(matched).not.toBeNull()
      const low = Number(String(matched?.[1]).replace(/\//g, ''))
      const high = Number(String(matched?.[2]).replace(/\//g, ''))
      expect(slot.people).toBe((low + high) / 2)
    })
  })
})
