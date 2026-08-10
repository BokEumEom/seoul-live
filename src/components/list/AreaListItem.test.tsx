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

  // 속성이 아니라 계산된 이름을 잠근다. `getByLabelText`는 role과 무관하게
  // `aria-label` 속성만 보므로, 이름을 받을 수 없는 요소에 붙은 label도
  // 통과시킨다.
  //
  // 한계를 밝혀 둔다: role 없는 `<span>`은 `generic`이고 ARIA 1.2에서 generic은
  // 이름을 받는 게 금지돼 있다("Name from author: prohibited"). Chromium(토스
  // 안드로이드 웹뷰)·Firefox는 이 금지를 구현해 `aria-label`을 버리는데,
  // **jsdom은 이 금지를 모형화하지 않는다** — `role="img"`을 지우고 재봤더니
  // `toHaveAccessibleName`은 그대로 통과했다. 즉 이 결함 자체를 잡는 건
  // `getByRole('img', ...)`(role이 없으면 못 찾는다)이고,
  // `toHaveAccessibleName`은 label이 버튼 이름까지 닿는지만 본다.
  // 실기기 검증은 여기서 대신할 수 없다.
  it('즐겨찾기면 이름을 받을 수 있는 별을 붙인다', () => {
    render(<AreaListItem area={area()} favorite onSelect={() => {}} />)
    expect(screen.getByRole('img', { name: '즐겨찾기한 곳' })).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAccessibleName(/즐겨찾기한 곳/)
  })

  it('즐겨찾기가 아니면 별이 없다', () => {
    render(<AreaListItem area={area()} onSelect={() => {}} />)
    expect(screen.queryByRole('img', { name: '즐겨찾기한 곳' })).toBeNull()
    expect(screen.getByRole('button')).not.toHaveAccessibleName(/즐겨찾기/)
  })

  it('누르면 명소 이름을 올려보낸다', async () => {
    const onSelect = vi.fn()
    render(<AreaListItem area={area()} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith('강남역')
  })

  // jsdom은 높이를 재지 못한다. 실제 밀도를 정하는 건 py-2와 두 줄짜리 본문이고
  // 여기서 고정할 수 있는 건 "카드가 아니라 구분선"이라는 스타일 계약뿐이다.
  //
  // `className.toContain`은 부분 문자열이라 `border-b`가 `last:border-b-0`에도
  // 걸린다 — `border-b`를 지워도 통과한다. 클래스 토큰 단위로 보는
  // `toHaveClass`를 쓴다.
  it('카드 테두리가 아니라 아래 구분선을 쓴다', () => {
    render(<AreaListItem area={area()} onSelect={() => {}} />)
    const row = screen.getByRole('button')
    expect(row).toHaveClass('border-b')
    expect(row).not.toHaveClass('rounded-card')
  })

  // 마지막 행 아래는 비어 있어 구분선이 허공에 남는다.
  it('마지막 행은 구분선을 지운다', () => {
    render(<AreaListItem area={area()} onSelect={() => {}} />)
    expect(screen.getByRole('button')).toHaveClass('last:border-b-0')
  })

  // 59px 피치를 만드는 조합이다: py-2(8+8) + 이름 줄높이 24 + mt-0.5(2) +
  // 보조 줄높이 16 + 구분선 1. `min-h-12`는 하한일 뿐 실제 높이를 정하지
  // 않으므로 하한만 단언하면 **59px을 48px로 깎는 변경**(이 컴포넌트의 목적과
  // 정반대)이 그대로 통과한다. 이름의 `text-body-md`는 아래 테스트가 잠근다.
  it('행 높이를 만드는 조합을 고정한다', () => {
    render(<AreaListItem area={area()} onSelect={() => {}} />)
    expect(screen.getByRole('button')).toHaveClass('py-2', 'min-h-12')
    expect(screen.getByText('1.2km · 역·번화가')).toHaveClass('mt-0.5', 'text-label-sm')
  })

  it('이름을 제목이 아니라 본문 크기로 그린다', () => {
    render(<AreaListItem area={area()} onSelect={() => {}} />)
    expect(screen.getByText('강남역')).toHaveClass('text-body-md')
  })
})
