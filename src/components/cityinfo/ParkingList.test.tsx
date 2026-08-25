import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ParkingLot } from '../../domain/cityInfo'
import { makeParkingLot } from '../../test/cityInfo'
import { ParkingList } from './ParkingList'

// 이 파일이 보는 것은 **목록의 표시**다. 그래서 빌더의 「전부 없음」 기본값
// 위에 「보통의 주차장」을 한 겹 얹는다 — 면수·실시간 여부를 테스트마다
// 다시 적으면 정작 무엇이 그 테스트의 대상인지가 안 보인다.
function lot(overrides: Partial<ParkingLot> & { name: string }): ParkingLot {
  return makeParkingLot({ capacity: 100, available: 10, liveAvailable: true, ...overrides })
}

describe('ParkingList', () => {
  // "정보 없음"과 "만차"를 같은 문구로 묶으면, 실시간 정보를 주지 않는 주차장이
  // 전부 만차로 보인다 — 그 앞을 지나가는 사용자에게는 정반대의 안내다.
  it('실시간을 제공하지 않는 주차장은 만차가 아니라 미제공으로 쓴다', () => {
    render(
      <ParkingList
        origin={null}
        onShowOnMap={() => undefined}
        lots={[lot({ name: '미제공', available: null, liveAvailable: false })]}
      />,
    )

    expect(screen.getByText('실시간 미제공')).toBeInTheDocument()
    expect(screen.queryByText('만차')).not.toBeInTheDocument()
  })

  it('실시간을 제공하는데 값이 비면 정보 없음으로 쓴다', () => {
    render(
      <ParkingList
        origin={null}
        onShowOnMap={() => undefined}
        lots={[lot({ name: '값없음', available: null, liveAvailable: true })]}
      />,
    )

    expect(screen.getByText('정보 없음')).toBeInTheDocument()
  })

  it('여유 면수가 0일 때만 만차다', () => {
    render(
      <ParkingList
        origin={null}
        onShowOnMap={() => undefined}
        lots={[lot({ name: '가득 찬 곳', available: 0 }), lot({ name: '한 자리', available: 1 })]}
      />,
    )

    expect(screen.getByText('만차')).toBeInTheDocument()
    expect(screen.getByText('1면')).toBeInTheDocument()
  })

  it('총 면수와 유무료를 함께 쓴다', () => {
    render(<ParkingList origin={null} onShowOnMap={() => undefined} lots={[lot({ name: '유료', capacity: 1_200, paid: true })]} />)

    expect(screen.getByText('총 1,200면 · 유료')).toBeInTheDocument()
  })

  it('총 면수도 유무료도 모르면 설명 줄을 만들지 않는다', () => {
    render(<ParkingList origin={null} onShowOnMap={() => undefined} lots={[lot({ name: '모름', capacity: null, paid: null })]} />)

    expect(screen.getByText('모름')).toBeInTheDocument()
    expect(screen.queryByText(/총 /)).not.toBeInTheDocument()
  })

  it('여유 많은 순으로 다섯 곳만 보여주고 나머지는 개수로 알린다', () => {
    const lots = Array.from({ length: 7 }, (_, index) =>
      lot({ name: `주차장${index}`, available: index }),
    )

    render(<ParkingList origin={null} onShowOnMap={() => undefined} lots={lots} />)

    // available이 큰 순: 6, 5, 4, 3, 2
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByText('주차장6')).toBeInTheDocument()
    expect(screen.queryByText('주차장1')).not.toBeInTheDocument()
    expect(screen.getByText('외 2곳')).toBeInTheDocument()
  })

  it('다섯 곳 이하면 나머지 안내를 만들지 않는다', () => {
    render(<ParkingList origin={null} onShowOnMap={() => undefined} lots={[lot({ name: '하나' })]} />)

    expect(screen.queryByText(/^외 /)).not.toBeInTheDocument()
  })
})

