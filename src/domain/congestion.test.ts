import { describe, expect, it } from 'vitest'
import {
  congestionHeadline,
  congestionRank,
  congestionTone,
  isUncrowded,
  parseCongestionLevel,
} from './congestion'
import { CONGESTION_LEVELS } from './types'

describe('parseCongestionLevel', () => {
  it('서울 API가 주는 4단계를 그대로 인식한다', () => {
    expect(parseCongestionLevel('여유')).toBe('여유')
    expect(parseCongestionLevel('보통')).toBe('보통')
    expect(parseCongestionLevel('약간 붐빔')).toBe('약간 붐빔')
    expect(parseCongestionLevel('붐빔')).toBe('붐빔')
  })

  it('앞뒤 공백을 무시한다', () => {
    expect(parseCongestionLevel('  붐빔 ')).toBe('붐빔')
  })

  it('모르는 값은 null을 준다', () => {
    expect(parseCongestionLevel('매우 붐빔')).toBeNull()
    expect(parseCongestionLevel('')).toBeNull()
  })
})

describe('congestionRank', () => {
  it('여유가 가장 낮고 붐빔이 가장 높다', () => {
    expect(congestionRank('여유')).toBe(0)
    expect(congestionRank('보통')).toBe(1)
    expect(congestionRank('약간 붐빔')).toBe(2)
    expect(congestionRank('붐빔')).toBe(3)
  })

  it('정렬에 쓸 수 있다', () => {
    const sorted = ['붐빔' as const, '여유' as const, '보통' as const].toSorted(
      (a, b) => congestionRank(a) - congestionRank(b),
    )
    expect(sorted).toEqual(['여유', '보통', '붐빔'])
  })
})

describe('congestionTone', () => {
  it('단계마다 다른 톤을 준다', () => {
    expect(congestionTone('여유')).toBe('calm')
    expect(congestionTone('보통')).toBe('normal')
    expect(congestionTone('약간 붐빔')).toBe('busy')
    expect(congestionTone('붐빔')).toBe('crowded')
  })
})

describe('isUncrowded', () => {
  it('여유와 보통만 한산한 것으로 본다', () => {
    expect(isUncrowded('여유')).toBe(true)
    expect(isUncrowded('보통')).toBe(true)
    expect(isUncrowded('약간 붐빔')).toBe(false)
    expect(isUncrowded('붐빔')).toBe(false)
  })
})

describe('congestionHeadline', () => {
  it('4단계 모두 서로 다른 문구를 준다', () => {
    const headlines = CONGESTION_LEVELS.map(congestionHeadline)
    expect(new Set(headlines).size).toBe(CONGESTION_LEVELS.length)
  })

  it('시안의 문구를 그대로 쓴다', () => {
    // stitch_ui/_3 시안의 큰 제목이 "극심한 혼잡"이다.
    expect(congestionHeadline('붐빔')).toBe('극심한 혼잡')
  })

  it('붐빌수록 강한 표현이 된다', () => {
    expect(congestionHeadline('여유')).toBe('매우 원활')
    expect(congestionHeadline('보통')).toBe('원활')
    expect(congestionHeadline('약간 붐빔')).toBe('다소 혼잡')
  })
})
