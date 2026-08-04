import { describe, expect, it } from 'vitest'
import { findQuietTime } from './forecast'
import type { Forecast } from './types'

function forecast(time: string, congestion: Forecast['congestion']): Forecast {
  return {
    time,
    hour: Number(time.slice(11, 13)),
    congestion,
    populationMin: 0,
    populationMax: 0,
  }
}

describe('findQuietTime', () => {
  it('여유로 떨어지는 가장 이른 시각을 준다', () => {
    const result = findQuietTime('붐빔', [
      forecast('2026-08-03 16:00', '붐빔'),
      forecast('2026-08-03 21:00', '여유'),
      forecast('2026-08-03 22:00', '여유'),
    ])

    expect(result).toBe(21)
  })

  it('이미 한산하면 null을 준다', () => {
    expect(findQuietTime('여유', [forecast('2026-08-03 21:00', '여유')])).toBeNull()
  })

  it('예측에 여유가 없으면 null을 준다', () => {
    expect(findQuietTime('붐빔', [forecast('2026-08-03 16:00', '붐빔')])).toBeNull()
  })

  it('예측이 비어도 안전하다', () => {
    expect(findQuietTime('붐빔', [])).toBeNull()
  })

  it('보통은 아직 여유가 아니라서 안내 대상이다', () => {
    // isUncrowded는 보통까지 한산으로 보지만, 화면 문구가 "여유 예상"이라
    // 여기서는 여유만 센다. 두 범위가 다른 건 의도된 것이다.
    const result = findQuietTime('보통', [
      forecast('2026-08-03 16:00', '보통'),
      forecast('2026-08-03 20:00', '여유'),
    ])

    expect(result).toBe(20)
  })

  it('자정 이후 시각도 0으로 정확히 준다', () => {
    // hour가 0이면 falsy다. `?? null` 대신 `|| null`로 쓰면 0시가 사라진다.
    const result = findQuietTime('붐빔', [forecast('2026-08-04 00:00', '여유')])

    expect(result).toBe(0)
  })
})
