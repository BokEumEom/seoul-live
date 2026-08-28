import { describe, expect, it } from 'vitest'
import { AREA_CATALOG } from '../data/areas'
import type { AreaCatalogEntry, AreaCongestion } from '../domain/types'
import { buildNearbyList, pickRecommendations } from './useNearbyAreas'

const ENTRIES: readonly AreaCatalogEntry[] = [
  {
    code: 'A',
    name: '가까운여유',
    nameEn: '가까운여유',
    lat: 37.5665,
    lng: 126.978,
    category: '공원',
  },
  {
    code: 'B',
    name: '가까운붐빔',
    nameEn: '가까운붐빔',
    lat: 37.5675,
    lng: 126.979,
    category: '발달상권',
  },
  { code: 'C', name: '먼여유', nameEn: '먼여유', lat: 37.65, lng: 127.05, category: '공원' },
]

// 목록이 명소 하나에 대해 읽는 것은 이름과 등급뿐이다(`AreaCongestion`).
// 예전에는 여기서 인구수·예보·구성비까지 채운 큰 스냅샷을 지어냈는데, 그 값들은
// 이 훅이 한 번도 안 보는 것이라 「테스트가 뭘 요구하는가」를 흐렸다.
function snapshot(
  name: string,
  congestion: AreaCongestion['congestion'],
): AreaCongestion {
  return { name, congestion }
}

const SNAPSHOTS: readonly AreaCongestion[] = [
  snapshot('가까운여유', '여유'),
  snapshot('가까운붐빔', '붐빔'),
  snapshot('먼여유', '여유'),
]

const HERE = { lat: 37.5665, lng: 126.978 }

// **정렬 축이 하나다: 좌표가 있으면 가까운 순, 없으면 여유로운 순.**
//
// 여기 「붐비는 순」과 「정렬 기준」 두 describe가 있었다. 사용자가 고르던
// 「거리순 / 여유한 순 / 붐비는 순」 줄이 없어지면서 함께 사라졌다 — 혼잡도
// 칩이 네 등급으로 갈리자 뒤 둘이 칩과 같은 말을 하게 됐고, 남은 「가까운 순」은
// 고를 것이 없어 기본이 됐다(근거는 `useNearbyAreas`).
//
// **거르기가 줄 세우기를 대신할 수 있는지**는 여기서 잠근다: 「여유」 칩을
// 켜면 여유로운 곳들이 가까운 순으로 나온다 — 두 축이 겹치지 않고 곱해진다.
describe('buildNearbyList — 좌표가 없을 때', () => {
  const NO_COORD_ENTRIES: readonly AreaCatalogEntry[] = [
    { code: 'A', name: '여유1', nameEn: '여유1', lat: 37.5, lng: 127, category: '공원' },
    { code: 'B', name: '붐빔1', nameEn: '붐빔1', lat: 37.5, lng: 127, category: '공원' },
    { code: 'C', name: '보통1', nameEn: '보통1', lat: 37.5, lng: 127, category: '공원' },
    { code: 'D', name: '여유2', nameEn: '여유2', lat: 37.5, lng: 127, category: '공원' },
    { code: 'E', name: '정보없음', nameEn: '정보없음', lat: 37.5, lng: 127, category: '공원' },
  ]

  // **다섯째 명소는 목록에 없다.** 이름으로 맞추므로 「받아 온 값이 없다」는 곧
  // 배열에 그 이름이 없는 것이다 — 자리를 비워 두는 표현 자체가 없다.
  const NO_COORD_SNAPSHOTS: readonly AreaCongestion[] = [
    snapshot('여유1', '여유'),
    snapshot('붐빔1', '붐빔'),
    snapshot('보통1', '보통'),
    snapshot('여유2', '여유'),
  ]

  function levels(): readonly (AreaCongestion['congestion'] | null)[] {
    return buildNearbyList({
      entries: NO_COORD_ENTRIES,
      snapshots: NO_COORD_SNAPSHOTS,
      coords: null,
      category: '전체',
    }).map((item) => item.snapshot?.congestion ?? null)
  }

  // 위치를 거부한 사용자에게는 「가깝다」가 없다. 카탈로그 순서로 두면 목록의
  // 첫 화면이 아무 뜻도 없는 줄로 채워지므로, 쓸 수 있는 유일한 축인 혼잡도로
  // 세운다 — 여유로운 곳이 위다.
  it('여유로운 순으로 내려간다', () => {
    expect(levels()).toEqual(['여유', '여유', '보통', '붐빔', null])
  })

  // 동점(여유 둘)이 일부러 있다. 없으면 순서를 뒤집어도 우연히 통과한다.
  it('스냅샷이 없는 명소는 맨 뒤다', () => {
    // 「모름」은 여유로운 쪽에도 붐비는 쪽에도 속하지 않는다. 0으로 접으면
    // 정보가 없는 명소가 「여유」인 척 목록 맨 위로 올라온다.
    expect(levels().at(-1)).toBeNull()
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
      snapshots: [],
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
      snapshots: [SNAPSHOTS[1], SNAPSHOTS[2]],
      coords: null,
      category: '전체',
    })

    expect(list.at(-1)?.entry.name).toBe('가까운여유')
    expect(list.at(-1)?.snapshot).toBeNull()
  })

  it('카탈로그 순서를 바꾸지 않는다', () => {
    // 카탈로그는 모듈 전역 상수라 제자리 정렬하면 그 순서가 앱 전체에 남는다.
    // HomeScreen과 TodayScreen 둘 다 AREA_CATALOG를 그대로 넘겨 「전체」 목록을
    // 그리므로, 여기서 정렬해 버리면 이 훅과 무관한 화면의 렌더 순서까지 매
    // 렌더마다 바뀐다.
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
        nameEn: `여유${index}`,
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
