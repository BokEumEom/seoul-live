import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { BusStop } from '../../domain/cityInfo'
import { BusStopList } from './BusStopList'

function stop(overrides: Partial<BusStop> & { name: string }): BusStop {
  return { arsId: '', id: '', coords: null, ...overrides }
}

describe('BusStopList', () => {
  // **번호가 이름보다 실물이다** — 정류소 기둥에 붙어 있고 버스 앱에서
  // 검색하는 것도 이 번호다.
  it('정류소 번호를 이름과 함께 적는다', () => {
    render(
      <BusStopList
        stops={[stop({ name: '광화문역', arsId: '1009' })]}
        origin={null}
        onShowOnMap={() => undefined}
      />,
    )

    expect(screen.getByText('광화문역')).toBeInTheDocument()
    expect(screen.getByText(/1009번/)).toBeInTheDocument()
  })

  // 정류소는 골라 갈 대상이 아니라 「어디서 타나」의 답이라 가까운 것이 먼저다
  // (주차장은 여유순, 따릉이는 거리순 — 이쪽은 따릉이와 같다).
  it('가까운 순으로 다섯 곳만 보여주고 나머지는 개수로 알린다', () => {
    const origin = { lat: 37.57, lng: 126.977 }
    const stops = Array.from({ length: 7 }, (_, index) =>
      stop({
        name: `정류소${index}`,
        id: `S${index}`,
        // index가 클수록 멀다.
        coords: { lat: 37.57 + index * 0.002, lng: 126.977 },
      }),
    )

    render(<BusStopList stops={stops} origin={origin} onShowOnMap={() => undefined} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByText('정류소0')).toBeInTheDocument()
    expect(screen.queryByText('정류소6')).not.toBeInTheDocument()
    expect(screen.getByText('외 2곳')).toBeInTheDocument()
  })

  it('이름이 같아도 ID가 다르면 둘 다 그린다', () => {
    render(
      <BusStopList
        stops={[
          stop({ name: '광화문역', id: 'A1', arsId: '1009' }),
          stop({ name: '광화문역', id: 'A2', arsId: '1010' }),
        ]}
        origin={null}
        onShowOnMap={() => undefined}
      />,
    )

    expect(screen.getAllByText('광화문역')).toHaveLength(2)
  })

  it('좌표가 없으면 지도 버튼을 안 그린다', () => {
    render(
      <BusStopList
        stops={[stop({ name: '좌표없음', id: 'A1' })]}
        origin={null}
        onShowOnMap={() => undefined}
      />,
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
