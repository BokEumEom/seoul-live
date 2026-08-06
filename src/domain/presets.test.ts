import { describe, expect, it } from 'vitest'
import { filterByPreset, PRESETS, presetCounts } from './presets'
import type {
  AreaCategory,
  AreaSnapshot,
  CongestionLevel,
  NearbyArea,
} from './types'

function area(
  name: string,
  category: AreaCategory,
  congestion: CongestionLevel | null,
): NearbyArea {
  const snapshot: AreaSnapshot | null =
    congestion === null
      ? null
      : {
          code: 'POI000',
          name,
          congestion,
          message: '테스트',
          populationMin: 1_000,
          populationMax: 2_000,
          observedAt: '2026-08-06 14:00',
          observedAtLabel: '14:00',
          forecasts: [],
        }

  return {
    entry: { code: 'POI000', name, lat: 37.5, lng: 127, category },
    snapshot,
    distanceMeters: null,
  }
}

describe('PRESETS', () => {
  it('세 개이고 키가 겹치지 않는다', () => {
    expect(PRESETS).toHaveLength(3)
    expect(new Set(PRESETS.map((p) => p.key)).size).toBe(3)
  })
})

describe('아이와 나들이', () => {
  it('한산한 공원을 고른다', () => {
    expect(filterByPreset([area('남산공원', '공원', '여유')], 'kids')).toHaveLength(1)
  })

  it('보통인 공원도 고른다', () => {
    // isUncrowded의 범위가 여유+보통이다. 여유만으로 좁히면 주말 오후에
    // 갈 곳이 거의 없어진다.
    expect(filterByPreset([area('서울숲공원', '공원', '보통')], 'kids')).toHaveLength(1)
  })

  it('약간 붐비는 공원은 뺀다', () => {
    expect(filterByPreset([area('여의도한강공원', '공원', '약간 붐빔')], 'kids')).toHaveLength(0)
  })

  it('한산해도 공원이 아니면 뺀다', () => {
    expect(filterByPreset([area('성수카페거리', '카페', '여유')], 'kids')).toHaveLength(0)
  })
})

describe('데이트', () => {
  it('카페·문화재·공원을 고른다', () => {
    const areas = [
      area('성수카페거리', '카페', '보통'),
      area('북촌한옥마을', '문화재', '여유'),
      area('남산공원', '공원', '보통'),
    ]

    expect(filterByPreset(areas, 'date')).toHaveLength(3)
  })

  it('쇼핑몰과 기타는 뺀다', () => {
    const areas = [
      area('가로수길', '쇼핑몰', '여유'),
      area('강남역', '기타', '여유'),
    ]

    expect(filterByPreset(areas, 'date')).toHaveLength(0)
  })

  it('붐비는 곳은 뺀다', () => {
    // 카테고리만으로 잡으면 카탈로그상 항상 19곳으로 고정돼, 옆의 두 칩이
    // 시간대마다 바뀌는 사이에서 혼자 죽은 숫자가 된다.
    expect(filterByPreset([area('인사동', '문화재', '붐빔')], 'date')).toHaveLength(0)
  })

  it('약간 붐비는 곳은 남긴다', () => {
    expect(filterByPreset([area('인사동', '문화재', '약간 붐빔')], 'date')).toHaveLength(1)
  })
})

describe('지금 핫플', () => {
  it('붐비는 곳만 고른다', () => {
    const areas = [
      area('강남역', '기타', '붐빔'),
      area('남산공원', '공원', '여유'),
    ]

    const picked = filterByPreset(areas, 'hot')
    expect(picked).toHaveLength(1)
    expect(picked[0].entry.name).toBe('강남역')
  })

  it('약간 붐빔은 아직 핫플이 아니다', () => {
    expect(filterByPreset([area('명동 관광특구', '기타', '약간 붐빔')], 'hot')).toHaveLength(0)
  })

  it('카테고리를 가리지 않는다', () => {
    const areas = [
      area('강남역', '기타', '붐빔'),
      area('남산공원', '공원', '붐빔'),
    ]

    expect(filterByPreset(areas, 'hot')).toHaveLength(2)
  })
})

describe('스냅샷이 없는 명소', () => {
  it('어느 프리셋에도 걸리지 않는다', () => {
    // 혼잡도를 모르는데 "한산하다"고 말할 수 없다. 지도 전체 보기에서는
    // 회색 "정보 없음" 마커로 남지만 프리셋을 켜면 빠진다.
    const areas = [
      area('남산공원', '공원', null),
      area('성수카페거리', '카페', null),
      area('강남역', '기타', null),
    ]

    for (const key of ['kids', 'date', 'hot'] as const) {
      expect(filterByPreset(areas, key)).toHaveLength(0)
    }
  })
})

describe('filterByPreset', () => {
  it('프리셋이 없으면 전체를 돌려준다', () => {
    const areas = [
      area('강남역', '기타', '붐빔'),
      area('남산공원', '공원', '여유'),
    ]

    expect(filterByPreset(areas, null)).toHaveLength(2)
  })

  it('입력 배열을 변경하지 않는다', () => {
    const areas = [
      area('강남역', '기타', '붐빔'),
      area('남산공원', '공원', '여유'),
    ]

    filterByPreset(areas, 'hot')

    expect(areas).toHaveLength(2)
    expect(areas[1].entry.name).toBe('남산공원')
  })
})

describe('presetCounts', () => {
  it('프리셋별 개수를 센다', () => {
    const areas = [
      area('남산공원', '공원', '여유'),
      area('서울숲공원', '공원', '보통'),
      area('성수카페거리', '카페', '붐빔'),
      area('강남역', '기타', '붐빔'),
    ]

    expect(presetCounts(areas)).toEqual({ kids: 2, date: 2, hot: 2 })
  })

  it('해당 없으면 0이다', () => {
    expect(presetCounts([area('강남역', '기타', '붐빔')])).toEqual({
      kids: 0,
      date: 0,
      hot: 1,
    })
  })

  it('개수와 필터 결과 길이가 항상 같다', () => {
    // 둘이 어긋나면 칩에 "3"이라고 써놓고 마커는 5개가 뜬다. 같은 술어를
    // 쓰는지 여기서 고정한다.
    const areas = [
      area('남산공원', '공원', '여유'),
      area('여의도한강공원', '공원', '약간 붐빔'),
      area('인사동', '문화재', '보통'),
      area('강남역', '기타', '붐빔'),
      area('경복궁', '문화재', null),
    ]

    const counts = presetCounts(areas)
    for (const key of ['kids', 'date', 'hot'] as const) {
      expect(filterByPreset(areas, key)).toHaveLength(counts[key])
    }
  })
})
