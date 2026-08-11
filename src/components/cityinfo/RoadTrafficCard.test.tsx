import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RoadTraffic } from '../../domain/cityInfo'
import { RoadTrafficCard } from './RoadTrafficCard'

function traffic(overrides: Partial<RoadTraffic> = {}): RoadTraffic {
  return {
    index: '서행',
    speed: 18.4,
    message: '광화문 일대가 서행하고 있어요.',
    updatedAt: '2026-08-07 09:00',
    ...overrides,
  }
}

describe('RoadTrafficCard', () => {
  it('지표와 평균 속도를 보여준다', () => {
    render(<RoadTrafficCard traffic={traffic()} />)
    expect(screen.getByText('서행')).toBeInTheDocument()
    expect(screen.getByText(/18\.4/)).toBeInTheDocument()
    expect(screen.getByText(/km\/h/)).toBeInTheDocument()
  })

  // 지표 문자열의 종류를 모르므로 화면도 아는 척하지 않는다. 명세에 없는 값이
  // 와도 그대로 나와야 한다 — 아는 값만 그리면 처음 보는 값에서 지표가 사라진다.
  it('처음 보는 지표 문자열도 그대로 보여준다', () => {
    render(<RoadTrafficCard traffic={traffic({ index: '매우혼잡' })} />)
    expect(screen.getByText('매우혼잡')).toBeInTheDocument()
  })

  // 속도를 못 읽었을 때 0으로 떨어뜨리면 "0km/h"가 되어 완전 정체로 읽힌다.
  // 주차장의 「실시간 미제공」과 같은 자리다 — 모르는 것은 모른다고 적는다.
  it('속도를 못 읽으면 0이 아니라 아무것도 쓰지 않는다', () => {
    render(<RoadTrafficCard traffic={traffic({ speed: null })} />)
    expect(screen.queryByText(/km\/h/)).not.toBeInTheDocument()
    expect(screen.queryByText(/평균/)).not.toBeInTheDocument()
    expect(screen.getByText('서행')).toBeInTheDocument()
  })

  // 파서는 지표와 메시지 중 **하나만** 있어도 항목을 만든다. 지표가 빈 채로 오면
  // 제목 자리가 빈 줄로 남아 카드에 구멍이 생긴다.
  //
  // 속도를 남겨 바깥 가드를 통과시킨 채로 시험한다. 둘 다 비우면 줄 자체가
  // 안 그려져 **바깥 가드만 확인되고 지표 가드는 시험되지 않는다.**
  it('지표가 비어도 속도가 있으면 속도만 그린다', () => {
    render(<RoadTrafficCard traffic={traffic({ index: '', speed: 24 })} />)
    expect(screen.getByText(/24km\/h/)).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('지표도 속도도 없으면 그 줄을 통째로 만들지 않는다', () => {
    render(<RoadTrafficCard traffic={traffic({ index: '', speed: null })} />)
    expect(screen.getByText('광화문 일대가 서행하고 있어요.')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.queryByText(/km\/h/)).not.toBeInTheDocument()
  })

  it('안내 문구가 비면 그 자리를 만들지 않는다', () => {
    const { container } = render(<RoadTrafficCard traffic={traffic({ message: '' })} />)
    expect(container.textContent).not.toContain('서행하고 있어요')
  })

  it('기준 시각이 비면 그리지 않는다', () => {
    render(<RoadTrafficCard traffic={traffic({ updatedAt: '' })} />)
    expect(screen.queryByText(/기준/)).not.toBeInTheDocument()
  })

  it('기준 시각이 있으면 그린다', () => {
    render(<RoadTrafficCard traffic={traffic()} />)
    expect(screen.getByText(/기준 2026-08-07 09:00/)).toBeInTheDocument()
  })
})
