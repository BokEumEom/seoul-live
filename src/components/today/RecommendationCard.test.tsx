import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NearbyArea } from '../../domain/types'
import { RecommendationCard } from './RecommendationCard'

function areaAt(distanceMeters: number | null): NearbyArea {
  return {
    entry: {
      code: '강남역',
      name: '강남역',
      category: '인구밀집지역',
      lat: 37.5,
      lng: 127,
      purposes: [],
    },
    snapshot: null,
    distanceMeters,
  } as unknown as NearbyArea
}

describe('RecommendationCard', () => {
  it('걸어갈 만한 거리면 도보 시간을 적는다', () => {
    render(<RecommendationCard area={areaAt(800)} onSelect={vi.fn()} />)
    expect(screen.getByText('800m')).toBeInTheDocument()
    expect(screen.getByText('· 도보 12분')).toBeInTheDocument()
  })

  // 상한 판정을 도메인(`walkableMinutes`)에 맡긴다는 계약이다. 상한 없는
  // `walkingMinutes`를 쓰면 여기서 「도보 150분」이 나오는데, 같은 값을 쓰는
  // `AreaHero`는 상한을 지켜 두 화면이 다른 말을 하게 된다.
  it('걸어갈 거리가 아니면 거리만 적고 도보 시간은 뺀다', () => {
    render(<RecommendationCard area={areaAt(10_000)} onSelect={vi.fn()} />)
    expect(screen.getByText('10.0km')).toBeInTheDocument()
    expect(screen.queryByText(/도보/)).toBeNull()
  })
})
