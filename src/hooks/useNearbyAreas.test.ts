import { describe, expect, it } from 'vitest'
import { AREA_CATALOG } from '../data/areas'
import type { AreaCatalogEntry, AreaSnapshot } from '../domain/types'
import {
  buildNearbyList,
  pickRecommendations,
  type SortMode,
} from './useNearbyAreas'

const ENTRIES: readonly AreaCatalogEntry[] = [
  {
    code: 'A',
    name: '가까운여유',
    lat: 37.5665,
    lng: 126.978,
    category: '공원',
  },
  {
    code: 'B',
    name: '가까운붐빔',
    lat: 37.5675,
    lng: 126.979,
    category: '발달상권',
  },
  { code: 'C', name: '먼여유', lat: 37.65, lng: 127.05, category: '공원' },
]

function snapshot(
  name: string,
  congestion: AreaSnapshot['congestion'],
): AreaSnapshot {
  return {
    code: name,
    name,
    congestion,
    message: '',
    populationMin: 0,
    populationMax: 0,
    observedAt: '2026-08-03 14:00',
    observedAtLabel: '14:00',
    forecasts: [],
  }
}

const SNAPSHOTS: readonly AreaSnapshot[] = [
  snapshot('가까운여유', '여유'),
  snapshot('가까운붐빔', '붐빔'),
  snapshot('먼여유', '여유'),
]

const HERE = { lat: 37.5665, lng: 126.978 }

describe('buildNearbyList — 붐비는 순', () => {
  // 전용 픽스처다. 동점(여유 둘)과 스냅샷 없는 항목을 일부러 넣는다.
  // 동점이 없으면 "역순"이 우연히 성립해 정렬 방향을 뒤집어도 통과한다.
  const BUSY_ENTRIES: readonly AreaCatalogEntry[] = [
    { code: 'A', name: '여유1', lat: 37.5, lng: 127, category: '공원' },
    { code: 'B', name: '붐빔1', lat: 37.5, lng: 127, category: '공원' },
    { code: 'C', name: '보통1', lat: 37.5, lng: 127, category: '공원' },
    { code: 'D', name: '여유2', lat: 37.5, lng: 127, category: '공원' },
    { code: 'E', name: '정보없음', lat: 37.5, lng: 127, category: '공원' },
  ]

  const BUSY_SNAPSHOTS: readonly (AreaSnapshot | null)[] = [
    snapshot('여유1', '여유'),
    snapshot('붐빔1', '붐빔'),
    snapshot('보통1', '보통'),
    snapshot('여유2', '여유'),
    null,
  ]

  function levels(sort: SortMode): readonly (AreaSnapshot['congestion'] | null)[] {
    return buildNearbyList({
      entries: BUSY_ENTRIES,
      snapshots: BUSY_SNAPSHOTS,
      coords: null,
      category: '전체',
      sort,
    }).map((item) => item.snapshot?.congestion ?? null)
  }

  it('혼잡도 내림차순으로 정렬한다', () => {
    expect(levels('busy')).toEqual(['붐빔', '보통', '여유', '여유', null])
  })

  it('여유로운 순과 정확히 반대 방향이다', () => {
    // 이름 순서로는 비교하지 않는다. 안정 정렬이 동점의 원래 순서를 지키므로
    // 목록을 통째로 뒤집은 것과는 절대 같아지지 않는다. 혼잡도 수열로 본다.
    const observed = (sort: SortMode) => levels(sort).filter((level) => level !== null)
    expect(observed('busy')).toEqual(observed('calm').toReversed())
  })

  it('스냅샷이 없는 명소는 붐비는 순에서도 뒤로 간다', () => {
    // 여유로운 순과 같은 방향이다 — "모름"은 붐비는 쪽에도 여유로운 쪽에도
    // 속하지 않으므로 어느 정렬에서든 맨 뒤여야 한다.
    expect(levels('busy').at(-1)).toBeNull()
  })

  it('좌표가 없으면 거리순을 골라도 여유로운 순으로 내려간다', () => {
    expect(levels('distance')).toEqual(levels('calm'))
  })
})

describe('buildNearbyList — 정렬 기준', () => {
  it('거리순을 골라도 좌표가 없으면 혼잡도순으로 내려간다', () => {
    // 위치를 거부한 사용자에게 "거리순"을 고를 기회는 주되, 실제로는 정렬할
    // 근거가 없으므로 조용히 혼잡도순으로 대체한다.
    const list = buildNearbyList({
      entries: ENTRIES,
      snapshots: SNAPSHOTS,
      coords: null,
      category: '전체',
      sort: 'distance',
    })

    expect(list[0].snapshot?.congestion).toBe('여유')
    expect(list.at(-1)?.snapshot?.congestion).toBe('붐빔')
  })

  it('좌표가 있어도 혼잡도순을 고르면 그대로 따른다', () => {
    const list = buildNearbyList({
      entries: ENTRIES,
      snapshots: SNAPSHOTS,
      coords: HERE,
      category: '전체',
      sort: 'calm',
    })

    // 가장 가까운 건 '가까운여유'(0m)지만, 혼잡도순에서도 여유라 1등이다.
    // 순서를 가르는 건 두 번째다 — 거리순이면 '가까운붐빔', 혼잡도순이면 '먼여유'.
    expect(list[1].entry.name).toBe('먼여유')
    // 거리는 여전히 계산돼 화면에 표시된다.
    expect(list[1].distanceMeters).toBeGreaterThan(0)
  })
})

