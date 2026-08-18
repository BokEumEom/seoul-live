import { describe, expect, it } from 'vitest'
import { categoryAverages, summarize, topBusiest, topCalmest } from './summary'
import type { AreaCategory, AreaSnapshot, CongestionLevel, NearbyArea } from './types'

function snap(name: string, congestion: CongestionLevel): AreaSnapshot {
  return {
    code: name,
    name,
    congestion,
    message: '',
    populationMin: 0,
    populationMax: 0,
    observedAt: '2026-08-07 11:00',
    observedAtLabel: '11:00',
    forecasts: [],
    composition: null,
    replaced: null,
  }
}

function area(
  name: string,
  congestion: CongestionLevel | null,
  category: AreaCategory = '공원',
): NearbyArea {
  return {
    entry: { code: name, name, nameEn: name, lat: 0, lng: 0, category },
    snapshot: congestion === null ? null : snap(name, congestion),
    distanceMeters: null,
  }
}

describe('summarize', () => {
  it('혼잡도 분포를 센다', () => {
    const result = summarize([
      area('a', '여유'),
      area('b', '여유'),
      area('c', '붐빔'),
      area('d', null),
    ])
    expect(result.total).toBe(4)
    expect(result.counted).toBe(3)
    expect(result.byLevel).toEqual({
      여유: 2,
      보통: 0,
      '약간 붐빔': 0,
      붐빔: 1,
    })
  })

  it('전부 스냅샷이 없으면 counted가 0이다', () => {
    const result = summarize([area('a', null)])
    expect(result.counted).toBe(0)
    expect(result.byLevel.여유).toBe(0)
  })
})

describe('topBusiest / topCalmest', () => {
  const areas = [
    area('여유1', '여유'),
    area('붐빔1', '붐빔'),
    area('보통1', '보통'),
    area('약간1', '약간 붐빔'),
    area('없음', null),
  ]

  it('붐비는 순으로 뽑고 스냅샷 없는 곳은 제외한다', () => {
    expect(topBusiest(areas, 2).map((a) => a.entry.name)).toEqual(['붐빔1', '약간1'])
  })

  it('여유로운 순으로 뽑는다', () => {
    expect(topCalmest(areas, 2).map((a) => a.entry.name)).toEqual(['여유1', '보통1'])
  })

  it('limit보다 적으면 있는 만큼만 준다', () => {
    expect(topBusiest([area('a', '여유')], 5)).toHaveLength(1)
  })

  it('스냅샷이 없는 명소는 limit을 채우는 데 쓰이지 않는다', () => {
    // "입력 배열 불변" 대신 둔다 — toSorted를 쓰는 한 불변은 무엇을 해도
    // 참이라 잡을 수 있는 결함이 없다. 이건 filter를 빼면 실패한다.
    expect(topBusiest([area('a', null), area('b', null)], 5)).toEqual([])
  })
})

describe('categoryAverages', () => {
  it('카테고리별 평균 혼잡도를 낸다', () => {
    const result = categoryAverages([
      area('p1', '여유', '공원'),
      area('p2', '보통', '공원'),
      area('s1', '붐빔', '발달상권'),
    ])
    // 공원 평균 rank = (0+1)/2 = 0.5 → 반올림 1 → '보통'
    expect(result).toContainEqual({ category: '공원', level: '보통' })
    expect(result).toContainEqual({ category: '발달상권', level: '붐빔' })
  })

  it('스냅샷이 하나도 없는 카테고리는 빠진다', () => {
    expect(categoryAverages([area('x', null, '공원')])).toEqual([])
  })

  it('공식 분류 순서를 따른다', () => {
    // AREA_CATEGORIES 순서를 그대로 쓴다. 화면이 매번 같은 줄 순서를
    // 보이려면 집계가 순서를 정해야 한다.
    const result = categoryAverages([
      area('p', '여유', '공원'),
      area('t', '여유', '관광특구'),
      area('s', '여유', '발달상권'),
    ])
    expect(result.map((r) => r.category)).toEqual(['관광특구', '발달상권', '공원'])
  })
})