// 시안 `stitch_ui_ux/_5`의 요금 줄. 「어느 주차장으로 갈까」를 고를 때 면수
// 다음으로 보는 값이다.
describe('ParkingList — 요금과 주소', () => {
  it('기본요금과 추가요금을 함께 적는다', () => {
    render(
      <ParkingList
        lots={[
          lot({
            name: '세종로 공영주차장',
            paid: true,
            fee: { baseFee: 2000, baseMinutes: 30, addFee: 1000, addMinutes: 10 },
          }),
        ]}
        origin={null}
        onShowOnMap={() => undefined}
      />,
    )

    expect(screen.getByText(/30분 2,000원/)).toBeInTheDocument()
    expect(screen.getByText(/이후 10분당 1,000원/)).toBeInTheDocument()
  })

  // **여기가 이 회차의 핵심이다.** 유료인데 기본요금이 0원인 주차장이 실호출에
  // 셋 있었다. 「30분 0원」으로 적으면 공짜로 읽힌다.
  it('유료인데 기본요금이 0원이면 「무료 시간」으로 적는다', () => {
    render(
      <ParkingList
        lots={[
          lot({
            name: '서울시청 본청사 주차장',
            paid: true,
            fee: { baseFee: 0, baseMinutes: 30, addFee: 1000, addMinutes: 10 },
          }),
        ]}
        origin={null}
        onShowOnMap={() => undefined}
      />,
    )

    expect(screen.getByText(/30분 무료/)).toBeInTheDocument()
    expect(screen.queryByText(/30분 0원/)).not.toBeInTheDocument()
  })

  // 무료 주차장은 네 값이 전부 0으로 온다(실호출의 관광버스 승하차 구간 셋).
  it('무료 주차장이 0을 네 개 보내도 요금이 안 샌다', () => {
    render(
      <ParkingList
        lots={[
          lot({
            name: '관광버스 승하차 구간',
            paid: false,
            fee: { baseFee: 0, baseMinutes: 0, addFee: 0, addMinutes: 0 },
          }),
        ]}
        origin={null}
        onShowOnMap={() => undefined}
      />,
    )

    expect(screen.getByText(/무료/)).toBeInTheDocument()
    expect(screen.queryByText(/0원/)).not.toBeInTheDocument()
    expect(screen.queryByText(/0분/)).not.toBeInTheDocument()
  })

  // **위 테스트만으로는 `paid === false` 가드가 안 밟힌다.** 네 값이 0이면
  // 도메인이 이미 아무것도 안 돌려줘서, 가드를 통째로 지워도 통과했다
  // (2026-08-25 변이 실험). 가드가 막는 것은 **무료인데 단위시간이 붙어 오는**
  // 경우다 — 그때 「무료 · 30분 무료」라고 같은 말을 두 번 하게 된다.
  it('무료 주차장에 단위시간이 붙어 와도 요금을 안 적는다', () => {
    render(
      <ParkingList
        lots={[
          lot({
            name: '무료인데 시간이 붙음',
            paid: false,
            fee: { baseFee: 0, baseMinutes: 30, addFee: 0, addMinutes: 10 },
          }),
        ]}
        origin={null}
        onShowOnMap={() => undefined}
      />,
    )

    expect(screen.queryByText(/30분 무료/)).not.toBeInTheDocument()
  })

  it('주소를 함께 보여준다', () => {
    render(
      <ParkingList
        lots={[lot({ name: '백영북창빌딩', address: '중구 북창동 18-9' })]}
        origin={null}
        onShowOnMap={() => undefined}
      />,
    )

    expect(screen.getByText('중구 북창동 18-9')).toBeInTheDocument()
  })

  // 이름이 같은 주차장이 실제로 온다(「세종대로1·2·3 관광버스 승하차 허용
  // 구간」은 이름이 잘려 같아 보인다). 이름을 키로 쓰면 React가 둘을 같은
  // 항목으로 본다.
  //
  // **눈에 보이는 결과로는 이걸 못 잡는다** — 키가 겹쳐도 둘 다 그려진다
  // (2026-08-25 변이 실험에서 이름 키로 되돌려도 통과했다). React가 내는
  // 경고를 세는 것이 이 계약을 관측하는 유일한 길이다.
  it('이름이 같아도 코드가 다르면 키가 안 겹친다', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      render(
        <ParkingList
          lots={[
            lot({ name: '승하차 구간', code: 'A1', capacity: 10, available: 5 }),
            lot({ name: '승하차 구간', code: 'A2', capacity: 20, available: 9 }),
          ]}
          origin={null}
          onShowOnMap={() => undefined}
        />,
      )

      expect(screen.getAllByText('승하차 구간')).toHaveLength(2)
      const messages = errors.mock.calls.map((call) => String(call[0]))
      expect(messages.filter((message) => /same key|duplicate key/i.test(message))).toEqual([])
    } finally {
      errors.mockRestore()
    }
  })
})
