import { describe, expect, it } from 'vitest'
import { AREA_CATALOG } from './areas'
import { buildMockSnapshot } from './mock'
import { parseCitydataResponse } from './schema'

describe('buildMockSnapshot', () => {
  it('실제 응답 스키마를 통과하는 형태를 만든다', () => {
    expect(() => parseCitydataResponse(buildMockSnapshot('강남역'), '강남역')).not.toThrow()
  })

  it('요청한 명소 이름을 그대로 반영한다', () => {
    expect(parseCitydataResponse(buildMockSnapshot('성수카페거리'), '성수카페거리').name).toBe(
      '성수카페거리',
    )
  })

  it('카탈로그에 등록된 코드를 그대로 돌려준다', () => {
    // 실제 응답도 목업도 같은 code를 줘야 client.ts에서 snapshot.code === entry.code로
    // 오타를 대조하거나, React key로 안전하게 쓸 수 있다.
    for (const area of AREA_CATALOG) {
      const snapshot = parseCitydataResponse(buildMockSnapshot(area.name), area.name)
      expect(snapshot.code).toBe(area.code)
    }
  })

  it('같은 명소는 항상 같은 혼잡도를 준다', () => {
    const first = parseCitydataResponse(buildMockSnapshot('강남역'), '강남역')
    const second = parseCitydataResponse(buildMockSnapshot('강남역'), '강남역')
    expect(first.congestion).toBe(second.congestion)
  })

  it('명소마다 혼잡도가 다르게 나온다', () => {
    // 30곳 중 29곳이 같은 값이어도 toBeGreaterThan(1)은 통과한다 — 4단계가 실제로
    // 골고루 등장하는지까지 고정한다.
    const levels = new Set(
      AREA_CATALOG.map((a) => parseCitydataResponse(buildMockSnapshot(a.name), a.name).congestion),
    )
    expect(levels.size).toBe(4)
  })

  it('12시간치 예측을 만든다', () => {
    expect(parseCitydataResponse(buildMockSnapshot('경복궁'), '경복궁').forecasts).toHaveLength(
      12,
    )
  })

  it('예측 hour가 0~23 범위다', () => {
    for (const f of parseCitydataResponse(buildMockSnapshot('경복궁'), '경복궁').forecasts) {
      expect(f.hour).toBeGreaterThanOrEqual(0)
      expect(f.hour).toBeLessThanOrEqual(23)
    }
  })

  it('카탈로그의 모든 명소에 대해 동작한다', () => {
    for (const area of AREA_CATALOG) {
      expect(() => parseCitydataResponse(buildMockSnapshot(area.name), area.name)).not.toThrow()
    }
  })

  it('예측 혼잡도가 카탈로그 전체에서 4단계 모두 나타난다', () => {
    // 시간 간 상관이 있으면(예: 매시간 한 단계씩 순환) 극단값이 실제보다 덜/더 나올 수 있다.
    // 카탈로그 전체·모든 시간대를 훑어 4단계가 골고루 나오는지 고정한다.
    const levels = new Set(
      AREA_CATALOG.flatMap(
        (area) => parseCitydataResponse(buildMockSnapshot(area.name), area.name).forecasts,
      ).map((forecast) => forecast.congestion),
    )
    expect(levels.size).toBe(4)
  })

  it('12시간 내내 여유가 한 번도 없는 명소가 최소 하나 있다 (빈 상태 개발용)', () => {
    // "지금은 붐빔, 21시엔 여유 예상" 같은 한산 시간 추천 기능은 "한산해지는 시각 없음"
    // 빈 상태도 다뤄야 한다. 그 화면을 목업만으로 개발할 수 있어야 한다.
    const hasAreaWithoutCalmHour = AREA_CATALOG.some((area) => {
      const snapshot = parseCitydataResponse(buildMockSnapshot(area.name), area.name)
      return snapshot.forecasts.every((forecast) => forecast.congestion !== '여유')
    })
    expect(hasAreaWithoutCalmHour).toBe(true)
  })

  describe('인구 구성', () => {
    it('목업에도 인구 구성이 실려 온다', () => {
      // 목업에 없으면 개발 중에 인구 구성 섹션을 한 번도 볼 수 없다.
      const composition = parseCitydataResponse(buildMockSnapshot('강남역'), '강남역').composition
      expect(composition).not.toBeNull()
      expect(composition?.ageRates).toHaveLength(8)
    })

    it('연령대 비율의 합이 100에 가깝다', () => {
      // 화면은 합을 가정하지 않지만, 목업이 실제 응답과 동떨어진 분포를 주면
      // 막대 그래프의 눈금을 잘못 잡아도 개발 중에 티가 나지 않는다.
      const composition = parseCitydataResponse(buildMockSnapshot('경복궁'), '경복궁').composition
      const total = (composition?.ageRates ?? []).reduce((sum, value) => sum + value, 0)
      expect(total).toBeCloseTo(100, 0)
    })

    it('남녀 비율을 더하면 100이다', () => {
      for (const area of AREA_CATALOG) {
        const c = parseCitydataResponse(buildMockSnapshot(area.name), area.name).composition
        expect((c?.maleRate ?? 0) + (c?.femaleRate ?? 0)).toBe(100)
      }
    })

    it('비상주 비율이 높은 곳과 낮은 곳이 카탈로그 안에 둘 다 있다', () => {
      // residentLabel의 두 문구를 목업만으로 전부 볼 수 있어야 한다.
      const rates = AREA_CATALOG.map(
        (area) =>
          parseCitydataResponse(buildMockSnapshot(area.name), area.name).composition
            ?.nonResidentRate ?? 0,
      )
      expect(rates.some((rate) => rate > 60)).toBe(true)
      expect(rates.some((rate) => rate <= 60)).toBe(true)
    })

    it('같은 명소는 항상 같은 인구 구성을 준다', () => {
      const first = parseCitydataResponse(buildMockSnapshot('강남역'), '강남역').composition
      const second = parseCitydataResponse(buildMockSnapshot('강남역'), '강남역').composition
      expect(first).toEqual(second)
    })

    it('명소마다 인구 구성이 다르다', () => {
      const keys = new Set(
        AREA_CATALOG.map((area) => {
          const c = parseCitydataResponse(buildMockSnapshot(area.name), area.name).composition
          return `${c?.maleRate}:${c?.nonResidentRate}:${c?.ageRates.join(',')}`
        }),
      )
      expect(keys.size).toBe(AREA_CATALOG.length)
    })
  })

  describe('자정을 넘기는 시각', () => {
    it('23시 기준으로 만든 예측도 다음날로 굴러가며 스키마를 통과한다', () => {
      // 가짜 타이머 없이 `now`를 직접 주입한다 — buildMockSnapshot(areaName, now)가
      // 이걸 위해 존재한다.
      const lateNight = new Date('2026-08-03T23:30:00')
      const snapshot = parseCitydataResponse(buildMockSnapshot('강남역', lateNight), '강남역')
      expect(snapshot.forecasts).toHaveLength(12)
      expect(snapshot.forecasts[0].hour).toBe(0)
      expect(snapshot.forecasts[0].time).toBe('2026-08-04 00:00')
    })
  })
})
