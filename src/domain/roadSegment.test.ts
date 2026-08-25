import { describe, expect, it } from 'vitest'
import { makeRoadSegment } from '../test/cityInfo'
import { roadSegmentCenter, roadSegmentPath, sortRoadSegments } from './roadSegment'

function segment(linkId: string, index: string, speed: number | null) {
  return makeRoadSegment({ linkId, index, speed })
}

describe('sortRoadSegments', () => {
  // **지표가 속도보다 앞이다.** 실호출 1,893건에서 세 지표의 속도 범위가 크게
  // 겹쳤다(정체 2~28 · 서행 15~48 · 원활 25~67) — 같은 25km/h가 어떤 도로에서는
  // 정체이고 어떤 도로에서는 원활이다. 속도로 다시 매기면 서울의 판단을 덮어쓴다.
  it('느린 원활보다 빠른 정체를 먼저 올린다', () => {
    const sorted = sortRoadSegments([
      segment('원활28', '원활', 28),
      segment('정체27', '정체', 27),
    ])

    expect(sorted.map((entry) => entry.linkId)).toEqual(['정체27', '원활28'])
  })

  it('세 지표를 정체 · 서행 · 원활 차례로 세운다', () => {
    const sorted = sortRoadSegments([
      segment('a', '원활', 40),
      segment('b', '정체', 5),
      segment('c', '서행', 20),
    ])

    expect(sorted.map((entry) => entry.index)).toEqual(['정체', '서행', '원활'])
  })

  it('같은 지표 안에서는 느린 구간이 먼저다', () => {
    const sorted = sortRoadSegments([
      segment('빠름', '정체', 20),
      segment('느림', '정체', 4),
      segment('중간', '정체', 12),
    ])

    expect(sorted.map((entry) => entry.linkId)).toEqual(['느림', '중간', '빠름'])
  })

  // 「처음 보는 값」을 「제일 급한 값」으로 올려 두면 정체 구간이 그것에 밀려
  // 화면에서 사라진다. 명세에 값 목록이 없으므로 실제로 올 수 있다.
  it('모르는 지표는 아는 셋보다 뒤다', () => {
    const sorted = sortRoadSegments([
      segment('모름', '통제', 1),
      segment('원활', '원활', 60),
    ])

    expect(sorted.map((entry) => entry.linkId)).toEqual(['원활', '모름'])
  })

  // 못 읽은 값을 0으로 떨어뜨리면 「0km/h」가 가장 급한 구간으로 올라온다.
  it('속도를 모르는 구간은 같은 지표 안에서 뒤로 간다', () => {
    const sorted = sortRoadSegments([
      segment('모름', '정체', null),
      segment('느림', '정체', 4),
    ])

    expect(sorted.map((entry) => entry.linkId)).toEqual(['느림', '모름'])
  })

  it('한 명소에 281개까지 오므로 앞에서 자를 수 있다', () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      segment(String(index), '정체', index),
    )

    expect(sortRoadSegments(many, 5)).toHaveLength(5)
  })

  it('입력 배열을 제자리에서 정렬하지 않는다', () => {
    const input = [segment('a', '원활', 40), segment('b', '정체', 5)]
    sortRoadSegments(input)

    expect(input.map((entry) => entry.linkId)).toEqual(['a', 'b'])
  })
})

describe('roadSegmentCenter', () => {
  // 끝을 비추면 나머지가 화면 밖으로 나간다 — 실호출 구간이 최대 653m다.
  it('두 끝의 가운데를 준다', () => {
    const center = roadSegmentCenter(
      makeRoadSegment({
        startCoords: { lat: 37.57, lng: 126.97 },
        endCoords: { lat: 37.59, lng: 126.99 },
      }),
    )

    // 부동소수라 정확히 126.98이 아니다(126.97999999999999). 1e-14도는 지구에서
    // 나노미터라 지도에서는 같은 점이다 — 반올림해서 숨기는 대신 여기서 인정한다.
    expect(center?.lat).toBeCloseTo(37.58, 10)
    expect(center?.lng).toBeCloseTo(126.98, 10)
  })

  it('한쪽만 있으면 그것을 쓴다', () => {
    const only = { lat: 37.57, lng: 126.97 }

    expect(roadSegmentCenter(makeRoadSegment({ startCoords: only }))).toEqual(only)
    expect(roadSegmentCenter(makeRoadSegment({ endCoords: only }))).toEqual(only)
  })

  it('둘 다 없으면 null이다', () => {
    expect(roadSegmentCenter(makeRoadSegment())).toBeNull()
  })
})

describe('roadSegmentPath', () => {
  it('보간점이 있으면 그대로 쓴다', () => {
    const path = [
      { lat: 37.57, lng: 126.97 },
      { lat: 37.58, lng: 126.98 },
      { lat: 37.59, lng: 126.99 },
    ]

    expect(roadSegmentPath(makeRoadSegment({ path }))).toEqual(path)
  })

  // 굽은 길이 직선이 되지만 「어디쯤인지」는 그대로 전한다 — 선을 통째로 안
  // 그리는 것보다 낫다.
  it('보간점을 못 읽으면 두 끝을 잇는 직선으로 떨어진다', () => {
    const start = { lat: 37.57, lng: 126.97 }
    const end = { lat: 37.59, lng: 126.99 }

    expect(
      roadSegmentPath(makeRoadSegment({ startCoords: start, endCoords: end })),
    ).toEqual([start, end])
  })

  // 점 하나는 선이 아니다. 그리면 지도에 아무것도 안 보이는데 버튼은 눌린다.
  it('점이 하나뿐이면 null이다', () => {
    expect(
      roadSegmentPath(makeRoadSegment({ path: [{ lat: 37.57, lng: 126.97 }] })),
    ).toBeNull()
    expect(
      roadSegmentPath(makeRoadSegment({ startCoords: { lat: 37.57, lng: 126.97 } })),
    ).toBeNull()
  })

  it('아무것도 없으면 null이다', () => {
    expect(roadSegmentPath(makeRoadSegment())).toBeNull()
  })
})
