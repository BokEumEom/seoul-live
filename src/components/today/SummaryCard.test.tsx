import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SummaryCard } from './SummaryCard'

describe('SummaryCard', () => {
  it('붐빔 개수를 한 줄로 보여준다', () => {
    render(
      <SummaryCard
        summary={{
          total: 30,
          counted: 30,
          byLevel: { 여유: 20, 보통: 5, '약간 붐빔': 4, 붐빔: 1 },
        }}
      />,
    )
    expect(screen.getByText(/30곳 중 붐빔 1곳/)).toBeInTheDocument()
  })

  it('아직 아무것도 안 왔으면 그렇게 말한다', () => {
    render(
      <SummaryCard
        summary={{
          total: 30,
          counted: 0,
          byLevel: { 여유: 0, 보통: 0, '약간 붐빔': 0, 붐빔: 0 },
        }}
      />,
    )
    expect(screen.getByText('혼잡도 정보를 아직 받지 못했어요.')).toBeInTheDocument()
  })

  it('일부만 왔으면 몇 곳이 빠졌는지 밝힌다', () => {
    render(
      <SummaryCard
        summary={{
          total: 30,
          counted: 22,
          byLevel: { 여유: 20, 보통: 1, '약간 붐빔': 0, 붐빔: 1 },
        }}
      />,
    )
    expect(screen.getByText(/30곳 중 22곳만 정보가 왔어요/)).toBeInTheDocument()
  })

  it('전부 왔으면 빠진 곳 안내를 하지 않는다', () => {
    render(
      <SummaryCard
        summary={{
          total: 30,
          counted: 30,
          byLevel: { 여유: 29, 보통: 0, '약간 붐빔': 0, 붐빔: 1 },
        }}
      />,
    )
    expect(screen.queryByText(/정보가 왔어요/)).toBeNull()
  })
})
