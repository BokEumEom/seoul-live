import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CityAlert } from '../../domain/cityInfo'
import { AlertDigest } from './AlertDigest'

function alert(message: string): CityAlert {
  return { category: '기상', step: '주의보', message, createdAt: '2026-08-07 11:00' }
}

describe('AlertDigest', () => {
  it('재난문자가 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<AlertDigest alerts={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('같은 문구가 여러 번 실려도 한 번만 그린다', () => {
    // 폭염 경보 하나가 30곳에 실려 오면 화면이 같은 문장으로 도배된다.
    const same = alert('호우 주의보')
    render(<AlertDigest alerts={[same, same, same]} />)
    expect(screen.getAllByText('호우 주의보')).toHaveLength(1)
    expect(screen.getByText(/재난문자 1건/)).toBeInTheDocument()
  })

  it('서로 다른 문구는 모두 그린다', () => {
    render(<AlertDigest alerts={[alert('호우 주의보'), alert('폭염 경보')]} />)
    expect(screen.getByText(/재난문자 2건/)).toBeInTheDocument()
  })

  it('role=alert로 올린다', () => {
    render(<AlertDigest alerts={[alert('호우 주의보')]} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
