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
    ...overrides,
  }
}

describe('SubwayArrivals', () => {
  it('역 이름과 노선 배지를 묶음 제목으로 적는다', () => {
    render(<SubwayArrivals arrivals={[arrival()]} />)

    expect(screen.getByText('강남')).toBeInTheDocument()
    // 배지 안에는 숫자만 있고 「2호선」은 소리 쪽으로 간다 —
    // 근거는 `SubwayLineBadge`.
    expect(screen.getByRole('img', { name: '2호선' })).toHaveTextContent('2')
  })

  // **배지가 있으면 같은 말을 글자로 또 적지 않는다.** 「② 강남 2호선」은
  // 노선을 두 번 말한다.
  it('배지가 있으면 호선 글자를 따로 안 적는다', () => {
    render(<SubwayArrivals arrivals={[arrival()]} />)

    expect(screen.queryByText('2호선')).toBeNull()
  })

  // 표에 없는 노선(새로 열린 노선)은 배지가 없다. 그때는 색을 지어내는 대신
  // 옛 글자 표기로 돌아간다 — 노선을 화면에서 통째로 잃지 않으려는 것이다.
  it('모르는 노선은 글자로 적는다', () => {
    render(<SubwayArrivals arrivals={[arrival({ line: '위례선' })]} />)

    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('위례선')).toBeInTheDocument()
  })

  it('방향과 도착 메세지를 나란히 적는다', () => {
    render(<SubwayArrivals arrivals={[arrival()]} />)

    expect(screen.getByText('성수행')).toBeInTheDocument()
    expect(screen.getByText('4분 20초 후')).toBeInTheDocument()
  })

  it('도착 메세지를 원문 그대로 적는다', () => {
    // 실측값이 「9분 후 (동대입구)」처럼 괄호까지 포함해 온다(2026-08-13).
    // 우리가 쪼개거나 덧붙이지 않는다 — detail_page.png의 오른쪽 칸과 같은 모양이다.
    render(<SubwayArrivals arrivals={[arrival({ message: '9분 후 (동대입구)' })]} />)

    expect(screen.getByText('9분 후 (동대입구)')).toBeInTheDocument()
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

    expect(screen.getByRole('img', { name: '2호선' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '신분당선' })).toBeInTheDocument()
  })

  // **줄마다 상자에 담는다**(시안 `_4`). 방면과 도착 시각이 한 덩어리로
  // 읽혀야 하는데, 배경이 없으면 세 줄이 여섯 조각으로 흩어진다.
  //
  // 클래스 이름을 리터럴로 적지 않는다 — 색을 바꿀 때 테스트가 옛 값을
  // 지키게 하지 않으려는 것이다. 잠그는 것은 **줄마다 빠짐없이, 똑같이**다.
  it('도착 줄을 모두 같은 상자에 담는다', () => {
    render(
      <SubwayArrivals
        arrivals={[arrival({ message: '1분 후' }), arrival({ message: '5분 후' })]}
      />,
    )
    const rows = screen.getAllByRole('listitem')

    expect(rows).toHaveLength(2)
    expect(rows[0].className).toMatch(/\bbg-/)
    expect(rows[1].className).toBe(rows[0].className)
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
