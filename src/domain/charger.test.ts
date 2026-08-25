import { describe, expect, it } from 'vitest'
import {
  availableChargerCount,
  chargerStationTone,
  chargerTypeParts,
  isChargerAvailable,
  isFastCharger,
  sortChargerStations,
  type Charger,
  type ChargerStation,
} from './charger'

function charger(overrides: Partial<Charger> = {}): Charger {
  return {
    id: '01',
    type: 'AC완속',
    status: '사용가능',
    outputKw: 7,
    method: '단독',
    statusAt: '',
    lastStartAt: '',
    lastEndAt: '',
    chargingSince: '',
    ...overrides,
  }
}

function station(overrides: Partial<ChargerStation> = {}): ChargerStation {
  return {
    name: '충전소',
    id: 'S1',
    address: '',
    coords: null,
    useTime: '',
    parkingPaid: null,
    limited: null,
    limitDetail: '',
    kind: '',
    chargers: [],
    ...overrides,
  }
}

describe('isChargerAvailable', () => {
  // **`사용가능`만 참이다.** `상태미확인`·`통신이상`을 「아마 될 것」으로 세면
  // 가서 못 꽂는데, 그 대가가 안 가는 쪽보다 크다.
  it('사용가능만 참이다', () => {
    expect(isChargerAvailable(charger({ status: '사용가능' }))).toBe(true)
    expect(isChargerAvailable(charger({ status: '충전중' }))).toBe(false)
    expect(isChargerAvailable(charger({ status: '상태미확인' }))).toBe(false)
    expect(isChargerAvailable(charger({ status: '통신이상' }))).toBe(false)
    expect(isChargerAvailable(charger({ status: '점검중' }))).toBe(false)
    expect(isChargerAvailable(charger({ status: '운영중지' }))).toBe(false)
  })

  it('앞뒤 공백을 무시한다', () => {
    expect(isChargerAvailable(charger({ status: ' 사용가능 ' }))).toBe(true)
  })
})

describe('isFastCharger', () => {
  // 실호출 1,725대에서 본 네 값이 이 규칙으로 정확히 갈린다.
  it('DC가 들어 있으면 급속이다', () => {
    expect(isFastCharger(charger({ type: 'AC완속' }))).toBe(false)
    expect(isFastCharger(charger({ type: 'DC콤보' }))).toBe(true)
    expect(isFastCharger(charger({ type: 'DC차데모+DC콤보' }))).toBe(true)
    expect(isFastCharger(charger({ type: 'DC차데모+AC3상+DC콤보' }))).toBe(true)
  })

  // **출력으로 가르지 않는다.** 완속에도 11kW·14kW가 있어 급속의 하한과 겹친다.
  it('출력이 커도 AC면 완속이다', () => {
    expect(isFastCharger(charger({ type: 'AC완속', outputKw: 14 }))).toBe(false)
  })
})

describe('chargerTypeParts', () => {
  it('복합값을 조각으로 가른다', () => {
    expect(chargerTypeParts('DC차데모+AC3상+DC콤보')).toEqual(['DC차데모', 'AC3상', 'DC콤보'])
  })

  it('홑값은 그대로 한 조각이다', () => {
    expect(chargerTypeParts('AC완속')).toEqual(['AC완속'])
  })

  it('빈 값은 빈 배열이다', () => {
    expect(chargerTypeParts('')).toEqual([])
    expect(chargerTypeParts('+')).toEqual([])
  })
})

describe('chargerStationTone', () => {
  it('사용가능이 둘 이상이면 여유다', () => {
    expect(
      chargerStationTone(station({ chargers: [charger(), charger({ id: '02' })] })),
    ).toBe('calm')
  })

  it('하나뿐이면 보통이다', () => {
    expect(chargerStationTone(station({ chargers: [charger()] }))).toBe('normal')
  })

  it('하나도 없으면 붐빔이다', () => {
    expect(
      chargerStationTone(station({ chargers: [charger({ status: '충전중' })] })),
    ).toBe('crowded')
  })

  // 충전기가 아예 없는 것과 전부 쓰이는 중인 것은 다르다.
  it('충전기 목록이 비면 null이다', () => {
    expect(chargerStationTone(station())).toBeNull()
  })
})

describe('sortChargerStations', () => {
  // **이 차례가 이 함수의 존재 이유다.** 실호출 1,725대 중 464대가 이용 제한이
  // 걸려 있었고, 사용가능 대수만으로 줄 세우면 못 들어가는 충전소가 맨 위에
  // 온다 — 거기까지 가서야 알게 되는 것이 이 목록의 최악이다.
  it('제한 없는 곳이 사용가능 대수가 적어도 먼저다', () => {
    const sorted = sortChargerStations([
      station({ name: '제한있음', limited: true, chargers: [charger(), charger({ id: '02' })] }),
      station({ name: '열림', limited: false, chargers: [charger()] }),
    ])

    expect(sorted.map((entry) => entry.name)).toEqual(['열림', '제한있음'])
  })

  it('제한이 같으면 사용가능 대수가 많은 순이다', () => {
    const sorted = sortChargerStations([
      station({ name: '하나', limited: false, chargers: [charger()] }),
      station({ name: '둘', limited: false, chargers: [charger(), charger({ id: '02' })] }),
    ])

    expect(sorted.map((entry) => entry.name)).toEqual(['둘', '하나'])
  })

  // **모르는 곳을 뒤로 미루지 않는다.** 정보가 부실한 충전소가 실제보다
  // 나쁘게 취급되면 안 된다.
  it('제한 여부를 모르는 곳은 제한 없는 쪽에 둔다', () => {
    const sorted = sortChargerStations([
      station({ name: '제한있음', limited: true, chargers: [charger(), charger({ id: '02' })] }),
      station({ name: '모름', limited: null, chargers: [charger()] }),
    ])

    expect(sorted.map((entry) => entry.name)).toEqual(['모름', '제한있음'])
  })

  it('입력 배열을 제자리에서 정렬하지 않는다', () => {
    const input = [
      station({ name: 'A', chargers: [] }),
      station({ name: 'B', chargers: [charger()] }),
    ]
    sortChargerStations(input)
    expect(input.map((entry) => entry.name)).toEqual(['A', 'B'])
  })

  it('limit을 주면 그만큼만 돌려준다', () => {
    const many = Array.from({ length: 7 }, (_, index) => station({ name: `S${index}` }))
    expect(sortChargerStations(many, 3)).toHaveLength(3)
  })
})

describe('availableChargerCount', () => {
  it('사용가능한 충전기만 센다', () => {
    expect(
      availableChargerCount(
        station({
          chargers: [charger(), charger({ id: '02', status: '충전중' }), charger({ id: '03' })],
        }),
      ),
    ).toBe(2)
  })
})
