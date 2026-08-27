import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SubwayArrival } from '../../domain/cityInfo'
import type { SubwayFacility } from '../../domain/subwayFacility'
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
    render(<SubwayArrivals arrivals={[arrival()]} facilities={[]} />)

    expect(screen.getByText('강남')).toBeInTheDocument()
    // 배지 안에는 숫자만 있고 「2호선」은 소리 쪽으로 간다 —
    // 근거는 `SubwayLineBadge`.
    expect(screen.getByRole('img', { name: '2호선' })).toHaveTextContent('2')
  })

  // **배지가 있으면 같은 말을 글자로 또 적지 않는다.** 「② 강남 2호선」은
  // 노선을 두 번 말한다.
  it('배지가 있으면 호선 글자를 따로 안 적는다', () => {
    render(<SubwayArrivals arrivals={[arrival()]} facilities={[]} />)

    expect(screen.queryByText('2호선')).toBeNull()
  })

  // 표에 없는 노선(새로 열린 노선)은 배지가 없다. 그때는 색을 지어내는 대신
  // 옛 글자 표기로 돌아간다 — 노선을 화면에서 통째로 잃지 않으려는 것이다.
  it('모르는 노선은 글자로 적는다', () => {
    render(<SubwayArrivals arrivals={[arrival({ line: '위례선' })]} facilities={[]} />)

    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('위례선')).toBeInTheDocument()
  })

  it('방향과 도착 메세지를 나란히 적는다', () => {
    render(<SubwayArrivals arrivals={[arrival()]} facilities={[]} />)

    expect(screen.getByText('성수행')).toBeInTheDocument()
    expect(screen.getByText('4분 20초 후')).toBeInTheDocument()
  })

  it('도착 메세지를 원문 그대로 적는다', () => {
    // 실측값이 「9분 후 (동대입구)」처럼 괄호까지 포함해 온다(2026-08-13).
    // 우리가 쪼개거나 덧붙이지 않는다 — detail_page.png의 오른쪽 칸과 같은 모양이다.
    render(<SubwayArrivals
        arrivals={[arrival({ message: '9분 후 (동대입구)' })]}
        facilities={[]}
      />)

    expect(screen.getByText('9분 후 (동대입구)')).toBeInTheDocument()
  })

  it('방향이 없으면 종착역으로 대신한다', () => {
    render(<SubwayArrivals
        arrivals={[arrival({ direction: '', terminal: '성수' })]}
        facilities={[]}
      />)

    expect(screen.getByText('성수')).toBeInTheDocument()
  })

  it('같은 역이라도 호선이 다르면 묶음을 나눈다', () => {
    render(
      <SubwayArrivals
        arrivals={[arrival({ line: '2호선' }), arrival({ line: '신분당선' })]}
        facilities={[]}
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
        facilities={[]}
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
        facilities={[]}
      />,
    )

    const group = screen.getByRole('list', { name: '강남 2호선 도착 열차' })
    expect(within(group).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('외 2대')).toBeInTheDocument()
  })

  it('셋 이하면 남은 수를 적지 않는다', () => {
    render(<SubwayArrivals arrivals={[arrival(), arrival()]} facilities={[]} />)

    expect(screen.queryByText(/^외 /)).not.toBeInTheDocument()
  })

  it('호선을 모르면 역명만 적는다', () => {
    // 역도 열차도 호선을 안 주는 응답이 있을 수 있다. 틀린 호선을 적는 것보다
    // 안 적는 게 낫다.
    render(<SubwayArrivals arrivals={[arrival({ line: '' })]} facilities={[]} />)

    expect(screen.getByText('강남')).toBeInTheDocument()
  })

  it('도착 정보가 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<SubwayArrivals arrivals={[]} facilities={[]} />)

    expect(container).toBeEmptyDOMElement()
  })

  describe('승강기', () => {
    const lift: SubwayFacility = {
      kind: 'EV',
      section: 'B2-B4',
      position: '서대문 방면1-1',
      status: '사용가능',
    }

    it('엘리베이터가 있는 역에 표시를 단다', () => {
      render(
        <SubwayArrivals
          arrivals={[arrival()]}
          facilities={[{ station: '강남', line: '2호선', facilities: [lift] }]}
        />,
      )

      expect(screen.getByRole('img', { name: '엘리베이터 있음' })).toBeInTheDocument()
    })

    it('보수중인 승강기를 도착 줄 아래에 적는다', () => {
      render(
        <SubwayArrivals
          arrivals={[arrival()]}
          facilities={[
            {
              station: '강남',
              line: '2호선',
              facilities: [{ ...lift, kind: 'ES', status: '보수중' }],
            },
          ]}
        />,
      )

      expect(screen.getByText('에스컬레이터 B2-B4')).toBeInTheDocument()
    })

    /**
     * **묶음마다 자기 역 것만 얹힌다.** 잇는 규칙은 도메인이 갖고 있지만
     * (`groupSubwayArrivals`), 화면이 묶음이 아니라 전체 목록을 그리게 되면
     * 그 규칙이 통째로 우회된다 — 실호출의 신당역이 6호선 22건 · 2호선 0건이라
     * 그때 2호선 승강장에 6호선의 승강기 스물둘이 붙는다.
     */
    it('다른 호선의 승강기는 안 얹는다', () => {
      render(
        <SubwayArrivals
          arrivals={[arrival({ station: '신당', line: '2호선' })]}
          facilities={[{ station: '신당', line: '6호선', facilities: [lift] }]}
        />,
      )

      expect(screen.queryByRole('img', { name: '엘리베이터 있음' })).toBeNull()
    })

    // 승강기를 안 주는 역이 실호출 44역 중 31곳이다. 그 역이 「엘리베이터가
    // 없는 역」으로 보이면 안 된다 — 아무 말도 안 하는 것이 맞다.
    it('승강기를 안 준 역에는 아무 표시도 없다', () => {
      render(<SubwayArrivals arrivals={[arrival()]} facilities={[]} />)

      expect(screen.queryByRole('img', { name: '엘리베이터 있음' })).toBeNull()
      expect(screen.queryByText('보수중')).toBeNull()
    })
  })
})
