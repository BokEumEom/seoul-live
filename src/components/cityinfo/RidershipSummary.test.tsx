import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeRidership, makeRidershipWindow } from '../../test/cityInfo'
import { RidershipSummary } from './RidershipSummary'

const BUSY = makeRidershipWindow({
  boardingMin: 550,
  boardingMax: 600,
  alightingMin: 900,
  alightingMax: 950,
})

describe('RidershipSummary', () => {
  it('최근 10분 승하차를 구간으로 적는다', () => {
    render(<RidershipSummary ridership={makeRidership({ last10Minutes: BUSY })} />)

    expect(screen.getByText(/승차 550~600명/)).toBeInTheDocument()
    expect(screen.getByText(/하차 900~950명/)).toBeInTheDocument()
  })

  it('하차가 많으면 모이는 중이라고 말한다', () => {
    render(<RidershipSummary ridership={makeRidership({ last10Minutes: BUSY })} />)

    expect(screen.getByText('사람이 모이는 중이에요')).toBeInTheDocument()
  })

  it('승차가 많으면 빠지는 중이라고 말한다', () => {
    render(
      <RidershipSummary
        ridership={makeRidership({
          last10Minutes: makeRidershipWindow({
            boardingMin: 900,
            boardingMax: 950,
            alightingMin: 550,
            alightingMax: 600,
          }),
        })}
      />,
    )

    expect(screen.getByText('사람이 빠지는 중이에요')).toBeInTheDocument()
  })

  // **모르면 아무 말도 안 한다.** 「비슷해요」 같은 문장을 지어내면 겹치는
  // 구간을 근거 있는 판단인 것처럼 보이게 한다.
  it('구간이 겹치면 방향을 말하지 않는다', () => {
    render(
      <RidershipSummary
        ridership={makeRidership({
          last10Minutes: makeRidershipWindow({
            boardingMin: 550,
            boardingMax: 600,
            alightingMin: 580,
            alightingMax: 640,
          }),
        })}
      />,
    )

    expect(screen.queryByText(/모이는 중|빠지는 중/)).not.toBeInTheDocument()
    // 방향을 못 말해도 숫자는 남는다.
    expect(screen.getByText(/승차 550~600명/)).toBeInTheDocument()
  })

  it('누적을 최근 10분과 따로 적는다', () => {
    render(
      <RidershipSummary
        ridership={makeRidership({
          last10Minutes: BUSY,
          total: makeRidershipWindow({
            boardingMin: 10_400,
            boardingMax: 10_500,
            alightingMin: 87_100,
            alightingMax: 87_200,
          }),
        })}
      />,
    )

    expect(screen.getByText('최근 10분')).toBeInTheDocument()
    expect(screen.getByText('오늘 첫차 이후')).toBeInTheDocument()
    expect(screen.getByText(/승차 10,400~10,500명/)).toBeInTheDocument()
  })

  // **30분·5분 창은 읽되 안 그린다**(`RidershipSummary`의 주석). 그리기 시작하면
  // 열여섯 숫자가 화면을 먹는다 — 그 결정을 여기서 잠근다.
  it('30분·5분 창은 그리지 않는다', () => {
    render(
      <RidershipSummary
        ridership={makeRidership({
          last10Minutes: BUSY,
          last30Minutes: makeRidershipWindow({ boardingMin: 3100, boardingMax: 3200 }),
          last5Minutes: makeRidershipWindow({ boardingMin: 300, boardingMax: 350 }),
        })}
      />,
    )

    expect(screen.queryByText(/3,100/)).not.toBeInTheDocument()
    expect(screen.queryByText(/300~350/)).not.toBeInTheDocument()
  })

  it('한쪽만 읽힌 구간은 그 값 하나만 적는다', () => {
    render(
      <RidershipSummary
        ridership={makeRidership({
          last10Minutes: makeRidershipWindow({ boardingMin: 550, boardingMax: 550 }),
        })}
      />,
    )

    expect(screen.getByText(/승차 550명/)).toBeInTheDocument()
    expect(screen.queryByText(/하차/)).not.toBeInTheDocument()
  })

  it('역·정류장 개수를 적는다', () => {
    render(<RidershipSummary ridership={makeRidership({ stopCount: 4 })} />)

    expect(screen.getByText('이 명소 안 4곳 기준')).toBeInTheDocument()
  })

  it('아무것도 없으면 절 자체가 안 그려진다', () => {
    const { container } = render(<RidershipSummary ridership={makeRidership()} />)

    expect(container).toBeEmptyDOMElement()
  })
})
