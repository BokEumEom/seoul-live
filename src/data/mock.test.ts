import { describe, expect, it } from 'vitest'
import { AGE_LABELS, residentLabel } from '../domain/composition'
import type { PopulationComposition } from '../domain/composition'
import { AREA_CATALOG } from './areas'
import { buildMockPopulationRows } from './mock'
import { parseCitydataResponse } from './schema'

// 인구 구성이 **있는** 명소. 목업은 일부 명소의 인구 구성을 일부러 비우므로(빈 상태
// 개발용) 특정 명소를 집어 쓰는 테스트는 채워진 쪽을 골라야 한다. 씨앗을 바꾸면 이
// 명소가 빈 쪽으로 넘어갈 수 있고, 그러면 아래 테스트들이 곧바로 실패해서 알려준다.
const WITH_COMPOSITION = '광화문·덕수궁'

// `buildMockPopulationRows`는 행 배열만 돌려준다(mockCityInfo.ts가 다른 절과 함께
// CITYDATA 봉투로 조립한다). 이 파일은 파서 자체를 검증하는 것이 목적이라
// parseCitydataResponse가 기대하는 최소 봉투로 직접 감싼다.
function parseMockRows(name: string, now?: Date) {
  return parseCitydataResponse(
    { CITYDATA: { LIVE_PPLTN_STTS: buildMockPopulationRows(name, now) } },
    name,
  )
}

