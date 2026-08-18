import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { NearbyArea } from '../../domain/types'
import { RankList } from './RankList'

function area(name: string): NearbyArea {
  return {
    entry: { code: name, name, nameEn: name, lat: 0, lng: 0, category: '공원' },
    snapshot: {
      code: name,
      name,
      congestion: '붐빔',
      message: '',
      populationMin: 0,
      populationMax: 0,
      observedAt: '2026-08-07 11:00',
      observedAtLabel: '11:00',
      forecasts: [],
      composition: null,
      replaced: null,
    },
    distanceMeters: null,
  }
}

describe('RankList', () => {
  it('비어 있으면 아무것도 그리지 않는다', () => {
    const { container } = render(
      <RankList title="지금 가장 붐비는 곳" areas={[]} onSelect={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('순위를 1부터 매긴다', () => {
    render(
      <RankList
        title="지금 가장 붐비는 곳"
        areas={[area('남산공원'), area('서울숲공원')]}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('누르면 명소 이름을 올려보낸다', async () => {
    const onSelect = vi.fn()
    render(
      <RankList title="지금 가장 붐비는 곳" areas={[area('남산공원')]} onSelect={onSelect} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /남산공원/ }))
    expect(onSelect).toHaveBeenCalledWith('남산공원')
  })
})
