import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AREA_CATALOG } from './areas'
import { buildMockSnapshot } from './mock'
import { parseCitydataResponse } from './schema'

describe('buildMockSnapshot', () => {
  it('실제 응답 스키마를 통과하는 형태를 만든다', () => {
    expect(() => parseCitydataResponse(buildMockSnapshot('강남역'))).not.toThrow()
  })

  it('요청한 명소 이름을 그대로 반영한다', () => {
    expect(parseCitydataResponse(buildMockSnapshot('성수카페거리')).name).toBe('성수카페거리')
  })

  it('같은 명소는 항상 같은 혼잡도를 준다', () => {
    const first = parseCitydataResponse(buildMockSnapshot('강남역'))
    const second = parseCitydataResponse(buildMockSnapshot('강남역'))
    expect(first.congestion).toBe(second.congestion)
  })

  it('명소마다 혼잡도가 다르게 나온다', () => {
    const levels = new Set(
      AREA_CATALOG.map((a) => parseCitydataResponse(buildMockSnapshot(a.name)).congestion),
    )
    expect(levels.size).toBeGreaterThan(1)
  })

  it('12시간치 예측을 만든다', () => {
    expect(parseCitydataResponse(buildMockSnapshot('경복궁')).forecasts).toHaveLength(12)
  })

  it('예측 hour가 0~23 범위다', () => {
    for (const f of parseCitydataResponse(buildMockSnapshot('경복궁')).forecasts) {
      expect(f.hour).toBeGreaterThanOrEqual(0)
      expect(f.hour).toBeLessThanOrEqual(23)
    }
  })

  it('카탈로그의 모든 명소에 대해 동작한다', () => {
    for (const area of AREA_CATALOG) {
      expect(() => parseCitydataResponse(buildMockSnapshot(area.name))).not.toThrow()
    }
  })

  describe('자정을 넘기는 시각', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-03T23:30:00'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('23시 기준으로 만든 예측도 다음날로 굴러가며 스키마를 통과한다', () => {
      const snapshot = parseCitydataResponse(buildMockSnapshot('강남역'))
      expect(snapshot.forecasts).toHaveLength(12)
      expect(snapshot.forecasts[0].hour).toBe(0)
      expect(snapshot.forecasts[0].time).toBe('2026-08-04 00:00')
    })
  })
})
