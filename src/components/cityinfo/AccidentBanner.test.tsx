import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeAccident } from '../../test/cityInfo'
import { AccidentBanner } from './AccidentBanner'

const noop = () => undefined

describe('AccidentBanner', () => {
  it('제목과 통제 내용을 함께 보여준다', () => {
    render(
      <AccidentBanner
        accidents={[makeAccident({ info: '세종대로 하위1개차로 통제' })]}
        origin={null}
        onShowOnMap={noop}
      />,
    )

    expect(screen.getByRole('heading', { name: '차량 통제 알림' })).toBeInTheDocument()
    expect(screen.getByText('세종대로 하위1개차로 통제')).toBeInTheDocument()
  })

  // **여러 건이 한 배너에 쌓인다.** 건마다 배너를 세우면 제목이 화면에 여러 번
  // 적힌다 — 실호출의 광화문이 두 건이었다(2026-08-25).
  it('여러 건이어도 제목은 한 번만 적는다', () => {
    render(
      <AccidentBanner
        accidents={[
          makeAccident({ info: '첫째 통제', occurredAt: '2026-08-25 09:00' }),
          makeAccident({ info: '둘째 통제', occurredAt: '2026-08-25 10:00' }),
        ]}
        origin={null}
        onShowOnMap={noop}
      />,
    )

    expect(screen.getAllByRole('heading', { name: '차량 통제 알림' })).toHaveLength(1)
    expect(screen.getByText('첫째 통제')).toBeInTheDocument()
    expect(screen.getByText('둘째 통제')).toBeInTheDocument()
  })

  it('통제가 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<AccidentBanner accidents={[]} origin={null} onShowOnMap={noop} />)

    expect(container).toBeEmptyDOMElement()
  })

  /**
   * **빨강이 아니다.** 이 앱에서 빨강 배너는 재난문자와 기상특보 둘이 쓴다.
   * 통제까지 같은 빨강을 입으면 광화문처럼 상시 공사·집회가 있는 곳에서 매일
   * 빨간 배너가 떠서, 정작 재난문자가 왔을 때 그 빨강이 아무 말도 못 한다.
   *
   * 클래스 이름을 리터럴로 적는 자리다 — 잠그려는 것이 **어느 톤인가** 자체다.
   */
  it('재난문자와 다른 톤을 쓴다', () => {
    const { container } = render(
      <AccidentBanner accidents={[makeAccident()]} origin={null} onShowOnMap={noop} />,
    )
    const banner = container.querySelector('section')

    expect(banner).toHaveClass('bg-busy-container')
    expect(banner).not.toHaveClass('bg-crowded-container')
  })
})
