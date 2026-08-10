import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CityInfo } from '../domain/cityInfo'
import type { AreaSnapshot } from '../domain/types'
import { reset } from '../hooks/favoritesStore'
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

// 즐겨찾기 저장소를 고정한다. 브리지가 없는 환경을 흉내 내 localStorage
// 폴백을 타게 한다 — 실제 SDK에 기대면 결과가 SDK 동작에 묶인다.
vi.mock('@apps-in-toss/web-framework', () => ({
  Storage: {
    getItem: vi.fn(() => Promise.reject(new Error('브리지 없음'))),
    setItem: vi.fn(() => Promise.reject(new Error('브리지 없음'))),
  },
  Device: { openURL: vi.fn(() => Promise.reject(new Error('브리지 없음'))) },
  Share: { sendMessage: vi.fn(() => Promise.reject(new Error('브리지 없음'))) },
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
    composition: null,
  }
}

beforeEach(async () => {
  reset()
  localStorage.clear()
  vi.restoreAllMocks()
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

  it('내 장소 칩이 즐겨찾기만 남긴다', async () => {
    localStorage.setItem('seoul-live:favorites', JSON.stringify(['경복궁']))
    render(<HomeScreen />)

    await userEvent.click(await screen.findByRole('tab', { name: '내 장소 1' }))

    expect(listItem(/경복궁/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /강남역/ })).toBeNull()
  })

  it('내 장소 개수는 지금 목록에 있는 것만 센다', async () => {
    // 저장된 이름을 그대로 세면 칩에 2라고 써놓고 목록에는 1곳만 뜬다.
    // 카테고리로 좁혔거나 카탈로그에서 이름이 바뀐 경우에 실제로 갈린다.
    localStorage.setItem(
      'seoul-live:favorites',
      JSON.stringify(['강남역', '사라진곳']),
    )
    render(<HomeScreen />)
    expect(await screen.findByRole('tab', { name: '내 장소 1' })).toBeEnabled()

    await userEvent.click(screen.getByRole('tab', { name: '공원' }))

    expect(screen.getByRole('tab', { name: '내 장소 0' })).toBeDisabled()
  })

  it('상세에서 별을 누르면 내 장소 칩이 곧바로 는다', async () => {
    // 칩과 별이 각자 useFavorites를 부른다. 둘이 따로 놀면 방금 담은 곳이
    // 칩에 안 잡히고, 0인 칩은 비활성이라 필터를 켤 방법이 없어진다.
    render(<HomeScreen />)
    expect(screen.getByRole('tab', { name: '내 장소 0' })).toBeDisabled()

    await userEvent.click(listItem(/강남역/)[0])
    await userEvent.click(screen.getByRole('button', { name: '즐겨찾기에 추가' }))

    expect(await screen.findByRole('tab', { name: '내 장소 1' })).toBeEnabled()
  })

  it('저장이 막혀도 칩과 별이 같은 것을 말한다', async () => {
    // 브리지도 localStorage도 막힌 상태다. 저장 실패가 별을 막지 않는 이상
    // 그 뒤에 열리는 화면들이 서로 다른 말을 하면 안 된다. 명소를 다시 열면
    // AreaDetail이 새로 마운트되는데, 저장소만 읽으면 방금 담은 것을 못 본다.
    // window.Storage는 DOM 쪽이다(위에서 목업한 토스 SDK의 Storage가 아니다).
    // 인스턴스에 스파이를 걸면 jsdom이 조용히 무시해서 저장이 그대로 성공한다 —
    // 프로토타입이라야 실제로 막힌다.
    vi.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    render(<HomeScreen />)

    await userEvent.click(listItem(/강남역/)[0])
    await userEvent.click(screen.getByRole('button', { name: '즐겨찾기에 추가' }))
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))
    await userEvent.click(listItem(/강남역/)[0])

    expect(screen.getByRole('tab', { name: '내 장소 1' })).toBeEnabled()
    expect(
      screen.getByRole('button', { name: '즐겨찾기에서 빼기' }),
    ).toBeInTheDocument()
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
