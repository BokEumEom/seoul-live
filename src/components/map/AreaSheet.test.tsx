import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AreaSnapshot, NearbyArea } from '../../domain/types'
import { AreaSheet } from './AreaSheet'

vi.mock('../../platform/links', () => ({
  openExternalUrl: vi.fn(),
}))

const links = await import('../../platform/links')

function snapshot(): AreaSnapshot {
  return {
    code: 'POI014',
    name: '강남역',
    congestion: '붐빔',
    message: '사람이 많아 붐빕니다. 이동에 주의하세요.',
    populationMin: 42_000,
    populationMax: 44_000,
    observedAt: '2026-08-05 14:35',
    observedAtLabel: '14:35',
    forecasts: [],
  }
}

function area(overrides: Partial<NearbyArea> = {}): NearbyArea {
  return {
    entry: {
      code: 'POI014',
      name: '강남역',
      lat: 37.498,
      lng: 127.0276,
      category: '인구밀집지역',
    },
    snapshot: snapshot(),
    distanceMeters: 800,
    ...overrides,
  }
}

describe('AreaSheet', () => {
  it('선택된 명소가 없으면 아무것도 렌더하지 않는다', () => {
    // 앱인토스 심사: "미니앱에 진입하자마자 바텀시트가 자동으로 나타나지 않아요."
    const { container } = render(
      <AreaSheet area={null} onClose={vi.fn()} onOpenForecast={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('명소명·혼잡도·안내 문구·갱신 시각을 보여준다', () => {
    render(
      <AreaSheet area={area()} onClose={vi.fn()} onOpenForecast={vi.fn()} />,
    )

    expect(screen.getByText('강남역')).toBeInTheDocument()
    expect(screen.getByText('붐빔')).toBeInTheDocument()
    expect(
      screen.getByText('사람이 많아 붐빕니다. 이동에 주의하세요.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/14:35 기준/)).toBeInTheDocument()
  })

  it('거리를 알면 함께 보여준다', () => {
    render(
      <AreaSheet area={area()} onClose={vi.fn()} onOpenForecast={vi.fn()} />,
    )

    expect(screen.getByText('800m')).toBeInTheDocument()
  })

  it('거리를 모르면 거리 자리를 비운다', () => {
    render(
      <AreaSheet
        area={area({ distanceMeters: null })}
        onClose={vi.fn()}
        onOpenForecast={vi.fn()}
      />,
    )

    expect(screen.queryByText('800m')).not.toBeInTheDocument()
  })

  it('조회에 실패한 명소는 정보 없음으로 보여준다', () => {
    render(
      <AreaSheet
        area={area({ snapshot: null })}
        onClose={vi.fn()}
        onOpenForecast={vi.fn()}
      />,
    )

    expect(screen.getByText('강남역')).toBeInTheDocument()
    expect(screen.getByText('정보 없음')).toBeInTheDocument()
  })

  it('닫기를 누르면 onClose를 부른다', async () => {
    const onClose = vi.fn()
    render(
      <AreaSheet area={area()} onClose={onClose} onOpenForecast={vi.fn()} />,
    )

    await userEvent.click(screen.getByRole('button', { name: '닫기' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('닫기 아이콘이 아래를 가리킨다', () => {
    // 위 화살표는 바텀시트에서 "펼치기"로 읽힌다. 실제 동작은 닫기이므로
    // 화살표도 시트가 사라지는 방향을 가리켜야 한다.
    render(
      <AreaSheet area={area()} onClose={vi.fn()} onOpenForecast={vi.fn()} />,
    )

    const icon = screen.getByRole('button', { name: '닫기' }).querySelector('svg')
    expect(icon).toHaveClass('-rotate-90')
  })

  it('혼잡예보 보기를 누르면 명소 이름을 넘긴다', async () => {
    const onOpenForecast = vi.fn()
    render(
      <AreaSheet area={area()} onClose={vi.fn()} onOpenForecast={onOpenForecast} />,
    )

    await userEvent.click(screen.getByRole('button', { name: '혼잡예보 보기' }))

    expect(onOpenForecast).toHaveBeenCalledWith('강남역')
  })

  it('길찾기를 누르면 카카오맵을 네이티브로 연다', async () => {
    render(
      <AreaSheet area={area()} onClose={vi.fn()} onOpenForecast={vi.fn()} />,
    )

    await userEvent.click(screen.getByRole('link', { name: '길찾기' }))

    expect(links.openExternalUrl).toHaveBeenCalledWith(
      `https://map.kakao.com/link/search/${encodeURIComponent('강남역')}`,
    )
  })
})
