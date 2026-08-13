import { render, screen, within } from '@testing-library/react'
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
  // 실제 APIProvider는 스크립트 로드가 깨졌을 때 내부에서 `onError`를 부른다.
  // 목에는 그 경로가 없어서 `loadFailed` 분기가 통째로 미커버였다 — 설계 §4가
  // "가장 중요한 실패 경로"라 부른 둘 중 하나다. 버튼 하나로 그 통로를 낸다.
  // 이름을 붙여 뒀으므로 다른 테스트의 이름 기반 쿼리에는 걸리지 않는다.
  APIProvider: ({
    children,
    onError,
  }: {
    children: ReactNode
    onError?: (error: unknown) => void
  }) => (
    <div>
      <button
        type="button"
        aria-label="지도 스크립트 로드 실패"
        onClick={() => onError?.(new Error('스크립트를 받지 못했다'))}
      />
      {children}
    </div>
  ),
  // 카메라(center·zoom)를 DOM에 실어 둔다. 목이 이 둘을 버리면 「내 주변을
  // 누르면 지도가 내 위치로 간다」를 잡을 방법이 없어진다 — 실제 지도가 없는
  // 환경에서 그 계약을 관찰할 수 있는 유일한 통로다. 검증 대상은 목이 아니라
  // **HomeScreen이 무엇을 넘기는가**이고, 그건 이 화면의 진짜 책임이다.
  Map: ({
    children,
    center,
    zoom,
    onCameraChanged,
  }: {
    children: ReactNode
    center?: { lat: number; lng: number }
    zoom?: number
    onCameraChanged?: (event: {
      detail: { center: { lat: number; lng: number }; zoom: number }
    }) => void
  }) => (
    <div
      role="region"
      aria-label="지도"
      data-center={center === undefined ? '' : `${center.lat},${center.lng}`}
      data-zoom={zoom}
    >
      {/* 실제 지도는 사용자가 팬·줌할 때 이 콜백을 쏜다. 목에 통로가 없으면
          `handleCameraChanged`가 통째로 미커버가 되고, 줌을 당겨도 마커 라벨이
          영영 안 뜨는 증상을 아무도 못 잡는다.

          이름이 「지도 확대」가 아니라 「지도 카메라 변경」인 이유: 이 버튼은
          center와 zoom을 **함께** 쏜다(팬 + 줌). 확대만 하는 것으로 읽히면
          카메라 이동을 잠그는 테스트가 이 통로를 안 쓰게 된다. */}
      <button
        type="button"
        aria-label="지도 카메라 변경"
        onClick={() =>
          onCameraChanged?.({ detail: { center: { lat: 37.6, lng: 127.1 }, zoom: 15 } })
        }
      />
      {children}
    </div>
  ),
  // 쌓임 순서를 DOM에 실어 둔다. 겹친 핀 중 무엇이 위에 오는지는 실제 지도가
  // 정하는 일이라 여기서 관찰할 수 있는 것은 **화면이 무엇을 넘기는가**뿐이고,
  // 그게 이 화면의 책임이다. 목이 이 값을 버리면 「붐빔이 여유 뒤에 숨는다」를
  // 잡을 통로가 없어진다.
  AdvancedMarker: ({
    children,
    onClick,
    zIndex,
  }: {
    children: ReactNode
    onClick?: () => void
    zIndex?: number
  }) => (
    <button type="button" onClick={onClick} data-z={zIndex}>
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
    replaced: null,
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

/**
 * 그 이름의 명소 버튼 전부. **거르지 않는다** — 지도 마커와 목록 행이 같은
 * 이름이라 둘 다 잡히고, DOM 순서상 `[0]`은 마커다(`data-map-layer`가 시트보다
 * 앞이라서). 개수만 보는 단언에는 그걸로 충분하고, 실제로 그렇게 쓴다.
 *
 * 어느 쪽을 눌렀는지가 중요한 곳에서는 `mapMarker`·`sheetRow`를 써라.
 */
function areaButtons(name: string | RegExp) {
  return screen.getAllByRole('button', { name })
}

/** 지도 마커. 지도 레이어 안으로 좁힌다. */
function mapMarker(name: string | RegExp): HTMLElement {
  const layer = document.querySelector('[data-map-layer]') as HTMLElement
  return within(layer).getAllByRole('button', { name })[0]
}

/** 시트 안 목록 행. 마커가 아니라 `AreaListItem`을 누른다. */
function sheetRow(name: string | RegExp): HTMLElement {
  const sheet = document.querySelector('[data-sheet-content]') as HTMLElement
  return within(sheet).getAllByRole('button', { name })[0]
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
    expect(screen.getByRole('group', { name: '필터' })).toBeInTheDocument()
  })

  // 지도가 살아 있는 상태에서 **목록 행**을 누르는 경로다. 다른 테스트들이
  // 쓰는 `areaButtons(...)[0]`은 DOM 순서상 전부 지도 마커라, 이 테스트가
  // 없으면 `AreaListItem` → 상세가 한 번도 검증되지 않는다.
  it('목록 행을 눌러도 그 명소의 상세가 열린다', async () => {
    render(<HomeScreen />)

    await userEvent.click(sheetRow(/경복궁/))

    expect(screen.getByRole('heading', { name: '경복궁' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '목록으로' })).toBeInTheDocument()
  })

  it('지도 마커를 눌러도 그 명소의 상세가 열린다', async () => {
    render(<HomeScreen />)

    await userEvent.click(mapMarker(/경복궁/))

    expect(screen.getByRole('heading', { name: '경복궁' })).toBeInTheDocument()
  })

  // 지도를 움직이면 그 카메라를 화면이 받아 들고 있어야 한다. 안 받으면
  // `zoom`이 초기값(11)에 묶여 `shouldShowMarkerLabel`이 영영 false가 되고,
  // 사용자가 아무리 확대해도 마커 위 혼잡도 라벨이 안 뜬다.
  it('지도를 확대하면 마커에 혼잡도 라벨이 붙는다', async () => {
    render(<HomeScreen />)
    const layer = document.querySelector('[data-map-layer]') as HTMLElement
    // 초기 줌 11은 라벨 기준(12) 아래다.
    expect(within(layer).queryByText('보통')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: '지도 카메라 변경' }))

    expect(within(layer).getAllByText('보통').length).toBeGreaterThan(0)
  })

  // 중심부에 핀이 몰려 서로를 덮는데, 덮는 쪽이 「여유」면 사용자가 피해야 할
  // 곳이 피할 수 있는 곳 뒤에 숨는다. 순서를 정하는 규칙 자체는 `domain/map`의
  // `markerZIndex`가 잠그고, 여기서는 **그 값이 실제로 지도까지 가는지**만 본다.
  it('붐비는 마커가 여유로운 마커 위에 쌓인다', async () => {
    // 기본 목은 30곳이 전부 '보통'이라 순서가 갈리지 않는다 — 소재를 바꾼다.
    const { AREA_NAMES } = await import('../data/areas')
    useAreaSnapshots.mockReturnValue({
      data: AREA_NAMES.map((name) =>
        snapshotFor(name, name === '강남역' ? '붐빔' : '여유'),
      ),
      isPending: false,
      isError: false,
    } as unknown as UseQueryResult<readonly (AreaSnapshot | null)[]>)
    render(<HomeScreen />)

    const busy = Number(mapMarker(/강남역/).dataset.z)
    const calm = Number(mapMarker(/경복궁/).dataset.z)

    expect(busy).toBeGreaterThan(calm)
  })

  it('지도를 움직이면 그 위치를 화면이 이어받는다', async () => {
    // 카메라를 안 받아두면 다음 렌더에 `center`가 초기값으로 되돌아가
    // 팬한 자리가 튕겨 돌아온다.
    render(<HomeScreen />)
    const map = screen.getByRole('region', { name: '지도' })

    await userEvent.click(screen.getByRole('button', { name: '지도 카메라 변경' }))

    expect(map).toHaveAttribute('data-center', '37.6,127.1')
    expect(map).toHaveAttribute('data-zoom', '15')
  })

  // **명소를 여는 것은 시트를 올리는 일이 아니다.** 한때 `openArea`가
  // `setDetent('full')`을 불렀는데, 목록에서 한 곳을 누르면 시트가 화면의 92%로
  // 튀어올라 지도가 통째로 사라졌다 — 지도 위에 얹힌 시트라는 이 화면의 전제가
  // 누를 때마다 무너진 셈이다. 상세는 언제나 half에서 연다.
  it('명소를 눌러도 시트가 올라가지 않아 지도가 계속 보인다', async () => {
    render(<HomeScreen />)
    await userEvent.click(areaButtons(/강남역/)[0])
    expect(screen.getByRole('button', { name: '목록으로' })).toBeInTheDocument()
    expect(sheetHandle()).toHaveAccessibleName(/현재 절반/)
    // 지도는 문서에 있는 것으로 모자란다 — full에서도 뒤에 살아 있었다.
    // 시트가 half라야 실제로 화면의 44%가 지도로 남는다.
    expect(screen.getByRole('region', { name: '지도' })).toBeInTheDocument()
  })

  // 위 규칙의 반대쪽 끝이다. 「올리지 않는다」만 지키면 사용자가 full로 펼쳐 둔
  // 상태에서 목록 행을 눌렀을 때 상세가 full에 그대로 앉아 지도가 안 보인다 —
  // 「지도는 계속 보여야 한다」가 거기서 깨진다. 상세의 높이는 하나뿐이다.
  it('전체로 펼쳐 둔 채 명소를 열면 지도가 보이는 높이로 내려온다', async () => {
    render(<HomeScreen />)
    await userEvent.click(sheetHandle()) // half → full
    expect(sheetHandle()).toHaveAccessibleName(/현재 전체/)

    await userEvent.click(sheetRow(/강남역/))

    expect(screen.getByRole('button', { name: '목록으로' })).toBeInTheDocument()
    expect(sheetHandle()).toHaveAccessibleName(/현재 절반/)
  })

  // half에 머무는 것의 눈에 보이는 값이다. full은 검색 바·칩 열·「내 주변」을
  // 통째로 걷어내므로(아래 테스트들) 상세를 열 때마다 지도 위 조작부가 전부
  // 사라졌다 — 다른 곳을 찾으려면 시트부터 내려야 했다.
  it('상세를 열어도 지도 위 조작부가 그대로 남는다', async () => {
    render(<HomeScreen />)

    await userEvent.click(sheetRow(/강남역/))

    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '필터' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '내 주변' })).toBeInTheDocument()
  })

  // (C) full에서 검색 바와 칩 열은 손잡이 히트 영역(시트 상단 위 20px까지)을
  // 통째로 덮는다. pointer-events-auto가 걸린 데다 폭이 화면 전체라 손잡이를
  // 아예 못 잡게 된다. opacity-0이 아니라 조건부 렌더라야 포인터 이벤트와
  // 접근성 트리가 함께 정리되고, 그 사실을 테스트로 잠글 수 있다.
  //
  // full로 가는 길이 손잡이다. 한때 명소를 누르는 것도 그 길이었지만, 지도를
  // 덮어 버려 없앴다(위 「명소를 눌러도 시트가 올라가지 않아」).
  it('시트가 전체로 펼쳐지면 검색 바와 필터 칩이 물러난다', async () => {
    render(<HomeScreen />)
    expect(screen.getByRole('searchbox')).toBeInTheDocument()

    await userEvent.click(sheetHandle()) // half → full

    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.queryByRole('group', { name: '필터' })).toBeNull()
  })

  it('시트가 전체로 펼쳐지면 내 주변 버튼도 함께 물러난다', async () => {
    // full에서는 48px 버튼이 들어갈 자리가 없다. 시트 위 지도 조각에서 버튼
    // 몫이 `0.06H`라 `H ≥ 800px`이라야 안 잘리는데, Task 10에서 컨테이너가
    // 뷰포트 그대로(`100dvh`)가 된 지금도 그보다 작은 기기가 많다 — 루트의
    // `overflow-hidden`이 버튼 위쪽을 잘라낸다.
    //
    // 잘림 자체는 기하라서 jsdom이 못 잡는다. 잡을 수 있는 것은 「full에서는
    // 그리지 않는다」는 결정이고, 그래서 그것을 잠근다.
    render(<HomeScreen />)
    expect(screen.getByRole('button', { name: '내 주변' })).toBeInTheDocument()

    await userEvent.click(sheetHandle()) // half → full

    expect(screen.queryByRole('button', { name: '내 주변' })).toBeNull()
  })

  // 「내 주변」이 검색 줄에서 FAB으로 넘어오며 **하던 일도 함께 왔다**는 것이
  // 이 태스크의 서사인데, 콜백이 불린다는 것만 옮겨지고 콜백이 **무엇을 하는지**는
  // 안 옮겨져 있었다. SearchBar.test.tsx에서 지운 테스트가 잡던 자리다.
  it('내 주변을 누르면 목록이 거리순이 되고 시트가 내려간다', async () => {
    useLocation.mockReturnValue({
      coords: { lat: 37.5, lng: 127 },
      status: 'granted',
      retry: vi.fn(),
    })
    render(<HomeScreen />)
    await userEvent.click(screen.getByRole('button', { name: '붐비는 순' }))

    await userEvent.click(screen.getByRole('button', { name: '내 주변' }))

    expect(sheetHandle()).toHaveAccessibleName(/현재 살짝 열림/)
    expect(screen.getByRole('button', { name: '거리순' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('내 주변을 누르면 지도가 내 위치로 옮겨간다', async () => {
    // 버튼 이름이 약속하는 바로 그 동작이다. 목록 정렬만 바뀌고 지도가 그대로면
    // 「내 주변」이라는 이름이 거짓말이 된다.
    useLocation.mockReturnValue({
      coords: { lat: 37.5, lng: 127 },
      status: 'granted',
      retry: vi.fn(),
    })
    render(<HomeScreen />)
    const map = screen.getByRole('region', { name: '지도' })
    expect(map).toHaveAttribute('data-center', '37.5665,126.978') // 서울 전역

    await userEvent.click(screen.getByRole('button', { name: '내 주변' }))

    expect(map).toHaveAttribute('data-center', '37.5,127')
    // 줌도 함께 당긴다. 서울 전역 줌 그대로 옮기면 내 주변이 안 보인다.
    expect(map).toHaveAttribute('data-zoom', '14')
  })

  it('시트를 내리면 오버레이가 돌아온다', async () => {
    // 손잡이가 full에서 peek으로 굴러간다. 되돌아올 길이 막히지 않는다는 것이
    // 위 규칙을 감당 가능하게 만드는 조건이다.
    render(<HomeScreen />)
    await userEvent.click(sheetHandle()) // half → full
    await userEvent.click(sheetHandle()) // full → peek
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })

  it('상세가 열린 채로 검색하면 목록으로 돌아간다', async () => {
    // 상세가 half에서 열리므로 검색 바는 그 자리에 그대로 있다(예전에는 full
    // 이라 시트부터 내려야 했다). 검색이 선택을 푸는 규칙 자체는 그대로다 —
    // 걸러져 사라진 명소의 상세가 남으면 목록에 없는 곳의 요약이 떠 있게 된다.
    render(<HomeScreen />)
    await userEvent.click(areaButtons(/강남역/)[0])
    await userEvent.type(screen.getByRole('searchbox'), '경복궁')
    expect(screen.queryByRole('button', { name: '목록으로' })).toBeNull()
    expect(areaButtons(/경복궁/).length).toBeGreaterThan(0)
    // **친 글자가 다 남아야 한다.** 첫 글자에서 선택이 풀리며 뷰가 갈리는데,
    // 그때 포커스 처방이 입력에서 포커스를 가져가면 둘째 글자부터 사라진다.
    // 위 두 단언은 `'경'` 한 글자만으로도 통과해 그 회귀를 놓쳤다.
    expect(screen.getByRole('searchbox')).toHaveValue('경복궁')
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

  // `openArea`의 `setView('list')`가 없으면 여기서 오늘의 서울로 되돌아간다.
  // 버튼 이름이 「목록으로」이므로 이름과 가는 곳이 갈리면 안 된다.
  it('오늘의 서울에서 연 상세를 닫으면 오늘의 서울이 아니라 목록이다', async () => {
    render(<HomeScreen />)
    await userEvent.click(screen.getByRole('button', { name: /오늘의 서울 열기/ }))
    await userEvent.click(sheetRow(/강남역/))

    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))

    expect(screen.queryByRole('heading', { name: '오늘의 서울' })).toBeNull()
    expect(screen.getByRole('button', { name: /오늘의 서울 열기/ })).toBeInTheDocument()
  })

  it('오늘의 서울에서 목록으로 돌아온다', async () => {
    render(<HomeScreen />)
    await userEvent.click(screen.getByRole('button', { name: /곳 중 붐빔/ }))
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))
    expect(areaButtons(/강남역/).length).toBeGreaterThan(0)
    // half로 내려와야 목록 뒤의 지도가 다시 보인다.
    expect(sheetHandle()).toHaveAccessibleName(/현재 절반/)
  })

  it('목록으로를 누르면 다시 목록이 나오고 시트도 내려온다', async () => {
    // 목록만 돌려놓고 시트를 full에 두면 목록이 화면의 92%를 덮은 채 남아
    // 지도가 안 보인다 — 상세를 닫는다는 건 지도로 돌아온다는 뜻이다.
    //
    // **상세를 연 뒤 손잡이로 full까지 올려 놓고 닫는다.** 상세가 half에서
    // 열리게 된 지금, 그냥 열고 닫으면 half→half라 `onBack`의 `setDetent`를
    // 통째로 지워도 통과한다 — 실제로 확인했다. 내릴 것이 있어야 내리는지 안다.
    render(<HomeScreen />)
    await userEvent.click(areaButtons(/강남역/)[0])
    await userEvent.click(sheetHandle()) // half → full
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))
    expect(areaButtons(/경복궁/).length).toBeGreaterThan(0)
    expect(sheetHandle()).toHaveAccessibleName(/현재 절반/)
  })

  // 사라진 App.test「탭을 오가도 홈의 상태가 남는다」가 잡던 자리다. 탭이
  // 없어졌으니 언마운트시킬 주체도 없어졌다고 판단했는데 **틀렸다** — 오늘의
  // 서울을 열면 `detent`가 full이 되면서 **검색 바와 칩 열이 실제로
  // 언마운트된다.** 「뷰를 오가도 홈의 상태가 남는가」는 지금도 살아 있는
  // 질문이고, 답이 사는 곳만 탭에서 시트 안으로 옮겨왔다.
  //
  // **상세로는 이 질문을 못 던진다.** 상세는 half에서 열려 검색 바가 계속
  // 마운트돼 있으므로, 상세를 오가는 왕복은 무엇을 깨뜨려도 값이 남는다.
  //
  // 상태가 둘이라 테스트도 둘이다. 검색어는 `useHomeFilters`가, 카메라는 이
  // 화면의 `center`·`zoom`이 들고 있어서 한쪽이 깨져도 다른 쪽은 멀쩡하다.
  it('시트 안에서 뷰를 오가도 검색어가 남는다', async () => {
    render(<HomeScreen />)
    await userEvent.type(screen.getByRole('searchbox'), '경복궁')

    await userEvent.click(screen.getByRole('button', { name: /오늘의 서울 열기/ }))
    expect(screen.queryByRole('searchbox')).toBeNull() // 실제로 언마운트됐다
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))

    expect(screen.getByRole('searchbox')).toHaveValue('경복궁')
  })

  it('시트 안에서 뷰를 오가도 지도 카메라가 남는다', async () => {
    render(<HomeScreen />)
    await userEvent.click(screen.getByRole('button', { name: '지도 카메라 변경' }))

    await userEvent.click(screen.getByRole('button', { name: /오늘의 서울 열기/ }))
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))

    // 옛 구조에서 탭을 오가면 지도가 다시 만들어져 카메라가 서울 전역으로
    // 돌아갔다. 시트 안 뷰 전환에서는 지도가 아예 언마운트되지 않아야 한다.
    expect(screen.getByRole('region', { name: '지도' })).toHaveAttribute(
      'data-center',
      '37.6,127.1',
    )
  })

  it('검색하면 목록이 줄어든다', async () => {
    render(<HomeScreen />)
    await userEvent.type(screen.getByRole('searchbox'), '경복궁')
    expect(screen.queryByRole('button', { name: /강남역/ })).toBeNull()
    expect(areaButtons(/경복궁/).length).toBeGreaterThan(0)
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
    expect(areaButtons(/강남역/).length).toBeGreaterThan(0)
  })

  // 설계 §4가 가장 중요하다고 한 실패 경로다. 예전에는 지도가 독립 탭이라
  // 실패해도 「내 주변」이 멀쩡했지만, 이제 지도가 화면 전체다.
  it('지도 키가 없어도 목록과 검색이 동작한다', async () => {
    isMapAvailable.mockReturnValue(false)
    render(<HomeScreen />)
    expect(screen.queryByRole('region', { name: '지도' })).toBeNull()
    expect(areaButtons(/강남역/).length).toBeGreaterThan(0)
    await userEvent.type(screen.getByRole('searchbox'), '경복궁')
    expect(screen.queryByRole('button', { name: /강남역/ })).toBeNull()
  })

  // 설계 §4가 꼽은 두 실패 경로 중 나머지 하나다. 키는 있는데 스크립트를 못
  // 받은 경우(오프라인·차단·잘못된 키)라 키 미설정과 문구가 달라야 한다 —
  // 개발자와 사용자가 각각 맞는 곳을 의심해야 하기 때문이다.
  it('지도 스크립트를 못 받으면 그 사실을 말하고 목록은 남는다', async () => {
    // 이 경로는 console.error로 원인을 남긴다(이 저장소가 허용한 유일한 용례다).
    // 테스트 출력에 섞이지 않게 막고, 실제로 남기는지도 함께 본다.
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<HomeScreen />)

    await userEvent.click(screen.getByRole('button', { name: '지도 스크립트 로드 실패' }))

    expect(screen.queryByRole('region', { name: '지도' })).toBeNull()
    expect(screen.getByText(/불러오지 못했어요/)).toBeInTheDocument()
    expect(screen.queryByText(/VITE_GOOGLE_MAPS_API_KEY/)).toBeNull()
    expect(areaButtons(/강남역/).length).toBeGreaterThan(0)
    expect(logged).toHaveBeenCalled()
  })

  // **안내가 있는 것과 보이는 것은 다르다.** 오버레이(검색 바 + 칩 열)가 화면
  // 위 0~112px을 `z-20`으로 덮는데(Task 10 실측), 안내를 지도 레이어에 두면
  // `ErrorState`의 `py-10` 때문에 문구가 y≈64px에서 시작해 그 아래로 깔린다 —
  // 390px 헤드리스 크롬으로 찍어 보니 칩 사이 틈으로 글자 조각만 새어 나오고
  // 사용자에게는 **아무 설명 없는 빈 화면**이었다. 위 테스트는 "안내가 문서에
  // 있다"만 세고 있어서 이 상태를 그대로 통과시켰다.
  //
  // 지도를 **대신하는** 안내라 지도 위에 얹을 것이 아니라 오버레이 열의 마지막
  // 칸에 서야 한다. 그러면 칩 아래에 흐름대로 놓여 어느 뷰포트에서도 안 가리고,
  // 오버레이 높이가 바뀌어도 따라온다 — 112px을 어딘가에 또 적어 둘 필요가 없다.
  //
  // jsdom에는 레이아웃이 없어 겹침 자체는 못 잰다. 잠글 수 있는 것은 **어느
  // 레이어에 속하는가**뿐이라 `data-overlay`·`data-map-layer`로 본다. 위치로
  // 재려 들면 무엇을 해도 통과하는 테스트가 된다.
  // **`closest('[data-map-layer]')`가 null이라는 단언은 두지 않는다.** 실제로
  // 일어날 변이 둘 다 그것 없이 죽는다 — 안내를 지도 레이어로 되돌리면 아래
  // 단언이 죽고, 양쪽에 그리면 `getByText`가 "multiple elements"로 죽는다.
  // 반대로 오버레이를 지도 레이어 **안으로** 옮기는 무해한 리팩터에는 그 단언만
  // 죽는다(중첩돼도 `z-20`이라 안내는 그대로 보인다). 잡을 결함이 없고 거짓
  // 경보만 내는 소재라 뺀다.
  it('키가 없을 때의 안내가 검색 바·칩 열에 가리지 않는다', () => {
    isMapAvailable.mockReturnValue(false)
    render(<HomeScreen />)

    expect(
      screen.getByText(/VITE_GOOGLE_MAPS_API_KEY/).closest('[data-overlay]'),
    ).not.toBeNull()
  })

  it('스크립트를 못 받았을 때의 안내도 가리지 않는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<HomeScreen />)
    await userEvent.click(screen.getByRole('button', { name: '지도 스크립트 로드 실패' }))

    expect(
      screen.getByText(/불러오지 못했어요/).closest('[data-overlay]'),
    ).not.toBeNull()
  })

  it('지도 스크립트를 못 받으면 시트가 half에 묶인다', async () => {
    // 키가 없을 때와 같은 이유다. 지도 안내가 화면의 92%를 차지할 이유가 없다.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<HomeScreen />)
    await userEvent.click(screen.getByRole('button', { name: '지도 스크립트 로드 실패' }))

    await userEvent.click(sheetHandle())

    expect(sheetHandle()).toHaveAccessibleName(/현재 절반/)
  })

  it('지도 키가 없으면 오늘의 서울을 열어도 시트가 half에 묶인다', async () => {
    // 지도 안내가 화면의 92%를 차지할 이유가 없고, 접을 수 있게 두면 안내가
    // 사라져 더 헷갈린다. 묶인 덕에 오버레이도 계속 보인다 — 검색이 유일하게
    // 남은 길인 상황에서 그 길까지 닫으면 안 된다.
    //
    // **소재가 상세에서 오늘의 서울로 바뀌었다.** 상세는 이제 스스로 half를
    // 부르므로 `sheetDetent`의 클램프를 지워도 통과한다. `detent`를 실제로
    // full로 미는 조작이라야 클램프가 일하는지 보인다.
    isMapAvailable.mockReturnValue(false)
    render(<HomeScreen />)
    await userEvent.click(screen.getByRole('button', { name: /오늘의 서울 열기/ }))
    expect(
      screen.getByRole('heading', { name: '지금 가장 붐비는 곳' }),
    ).toBeInTheDocument()
    expect(sheetHandle()).toHaveAccessibleName(/현재 절반/)
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })

  // 시트가 유일한 내용 영역이 되면서 목록↔상세↔오늘의 서울 왕복이 주 동선이
  // 됐다. 방금 누른 버튼이 언마운트되면 포커스가 `document.body`로 떨어지고,
  // body에서 누른 Tab은 문서 맨 앞부터 다시 세는데 시트 앞에는 지도 레이어가
  // 통째로 놓여 있다. 키보드·스위치 사용자는 뷰를 바꿀 때마다 그 값을 치른다.
  //
  // `focus({ preventScroll: true })`의 `preventScroll`은 여기서 관측할 수
  // 없다. jsdom에는 레이아웃이 없어 옵션이 무시된다 — 시트가 스크롤
  // 컨테이너라 기본 동작이 방금 연 뷰를 맨 위가 아닌 곳에서 시작하게 만든다는
  // 것은 실기기 몫이다. 잡을 수 있는 것은 「포커스가 시트를 벗어나지 않는다」이다.
  it('시트 안에서 뷰가 갈려도 포커스가 시트를 벗어나지 않는다', async () => {
    render(<HomeScreen />)
    const sheet = document.querySelector('[data-sheet-content]') as HTMLElement
    // 첫 렌더에서는 뺏지 않는다. 진입하자마자 시트가 포커스를 가져가면
    // 스크린리더가 화면 첫머리 대신 시트를 읽는다.
    expect(document.activeElement).toBe(document.body)

    await userEvent.click(sheetRow(/강남역/))
    expect(sheet.contains(document.activeElement)).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))
    expect(sheet.contains(document.activeElement)).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: /오늘의 서울 열기/ }))
    expect(sheet.contains(document.activeElement)).toBe(true)

    // 돌아오는 길도 세어야 한다. 여기를 빼면 「오늘의 서울 → 목록」의 포커스
    // 요청만 지워도 아무 테스트도 안 죽는다(실제로 그랬다).
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))
    expect(sheet.contains(document.activeElement)).toBe(true)
  })

  it('목록 뷰도 제목 층에 자리를 갖는다', () => {
    // 상세는 히어로의 h2, 오늘의 서울은 절 제목을 갖는데 목록만 `App`의 h1
    // 아래가 비어 있었다 — 제목으로 훑는 스크린리더 사용자에게 **기본 화면이**
    // 통째로 빈 칸이 된다. 눈에 보이는 제목은 세로 공간을 먹으므로 sr-only다.
    render(<HomeScreen />)
    expect(
      screen.getByRole('heading', { level: 2, name: '명소 목록' }),
    ).toBeInTheDocument()
  })

  // 목록·상세·오늘의 서울이 시트의 스크롤 컨테이너 **하나를 나눠 쓴다.**
  // 되돌리지 않으면 앞 뷰에서 내려둔 자리에서 새 뷰가 시작한다 — 실측으로는
  // 상세의 「목록으로」가 화면 밖(`top −47.5`)이고, 돌아올 때는 요약 스트립이
  // 잘려 「오늘의 서울」로 가는 유일한 통로가 사라진 것처럼 보였다.
  //
  // jsdom에는 레이아웃이 없어 **잘렸다는 사실 자체는** 못 잡는다. 잡을 수 있는
  // 것은 `scrollTop = 0` 대입이고(jsdom이 대입값을 보존한다) 그게 처방이다.
  it('뷰가 갈리면 시트 스크롤도 새 뷰의 맨 위로 돌아온다', async () => {
    render(<HomeScreen />)
    const scroller = document.querySelector('[data-sheet-content]') as HTMLElement

    scroller.scrollTop = 200
    await userEvent.click(sheetRow(/강남역/))
    expect(scroller.scrollTop).toBe(0)

    scroller.scrollTop = 200
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))
    expect(scroller.scrollTop).toBe(0)

    scroller.scrollTop = 200
    await userEvent.click(screen.getByRole('button', { name: /오늘의 서울 열기/ }))
    expect(scroller.scrollTop).toBe(0)
  })

  // 위 규칙의 반대편이다. 뷰가 갈렸다고 무조건 옮기면 **타이핑이 깨진다** —
  // 검색어를 치면 `setQuery`가 선택을 풀어 상세→목록 전환이 일어나는데, 그건
  // 사용자가 시트로 가려던 조작이 아니라 타이핑의 부수 효과다. 실제로 첫
  // 글자만 입력되고 둘째 글자부터 사라졌다.
  it('뷰가 갈려도 사용자가 부른 이동이 아니면 포커스를 뺏지 않는다', async () => {
    render(<HomeScreen />)
    await userEvent.click(sheetRow(/강남역/))
    const box = screen.getByRole('searchbox')

    await userEvent.type(box, '경')

    // 상세가 닫히며 뷰는 갈렸는데 포커스는 입력에 남아야 한다.
    expect(screen.queryByRole('button', { name: '목록으로' })).toBeNull()
    expect(document.activeElement).toBe(box)
  })

  it('칩을 눌러 선택이 풀려도 포커스는 칩 줄에 남는다', async () => {
    // 같은 규칙의 다른 소재다. 칩도 선택을 푸는데(`useHomeFilters.setFilter`)
    // 그때 손은 칩 줄에 있다 — 연달아 다른 칩을 누르려던 참이다.
    render(<HomeScreen />)
    await userEvent.click(sheetRow(/강남역/))
    const chip = screen.getByRole('button', { name: /데이트/ })

    await userEvent.click(chip)

    expect(screen.queryByRole('button', { name: '목록으로' })).toBeNull()
    expect(document.activeElement).toBe(chip)
  })

  // 포커스 요청을 ref로 들면 **굳는다.** 이미 열린 명소의 마커를 다시 누르면
  // `openArea`의 세 setter가 전부 같은 값이라(선택 동일·view 동일·detent 동일)
  // React가 렌더를 건너뛴다. 그러면 effect도 안 돌아 신호가 남아 있다가
  // **그다음 아무 렌더에서** 포커스를 훔친다 — 지도를 팬하거나, 시트를
  // 만지거나, 창에 돌아와 refetch가 도는 순간이다(`refetchOnWindowFocus`).
  //
  // 눈에는 안 보이지만 키보드·스위치·스크린리더 사용자는 맥락을 잃는다.
  it('같은 명소를 다시 눌러도 포커스 요청이 남지 않는다', async () => {
    render(<HomeScreen />)
    await userEvent.click(mapMarker(/경복궁/))
    // 두 번째 클릭이 렌더를 일으키지 않는 그 지점이다.
    await userEvent.click(mapMarker(/경복궁/))

    const camera = screen.getByRole('button', { name: '지도 카메라 변경' })
    await userEvent.click(camera)

    // 카메라를 움직였을 뿐인데 포커스가 시트로 튀면 안 된다.
    expect(document.activeElement).toBe(camera)
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
    const kidsChip = screen.getByRole('button', { name: /아이와 나들이 10/ })
    expect(screen.getByRole('button', { name: /지금 핫플 20/ })).toBeEnabled()

    await userEvent.click(kidsChip)

    expect(screen.getByRole('button', { name: /지금 핫플 20/ })).toBeEnabled()
  })

  it('내 장소 칩이 즐겨찾기만 남긴다', async () => {
    localStorage.setItem('seoul-live:favorites', JSON.stringify(['경복궁']))
    render(<HomeScreen />)

    await userEvent.click(await screen.findByRole('button', { name: '내 장소 1' }))

    expect(areaButtons(/경복궁/).length).toBeGreaterThan(0)
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
    expect(await screen.findByRole('button', { name: '내 장소 1' })).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: '공원' }))

    // 면제 이후의 대칭 단언은 `toBeEnabled()`다 — 위 `내 장소 1`과 짝을 이룬다.
    expect(screen.getByRole('button', { name: '내 장소 0' })).toBeEnabled()
  })

  // FavoritesScreen이 사라지면서 「지도에서 ☆를 눌러 담아보세요」도 함께
  // 없어졌다. 문구는 이미 낡아 있었다 — Task 8에서 별이 상세 헤더를 떠나
  // 액션 행의 「저장」이 됐으므로 그대로 옮기면 있지도 않은 ☆를 찾게 된다.
  it('담은 게 하나도 없으면 담는 방법을 알려준다', async () => {
    render(<HomeScreen />)

    await userEvent.click(screen.getByRole('button', { name: '내 장소 0' }))

    expect(
      screen.getByText('아직 담은 곳이 없어요. 명소를 열고 「저장」을 누르면 여기에 모여요.'),
    ).toBeInTheDocument()
  })

  it('빈 목록 안내는 소리로도 전달된다', async () => {
    // 칩을 눌러도 포커스는 칩에 남고 시트만 올라오므로, live region이 없으면
    // 이 문구는 눈에만 있다. 「내 장소」를 0에서도 누를 수 있게 만든 이유가
    // 「누르면 답이 나온다」인데 그 답이 안 들리면 면제가 헛돈다.
    render(<HomeScreen />)

    await userEvent.click(screen.getByRole('button', { name: '내 장소 0' }))

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(
      '아직 담은 곳이 없어요. 명소를 열고 「저장」을 누르면 여기에 모여요.',
    )
    // 상자째 감싸므로 빠져나올 길도 함께 낭독된다 — half에서 4.2px만 보이는
    // 버튼이라 소리로 먼저 알려주는 편이 낫다.
    expect(within(status).getByRole('button', { name: '필터 해제' })).toBeInTheDocument()
  })

  it('담은 게 없는 내 장소를 켜면 안내가 보이는 높이까지 시트가 올라온다', async () => {
    // 켜는 순간 목록도 마커도 함께 빈다. peek에서는 그 이유를 적은 문구가
    // 시트 안에 가려 있어 사용자에게는 「눌렀더니 다 사라졌다」만 남는다.
    render(<HomeScreen />)
    await userEvent.click(sheetHandle()) // half → full
    await userEvent.click(sheetHandle()) // full → peek
    expect(sheetHandle()).toHaveAccessibleName(/현재 살짝 열림/)

    await userEvent.click(screen.getByRole('button', { name: '내 장소 0' }))

    expect(sheetHandle()).toHaveAccessibleName(/현재 절반/)
  })

  it('담아둔 게 있으면 지금 0이어도 시트를 올리지 않는다', async () => {
    // 「아직 아무것도 안 담았다」(온보딩)와 「담았는데 지금 조건에 안 걸린다」
    // (일시적)는 다른 말이다. 앞엣것만 읽을 안내가 있어 시트를 올린다.
    // 세는 것이 `favorites`가 아니라 `counts.fav`가 되면 둘이 뭉개진다.
    localStorage.setItem('seoul-live:favorites', JSON.stringify(['강남역']))
    render(<HomeScreen />)
    await userEvent.click(await screen.findByRole('button', { name: '공원' }))
    await userEvent.click(sheetHandle()) // half → full
    await userEvent.click(sheetHandle()) // full → peek

    await userEvent.click(screen.getByRole('button', { name: '내 장소 0' }))

    expect(sheetHandle()).toHaveAccessibleName(/현재 살짝 열림/)
  })

  it('다른 칩은 시트를 건드리지 않는다', async () => {
    // 위 규칙을 「칩을 누르면 시트를 올린다」로 넓히면 필터를 만질 때마다
    // 시트가 튀어오른다. peek으로 내려둔 것은 지도를 보려는 뜻이고, 칩은
    // 그 지도의 마커를 거르는 도구다 — 거를 때마다 지도가 덮이면 안 된다.
    render(<HomeScreen />)
    await userEvent.click(sheetHandle()) // half → full
    await userEvent.click(sheetHandle()) // full → peek
    // 「지금 핫플」은 이 파일의 기본 목업(전부 '보통')에서 0이라 비활성이다.
    // 비활성 칩을 누르면 아무 일도 안 일어나므로 무엇을 넣든 통과한다.
    const chip = screen.getByRole('button', { name: /데이트/ })
    expect(chip).toBeEnabled()

    await userEvent.click(chip)

    expect(sheetHandle()).toHaveAccessibleName(/현재 살짝 열림/)
  })

  // (G) 필터 때문에 0이 된 목록은 어느 조건이 문제인지 말해야 한다.
  // 「내 장소」를 켠 뒤 카테고리로 좁히면 칩은 선택돼 있어 활성이지만
  // 목록은 빈다 — 「조건에 맞는 명소가 없어요」만으로는 무엇을 풀지 모른다.
  it('필터 때문에 목록이 비면 그 필터를 이름으로 지목한다', async () => {
    localStorage.setItem('seoul-live:favorites', JSON.stringify(['강남역']))
    render(<HomeScreen />)
    await userEvent.click(await screen.findByRole('button', { name: '내 장소 1' }))

    await userEvent.click(screen.getByRole('button', { name: '공원' }))

    expect(screen.getByText('「내 장소」에 해당하는 명소가 없어요.')).toBeInTheDocument()
  })

  it('빈 목록의 필터 해제 버튼이 실제로 필터를 푼다', async () => {
    localStorage.setItem('seoul-live:favorites', JSON.stringify(['강남역']))
    render(<HomeScreen />)
    await userEvent.click(await screen.findByRole('button', { name: '내 장소 1' }))
    await userEvent.click(screen.getByRole('button', { name: '공원' }))

    await userEvent.click(screen.getByRole('button', { name: '필터 해제' }))

    expect(areaButtons(/남산공원/).length).toBeGreaterThan(0)
  })

  it('검색 결과가 비었을 때는 필터 해제를 권하지 않는다', async () => {
    // 검색어에는 검색 바의 지우기 버튼이라는 제 나름의 출구가 이미 있다.
    // 두 원인을 한 문장에 담으면 길어지고, 검색어를 지우면 필터만 걸린
    // 상태로 돌아가 그때 필터 문구가 뜬다.
    localStorage.setItem('seoul-live:favorites', JSON.stringify(['강남역']))
    render(<HomeScreen />)
    await userEvent.click(await screen.findByRole('button', { name: '내 장소 1' }))

    await userEvent.type(screen.getByRole('searchbox'), '없는곳')

    expect(screen.getByText(/「없는곳」/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '필터 해제' })).toBeNull()
  })

  it('상세에서 저장을 누르면 내 장소 칩이 곧바로 는다', async () => {
    // 칩과 저장 버튼이 각자 useFavorites를 부른다. 둘이 따로 놀면 방금 담은
    // 곳이 칩에 안 잡혀 숫자가 0에서 멎는다. Task 10 전에는 「0인 칩은 비활성
    // 이라 필터를 켤 방법이 없어진다」가 근거였는데, 그 태스크가 「내 장소」를
    // 0에서도 누를 수 있게 하면서 그 대목은 더 이상 참이 아니다 — 남은 손해는
    // 담은 곳이 필터에 안 걸린다는 것 자체다.
    //
    // **상세를 닫지 않고 본다.** 상세가 half에서 열리게 되면서 칩 줄이 그대로
    // 남으므로 「곧바로」를 글자 그대로 잴 수 있다 — 예전에는 시트가 full이라
    // 칩이 가려져 목록으로 돌아와서야 볼 수 있었다.
    render(<HomeScreen />)
    expect(screen.getByRole('button', { name: '내 장소 0' })).toBeEnabled()

    await userEvent.click(areaButtons(/강남역/)[0])
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByRole('button', { name: '내 장소 1' })).toBeEnabled()
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

    await userEvent.click(areaButtons(/강남역/)[0])
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))

    expect(screen.getByRole('button', { name: '내 장소 1' })).toBeEnabled()

    await userEvent.click(areaButtons(/강남역/)[0])
    expect(screen.getByRole('button', { name: '저장됨' })).toBeInTheDocument()
  })

  it('카테고리를 고르면 목록이 그 분류만 남는다', async () => {
    render(<HomeScreen />)
    await userEvent.click(screen.getByRole('button', { name: '고궁·유적' }))
    expect(areaButtons(/경복궁/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /강남역/ })).toBeNull()
  })

  it('상세를 열면 카테고리와 정렬은 목록과 함께 물러난다', async () => {
    render(<HomeScreen />)
    await userEvent.click(areaButtons(/강남역/)[0])
    expect(screen.queryByRole('button', { name: '공원' })).toBeNull()
    expect(screen.queryByRole('button', { name: '여유한 순' })).toBeNull()
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

  // 사라진 FavoritesScreen이 「혼잡도 조회가 실패해도 담은 목록은 보여준다」로
  // 잡던 자리다. 위 테스트는 스트립이 감춰지는 것만 보므로 「실패하면 목록도
  // 통째로 감춘다」는 구현이 그대로 통과한다 — 목록은 카탈로그만 있으면
  // 서고, 혼잡도는 배지 자리에서 「정보 없음」이 될 뿐이다.
  it('혼잡도 조회가 실패해도 명소 목록은 남는다', () => {
    useAreaSnapshots.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<readonly (AreaSnapshot | null)[]>)
    render(<HomeScreen />)

    expect(screen.getByText('혼잡도 정보를 가져오지 못했어요.')).toBeInTheDocument()
    expect(sheetRow(/강남역/)).toBeInTheDocument()
    expect(sheetRow(/남산공원/)).toBeInTheDocument()
    // 빈 목록 문구가 대신 뜨면 원인을 조건 탓으로 돌리게 된다.
    expect(screen.queryByText('조건에 맞는 명소가 없어요.')).toBeNull()
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
