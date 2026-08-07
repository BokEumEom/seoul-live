import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CityInfo } from '../domain/cityInfo'
import type { AreaSnapshot } from '../domain/types'
import { HomeScreen } from './HomeScreen'

// jsdom에 Google Maps가 없다. App.test.tsx가 토스 SDK에 쓰는 방식과 같다.
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Map: ({ children }: { children: ReactNode }) => (
    <div role="region" aria-label="지도">
      {children}
    </div>
  ),
  AdvancedMarker: ({
    children,
    onClick,
  }: {
    children: ReactNode
    onClick?: () => void
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock('../data/queries', () => ({
  useAreaSnapshots: vi.fn(),
  useAreaSnapshot: vi.fn(),
  useCityInfo: vi.fn(),
}))
vi.mock('../app/locationContext', () => ({ useLocation: vi.fn() }))
vi.mock('../platform/googleMaps', () => ({
  googleMapsApiKey: vi.fn(() => 'test-key'),
  googleMapsMapId: vi.fn(() => 'DEMO_MAP_ID'),
  isMapAvailable: vi.fn(() => true),
}))

const queries = await import('../data/queries')
const locationContext = await import('../app/locationContext')
const googleMaps = await import('../platform/googleMaps')
const useAreaSnapshots = vi.mocked(queries.useAreaSnapshots)
const useAreaSnapshot = vi.mocked(queries.useAreaSnapshot)
const useCityInfo = vi.mocked(queries.useCityInfo)
const useLocation = vi.mocked(locationContext.useLocation)
const isMapAvailable = vi.mocked(googleMaps.isMapAvailable)

function snapshotFor(
  name: string,
  congestion: AreaSnapshot['congestion'] = '보통',
): AreaSnapshot {
  return {
    code: name,
    name,
    congestion,
    message: '',
    populationMin: 0,
    populationMax: 0,
    observedAt: '2026-08-07 11:00',
    observedAtLabel: '11:00',
    forecasts: [],
  }
}

beforeEach(async () => {
  localStorage.clear()
  vi.clearAllMocks()
  isMapAvailable.mockReturnValue(true)
  useLocation.mockReturnValue({ coords: null, status: 'unavailable', retry: vi.fn() })
  const { AREA_NAMES } = await import('../data/areas')
  useAreaSnapshots.mockReturnValue({
    data: AREA_NAMES.map((name) => snapshotFor(name)),
    isPending: false,
    isError: false,
  } as unknown as UseQueryResult<readonly (AreaSnapshot | null)[]>)
  useAreaSnapshot.mockReturnValue({
    data: snapshotFor('강남역'),
    isPending: false,
    isError: false,
  } as unknown as UseQueryResult<AreaSnapshot>)
  useCityInfo.mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
  } as unknown as UseQueryResult<CityInfo>)
})

/** 목록 쪽 항목만 고른다 — 지도 마커도 같은 이름의 버튼이라서. */
function listItem(name: string | RegExp) {
  return screen.getAllByRole('button', { name })
}

