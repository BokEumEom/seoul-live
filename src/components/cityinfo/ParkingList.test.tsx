import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ParkingLot } from '../../domain/cityInfo'
import { ParkingList } from './ParkingList'

function lot(overrides: Partial<ParkingLot> & { name: string }): ParkingLot {
  return {
    coords: null,
    capacity: 100,
    available: 10,
    liveAvailable: true,
    paid: null,
    ...overrides,
  }
}

describe('ParkingList', () => {
  // "정보 없음"과 "만차"를 같은 문구로 묶으면, 실시간 정보를 주지 않는 주차장이
  // 전부 만차로 보인다 — 그 앞을 지나가는 사용자에게는 정반대의 안내다.
  it('실시간을 제공하지 않는 주차장은 만차가 아니라 미제공으로 쓴다', () => {
    render(
      <ParkingList
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
        onShowOnMap={() => undefined}
        lots={[lot({ name: '값없음', available: null, liveAvailable: true })]}
      />,
    )

    expect(screen.getByText('정보 없음')).toBeInTheDocument()
  })

  it('여유 면수가 0일 때만 만차다', () => {
    render(
      <ParkingList
        onShowOnMap={() => undefined}
        lots={[lot({ name: '가득 찬 곳', available: 0 }), lot({ name: '한 자리', available: 1 })]}
      />,
    )

    expect(screen.getByText('만차')).toBeInTheDocument()
    expect(screen.getByText('1면')).toBeInTheDocument()
  })

  it('총 면수와 유무료를 함께 쓴다', () => {
    render(<ParkingList onShowOnMap={() => undefined} lots={[lot({ name: '유료', capacity: 1_200, paid: true })]} />)

    expect(screen.getByText('총 1,200면 · 유료')).toBeInTheDocument()
  })

  it('총 면수도 유무료도 모르면 설명 줄을 만들지 않는다', () => {
    render(<ParkingList onShowOnMap={() => undefined} lots={[lot({ name: '모름', capacity: null, paid: null })]} />)

    expect(screen.getByText('모름')).toBeInTheDocument()
    expect(screen.queryByText(/총 /)).not.toBeInTheDocument()
  })

  it('여유 많은 순으로 다섯 곳만 보여주고 나머지는 개수로 알린다', () => {
    const lots = Array.from({ length: 7 }, (_, index) =>
      lot({ name: `주차장${index}`, available: index }),
    )

    render(<ParkingList onShowOnMap={() => undefined} lots={lots} />)

    // available이 큰 순: 6, 5, 4, 3, 2
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByText('주차장6')).toBeInTheDocument()
    expect(screen.queryByText('주차장1')).not.toBeInTheDocument()
    expect(screen.getByText('외 2곳')).toBeInTheDocument()
  })

  it('다섯 곳 이하면 나머지 안내를 만들지 않는다', () => {
    render(<ParkingList onShowOnMap={() => undefined} lots={[lot({ name: '하나' })]} />)

    expect(screen.queryByText(/^외 /)).not.toBeInTheDocument()
  })
})
