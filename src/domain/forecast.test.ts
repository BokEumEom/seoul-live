import { describe, expect, it } from 'vitest'
import {
  findQuietTime,
  forecastPopulation,
  formatPopulationTick,
  niceAxisMax,
  peakForecast,
} from './forecast'
import type { CongestionLevel, Forecast } from './types'

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

// 샘플(서울 인파레이더 상세)의 막대그래프를 우리 데이터로 옮긴다. 그쪽은
// 24시간(과거+현재+미래)에 어제 곡선까지 겹치지만 **우리는 과거를 가질 수
// 없다** — 서울 API의 요청 인자에 날짜가 없다. 실데이터에서 예보는 12개다.
// 그래서 그리는 것은 「지금 + 앞으로 N시간」이고, 제목도 그렇게 적는다.
describe('forecastPopulation', () => {
  it('구간의 가운데 값을 쓴다', () => {
    // 화면은 「40,000~42,000명」처럼 구간으로 말하는데 막대는 높이가 하나여야
    // 한다. 가운데가 그 구간을 대표하는 유일하게 치우치지 않은 값이다.
    expect(forecastPopulation({ populationMin: 40000, populationMax: 42000 })).toBe(41000)
  })

  it('구간이 한 점이면 그 값이다', () => {
    expect(forecastPopulation({ populationMin: 3000, populationMax: 3000 })).toBe(3000)
  })

  it('홀수 폭이어도 정수로 떨어뜨리지 않는다', () => {
    // 내림하면 막대끼리 견줄 때 1명씩 어긋난다. 화면에 쓰는 값이 아니라
    // 높이를 정하는 값이라 소수여도 된다.
    expect(forecastPopulation({ populationMin: 100, populationMax: 101 })).toBe(100.5)
  })
})

describe('peakForecast', () => {
  const at = (hour: number, population: number, congestion: CongestionLevel): Forecast => ({
    time: `2026-08-13 ${String(hour).padStart(2, '0')}:00`,
    hour,
    congestion,
    populationMin: population,
    populationMax: population,
  })

  it('가장 붐빌 시각을 인원으로 고른다', () => {
    // 혼잡도 4단계로 고르면 같은 「붐빔」이 여럿일 때 첫 번째가 뽑혀,
    // 실제 정점이 아니라 정점 구간의 시작을 가리킨다.
    const peak = peakForecast([at(15, 44000, '붐빔'), at(18, 46000, '붐빔'), at(21, 20000, '보통')])

    expect(peak?.hour).toBe(18)
  })

  it('같은 인원이면 이른 시각을 고른다', () => {
    // 「언제까지 피해야 하나」가 아니라 「언제부터 붐비나」를 알려주는 쪽이
    // 행동으로 이어진다.
    const peak = peakForecast([at(15, 44000, '붐빔'), at(18, 44000, '붐빔')])

    expect(peak?.hour).toBe(15)
  })

  it('예보가 없으면 null이다', () => {
    expect(peakForecast([])).toBeNull()
  })
})

describe('niceAxisMax', () => {
  it('가장 높은 막대 위에 여백을 남긴다', () => {
    // 막대가 천장에 닿으면 잘린 것처럼 보인다.
    expect(niceAxisMax(46000)).toBeGreaterThan(46000)
  })

  it('눈금 넷으로 딱 떨어지는 값을 고른다', () => {
    // 46,000 → 눈금 15,000짜리 넷 = 60,000. 샘플의 축(0/1.5만/3만/4.5만/6만)과
    // 같은 값이 나온다 — 그쪽도 같은 규칙을 쓴다는 뜻이다.
    expect(niceAxisMax(46000)).toBe(60000)
    expect(niceAxisMax(46000) % 4).toBe(0)
  })

  it('작은 명소에서도 읽을 수 있는 눈금이 된다', () => {
    // 반포한강공원은 2,500~3,000명이다. 만 단위로 고정하면 막대가 바닥에 붙는다.
    expect(niceAxisMax(3000)).toBe(3200)
  })

  it('0이어도 0으로 나누지 않는다', () => {
    // 전 시간대가 0인 응답이 오면 축 계산이 NaN이 되고 SVG 전체가 사라진다.
    expect(niceAxisMax(0)).toBeGreaterThan(0)
  })
})

describe('formatPopulationTick', () => {
  it('만 단위부터는 만으로 줄인다', () => {
    // 60,000을 그대로 적으면 좁은 축에서 자리를 다 먹는다.
    expect(formatPopulationTick(60000)).toBe('6만')
    expect(formatPopulationTick(45000)).toBe('4.5만')
  })

  it('만 미만은 그대로 적는다', () => {
    // 0.32만은 아무도 안 읽는다.
    expect(formatPopulationTick(3200)).toBe('3,200')
    expect(formatPopulationTick(800)).toBe('800')
  })

  it('0은 0이다', () => {
    expect(formatPopulationTick(0)).toBe('0')
  })
})
