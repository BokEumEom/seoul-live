import { describe, expect, it } from 'vitest'
import type { BikeStation, CityInfo, ParkingLot } from './cityInfo'
import { parkingVacancyRate, summarizeCityInfo, totalBikes } from './cityInfoSummary'

function info(overrides: Partial<CityInfo> = {}): CityInfo {
  return {
    areaName: '광화문·덕수궁',
    areaCode: 'POI009',
    weather: null,
    roadTraffic: null,
    accidents: [],
    parking: [],
    bikes: [],
    events: [],
    alerts: [],
    subway: [],
    ...overrides,
  }
}

function lot(capacity: number | null, available: number | null): ParkingLot {
  return { name: '주차장', coords: null, capacity, available, liveAvailable: true, paid: null }
}

function station(bikes: number | null): BikeStation {
  return { name: '대여소', coords: null, bikes, racks: 10 }
}

describe('parkingVacancyRate', () => {
  it('전체 면수 대비 남은 면수를 센다', () => {
    // 샘플(서울 인파레이더)의 「주차 45%」다. 주차장마다 따로 세지 않고 합쳐
    // 세는 이유는 사용자가 「이 동네에 자리가 있나」를 묻기 때문이다 — 어느
    // 주차장인지는 아래 목록이 답한다.
    expect(parkingVacancyRate([lot(100, 45), lot(100, 45)])).toBe(45)
  })

  it('면수를 모르는 주차장은 아예 세지 않는다', () => {
    // **분자에서만 빼면 안 된다.** 전체 300면 중 45면으로 세어 15%가 되는데,
    // 실제로 값을 아는 주차장에는 45%가 비어 있다. 모르는 것은 분모에서도 빠져야
    // 「아는 것 중에서」라는 뜻이 유지된다.
    expect(parkingVacancyRate([lot(100, 45), lot(200, null)])).toBe(45)
    expect(parkingVacancyRate([lot(100, 45), lot(null, 30)])).toBe(45)
  })

  it('셀 수 있는 주차장이 없으면 모른다고 한다', () => {
    // 0%로 접으면 「자리가 하나도 없다」가 되어 정반대를 말한다.
    expect(parkingVacancyRate([])).toBeNull()
    expect(parkingVacancyRate([lot(null, null)])).toBeNull()
  })

  it('전체 면수가 0인 주차장은 세지 않는다', () => {
    // 0으로 나누면 NaN이나 Infinity가 화면에 나온다.
    expect(parkingVacancyRate([lot(0, 0)])).toBeNull()
  })

  it('100%를 넘지 않는다', () => {
    // 남은 면수가 전체보다 크게 오는 응답이 있어도 「112% 비어 있음」은 말이 안 된다.
    expect(parkingVacancyRate([lot(100, 130)])).toBe(100)
  })
})

describe('totalBikes', () => {
  it('대여소의 자전거를 합친다', () => {
    expect(totalBikes([station(5), station(3)])).toBe(8)
  })

  it('대수를 모르는 대여소는 0으로 세지 않고 건너뛴다', () => {
    // 합계에서는 결과가 같지만, 아래 「셀 수 있는 대여소가 없다」와 구별하려면
    // 건너뛴다는 사실 자체가 필요하다.
    expect(totalBikes([station(5), station(null)])).toBe(5)
  })

  it('셀 수 있는 대여소가 없으면 모른다고 한다', () => {
    // 0대와 「모른다」는 다르다. 0대는 지금 빌릴 자전거가 없다는 뜻이고,
    // 모른다는 것은 응답에 대수가 안 왔다는 뜻이다.
    expect(totalBikes([])).toBeNull()
    expect(totalBikes([station(null)])).toBeNull()
  })
})

describe('summarizeCityInfo', () => {
  it('값이 있는 것만 칩으로 만든다', () => {
    // 빈 칩("주차 -")을 만들면 한 줄이 모르는 것들로 채워진다. 샘플도 값이
    // 있는 것만 세워 둔다.
    const chips = summarizeCityInfo(
      info({
        parking: [lot(100, 45)],
        roadTraffic: { index: '정체', speed: 13.9, message: '', updatedAt: '' },
        events: [
          { name: '행사', period: '', place: '', free: null, url: '' },
          { name: '행사2', period: '', place: '', free: null, url: '' },
        ],
        bikes: [station(131)],
      }),
    )

    // **완성된 글자가 아니라 번역 키와 값이다.** 도메인은 순수해야 해서 언어를
    // 볼 수 없다 — 「무엇을 말할지」만 정하고 「어느 말로 적을지」는 화면이 정한다.
    expect(chips.map((chip) => chip.label)).toEqual([
      '정체',
      '주차 {비율}%',
      '따릉이 {대수}대',
      '행사 {개수}',
    ])
    expect(chips.map((chip) => chip.labelParams)).toEqual([
      undefined,
      { 비율: 45 },
      { 대수: 131 },
      { 개수: 2 },
    ])
  })

  it('아무 값도 없으면 빈 줄을 만들지 않는다', () => {
    expect(summarizeCityInfo(info())).toEqual([])
  })

  it('칩마다 어느 절로 가는지 들고 있다', () => {
    // 상세가 통째로 펼쳐지면서 화면이 길어졌다. 칩이 요약만 하고 끝나면
    // 사용자는 그 값을 확인하러 손으로 한참 스크롤해야 한다.
    const chips = summarizeCityInfo(info({ parking: [lot(100, 45)] }))

    expect(chips[0].sectionId).toBe('parking')
  })

  it('지하철은 역·호선 수를 센다', () => {
    // 열차 수를 세면 「지하철 12」처럼 커져서 무엇을 세는지 알 수 없다.
    // 샘플의 「지하철 3」은 도착 정보가 오는 노선 수다.
    const chips = summarizeCityInfo(
      info({
        subway: [
          { station: '광화문', line: '5호선', direction: '', terminal: '', message: '' },
          { station: '광화문', line: '5호선', direction: '', terminal: '', message: '' },
          { station: '시청', line: '1호선', direction: '', terminal: '', message: '' },
        ],
      }),
    )

    expect(chips[0].label).toBe('지하철 {개수}')
    expect(chips[0].labelParams).toEqual({ 개수: 2 })
  })

  it('아래 절과 같은 순서로 세운다', () => {
    // 값이 있는 것만 세우면 명소마다 칩 순서가 달라져 같은 자리에 다른 뜻이
    // 온다. 게다가 이 칩은 목차라 절 순서와 어긋나면 왼쪽 칩이 아래쪽 절로
    // 뛴다 — 그래서 샘플(주차가 맨 앞)과 순서가 다르다.
    const chips = summarizeCityInfo(
      info({
        bikes: [station(10)],
        parking: [lot(100, 50)],
        subway: [
          { station: '시청', line: '1호선', direction: '', terminal: '', message: '' },
        ],
      }),
    )

    expect(chips.map((chip) => chip.sectionId)).toEqual(['subway', 'parking', 'bikes'])
  })
})
