import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { RoadSegment } from '../../domain/roadSegment'
import { makeRoadSegment } from '../../test/cityInfo'
import { RoadSegmentList } from './RoadSegmentList'

function segment(overrides: Partial<RoadSegment> = {}): RoadSegment {
  return makeRoadSegment({
    linkId: '1220019401',
    roadName: '역삼로',
    startName: '역삼동 858-14',
    endName: '역삼초등학교',
    meters: 68,
    speed: 9,
    index: '정체',
    path: [
      { lat: 37.4936, lng: 127.0316 },
      { lat: 37.4933, lng: 127.0309 },
    ],
    startCoords: { lat: 37.4933, lng: 127.0309 },
    endCoords: { lat: 37.4936, lng: 127.0316 },
    ...overrides,
  })
}

const noop = () => undefined

describe('RoadSegmentList', () => {
  it('도로명·길이·구간·속도·지표를 적는다', () => {
    render(<RoadSegmentList segments={[segment()]} onShowOnMap={noop} />)

    expect(screen.getByText('역삼로')).toBeInTheDocument()
    expect(screen.getByText('70m')).toBeInTheDocument()
    expect(screen.getByText('역삼동 858-14 → 역삼초등학교')).toBeInTheDocument()
    expect(screen.getByText('9km/h')).toBeInTheDocument()
    expect(screen.getByText('정체')).toBeInTheDocument()
  })

  // 「0km/h」는 완전 정체로 읽힌다 — 못 읽은 값을 0으로 떨어뜨리지 않는다.
  it('속도를 모르면 그 자리를 비운다', () => {
    render(<RoadSegmentList segments={[segment({ speed: null })]} onShowOnMap={noop} />)

    expect(screen.queryByText(/km\/h/)).toBeNull()
    // 지표는 남는다 — 서울이 준 판단이라 속도와 별개다.
    expect(screen.getByText('정체')).toBeInTheDocument()
  })

  it('두 끝 중 하나만 와도 그 하나를 적는다', () => {
    render(<RoadSegmentList segments={[segment({ endName: '' })]} onShowOnMap={noop} />)

    expect(screen.getByText('역삼동 858-14')).toBeInTheDocument()
  })

  // **지표가 속도보다 앞이다.** 화면이 그 차례를 실제로 지키는지 본다 —
  // 도메인 테스트만으로는 목록이 정렬을 안 부르는 실수를 못 잡는다.
  it('느린 원활보다 빠른 정체를 위에 둔다', () => {
    render(
      <RoadSegmentList
        segments={[
          segment({ linkId: 'a', roadName: '원활한길', index: '원활', speed: 28 }),
          segment({ linkId: 'b', roadName: '막힌길', index: '정체', speed: 27 }),
        ]}
        onShowOnMap={noop}
      />,
    )

    const rows = screen.getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('막힌길')
    expect(rows[1]).toHaveTextContent('원활한길')
  })

  // 한 명소에 281개까지 온다(여의도). 다 그리면 탭이 통째로 도로 목록이 된다.
  it('다섯 개만 그리고 나머지 수를 적는다', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      segment({ linkId: String(index), roadName: `길${String(index)}` }),
    )
    render(<RoadSegmentList segments={many} onShowOnMap={noop} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByText('외 7곳')).toBeInTheDocument()
  })

  // **점이 아니라 선이다.** 도로는 길이가 있는 것이라 핀만 찍으면
  // 「어디서 어디까지」가 빠진다.
  it('지도에 선과 가운데 점을 함께 넘긴다', async () => {
    const onShowOnMap = vi.fn()
    render(<RoadSegmentList segments={[segment()]} onShowOnMap={onShowOnMap} />)

    await userEvent.click(screen.getByRole('button', { name: '역삼로 지도에서 보기' }))

    expect(onShowOnMap).toHaveBeenCalledWith({
      name: '역삼로',
      // 두 끝의 가운데. 끝을 비추면 나머지가 화면 밖으로 나간다.
      coords: { lat: (37.4933 + 37.4936) / 2, lng: (127.0309 + 127.0316) / 2 },
      path: [
        { lat: 37.4936, lng: 127.0316 },
        { lat: 37.4933, lng: 127.0309 },
      ],
    })
  })

  // 보간점을 못 읽어도 두 끝을 잇는 직선이 남는다.
  it('보간점이 없으면 두 끝으로 선을 만든다', async () => {
    const onShowOnMap = vi.fn()
    render(
      <RoadSegmentList segments={[segment({ path: [] })]} onShowOnMap={onShowOnMap} />,
    )

    await userEvent.click(screen.getByRole('button', { name: /지도에서 보기/ }))

    expect(onShowOnMap.mock.calls[0][0].path).toEqual([
      { lat: 37.4933, lng: 127.0309 },
      { lat: 37.4936, lng: 127.0316 },
    ])
  })

  // 눌러도 아무 일이 안 일어나는 버튼은 고장으로 보인다(`ShowOnMapButton`).
  it('좌표가 하나도 없으면 지도 버튼을 만들지 않는다', () => {
    render(
      <RoadSegmentList
        segments={[segment({ path: [], startCoords: null, endCoords: null })]}
        onShowOnMap={noop}
      />,
    )

    expect(screen.queryByRole('button', { name: /지도에서 보기/ })).toBeNull()
  })

  // 명세에 값 목록이 없어 처음 보는 지표가 올 수 있다. 그때 색이 안 붙을 뿐
  // 글자는 그대로 나가야 한다 — `roadIndexTone`의 `?? null`이 그 규칙이다.
  it('모르는 지표도 글자는 그대로 적는다', () => {
    render(<RoadSegmentList segments={[segment({ index: '통제' })]} onShowOnMap={noop} />)

    expect(screen.getByText('통제')).toBeInTheDocument()
  })
})
