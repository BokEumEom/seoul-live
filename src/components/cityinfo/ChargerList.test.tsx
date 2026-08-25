import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Charger, ChargerStation } from '../../domain/charger'
import { ChargerList } from './ChargerList'

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

function station(overrides: Partial<ChargerStation> & { name: string }): ChargerStation {
  return {
    id: overrides.name,
    address: '',
    coords: null,
    useTime: '',
    parkingPaid: null,
    limited: null,
    limitDetail: '',
    kind: '',
    chargers: [charger()],
    ...overrides,
  }
}

describe('ChargerList', () => {
  it('사용가능 대수를 배지로 적는다', () => {
    render(
      <ChargerList
        stations={[
          station({
            name: 'NIA빌딩',
            chargers: [charger(), charger({ id: '02' }), charger({ id: '03', status: '충전중' })],
          }),
        ]}
        origin={null}
        onShowOnMap={() => undefined}
      />,
    )

    expect(screen.getByText('2대 가능')).toBeInTheDocument()
  })

  // 「0대」는 「충전기가 없다」로도 읽힌다. 여기 있는 충전소는 전부 충전기가 있다.
  it('하나도 못 쓰면 「사용 불가」라고 적는다', () => {
    render(
      <ChargerList
        stations={[station({ name: '만차', chargers: [charger({ status: '충전중' })] })]}
        origin={null}
        onShowOnMap={() => undefined}
      />,
    )

    expect(screen.getByText('사용 불가')).toBeInTheDocument()
    expect(screen.queryByText('0대 가능')).not.toBeInTheDocument()
  })

  it('가장 빠른 충전기로 급속·완속과 출력을 적는다', () => {
    render(
      <ChargerList
        stations={[
          station({
            name: '복합',
            chargers: [charger(), charger({ id: '02', type: 'DC콤보', outputKw: 100 })],
          }),
        ]}
        origin={null}
        onShowOnMap={() => undefined}
      />,
    )

    expect(screen.getByText(/급속 100kW/)).toBeInTheDocument()
  })

  it('완속만 있으면 완속이라고 적는다', () => {
    render(
      <ChargerList
        stations={[station({ name: '완속만' })]}
        origin={null}
        onShowOnMap={() => undefined}
      />,
    )

    expect(screen.getByText(/완속 7kW/)).toBeInTheDocument()
  })

  // **제한 사유는 서울 API의 자유 문장이라 원문 그대로다.** 서른일곱 가지가
  // 나왔고 표현이 제각각이라 옮길 수 없다.
  it('이용 제한이 있으면 사유를 그대로 보여준다', () => {
    render(
      <ChargerList
        stations={[
          station({ name: '제한', limited: true, limitDetail: '외부인 사용불가' }),
        ]}
        origin={null}
        onShowOnMap={() => undefined}
      />,
    )

    expect(screen.getByText('외부인 사용불가')).toBeInTheDocument()
  })

  it('제한은 있는데 사유가 없으면 있다고만 적는다', () => {
    render(
      <ChargerList
        stations={[station({ name: '제한', limited: true, limitDetail: '' })]}
        origin={null}
        onShowOnMap={() => undefined}
      />,
    )

    expect(screen.getByText('이용 제한 있음')).toBeInTheDocument()
  })

  it('제한이 없으면 그 줄을 안 만든다', () => {
    render(
      <ChargerList
        stations={[station({ name: '열림', limited: false })]}
        origin={null}
        onShowOnMap={() => undefined}
      />,
    )

    expect(screen.queryByText(/제한/)).not.toBeInTheDocument()
  })

  // **차례가 이 목록의 핵심이다** — 못 들어가는 곳이 맨 위에 오면 헛걸음한다.
  it('제한 없는 곳을 먼저 보여준다', () => {
    render(
      <ChargerList
        stations={[
          station({
            name: '제한많음',
            limited: true,
            chargers: [charger(), charger({ id: '02' }), charger({ id: '03' })],
          }),
          station({ name: '열림하나', limited: false, chargers: [charger()] }),
        ]}
        origin={null}
        onShowOnMap={() => undefined}
      />,
    )

    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]).getByText('열림하나')).toBeInTheDocument()
  })

  it('다섯 곳까지만 보여주고 나머지는 개수로 알린다', () => {
    const many = Array.from({ length: 7 }, (_, index) =>
      station({ name: `충전소${index}`, id: `S${index}` }),
    )
    render(<ChargerList stations={many} origin={null} onShowOnMap={() => undefined} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByText('외 2곳')).toBeInTheDocument()
  })

  it('시설 종류를 함께 적는다', () => {
    render(
      <ChargerList
        stations={[station({ name: 'NIA빌딩', kind: '아파트' })]}
        origin={null}
        onShowOnMap={() => undefined}
      />,
    )

    expect(screen.getByText(/아파트/)).toBeInTheDocument()
  })

  it('좌표가 없으면 지도 버튼을 안 그린다', () => {
    render(
      <ChargerList
        stations={[station({ name: '좌표없음' })]}
        origin={null}
        onShowOnMap={() => undefined}
      />,
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
