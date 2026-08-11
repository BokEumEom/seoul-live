import { describe, expect, it } from 'vitest'
import {
  formatDistance,
  haversineMeters,
  nearestEntry,
  walkableMinutes,
  walkingMinutes,
} from './distance'

const CITY_HALL = { lat: 37.5665, lng: 126.978 }
const GANGNAM = { lat: 37.498, lng: 127.0276 }

describe('nearestEntry', () => {
  const entries = [
    { name: '강남', ...GANGNAM },
    { name: '시청', ...CITY_HALL },
    { name: '부산', lat: 35.1796, lng: 129.0756 },
  ]

  it('가장 가까운 항목을 돌려준다', () => {
    expect(nearestEntry(entries, { lat: 37.5709, lng: 126.9769 })?.name).toBe('시청')
    expect(nearestEntry(entries, { lat: 37.4979, lng: 127.0276 })?.name).toBe('강남')
  })

  it('좌표가 없으면 null이다', () => {
    // 위치를 거부한 사용자에게 "가장 가까운 곳"을 지어내면 안 된다. 호출부가
    // 기본 명소를 고르게 두려면 여기서 없다고 말해야 한다.
    expect(nearestEntry(entries, null)).toBeNull()
  })

  it('후보가 없으면 null이다', () => {
    expect(nearestEntry([], CITY_HALL)).toBeNull()
  })

  it('입력 배열을 건드리지 않는다', () => {
    const input = [...entries]
    nearestEntry(input, CITY_HALL)
    expect(input.map((entry) => entry.name)).toEqual(['강남', '시청', '부산'])
  })
})

describe('haversineMeters', () => {
  it('같은 지점은 0이다', () => {
    expect(haversineMeters(CITY_HALL, CITY_HALL)).toBe(0)
  })

  it('서울시청-강남역은 약 8.78km다', () => {
    expect(haversineMeters(CITY_HALL, GANGNAM)).toBeCloseTo(8783, -1)
  })

  it('방향이 바뀌어도 거리는 같다', () => {
    expect(haversineMeters(CITY_HALL, GANGNAM)).toBeCloseTo(
      haversineMeters(GANGNAM, CITY_HALL),
      6,
    )
  })
})

describe('formatDistance', () => {
  it('1km 미만은 미터로 표시한다', () => {
    expect(formatDistance(800)).toBe('800m')
    expect(formatDistance(45)).toBe('50m')
  })

  it('1km 이상은 소수점 한 자리 km로 표시한다', () => {
    expect(formatDistance(1200)).toBe('1.2km')
    expect(formatDistance(8700)).toBe('8.7km')
  })

  it('반올림이 1km를 넘기면 km로 표시한다', () => {
    expect(formatDistance(997)).toBe('1.0km')
    expect(formatDistance(994)).toBe('990m')
    expect(formatDistance(1000)).toBe('1.0km')
  })
})

describe('walkingMinutes', () => {
  it('시속 4km 기준으로 계산한다', () => {
    expect(walkingMinutes(800)).toBe(12)
    expect(walkingMinutes(2000)).toBe(30)
  })

  it('최소 1분은 보장한다', () => {
    expect(walkingMinutes(10)).toBe(1)
  })

  it('0m도 최소 1분으로 본다', () => {
    expect(walkingMinutes(0)).toBe(1)
  })
})

// 상한이 필요한 이유: 명소 상세 히어로는 거리와 무관하게 이 값을 쓰는 첫
// 자리다. 홍대입구역 10.7km에서 「도보 160분」이 그대로 나오면 첫 세 줄이
// 실없어진다. 2km 반경만 보던 RecommendationCard에서는 드러나지 않던 결함이다.
describe('walkableMinutes', () => {
  // 경계를 양쪽에서 잠근다. 4km가 정확히 60분이라 여기가 갈림길이다.
  it('한 시간까지는 그대로 준다', () => {
    expect(walkableMinutes(4000)).toBe(60)
  })

  it('한 시간을 넘으면 걸어갈 거리로 보지 않는다', () => {
    expect(walkableMinutes(4100)).toBeNull()
  })

  it('가까운 거리는 walkingMinutes와 같은 값이다', () => {
    expect(walkableMinutes(800)).toBe(walkingMinutes(800))
  })
})
