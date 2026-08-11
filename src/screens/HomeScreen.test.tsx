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
// 「오늘의 서울」이 시트 안 뷰가 되면서 이 화면이 재난문자를 함께 읽는다.
// 실제 훅은 QueryClient를 요구해 이 파일의 render를 전부 깨뜨린다.
vi.mock('../hooks/useCachedCityAlerts', () => ({ useCachedCityAlerts: vi.fn() }))
vi.mock('../app/locationContext', () => ({ useLocation: vi.fn() }))
vi.mock('../platform/googleMaps', () => ({
  googleMapsApiKey: vi.fn(() => 'test-key'),
  googleMapsMapId: vi.fn(() => 'DEMO_MAP_ID'),
  isMapAvailable: vi.fn(() => true),
}))

const queries = await import('../data/queries')
const cached = await import('../hooks/useCachedCityAlerts')
const locationContext = await import('../app/locationContext')
const googleMaps = await import('../platform/googleMaps')
const useAreaSnapshots = vi.mocked(queries.useAreaSnapshots)
const useAreaSnapshot = vi.mocked(queries.useAreaSnapshot)
const useCityInfo = vi.mocked(queries.useCityInfo)
const useCachedCityAlerts = vi.mocked(cached.useCachedCityAlerts)
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
  useCachedCityAlerts.mockReturnValue([])
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

/** 시트 손잡이. 이름에 현재 단계가 붙어 있어 정규식으로 잡는다. */
function sheetHandle(): HTMLElement {
  return screen.getByRole('button', { name: /시트 높이 조절/ })
}

