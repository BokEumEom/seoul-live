import { describe, expect, it } from 'vitest'
import {
  filterAreas,
  filterByPreset,
  filterCounts,
  filterLabel,
  PRESETS,
} from './presets'
import type {
  AreaCategory,
  AreaSnapshot,
  CongestionLevel,
  NearbyArea,
  Purpose,
} from './types'

function area(
  name: string,
  category: AreaCategory,
  congestion: CongestionLevel | null,
  purposes?: readonly Purpose[],
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
          composition: null,
        }

  return {
    entry: { code: 'POI000', name, lat: 37.5, lng: 127, category, purposes },
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
    expect(
      filterByPreset([area('남산공원', '공원', '여유', ['kids', 'date'])], 'kids'),
    ).toHaveLength(1)
  })

  it('보통인 공원도 고른다', () => {
    // isUncrowded의 범위가 여유+보통이다. 여유만으로 좁히면 주말 오후에
    // 갈 곳이 거의 없어진다.
    expect(
      filterByPreset([area('서울숲공원', '공원', '보통', ['kids', 'date'])], 'kids'),
    ).toHaveLength(1)
  })

  it('약간 붐비는 공원은 뺀다', () => {
    expect(
      filterByPreset(
        [area('여의도한강공원', '공원', '약간 붐빔', ['kids', 'date'])],
        'kids',
      ),
    ).toHaveLength(0)
  })

  it('한산해도 나들이 태그가 없으면 뺀다', () => {
    // 카테고리가 아니라 태그가 기준이다. 성수카페거리는 발달상권이면서
    // 데이트 태그만 있다.
    expect(
      filterByPreset([area('성수카페거리', '발달상권', '여유', ['date'])], 'kids'),
    ).toHaveLength(0)
  })
})

describe('데이트', () => {
  it('데이트 태그가 붙은 곳을 고른다', () => {
    // 카테고리가 서로 달라도 태그가 같으면 함께 걸린다 — 이게 태그를
    // 카테고리에서 떼어낸 이유다.
    const areas = [
      area('성수카페거리', '발달상권', '보통', ['date']),
      area('북촌한옥마을', '발달상권', '여유', ['date']),
      area('남산공원', '공원', '보통', ['kids', 'date']),
    ]

    expect(filterByPreset(areas, 'date')).toHaveLength(3)
  })

  it('같은 카테고리라도 태그가 없으면 뺀다', () => {
    // 광장(전통)시장과 청담동 명품거리가 같은 발달상권인데 데이트
    // 적합성은 정반대다. 카테고리로는 이 둘을 가를 수 없다.
    const areas = [
      area('가로수길', '발달상권', '여유'),
      area('강남역', '인구밀집지역', '여유'),
    ]

    expect(filterByPreset(areas, 'date')).toHaveLength(0)
  })

  it('붐비는 곳은 뺀다', () => {
    // 태그만으로 잡으면 카탈로그상 항상 19곳으로 고정돼, 옆의 두 칩이
    // 시간대마다 바뀌는 사이에서 혼자 죽은 숫자가 된다.
    expect(
      filterByPreset([area('인사동', '발달상권', '붐빔', ['date'])], 'date'),
    ).toHaveLength(0)
  })

  it('약간 붐비는 곳은 남긴다', () => {
    expect(
      filterByPreset([area('인사동', '발달상권', '약간 붐빔', ['date'])], 'date'),
    ).toHaveLength(1)
  })
})

describe('지금 핫플', () => {
  it('붐비는 곳만 고른다', () => {
    const areas = [
      area('강남역', '인구밀집지역', '붐빔'),
      area('남산공원', '공원', '여유', ['kids', 'date']),
    ]

    const picked = filterByPreset(areas, 'hot')
    expect(picked).toHaveLength(1)
    expect(picked[0].entry.name).toBe('강남역')
  })

  it('약간 붐빔은 아직 핫플이 아니다', () => {
    expect(
      filterByPreset([area('명동 관광특구', '관광특구', '약간 붐빔')], 'hot'),
    ).toHaveLength(0)
  })

  it('카테고리도 태그도 가리지 않는다', () => {
    const areas = [
      area('강남역', '인구밀집지역', '붐빔'),
      area('남산공원', '공원', '붐빔', ['kids', 'date']),
    ]

    expect(filterByPreset(areas, 'hot')).toHaveLength(2)
  })
})

describe('목적 태그가 없는 명소', () => {
  it('나들이·데이트에 안 걸리고 핫플에는 걸린다', () => {
    // 121곳으로 늘릴 때 태그를 빠뜨린 명소가 조용히 오분류되지 않고
    // 그냥 빠지게 하려는 것이다.
    const untagged = area('태그없음', '발달상권', '붐빔')

    expect(filterByPreset([untagged], 'kids')).toHaveLength(0)
    expect(filterByPreset([untagged], 'date')).toHaveLength(0)
    expect(filterByPreset([untagged], 'hot')).toHaveLength(1)
  })
})

describe('스냅샷이 없는 명소', () => {
  it('어느 프리셋에도 걸리지 않는다', () => {
    // 혼잡도를 모르는데 "한산하다"고 말할 수 없다. 지도 전체 보기에서는
    // 회색 "정보 없음" 마커로 남지만 프리셋을 켜면 빠진다.
    const areas = [
      area('남산공원', '공원', null, ['kids', 'date']),
      area('성수카페거리', '발달상권', null, ['date']),
      area('강남역', '인구밀집지역', null),
    ]

    for (const key of ['kids', 'date', 'hot'] as const) {
      expect(filterByPreset(areas, key)).toHaveLength(0)
    }
  })
})

