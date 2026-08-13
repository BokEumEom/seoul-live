import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SubwayArrival } from '../../domain/cityInfo'
import { SubwayArrivals } from './SubwayArrivals'

function arrival(overrides: Partial<SubwayArrival> = {}): SubwayArrival {
  return {
    station: '강남',
    line: '2호선',
    direction: '성수행',
    terminal: '성수',
    message: '4분 20초 후',
    messageDetail: '',
    ...overrides,
  }
}

describe('SubwayArrivals', () => {
  it('역과 호선을 묶음 제목으로 적는다', () => {
    render(<SubwayArrivals arrivals={[arrival()]} />)

    expect(screen.getByText('강남')).toBeInTheDocument()
    expect(screen.getByText('2호선')).toBeInTheDocument()
  })

  it('방향과 도착 메세지를 나란히 적는다', () => {
    render(<SubwayArrivals arrivals={[arrival()]} />)

    expect(screen.getByText('성수행')).toBeInTheDocument()
    expect(screen.getByText('4분 20초 후')).toBeInTheDocument()
  })

  it('보조 메세지가 있으면 괄호로 덧붙인다', () => {
    // detail_page.png의 「5분 30초 후 (삼성중앙)」 자리다.
    render(<SubwayArrivals arrivals={[arrival({ messageDetail: '역삼' })]} />)

    expect(screen.getByText('(역삼)')).toBeInTheDocument()
  })

  it('보조 메세지가 없으면 빈 괄호를 만들지 않는다', () => {
    render(<SubwayArrivals arrivals={[arrival()]} />)

    expect(screen.queryByText('()')).not.toBeInTheDocument()
  })

  it('방향이 없으면 종착역으로 대신한다', () => {
    render(<SubwayArrivals arrivals={[arrival({ direction: '', terminal: '성수' })]} />)

    expect(screen.getByText('성수')).toBeInTheDocument()
  })

  it('같은 역이라도 호선이 다르면 묶음을 나눈다', () => {
    render(
      <SubwayArrivals
        arrivals={[
          arrival({ line: '2호선' }),
          arrival({ line: '신분당선' }),
        ]}
      />,
    )

    expect(screen.getByText('2호선')).toBeInTheDocument()
    expect(screen.getByText('신분당선')).toBeInTheDocument()
  })

  it('한 묶음에 셋까지만 보여주고 나머지는 수로 알린다', () => {
    // 조용히 자르지 않는다 — 잘렸다는 사실이 화면에 남아야 한다.
    render(
      <SubwayArrivals
        arrivals={Array.from({ length: 5 }, (_, index) =>
          arrival({ message: `${index}분 후` }),
        )}
      />,
    )

    const group = screen.getByRole('list', { name: '강남 2호선 도착 열차' })
    expect(within(group).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('외 2대')).toBeInTheDocument()
  })

  it('셋 이하면 남은 수를 적지 않는다', () => {
    render(<SubwayArrivals arrivals={[arrival(), arrival()]} />)

    expect(screen.queryByText(/^외 /)).not.toBeInTheDocument()
  })

  it('호선을 모르면 역명만 적는다', () => {
    // 셋 중 무엇이 호선으로 오는지 몰라 전부 빌 수 있다. 틀린 호선을 적는
    // 것보다 안 적는 게 낫다.
    render(<SubwayArrivals arrivals={[arrival({ line: '' })]} />)

    expect(screen.getByText('강남')).toBeInTheDocument()
  })

  it('도착 정보가 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<SubwayArrivals arrivals={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
