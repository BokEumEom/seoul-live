import { describe, expect, it } from 'vitest'
import {
  SUBWAY_FACILITY_KINDS,
  elevators,
  isSubwayFacilityKind,
  isSubwayFacilityStatus,
  underRepair,
  type SubwayFacility,
} from './subwayFacility'

function facility(overrides: Partial<SubwayFacility> = {}): SubwayFacility {
  return {
    kind: 'ES',
    section: 'B2-B3',
    position: '서대문 방면1-1',
    status: '사용가능',
    ...overrides,
  }
}

describe('승강기 갈래', () => {
  it('실호출에서 본 네 코드를 안다', () => {
    expect(Object.keys(SUBWAY_FACILITY_KINDS)).toEqual(['ES', 'EV', 'WL', 'MW'])
  })

  /**
   * **뜻을 짐작한 게 아니다.** `ELVTR_NM`이 「승강기)에스컬레이터-광화문 내부2」처럼
   * 갈래 이름을 스스로 담고 있어서, 코드와 이름을 짝지어 셌다(2026-08-27 실호출
   * 160건: ES→에스컬레이터 111 · EV→엘리베이터 36 · WL→휠체어리프트 11 ·
   * MW→무빙워크 2, 어긋난 건 0).
   */
  it('코드마다 한국어 이름이 있다', () => {
    expect(SUBWAY_FACILITY_KINDS.ES).toBe('에스컬레이터')
    expect(SUBWAY_FACILITY_KINDS.EV).toBe('엘리베이터')
    expect(SUBWAY_FACILITY_KINDS.WL).toBe('휠체어리프트')
    expect(SUBWAY_FACILITY_KINDS.MW).toBe('무빙워크')
  })

  it('처음 보는 코드는 갈래가 아니다', () => {
    expect(isSubwayFacilityKind('EV')).toBe(true)
    expect(isSubwayFacilityKind('XX')).toBe(false)
    expect(isSubwayFacilityKind('')).toBe(false)
  })

  it('처음 보는 상태는 상태가 아니다', () => {
    expect(isSubwayFacilityStatus('보수중')).toBe(true)
    expect(isSubwayFacilityStatus('사용가능')).toBe(true)
    expect(isSubwayFacilityStatus('점검예정')).toBe(false)
  })
})

describe('elevators', () => {
  // 계단을 못 쓰는 사람에게 에스컬레이터는 답이 아니다. 「이 역에 들어갈 수
  // 있나」에 답하는 것은 엘리베이터뿐이라 따로 센다.
  it('엘리베이터만 고른다', () => {
    const list = [
      facility({ kind: 'EV' }),
      facility({ kind: 'ES' }),
      facility({ kind: 'WL' }),
      facility({ kind: null }),
    ]

    expect(elevators(list)).toEqual([facility({ kind: 'EV' })])
  })
})

describe('underRepair', () => {
  it('보수중인 것만 고른다', () => {
    const broken = facility({ status: '보수중' })

    expect(underRepair([facility(), broken])).toEqual([broken])
  })

  /**
   * **「모른다」는 「고장」이 아니다.** 상태를 못 읽은 승강기를 보수중으로 세면
   * 화면에 없는 고장이 뜨고, 그걸 보고 다른 역으로 돌아가는 사람이 생긴다.
   * 이 앱의 `?? null` 규칙이 여기서는 「경고하지 않는다」로 나타난다.
   */
  it('상태를 모르는 것은 안 센다', () => {
    expect(underRepair([facility({ status: null })])).toEqual([])
  })
})
