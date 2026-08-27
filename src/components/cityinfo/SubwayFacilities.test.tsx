import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { applyLanguage } from '../../i18n/t'
import type { SubwayFacility } from '../../domain/subwayFacility'
import { ElevatorMark, FacilityRepairs } from './SubwayFacilities'

function facility(overrides: Partial<SubwayFacility> = {}): SubwayFacility {
  return {
    kind: 'ES',
    section: 'B2-B3',
    position: '서대문 방면1-1',
    status: '사용가능',
    ...overrides,
  }
}

afterEach(() => {
  applyLanguage('ko')
})

describe('ElevatorMark', () => {
  it('엘리베이터가 있으면 표시를 단다', () => {
    render(<ElevatorMark facilities={[facility({ kind: 'EV' })]} />)

    expect(screen.getByRole('img', { name: '엘리베이터 있음' })).toBeInTheDocument()
  })

  /**
   * **표시는 「있나」에만 답한다.** 보수중인 한 대 때문에 표시를 떼면 나머지
   * 다섯 대가 화면에서 사라진다 — 실호출의 신길역이 엘리베이터 6대 중 1대만
   * 보수중이었다(2026-08-27). 어느 것이 멈췄는지는 `FacilityRepairs`가 적는다.
   */
  it('보수중인 엘리베이터가 있어도 표시는 남는다', () => {
    render(
      <ElevatorMark
        facilities={[
          facility({ kind: 'EV', status: '보수중' }),
          facility({ kind: 'EV' }),
        ]}
      />,
    )

    expect(screen.getByRole('img', { name: '엘리베이터 있음' })).toBeInTheDocument()
  })

  // 계단을 못 쓰는 사람에게 에스컬레이터는 답이 아니다.
  it('에스컬레이터만 있으면 표시를 안 단다', () => {
    const { container } = render(<ElevatorMark facilities={[facility()]} />)

    expect(container).toBeEmptyDOMElement()
  })

  /**
   * **비었다는 것은 「엘리베이터가 없다」가 아니다.** 실호출 44역 중 31역이 이
   * 배열을 통째로 안 주는데 거기에 강남역과 서울역이 들어 있다 — 둘 다 실제로는
   * 엘리베이터가 있다. 그래서 화면은 있다는 말만 하고 없다는 말은 안 한다.
   */
  it('승강기를 안 준 역에는 아무 말도 안 한다', () => {
    const { container } = render(<ElevatorMark facilities={[]} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('영어 화면에서는 표시 이름도 영어다', () => {
    applyLanguage('en')
    render(<ElevatorMark facilities={[facility({ kind: 'EV' })]} />)

    expect(screen.getByRole('img', { name: 'Has elevator' })).toBeInTheDocument()
  })
})

describe('FacilityRepairs', () => {
  it('갈래와 운행구간을 적는다', () => {
    render(
      <FacilityRepairs
        facilities={[facility({ status: '보수중' })]}
        title="광화문 5호선"
      />,
    )

    expect(screen.getByText('에스컬레이터 B2-B3')).toBeInTheDocument()
    expect(screen.getByText('서대문 방면1-1')).toBeInTheDocument()
  })

  // 「보수중」이 색으로만 있으면 색을 못 보는 사람에게 그냥 목록이다(WCAG 1.4.1).
  it('보수중이라고 글자로 적는다', () => {
    render(
      <FacilityRepairs
        facilities={[facility({ status: '보수중' })]}
        title="광화문 5호선"
      />,
    )

    expect(screen.getByText('보수중')).toBeInTheDocument()
  })

  it('사용가능한 것은 안 적는다', () => {
    const { container } = render(
      <FacilityRepairs facilities={[facility()]} title="광화문 5호선" />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  // 「모른다」는 「고장」이 아니다 — 없는 고장을 띄우면 그걸 보고 돌아가는
  // 사람이 생긴다.
  it('상태를 모르는 것은 안 적는다', () => {
    const { container } = render(
      <FacilityRepairs facilities={[facility({ status: null })]} title="광화문 5호선" />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  // 갈래를 몰라도 「무언가 보수중」은 참이다. 통째로 버리면 그 사실을 잃는다.
  it('처음 보는 갈래는 「승강기」로 적는다', () => {
    render(
      <FacilityRepairs
        facilities={[facility({ kind: null, status: '보수중' })]}
        title="광화문 5호선"
      />,
    )

    expect(screen.getByText('승강기 B2-B3')).toBeInTheDocument()
  })

  /**
   * **글자로는 못 잰다.** 「설치위치가 없으면 그 줄이 없다」를 `queryByText`로
   * 쓰면 위치가 빈 이상 무엇을 렌더하든 통과한다 — 처음에 그렇게 썼고 변이가
   * 살아남아서 드러났다. 빈 `<p>`는 높이가 0이라 눈으로도 안 보인다.
   *
   * 그래서 세는 것은 **줄의 개수**다. 이건 DOM에 실제로 남는 차이다.
   */
  it('설치위치가 없으면 줄을 하나만 만든다', () => {
    render(
      <FacilityRepairs
        facilities={[facility({ position: '', status: '보수중' })]}
        title="광화문 5호선"
      />,
    )

    const [item] = screen.getAllByRole('listitem')
    expect(item.querySelectorAll('p')).toHaveLength(1)
    expect(item).toHaveTextContent('에스컬레이터 B2-B3')
  })

  it('설치위치가 있으면 줄을 둘 만든다', () => {
    render(
      <FacilityRepairs
        facilities={[facility({ status: '보수중' })]}
        title="광화문 5호선"
      />,
    )

    const [item] = screen.getAllByRole('listitem')
    expect(item.querySelectorAll('p')).toHaveLength(2)
  })

  it('여러 대를 모두 적는다', () => {
    render(
      <FacilityRepairs
        facilities={[
          facility({ status: '보수중', section: 'B3-1F' }),
          facility({ kind: 'EV', status: '보수중', section: 'B4-B3' }),
        ]}
        title="신길 5호선"
      />,
    )

    const list = screen.getByRole('list', { name: '신길 5호선 보수중 시설' })
    expect(list.querySelectorAll('li')).toHaveLength(2)
    expect(screen.getByText('에스컬레이터 B3-1F')).toBeInTheDocument()
    expect(screen.getByText('엘리베이터 B4-B3')).toBeInTheDocument()
  })

  it('영어 화면에서 갈래와 상태가 영어다', () => {
    applyLanguage('en')
    render(
      <FacilityRepairs
        facilities={[facility({ status: '보수중' })]}
        title="Gwanghwamun Line 5"
      />,
    )

    expect(screen.getByText('Escalator B2-B3')).toBeInTheDocument()
    expect(screen.getByText('Under repair')).toBeInTheDocument()
  })
})