describe('buildNearbyList', () => {
  it('좌표가 있으면 거리 오름차순으로 정렬한다', () => {
    const list = buildNearbyList({
      entries: ENTRIES,
      snapshots: SNAPSHOTS,
      coords: HERE,
      category: '전체',
    })

    expect(list.map((item) => item.entry.name)).toEqual([
      '가까운여유',
      '가까운붐빔',
      '먼여유',
    ])
    expect(list[0].distanceMeters).toBe(0)
  })

  it('좌표가 없으면 혼잡도 낮은 순으로 정렬하고 거리는 null이다', () => {
    const list = buildNearbyList({
      entries: ENTRIES,
      snapshots: SNAPSHOTS,
      coords: null,
      category: '전체',
    })

    expect(list[0].snapshot?.congestion).toBe('여유')
    expect(list[0].distanceMeters).toBeNull()
    expect(list.at(-1)?.snapshot?.congestion).toBe('붐빔')
  })

  it('카테고리로 거른다', () => {
    const list = buildNearbyList({
      entries: ENTRIES,
      snapshots: SNAPSHOTS,
      coords: HERE,
      category: '공원',
    })

    expect(list).toHaveLength(2)
    expect(list.every((item) => item.entry.category === '공원')).toBe(true)
  })

  it('스냅샷이 없는 명소도 목록에 남기되 snapshot은 null이다', () => {
    const list = buildNearbyList({
      entries: ENTRIES,
      snapshots: [null, null, null],
      coords: HERE,
      category: '전체',
    })

    expect(list).toHaveLength(3)
    expect(list[0].snapshot).toBeNull()
  })

  it('스냅샷이 없는 명소는 혼잡도순에서 뒤로 간다', () => {
    // "정보 없음" 카드가 목록 위쪽을 차지하면 화면을 열었을 때 쓸 수 있는
    // 정보가 안 보인다.
    const list = buildNearbyList({
      entries: ENTRIES,
      snapshots: [null, SNAPSHOTS[1], SNAPSHOTS[2]],
      coords: null,
      category: '전체',
    })

    expect(list.at(-1)?.entry.name).toBe('가까운여유')
    expect(list.at(-1)?.snapshot).toBeNull()
  })

  it('카탈로그 순서를 바꾸지 않는다', () => {
    // 카탈로그는 모듈 전역 상수라 제자리 정렬하면 그 순서가 앱 전체에 남는다.
    // 사용자 위치에 따라 순서가 바뀌면 useAreaSnapshots의 queryKey(['areas', names])가
    // 매번 달라져 클라이언트 캐시가 미스난다. 서버 쪽 CDN 캐시 키는 client.ts가
    // 이름을 중복 제거·정렬해 보내므로 여기 영향을 받지 않는다.
    const before = AREA_CATALOG.map((entry) => entry.name)

    buildNearbyList({
      entries: AREA_CATALOG,
      snapshots: [],
      coords: HERE,
      category: '전체',
    })

    expect(AREA_CATALOG.map((entry) => entry.name)).toEqual(before)
  })
})

describe('pickRecommendations', () => {
  it('2km 이내이면서 한산한 곳만 고른다', () => {
    const list = buildNearbyList({
      entries: ENTRIES,
      snapshots: SNAPSHOTS,
      coords: HERE,
      category: '전체',
    })

    expect(pickRecommendations(list).map((item) => item.entry.name)).toEqual([
      '가까운여유',
    ])
  })

  it('좌표가 없으면 빈 배열을 준다', () => {
    const list = buildNearbyList({
      entries: ENTRIES,
      snapshots: SNAPSHOTS,
      coords: null,
      category: '전체',
    })

    expect(pickRecommendations(list)).toEqual([])
  })

  it('최대 5개까지만 준다', () => {
    const many: readonly AreaCatalogEntry[] = Array.from(
      { length: 9 },
      (_, index) => ({
        code: `X${index}`,
        name: `여유${index}`,
        lat: 37.5665 + index * 0.0001,
        lng: 126.978,
        category: '공원' as const,
      }),
    )

    const list = buildNearbyList({
      entries: many,
      snapshots: many.map((entry) => snapshot(entry.name, '여유')),
      coords: HERE,
      category: '전체',
    })

    expect(pickRecommendations(list)).toHaveLength(5)
  })

  it('보통도 한산한 것으로 본다 — isUncrowded와 범위가 같다', () => {
    const list = buildNearbyList({
      entries: ENTRIES,
      snapshots: [
        snapshot('가까운여유', '보통'),
        snapshot('가까운붐빔', '약간 붐빔'),
        snapshot('먼여유', '여유'),
      ],
      coords: HERE,
      category: '전체',
    })

    expect(pickRecommendations(list).map((item) => item.entry.name)).toEqual([
      '가까운여유',
    ])
  })
})