describe('filterByPreset', () => {
  it('프리셋이 없으면 전체를 돌려준다', () => {
    const areas = [
      area('강남역', '인구밀집지역', '붐빔'),
      area('남산공원', '공원', '여유', ['kids', 'date']),
    ]

    expect(filterByPreset(areas, null)).toHaveLength(2)
  })

  it('입력 배열을 변경하지 않는다', () => {
    const areas = [
      area('강남역', '인구밀집지역', '붐빔'),
      area('남산공원', '공원', '여유', ['kids', 'date']),
    ]

    filterByPreset(areas, 'hot')

    expect(areas).toHaveLength(2)
    expect(areas[1].entry.name).toBe('남산공원')
  })
})

describe('filterAreas', () => {
  const areas = [
    area('남산공원', '공원', '여유', ['kids', 'date']),
    area('성수카페거리', '발달상권', '붐빔', ['date']),
    area('강남역', '인구밀집지역', '붐빔'),
  ]

  it('내 장소는 담아둔 이름만 남긴다', () => {
    const picked = filterAreas(areas, 'fav', ['강남역', '남산공원'])

    expect(picked.map((item) => item.entry.name)).toEqual(['남산공원', '강남역'])
  })

  it('담아둔 이름이 목록에 없으면 그냥 빠진다', () => {
    // 카테고리로 좁혔거나 카탈로그에서 이름이 바뀐 경우다. 저장된 개수를
    // 그대로 쓰면 칩에 2라고 써놓고 목록에는 1개만 뜬다.
    const picked = filterAreas(areas, 'fav', ['강남역', '사라진곳'])

    expect(picked.map((item) => item.entry.name)).toEqual(['강남역'])
  })

  it('프리셋 키는 filterByPreset과 같은 결과를 준다', () => {
    // 즐겨찾기를 끼워 넣으면서 프리셋 쪽 술어가 갈라지지 않았는지 본다.
    for (const key of ['kids', 'date', 'hot'] as const) {
      expect(filterAreas(areas, key, [])).toEqual(filterByPreset(areas, key))
    }
  })

  it('필터가 없으면 전체를 그대로 돌려준다', () => {
    expect(filterAreas(areas, null, ['강남역'])).toBe(areas)
  })
})

describe('filterCounts', () => {
  it('칩 넷의 개수를 센다', () => {
    const areas = [
      area('남산공원', '공원', '여유', ['kids', 'date']),
      area('서울숲공원', '공원', '보통', ['kids', 'date']),
      area('성수카페거리', '발달상권', '붐빔', ['date']),
      area('강남역', '인구밀집지역', '붐빔'),
    ]

    expect(filterCounts(areas, ['강남역'])).toEqual({
      fav: 1,
      kids: 2,
      date: 2,
      hot: 2,
    })
  })

  it('해당 없으면 0이다', () => {
    expect(filterCounts([area('강남역', '인구밀집지역', '붐빔')], [])).toEqual({
      fav: 0,
      kids: 0,
      date: 0,
      hot: 1,
    })
  })

  it('개수와 필터 결과 길이가 항상 같다', () => {
    // 둘이 어긋나면 칩에 "3"이라고 써놓고 마커는 5개가 뜬다. 같은 술어를
    // 쓰는지 여기서 고정한다. 즐겨찾기도 예외가 아니다 — 「사라진곳」은
    // 저장돼 있지만 목록에 없다.
    const areas = [
      area('남산공원', '공원', '여유', ['kids', 'date']),
      area('여의도한강공원', '공원', '약간 붐빔', ['kids', 'date']),
      area('인사동', '발달상권', '보통', ['date']),
      area('강남역', '인구밀집지역', '붐빔'),
      area('경복궁', '고궁·문화유산', null, ['date']),
    ]
    const favorites = ['남산공원', '인사동', '사라진곳']

    const counts = filterCounts(areas, favorites)
    for (const key of ['fav', 'kids', 'date', 'hot'] as const) {
      expect(filterAreas(areas, key, favorites)).toHaveLength(counts[key])
    }
    expect(counts.fav).toBe(2)
  })
})

describe('filterLabel', () => {
  it('즐겨찾기 칩의 이름을 준다', () => {
    expect(filterLabel('fav')).toBe('내 장소')
  })

  it('프리셋 이름은 PRESETS의 것을 그대로 쓴다', () => {
    // 라벨을 여기 복사해두면 이름을 고칠 때 한쪽만 옛 이름으로 남는다.
    // 칩과 빈 목록 문구가 같은 말을 하는지가 이 함수의 존재 이유다.
    for (const preset of PRESETS) {
      expect(filterLabel(preset.key)).toBe(preset.label)
    }
  })

  it('키마다 다른 이름이 나온다', () => {
    // 위 반복문은 PRESETS에 든 것만 훑는다. 프리셋 하나가 PRESETS에서 빠지면
    // 그 키는 폴백으로 떨어져 「내 장소」라고 답하는데, 반복문은 그 키를
    // 아예 돌지 않아 조용히 통과한다. 빈 목록 문구가 엉뚱한 필터를 지목하게
    // 되는 자리라 키 넷을 직접 센다.
    const labels = (['fav', 'kids', 'date', 'hot'] as const).map(filterLabel)
    expect(new Set(labels).size).toBe(labels.length)
  })
})
