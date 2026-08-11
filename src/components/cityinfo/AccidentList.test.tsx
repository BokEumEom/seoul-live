import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AccidentControl } from '../../domain/cityInfo'
import { AccidentList } from './AccidentList'

function accident(overrides: Partial<AccidentControl> = {}): AccidentControl {
  return {
    info: '세종대로 사거리 2개 차로 통제',
    type: '교통사고',
    detailType: '차대차',
    occurredAt: '2026-08-07 08:40',
    expectedClearAt: '2026-08-07 10:00',
    ...overrides,
  }
}

describe('AccidentList', () => {
  it('통제 내용을 보여준다', () => {
    render(<AccidentList accidents={[accident()]} />)
    expect(screen.getByText('세종대로 사거리 2개 차로 통제')).toBeInTheDocument()
  })

  it('유형과 세부유형을 한 줄로 묶는다', () => {
    render(<AccidentList accidents={[accident()]} />)
    expect(screen.getByText('교통사고 · 차대차')).toBeInTheDocument()
  })

  // 유형만 오고 세부유형이 없을 때 구분점이 남으면 「교통사고 ·」가 된다.
  it('세부유형이 없으면 구분점을 남기지 않는다', () => {
    render(<AccidentList accidents={[accident({ detailType: '' })]} />)
    expect(screen.getByText('교통사고')).toBeInTheDocument()
    expect(screen.queryByText(/·/)).not.toBeInTheDocument()
  })

  // 사용자가 실제로 쓰는 값은 「언제 풀리나」다. 발생 시각보다 이쪽이 앞이다.
  it('통제 종료 예정 시각을 보여준다', () => {
    render(<AccidentList accidents={[accident()]} />)
    expect(screen.getByText(/10:00까지/)).toBeInTheDocument()
  })

  it('종료 예정이 없으면 그 줄을 만들지 않는다', () => {
    render(<AccidentList accidents={[accident({ expectedClearAt: '' })]} />)
    expect(screen.queryByText(/까지/)).not.toBeInTheDocument()
  })

  it('여러 건을 모두 보여준다', () => {
    render(
      <AccidentList
        accidents={[accident(), accident({ info: '남대문로 갓길 통제' })]}
      />,
    )
    expect(screen.getByText('세종대로 사거리 2개 차로 통제')).toBeInTheDocument()
    expect(screen.getByText('남대문로 갓길 통제')).toBeInTheDocument()
  })
})