describe('buildMockPopulationRows', () => {
  it('실제 응답 스키마를 통과하는 형태를 만든다', () => {
    expect(() => parseMockRows('강남역')).not.toThrow()
  })

  it('요청한 명소 이름을 그대로 반영한다', () => {
    expect(parseMockRows('성수카페거리').name).toBe('성수카페거리')
  })

  it('카탈로그에 등록된 코드를 그대로 돌려준다', () => {
    // 실제 응답도 목업도 같은 code를 줘야 client.ts에서 snapshot.code === entry.code로
    // 오타를 대조하거나, React key로 안전하게 쓸 수 있다.
    for (const area of AREA_CATALOG) {
      const snapshot = parseMockRows(area.name)
      expect(snapshot.code).toBe(area.code)
    }
  })

  it('같은 명소는 항상 같은 혼잡도를 준다', () => {
    const first = parseMockRows('강남역')
    const second = parseMockRows('강남역')
    expect(first.congestion).toBe(second.congestion)
  })

  it('명소마다 혼잡도가 다르게 나온다', () => {
    // 30곳 중 29곳이 같은 값이어도 toBeGreaterThan(1)은 통과한다 — 4단계가 실제로
    // 골고루 등장하는지까지 고정한다.
    const levels = new Set(AREA_CATALOG.map((a) => parseMockRows(a.name).congestion))
    expect(levels.size).toBe(4)
  })

  it('12시간치 예측을 만든다', () => {
    expect(parseMockRows('경복궁').forecasts).toHaveLength(12)
  })

  it('예측 hour가 0~23 범위다', () => {
    for (const f of parseMockRows('경복궁').forecasts) {
      expect(f.hour).toBeGreaterThanOrEqual(0)
      expect(f.hour).toBeLessThanOrEqual(23)
    }
  })

  it('카탈로그의 모든 명소에 대해 동작한다', () => {
    for (const area of AREA_CATALOG) {
      expect(() => parseMockRows(area.name)).not.toThrow()
    }
  })

  it('예측 혼잡도가 카탈로그 전체에서 4단계 모두 나타난다', () => {
    // 시간 간 상관이 있으면(예: 매시간 한 단계씩 순환) 극단값이 실제보다 덜/더 나올 수 있다.
    // 카탈로그 전체·모든 시간대를 훑어 4단계가 골고루 나오는지 고정한다.
    const levels = new Set(
      AREA_CATALOG.flatMap((area) => parseMockRows(area.name).forecasts).map(
        (forecast) => forecast.congestion,
      ),
    )
    expect(levels.size).toBe(4)
  })

  it('12시간 내내 여유가 한 번도 없는 명소가 최소 하나 있다 (빈 상태 개발용)', () => {
    // "지금은 붐빔, 21시엔 여유 예상" 같은 한산 시간 추천 기능은 "한산해지는 시각 없음"
    // 빈 상태도 다뤄야 한다. 그 화면을 목업만으로 개발할 수 있어야 한다.
    const hasAreaWithoutCalmHour = AREA_CATALOG.some((area) => {
      const snapshot = parseMockRows(area.name)
      return snapshot.forecasts.every((forecast) => forecast.congestion !== '여유')
    })
    expect(hasAreaWithoutCalmHour).toBe(true)
  })

  describe('인구 구성', () => {
    function compositionOf(name: string): PopulationComposition | null {
      return parseMockRows(name).composition
    }

    function allCompositions(): readonly (PopulationComposition | null)[] {
      return AREA_CATALOG.map((area) => compositionOf(area.name))
    }

    function presentCompositions(): readonly PopulationComposition[] {
      return allCompositions().filter((c): c is PopulationComposition => c !== null)
    }

    it('목업에도 인구 구성이 실려 온다', () => {
      // 목업에 없으면 개발 중에 인구 구성 섹션을 한 번도 볼 수 없다.
      expect(compositionOf(WITH_COMPOSITION)).not.toBeNull()
    })

    it('연령대 여덟 칸을 빠짐없이 채운다', () => {
      // 목업의 칸 수가 compositionSchema의 AGE_KEYS와 어긋나면 남는 칸이 조용히 0이 된다.
      // 길이만 재면 그 0을 못 잡으므로 "0인 칸이 하나도 없다"까지 단언한다.
      const ageRates = compositionOf(WITH_COMPOSITION)?.ageRates ?? []
      expect(ageRates).toHaveLength(AGE_LABELS.length)
      expect(ageRates.filter((rate) => rate === 0)).toEqual([])
    })

    it('연령대 비율의 합이 100에 가깝다', () => {
      // 화면은 합을 가정하지 않지만, 목업이 실제 응답과 동떨어진 분포를 주면
      // 막대 그래프의 눈금을 잘못 잡아도 개발 중에 티가 나지 않는다.
      const total = (compositionOf(WITH_COMPOSITION)?.ageRates ?? []).reduce(
        (sum, value) => sum + value,
        0,
      )
      expect(total).toBeCloseTo(100, 0)
    })

    it('남녀 비율을 더하면 100이다', () => {
      const present = presentCompositions()
      expect(present.length).toBeGreaterThan(0)
      for (const c of present) {
        expect(c.maleRate + c.femaleRate).toBe(100)
      }
    })

    it('residentLabel의 두 문구가 카탈로그 안에서 전부 나온다', () => {
      // 임계값(60)을 손으로 베끼지 않는다 — 그 값은 export되지 않고, 바뀌면 이 테스트가
      // 조용히 무의미해진다. 실제로 문구를 뽑아 두 종류가 다 나오는지 본다.
      const labels = new Set(
        presentCompositions().flatMap((c) => {
          const label = residentLabel(c)
          return label === null ? [] : [label]
        }),
      )
      expect(labels.size).toBe(2)
    })

    it('인구 구성을 아예 주지 않는 명소가 최소 하나 있다', () => {
      // composition === null은 상세 화면이 섹션을 통째로 숨기는 길이다. 30곳을 전부
      // 채워주면 그 화면을 목업만으로는 한 번도 볼 수 없다 — mockCityInfo.ts가
      // 주차장·따릉이를 일부러 비워두는 것과 같은 이유다.
      expect(allCompositions().filter((c) => c === null).length).toBeGreaterThan(0)
    })

    it('그래도 대부분의 명소는 인구 구성을 준다', () => {
      // 반대 방향의 함정도 막는다. 전부 비면 인구 구성 섹션 자체를 볼 수 없다.
      expect(presentCompositions().length).toBeGreaterThan(AREA_CATALOG.length / 2)
    })

    it('같은 명소는 항상 같은 인구 구성을 준다', () => {
      expect(compositionOf(WITH_COMPOSITION)).toEqual(compositionOf(WITH_COMPOSITION))
    })

    it('인구 구성이 있는 명소끼리는 서로 값이 다르다', () => {
      const present = presentCompositions()
      const keys = new Set(
        present.map((c) => `${c.maleRate}:${c.nonResidentRate}:${c.ageRates.join(',')}`),
      )
      expect(keys.size).toBe(present.length)
    })
  })

  describe('자정을 넘기는 시각', () => {
    it('23시 기준으로 만든 예측도 다음날로 굴러가며 스키마를 통과한다', () => {
      // 가짜 타이머 없이 `now`를 직접 주입한다 — buildMockPopulationRows(areaName, now)가
      // 이걸 위해 존재한다.
      const lateNight = new Date('2026-08-03T23:30:00')
      const snapshot = parseMockRows('강남역', lateNight)
      expect(snapshot.forecasts).toHaveLength(12)
      expect(snapshot.forecasts[0].hour).toBe(0)
      expect(snapshot.forecasts[0].time).toBe('2026-08-04 00:00')
    })
  })
})