describe('HomeScreen', () => {
  it('목록과 지도를 함께 보여준다', () => {
    render(<HomeScreen />)
    expect(screen.getByRole('region', { name: '지도' })).toBeInTheDocument()
    expect(listItem(/강남역/).length).toBeGreaterThan(0)
  })

  it('명소를 누르면 상세가 목록 자리에 들어오고 지도는 남는다', async () => {
    render(<HomeScreen />)
    await userEvent.click(listItem(/강남역/)[0])
    expect(screen.getByRole('button', { name: '목록으로' })).toBeInTheDocument()
    // 핵심: 지도가 사라지지 않는다. 예전 구조에서는 상세로 가면 사라졌다.
    expect(screen.getByRole('region', { name: '지도' })).toBeInTheDocument()
  })

  it('목록으로를 누르면 다시 목록이 나온다', async () => {
    render(<HomeScreen />)
    await userEvent.click(listItem(/강남역/)[0])
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))
    expect(listItem(/경복궁/).length).toBeGreaterThan(0)
  })

  it('검색하면 목록이 줄어든다', async () => {
    render(<HomeScreen />)
    await userEvent.type(screen.getByRole('searchbox'), '경복궁')
    expect(screen.queryByRole('button', { name: /강남역/ })).toBeNull()
    expect(listItem(/경복궁/).length).toBeGreaterThan(0)
  })

  it('검색 결과가 없으면 찾은 말을 되돌려 보여준다', async () => {
    render(<HomeScreen />)
    await userEvent.type(screen.getByRole('searchbox'), '없는곳')
    expect(screen.getByText(/「없는곳」/)).toBeInTheDocument()
  })

  it('검색어를 지우면 목록이 돌아온다', async () => {
    render(<HomeScreen />)
    await userEvent.type(screen.getByRole('searchbox'), '경복궁')
    await userEvent.click(screen.getByRole('button', { name: '검색어 지우기' }))
    expect(listItem(/강남역/).length).toBeGreaterThan(0)
  })

  // 설계 §4가 가장 중요하다고 한 실패 경로다. 예전에는 지도가 독립 탭이라
  // 실패해도 「내 주변」이 멀쩡했지만, 이제 지도가 홈의 절반이다.
  it('지도 키가 없어도 검색과 목록은 정상 동작한다', async () => {
    isMapAvailable.mockReturnValue(false)
    render(<HomeScreen />)
    expect(screen.queryByRole('region', { name: '지도' })).toBeNull()
    expect(listItem(/강남역/).length).toBeGreaterThan(0)
    await userEvent.type(screen.getByRole('searchbox'), '경복궁')
    expect(screen.queryByRole('button', { name: /강남역/ })).toBeNull()
  })

  it('지도 키가 없어도 명소 상세를 열 수 있다', async () => {
    isMapAvailable.mockReturnValue(false)
    render(<HomeScreen />)
    await userEvent.click(listItem(/강남역/)[0])
    expect(screen.getByRole('button', { name: '목록으로' })).toBeInTheDocument()
  })

  it('focusArea가 주어지면 그 명소의 상세로 연다', () => {
    useAreaSnapshot.mockReturnValue({
      data: snapshotFor('경복궁'),
      isPending: false,
      isError: false,
    } as unknown as UseQueryResult<AreaSnapshot>)
    render(<HomeScreen focusArea="경복궁" />)
    expect(screen.getByRole('button', { name: '목록으로' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '경복궁' })).toBeInTheDocument()
  })

  it('좌표가 없으면 내 주변 버튼이 비활성이다', () => {
    render(<HomeScreen />)
    expect(screen.getByRole('button', { name: '내 주변' })).toBeDisabled()
  })

  // 옛 MapScreen에서 옮겨온 규칙이다. 지도가 홈이 되면서 이 화면의 몫이 됐다.
  it('프리셋 개수는 걸러진 목록이 아니라 전체로 센다', async () => {
    // 걸러진 목록으로 세면 하나를 고르는 순간 나머지 두 칩이 0이 되어
    // 비활성으로 굳고, 다른 목적으로 갈아탈 방법이 사라진다.
    const { AREA_CATALOG } = await import('../data/areas')
    useAreaSnapshots.mockReturnValue({
      // 공원은 여유(나들이·데이트에 걸린다), 나머지는 붐빔(핫플에 걸린다).
      data: AREA_CATALOG.map((entry) =>
        snapshotFor(entry.name, entry.category === '공원' ? '여유' : '붐빔'),
      ),
      isPending: false,
      isError: false,
    } as unknown as UseQueryResult<readonly (AreaSnapshot | null)[]>)

    render(<HomeScreen />)
    const kidsChip = screen.getByRole('tab', { name: /아이와 나들이 10/ })
    expect(screen.getByRole('tab', { name: /지금 핫플 20/ })).toBeEnabled()

    await userEvent.click(kidsChip)

    expect(screen.getByRole('tab', { name: /지금 핫플 20/ })).toBeEnabled()
  })

  it('카테고리를 고르면 목록이 그 분류만 남는다', async () => {
    render(<HomeScreen />)
    await userEvent.click(screen.getByRole('tab', { name: '고궁·유적' }))
    expect(listItem(/경복궁/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /강남역/ })).toBeNull()
  })

  // 상세가 열리면 카테고리·정렬은 목록과 함께 가려진다. 검색 바만 남는다 —
  // 검색은 "다른 곳으로 가는" 전역 수단이고 카테고리·정렬은 목록의 것이다.
  it('상세를 열면 카테고리와 정렬은 가려지고 검색은 남는다', async () => {
    render(<HomeScreen />)
    await userEvent.click(listItem(/강남역/)[0])
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: '공원' })).toBeNull()
    expect(screen.queryByRole('tab', { name: '여유한 순' })).toBeNull()
  })

  it('상세가 열린 채로 검색하면 목록으로 돌아간다', async () => {
    render(<HomeScreen />)
    await userEvent.click(listItem(/강남역/)[0])
    expect(screen.getByRole('button', { name: '목록으로' })).toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox'), '경복궁')
    expect(screen.queryByRole('button', { name: '목록으로' })).toBeNull()
    expect(listItem(/경복궁/).length).toBeGreaterThan(0)
  })
})
