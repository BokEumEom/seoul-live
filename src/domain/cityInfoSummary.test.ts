import { describe, expect, it } from 'vitest'
import { makeCityInfo, makeParkingLot } from '../test/cityInfo'
import { makeBikeStation } from '../test/cityInfo'
import type { BikeStation } from './bike'
import type { CityInfo, ParkingLot } from './cityInfo'
import { parkingVacancyRate, subwayLineCount, totalBikes } from './cityInfoSummary'

function info(overrides: Partial<CityInfo> = {}): CityInfo {
  return makeCityInfo({ areaName: '광화문·덕수궁', areaCode: 'POI009', ...overrides })
}

function lot(capacity: number | null, available: number | null): ParkingLot {
  return makeParkingLot({ name: '주차장', capacity, available, liveAvailable: true })
}

function station(bikes: number | null): BikeStation {
  return makeBikeStation({ name: '대여소', bikes, racks: 10 })
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

// 요약 카드의 「지하철 2곳」이 이 값을 쓴다(`SummaryGrid`). 열차 수를 세면
// 「12」가 무엇의 12인지 알 수 없어진다 — 그래서 역·호선으로 접는다.
describe('subwayLineCount', () => {
  it('같은 역 같은 호선의 열차는 한 곳으로 센다', () => {
    expect(
      subwayLineCount(
        info({
          subway: [
            { station: '시청', line: '1호선', direction: '', terminal: '', message: '' },
            { station: '시청', line: '1호선', direction: '', terminal: '', message: '' },
          ],
        }),
      ),
    ).toBe(1)
  })

  it('같은 역이라도 호선이 다르면 따로 센다', () => {
    // 환승역에서 실제로 그렇다. 「시청 1호선」과 「시청 2호선」은 사용자가
    // 갈아탈지 말지를 정하는 데 서로 다른 정보다.
    expect(
      subwayLineCount(
        info({
          subway: [
            { station: '시청', line: '1호선', direction: '', terminal: '', message: '' },
            { station: '시청', line: '2호선', direction: '', terminal: '', message: '' },
          ],
        }),
      ),
    ).toBe(2)
  })

  it('도착 정보가 없으면 0이다', () => {
    expect(subwayLineCount(info())).toBe(0)
  })
})
