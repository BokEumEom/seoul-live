import { describe, expect, it } from 'vitest'
import { formatDistance, haversineMeters, walkingMinutes } from './distance'

const CITY_HALL = { lat: 37.5665, lng: 126.978 }
const GANGNAM = { lat: 37.498, lng: 127.0276 }

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
