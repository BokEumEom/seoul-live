import { describe, expect, it } from 'vitest'
import type { BikeStation, ParkingLot } from './cityInfo'
import { sortBikesForWalking, withDistanceFrom } from './facilityDistance'
import type { Coords } from './types'

/** 광화문·덕수궁 카탈로그 좌표. */
const AREA: Coords = { lat: 37.5759, lng: 126.9769 }

/** 북쪽으로 대략 `meters`만큼. 위도 1도 ≈ 111,320m. */
function north(meters: number): Coords {
  return { lat: AREA.lat + meters / 111_320, lng: AREA.lng }
}

function station(name: string, bikes: number | null, coords: Coords | null): BikeStation {
  return { name, coords, bikes, racks: 20 }
}

function lot(name: string, coords: Coords | null): ParkingLot {
  return { name, coords, capacity: 100, available: 40, liveAvailable: true, paid: null }
}

describe('withDistanceFrom', () => {
  it('명소에서 얼마나 떨어졌는지 붙인다', () => {
    // 샘플(서울 인파레이더)의 「광화문역 5번출구 120m 19대」다. 이름만 있으면
    // 「5번출구」가 걸어갈 만한 거리인지 알 수 없다.
    const [near, far] = withDistanceFrom([lot('가까운', north(120)), lot('먼', north(800))], AREA)

    expect(near.meters).toBeCloseTo(120, -1)
    expect(far.meters).toBeCloseTo(800, -1)
  })

  it('좌표가 없으면 거리도 없다', () => {
    // 0m로 접으면 좌표를 못 받은 시설이 「바로 여기」가 된다 — 가장 가까운
    // 곳으로 올라가 버려서 정반대를 말한다.
    const [entry] = withDistanceFrom([lot('좌표없음', null)], AREA)

    expect(entry.meters).toBeNull()
  })

  it('원본을 건드리지 않는다', () => {
    const lots = [lot('가까운', north(120))]
    withDistanceFrom(lots, AREA)

    expect(lots[0]).not.toHaveProperty('meters')
  })
})

describe('sortBikesForWalking', () => {
  it('가까운 대여소를 먼저 세운다', () => {
    // **주차장과 규칙이 다르다.** 주차장은 차로 가니 빈 자리 수가 먼저지만,
    // 따릉이는 걸어가므로 500m 떨어진 20대보다 120m의 5대가 낫다.
    const sorted = sortBikesForWalking(
      [station('먼', 20, north(500)), station('가까운', 5, north(120))],
      AREA,
    )

    expect(sorted.map((entry) => entry.name)).toEqual(['가까운', '먼'])
  })

  it('빌릴 자전거가 없는 곳은 아무리 가까워도 뒤로 보낸다', () => {
    // 0대인 대여소는 걸어가 봐야 헛걸음이다. 거리만으로 세우면 맨 앞이
    // 「가장 가까운데 못 빌리는 곳」이 된다.
    const sorted = sortBikesForWalking(
      [station('바로 앞인데 없음', 0, north(50)), station('조금 먼데 있음', 3, north(300))],
      AREA,
    )

    expect(sorted.map((entry) => entry.name)).toEqual(['조금 먼데 있음', '바로 앞인데 없음'])
  })

  it('대수를 모르는 곳도 뒤로 보낸다', () => {
    // 「모른다」는 「있다」가 아니다. 확실한 것을 먼저 보여준다.
    const sorted = sortBikesForWalking(
      [station('모름', null, north(50)), station('있음', 2, north(300))],
      AREA,
    )

    expect(sorted.map((entry) => entry.name)).toEqual(['있음', '모름'])
  })

  it('좌표가 없는 곳은 맨 뒤다', () => {
    // 거리를 못 재는 것을 0m로 쳐서 맨 앞에 세우면 안 된다.
    const sorted = sortBikesForWalking(
      [station('좌표없음', 9, null), station('먼', 1, north(900))],
      AREA,
    )

    expect(sorted.map((entry) => entry.name)).toEqual(['먼', '좌표없음'])
  })

  it('몇 곳까지 보여줄지 자를 수 있다', () => {
    const sorted = sortBikesForWalking(
      [station('1', 5, north(100)), station('2', 5, north(200)), station('3', 5, north(300))],
      AREA,
      2,
    )

    expect(sorted.map((entry) => entry.name)).toEqual(['1', '2'])
  })

  it('명소 좌표를 모르면 대수 순서를 지킨다', () => {
    // 카탈로그에 없는 이름이면 기준점이 없다. 그때는 예전 규칙(많은 순)이
    // 그대로 답이다 — 거리를 못 재는 것이지 순서가 없어진 것은 아니다.
    const sorted = sortBikesForWalking(
      [station('적음', 2, north(100)), station('많음', 9, north(500))],
      null,
    )

    expect(sorted.map((entry) => entry.name)).toEqual(['많음', '적음'])
  })
})
