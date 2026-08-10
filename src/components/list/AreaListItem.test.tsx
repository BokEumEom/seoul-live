import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { NearbyArea } from '../../domain/types'
import { AreaListItem } from './AreaListItem'

function area(overrides: Partial<NearbyArea> = {}): NearbyArea {
  return {
    entry: {
      code: 'POI014',
      name: '강남역',
      lat: 37.498,
      lng: 127.0276,
      category: '인구밀집지역',
    },
    snapshot: {
      code: 'POI014',
      name: '강남역',
      congestion: '붐빔',
      message: '',
      populationMin: 0,
      populationMax: 0,
      observedAt: '2026-08-10 11:00',
      observedAtLabel: '11:00',
      forecasts: [],
      composition: null,
    },
    distanceMeters: 1200,
    ...overrides,
  }
}

describe('AreaListItem', () => {
  it('이름과 혼잡도를 보여준다', () => {
    render(<AreaListItem area={area()} onSelect={() => {}} />)
    expect(screen.getByText('강남역')).toBeInTheDocument()
    expect(screen.getByText('붐빔')).toBeInTheDocument()
  })

  it('행정 용어가 아니라 화면 라벨로 카테고리를 쓴다', () => {
    render(<AreaListItem area={area()} onSelect={() => {}} />)
    expect(screen.getByText(/역·번화가/)).toBeInTheDocument()
    expect(screen.queryByText(/인구밀집지역/)).toBeNull()
  })

  // 부분 일치가 아니라 줄 전체를 단언한다. `/km|m$/` 같은 느슨한 매칭은
  // "500m · 역·번화가"를 놓치고 "0m · 역·번화가"도 통과시킨다.
  it('거리가 있으면 카테고리 앞에 붙인다', () => {
    render(<AreaListItem area={area()} onSelect={() => {}} />)
    expect(screen.getByText('1.2km · 역·번화가')).toBeInTheDocument()
  })

  it('거리가 없으면 카테고리만 남는다', () => {
    render(<AreaListItem area={area({ distanceMeters: null })} onSelect={() => {}} />)
    expect(screen.getByText('역·번화가')).toBeInTheDocument()
  })

  // 사용자가 명소 위에 서 있으면 0이 나온다(useNearbyAreas). `distanceMeters &&`로
  // 바꾸면 거리가 사라지고 숫자 0이 그려진다.
  it('거리가 0이면 0m으로 그린다', () => {
    render(<AreaListItem area={area({ distanceMeters: 0 })} onSelect={() => {}} />)
    expect(screen.getByText('0m · 역·번화가')).toBeInTheDocument()
  })

  // 갱신 시각은 시트 상단 요약과 명소 상세에 있다. 좁은 시트에서 줄을 먹으므로
  // 행에서는 뺀다.
  it('갱신 시각은 행에 넣지 않는다', () => {
    render(<AreaListItem area={area()} onSelect={() => {}} />)
    expect(screen.queryByText(/11:00/)).toBeNull()
  })

  it('즐겨찾기면 별을 붙인다', () => {
    render(<AreaListItem area={area()} favorite onSelect={() => {}} />)
    expect(screen.getByLabelText('즐겨찾기')).toBeInTheDocument()
  })

  it('즐겨찾기가 아니면 별이 없다', () => {
    render(<AreaListItem area={area()} onSelect={() => {}} />)
    expect(screen.queryByLabelText('즐겨찾기')).toBeNull()
  })

  it('누르면 명소 이름을 올려보낸다', async () => {
    const onSelect = vi.fn()
    render(<AreaListItem area={area()} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith('강남역')
  })

  // jsdom은 높이를 재지 못한다. 실제 밀도를 정하는 건 py-2와 두 줄짜리 본문이고
  // 여기서 고정할 수 있는 건 "카드가 아니라 구분선"이라는 스타일 계약뿐이다.
  it('카드 테두리가 아니라 아래 구분선을 쓴다', () => {
    render(<AreaListItem area={area()} onSelect={() => {}} />)
    const row = screen.getByRole('button')
    expect(row.className).toContain('border-b')
    expect(row.className).not.toContain('rounded-card')
  })

  it('행이 최소 탭 영역 48px을 지킨다', () => {
    render(<AreaListItem area={area()} onSelect={() => {}} />)
    expect(screen.getByRole('button').className).toContain('min-h-12')
  })

  it('이름을 제목이 아니라 본문 크기로 그린다', () => {
    render(<AreaListItem area={area()} onSelect={() => {}} />)
    expect(screen.getByText('강남역').className).toContain('text-body-md')
  })
})
