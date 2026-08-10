import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UseQueryResult } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AreaSnapshot } from '../domain/types'
import { FavoritesScreen } from './FavoritesScreen'

vi.mock('../data/queries', () => ({ useAreaSnapshots: vi.fn() }))
vi.mock('../app/locationContext', () => ({ useLocation: vi.fn() }))
// 브리지가 없는 환경을 고정한다. 실제 SDK에 기대면 결과가 SDK 동작에 묶인다.
vi.mock('@apps-in-toss/web-framework', () => ({
  Storage: {
    getItem: vi.fn(() => Promise.reject(new Error('브리지 없음'))),
    setItem: vi.fn(() => Promise.reject(new Error('브리지 없음'))),
  },
}))

const queries = await import('../data/queries')
const locationContext = await import('../app/locationContext')
const useAreaSnapshots = vi.mocked(queries.useAreaSnapshots)
const useLocation = vi.mocked(locationContext.useLocation)

function snapshotFor(name: string): AreaSnapshot {
  return {
    code: name,
    name,
    congestion: '보통',
    message: '',
    populationMin: 0,
    populationMax: 0,
    observedAt: '2026-08-07 11:00',
    observedAtLabel: '11:00',
    forecasts: [],
    composition: null,
  }
}

beforeEach(async () => {
  localStorage.clear()
  vi.clearAllMocks()
  useLocation.mockReturnValue({ coords: null, status: 'unavailable', retry: vi.fn() })
  const { AREA_NAMES } = await import('../data/areas')
  useAreaSnapshots.mockReturnValue({
    data: AREA_NAMES.map((name) => snapshotFor(name)),
    isPending: false,
    isError: false,
  } as unknown as UseQueryResult<readonly (AreaSnapshot | null)[]>)
})

describe('FavoritesScreen', () => {
  it('비어 있으면 담는 방법을 알려주고 홈으로 가는 버튼을 준다', async () => {
    const onGoHome = vi.fn()
    render(<FavoritesScreen onSelectArea={() => {}} onGoHome={onGoHome} />)
    expect(await screen.findByText('지도에서 ☆를 눌러 담아보세요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '지도로 가기' }))
    expect(onGoHome).toHaveBeenCalledTimes(1)
  })

  it('담은 명소만 보여준다', async () => {
    localStorage.setItem('seoul-live:favorites', JSON.stringify(['경복궁']))
    render(<FavoritesScreen onSelectArea={() => {}} onGoHome={() => {}} />)
    expect(await screen.findByRole('button', { name: /경복궁/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /강남역/ })).toBeNull()
  })

  it('항목을 누르면 명소를 올려보낸다', async () => {
    localStorage.setItem('seoul-live:favorites', JSON.stringify(['경복궁']))
    const onSelectArea = vi.fn()
    render(<FavoritesScreen onSelectArea={onSelectArea} onGoHome={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: /경복궁/ }))
    expect(onSelectArea).toHaveBeenCalledWith('경복궁')
  })

  it('담은 게 여럿이면 모두 보여준다', async () => {
    localStorage.setItem(
      'seoul-live:favorites',
      JSON.stringify(['경복궁', '남산공원']),
    )
    render(<FavoritesScreen onSelectArea={() => {}} onGoHome={() => {}} />)
    expect(await screen.findByRole('button', { name: /경복궁/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /남산공원/ })).toBeInTheDocument()
    expect(screen.queryByText('지도에서 ☆를 눌러 담아보세요')).toBeNull()
  })

  it('카탈로그에 없는 이름이 저장돼 있어도 무시한다', async () => {
    // 121곳으로 늘렸다 줄이면 실제로 생길 수 있다. 빈 카드가 뜨면 안 된다.
    localStorage.setItem(
      'seoul-live:favorites',
      JSON.stringify(['부산역', '경복궁']),
    )
    render(<FavoritesScreen onSelectArea={() => {}} onGoHome={() => {}} />)
    expect(await screen.findByRole('button', { name: /경복궁/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /부산역/ })).toBeNull()
  })

  // 행이 아래 구분선으로 갈리므로 컨테이너가 간격을 주면 구분선이 허공에 뜬다.
  it('구분선 목록에 행 간격을 두지 않는다', async () => {
    localStorage.setItem(
      'seoul-live:favorites',
      JSON.stringify(['경복궁', '남산공원']),
    )
    render(<FavoritesScreen onSelectArea={() => {}} onGoHome={() => {}} />)
    const row = await screen.findByRole('button', { name: /경복궁/ })
    expect(row.parentElement?.className).not.toMatch(/\bgap-/)
  })

  it('혼잡도 조회가 실패해도 담은 목록은 보여준다', async () => {
    localStorage.setItem('seoul-live:favorites', JSON.stringify(['경복궁']))
    useAreaSnapshots.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<readonly (AreaSnapshot | null)[]>)
    render(<FavoritesScreen onSelectArea={() => {}} onGoHome={() => {}} />)
    expect(await screen.findByRole('button', { name: /경복궁/ })).toBeInTheDocument()
    expect(screen.getByText('혼잡도 정보를 가져오지 못했어요.')).toBeInTheDocument()
  })
})