describe('HomeScreen', () => {
  it('지도가 시트 뒤에 전체 크기로 깔린다', () => {
    render(<HomeScreen />)
    // 시트는 오버레이라 지도와 공간을 나눠 갖지 않는다.
    const map = screen.getByRole('region', { name: '지도' })
    expect(map.closest('[data-map-layer]')).not.toBeNull()
  })

  it('검색 바와 필터 칩이 지도 위에 뜬다', () => {
    render(<HomeScreen />)
    expect(screen.getByRole('searchbox').closest('[data-overlay]')).not.toBeNull()
    expect(screen.getByRole('tablist', { name: '필터' })).toBeInTheDocument()
  })

  it('명소를 누르면 상세가 시트를 가득 채우고 지도는 뒤에 남는다', async () => {
    render(<HomeScreen />)
    await userEvent.click(listItem(/강남역/)[0])
    expect(screen.getByRole('button', { name: '목록으로' })).toBeInTheDocument()
    expect(sheetHandle()).toHaveAccessibleName(/현재 전체/)
    // 핵심: 지도가 사라지지 않는다. 예전 구조에서는 상세로 가면 사라졌다.
    expect(screen.getByRole('region', { name: '지도' })).toBeInTheDocument()
  })

  // (C) full에서 검색 바와 칩 열은 손잡이 히트 영역(시트 상단 위 20px까지)을
  // 통째로 덮는다. pointer-events-auto가 걸린 데다 폭이 화면 전체라 손잡이를
  // 아예 못 잡게 된다. opacity-0이 아니라 조건부 렌더라야 포인터 이벤트와
  // 접근성 트리가 함께 정리되고, 그 사실을 테스트로 잠글 수 있다.
  it('시트가 전체로 펼쳐지면 검색 바와 필터 칩이 물러난다', async () => {
    render(<HomeScreen />)
    expect(screen.getByRole('searchbox')).toBeInTheDocument()

    await userEvent.click(listItem(/강남역/)[0])

    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.queryByRole('tablist', { name: '필터' })).toBeNull()
  })

  it('전체로 펼쳐져도 내 주변 버튼은 남는다', async () => {
    // FAB은 폭 48px에 시트 위 16px로 떠서 손잡이를 가리지 않는다(겹치는 4px은
    // peek·half에서도 같다). 지도에 대고 하는 동작이라 지도가 조각으로 남은
    // full에서도 뜻이 살아 있고, 누르면 시트가 peek으로 내려간다.
    render(<HomeScreen />)
    await userEvent.click(listItem(/강남역/)[0])
    expect(screen.getByRole('button', { name: '내 주변' })).toBeInTheDocument()
  })

  it('시트를 내리면 오버레이가 돌아온다', async () => {
    // 손잡이가 full에서 peek으로 굴러간다. 되돌아올 길이 막히지 않는다는 것이
    // 위 규칙을 감당 가능하게 만드는 조건이다.
    render(<HomeScreen />)
    await userEvent.click(listItem(/강남역/)[0])
    await userEvent.click(sheetHandle())
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })

  it('상세가 열린 채로 검색하면 목록으로 돌아간다', async () => {
    // full에서는 검색 바가 없으므로 시트를 내려 꺼내야 한다. 검색이 선택을
    // 푸는 규칙 자체는 그대로다 — 걸러져 사라진 명소의 상세가 남으면 목록에
    // 없는 곳의 요약이 떠 있는 상태가 된다.
    render(<HomeScreen />)
    await userEvent.click(listItem(/강남역/)[0])
    await userEvent.click(sheetHandle())
    await userEvent.type(screen.getByRole('searchbox'), '경복궁')
    expect(screen.queryByRole('button', { name: '목록으로' })).toBeNull()
    expect(listItem(/경복궁/).length).toBeGreaterThan(0)
  })

  it('요약 스트립을 누르면 오늘의 서울이 열린다', async () => {
    render(<HomeScreen />)
    await userEvent.click(screen.getByRole('button', { name: /곳 중 붐빔/ }))
    expect(
      screen.getByRole('heading', { name: '지금 가장 붐비는 곳' }),
    ).toBeInTheDocument()
  })

  it('오늘의 서울에서 명소를 누르면 그 상세로 간다', async () => {
    render(<HomeScreen />)
    await userEvent.click(screen.getByRole('button', { name: /곳 중 붐빔/ }))
    const busiest = screen.getByRole('heading', { name: '지금 가장 붐비는 곳' })
      .parentElement as HTMLElement
    await userEvent.click(busiest.querySelectorAll('button')[0])
    expect(screen.getByRole('button', { name: '목록으로' })).toBeInTheDocument()
  })

  it('오늘의 서울에서 목록으로 돌아온다', async () => {
    render(<HomeScreen />)
    await userEvent.click(screen.getByRole('button', { name: /곳 중 붐빔/ }))
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))
    expect(listItem(/강남역/).length).toBeGreaterThan(0)
    // half로 내려와야 목록 뒤의 지도가 다시 보인다.
    expect(sheetHandle()).toHaveAccessibleName(/현재 절반/)
  })

  it('목록으로를 누르면 다시 목록이 나오고 시트도 내려온다', async () => {
    // 목록만 돌려놓고 시트를 full에 두면 목록이 화면의 92%를 덮은 채 남아
    // 지도가 안 보인다 — 상세를 닫는다는 건 지도로 돌아온다는 뜻이다.
    render(<HomeScreen />)
    await userEvent.click(listItem(/강남역/)[0])
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))
    expect(listItem(/경복궁/).length).toBeGreaterThan(0)
    expect(sheetHandle()).toHaveAccessibleName(/현재 절반/)
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
  // 실패해도 「내 주변」이 멀쩡했지만, 이제 지도가 화면 전체다.
  it('지도 키가 없어도 목록과 검색이 동작한다', async () => {
    isMapAvailable.mockReturnValue(false)
    render(<HomeScreen />)
    expect(screen.queryByRole('region', { name: '지도' })).toBeNull()
    expect(listItem(/강남역/).length).toBeGreaterThan(0)
    await userEvent.type(screen.getByRole('searchbox'), '경복궁')
    expect(screen.queryByRole('button', { name: /강남역/ })).toBeNull()
  })

  it('지도 키가 없으면 상세를 열어도 시트가 half에 묶인다', async () => {
    // 지도 안내가 화면의 92%를 차지할 이유가 없고, 접을 수 있게 두면 안내가
    // 사라져 더 헷갈린다. 묶인 덕에 오버레이도 계속 보인다 — 검색이 유일하게
    // 남은 길인 상황에서 그 길까지 닫으면 안 된다.
    isMapAvailable.mockReturnValue(false)
    render(<HomeScreen />)
    await userEvent.click(listItem(/강남역/)[0])
    expect(screen.getByRole('button', { name: '목록으로' })).toBeInTheDocument()
    expect(sheetHandle()).toHaveAccessibleName(/현재 절반/)
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })

  // Task 10에서 탭바와 함께 사라질 prop이다. 그때까지는 즐겨찾기·오늘의 서울
  // **탭**에서 명소를 눌러 이 화면으로 넘어오는 유일한 통로라 남겨 둔다 —
  // 지금 지우면 App이 그 이동을 표현할 수단을 잃는다.
  it('focusArea가 주어지면 그 명소의 상세를 가득 펼친다', () => {
    useAreaSnapshot.mockReturnValue({
      data: snapshotFor('경복궁'),
      isPending: false,
      isError: false,
    } as unknown as UseQueryResult<AreaSnapshot>)
    render(<HomeScreen focusArea="경복궁" />)
    expect(screen.getByRole('heading', { name: '경복궁' })).toBeInTheDocument()
    expect(sheetHandle()).toHaveAccessibleName(/현재 전체/)
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

  // (G) 필터 때문에 0이 된 목록은 어느 조건이 문제인지 말해야 한다.
  // 「내 장소」를 켠 뒤 카테고리로 좁히면 칩은 선택돼 있어 활성이지만
  // 목록은 빈다 — 「조건에 맞는 명소가 없어요」만으로는 무엇을 풀지 모른다.
  it('필터 때문에 목록이 비면 그 필터를 이름으로 지목한다', async () => {
    localStorage.setItem('seoul-live:favorites', JSON.stringify(['강남역']))
    render(<HomeScreen />)
    await userEvent.click(await screen.findByRole('tab', { name: '내 장소 1' }))

    await userEvent.click(screen.getByRole('tab', { name: '공원' }))

    expect(screen.getByText('「내 장소」에 해당하는 명소가 없어요.')).toBeInTheDocument()
  })

  it('빈 목록의 필터 해제 버튼이 실제로 필터를 푼다', async () => {
    localStorage.setItem('seoul-live:favorites', JSON.stringify(['강남역']))
    render(<HomeScreen />)
    await userEvent.click(await screen.findByRole('tab', { name: '내 장소 1' }))
    await userEvent.click(screen.getByRole('tab', { name: '공원' }))

    await userEvent.click(screen.getByRole('button', { name: '필터 해제' }))

    expect(listItem(/남산공원/).length).toBeGreaterThan(0)
  })

  it('검색 결과가 비었을 때는 필터 해제를 권하지 않는다', async () => {
    // 검색어에는 검색 바의 지우기 버튼이라는 제 나름의 출구가 이미 있다.
    // 두 원인을 한 문장에 담으면 길어지고, 검색어를 지우면 필터만 걸린
    // 상태로 돌아가 그때 필터 문구가 뜬다.
    localStorage.setItem('seoul-live:favorites', JSON.stringify(['강남역']))
    render(<HomeScreen />)
    await userEvent.click(await screen.findByRole('tab', { name: '내 장소 1' }))

    await userEvent.type(screen.getByRole('searchbox'), '없는곳')

    expect(screen.getByText(/「없는곳」/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '필터 해제' })).toBeNull()
  })

  it('상세에서 저장을 누르면 내 장소 칩이 곧바로 는다', async () => {
    // 칩과 저장 버튼이 각자 useFavorites를 부른다. 둘이 따로 놀면 방금 담은 곳이
    // 칩에 안 잡히고, 0인 칩은 비활성이라 필터를 켤 방법이 없어진다.
    // 상세가 열리면 시트가 full이라 칩이 가려지므로 목록으로 돌아와서 본다.
    render(<HomeScreen />)
    expect(screen.getByRole('tab', { name: '내 장소 0' })).toBeDisabled()

    await userEvent.click(listItem(/강남역/)[0])
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))

    expect(await screen.findByRole('tab', { name: '내 장소 1' })).toBeEnabled()
  })

  it('저장소가 막혀도 칩과 저장 버튼이 같은 것을 말한다', async () => {
    // 브리지도 localStorage도 막힌 상태다. 저장 실패가 버튼을 막지 않는 이상
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
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))

    expect(screen.getByRole('tab', { name: '내 장소 1' })).toBeEnabled()

    await userEvent.click(listItem(/강남역/)[0])
    expect(screen.getByRole('button', { name: '저장됨' })).toBeInTheDocument()
  })

  it('카테고리를 고르면 목록이 그 분류만 남는다', async () => {
    render(<HomeScreen />)
    await userEvent.click(screen.getByRole('tab', { name: '고궁·유적' }))
    expect(listItem(/경복궁/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /강남역/ })).toBeNull()
  })

  it('상세를 열면 카테고리와 정렬은 목록과 함께 물러난다', async () => {
    render(<HomeScreen />)
    await userEvent.click(listItem(/강남역/)[0])
    expect(screen.queryByRole('tab', { name: '공원' })).toBeNull()
    expect(screen.queryByRole('tab', { name: '여유한 순' })).toBeNull()
  })

  // (F) 조회가 영구 실패해도 스트립은 `혼잡도 정보를 아직 받지 못했어요.`라고
  // 말한다 — 로딩을 뜻하는 문구다. 바로 아래 목록은 `가져오지 못했어요`를
  // 띄우므로 같은 자리에서 두 문장이 어긋난다. CitySummary에 실패를 표현할
  // 수단이 없어 스트립 혼자서는 못 고친다.
  it('혼잡도 조회가 실패하면 요약 스트립을 감춘다', () => {
    useAreaSnapshots.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<readonly (AreaSnapshot | null)[]>)
    render(<HomeScreen />)

    expect(screen.getByText('혼잡도 정보를 가져오지 못했어요.')).toBeInTheDocument()
    expect(screen.queryByText('혼잡도 정보를 아직 받지 못했어요.')).toBeNull()
    expect(screen.queryByRole('button', { name: /곳 중 붐빔/ })).toBeNull()
  })

  it('스냅샷이 아직 없을 뿐이면 요약 스트립이 그 사실을 말한다', () => {
    // 실패와 로딩을 가르는 반대편이다. 실패가 아니면 스트립은 남아야 한다 —
    // 안 그러면 「스트립을 아예 안 그린다」로도 위 테스트가 통과한다.
    useAreaSnapshots.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    } as unknown as UseQueryResult<readonly (AreaSnapshot | null)[]>)
    render(<HomeScreen />)

    expect(
      screen.getByRole('button', { name: /혼잡도 정보를 아직 받지 못했어요/ }),
    ).toBeInTheDocument()
  })
})
