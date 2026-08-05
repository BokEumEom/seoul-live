import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UseQueryResult } from '@tanstack/react-query'
import { AREA_CATALOG } from '../data/areas'
import { DEFAULT_ZOOM, SEOUL_CENTER } from '../domain/map'
import type { AreaSnapshot } from '../domain/types'
import { MapScreen } from './MapScreen'

// jsdom에는 Google Maps가 없다. 라이브러리를 그대로 두면 스크립트를 받으러 나가
// 테스트가 네트워크에 의존한다. App.test.tsx가 토스 SDK에 쓰는 방식과 같다.
//
// 목업이 두 가지를 더 한다.
//  - Map이 center/zoom을 data 속성으로 노출한다. 카메라가 제어 방식이라
//    "초기 뷰가 고정된다"를 이걸로만 검증할 수 있다.
//  - APIProvider가 onError를 부르는 버튼을 심는다. 스크립트 로드 실패 경로를
//    실제로 밟아보려면 트리거가 필요하다.
vi.mock('@vis.gl/react-google-maps', () => ({
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
        aria-label="테스트: 지도 로드 실패"
        onClick={() => onError?.(new Error('script blocked'))}
      />
      {children}
    </div>
  ),
  Map: ({
    children,
    center,
    zoom,
    onCameraChanged,
  }: {
    children: ReactNode
    center: { lat: number; lng: number }
    zoom: number
    onCameraChanged?: (event: { detail: { center: { lat: number; lng: number }; zoom: number } }) => void
  }) => (
    <div
      data-testid="google-map"
      data-center={`${center.lat},${center.lng}`}
      data-zoom={String(zoom)}
    >
      {/* 제어 카메라의 왕복을 실제로 밟아보려면 트리거가 필요하다. 목업이
          받지 않는 prop은 존재 자체가 검증되지 않는다. */}
      <button
        type="button"
        aria-label="테스트: 카메라 이동"
        onClick={() =>
          onCameraChanged?.({
            detail: { center: { lat: 37.4979, lng: 127.0276 }, zoom: 14 },
          })
        }
      />
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
}))

vi.mock('../app/locationContext', () => ({
  useLocation: vi.fn(),
}))

const queries = await import('../data/queries')
const locationContext = await import('../app/locationContext')
const useAreaSnapshots = vi.mocked(queries.useAreaSnapshots)
const useLocation = vi.mocked(locationContext.useLocation)

function snapshotFor(name: string): AreaSnapshot {
  return {
    code: 'POI000',
    name,
    congestion: '붐빔',
    message: '사람이 많아 붐빕니다.',
    populationMin: 42_000,
    populationMax: 44_000,
    observedAt: '2026-08-05 14:35',
    observedAtLabel: '14:35',
    forecasts: [],
  }
}

/** 카탈로그 순서에 맞춘 스냅샷 배열. buildNearbyList가 인덱스로 짝짓는다. */
function allSnapshots(): readonly (AreaSnapshot | null)[] {
  return AREA_CATALOG.map((entry) => snapshotFor(entry.name))
}

function mockSnapshots(data: readonly (AreaSnapshot | null)[]): void {
  useAreaSnapshots.mockReturnValue({
    data,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<readonly (AreaSnapshot | null)[]>)
}

beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'demo-key-1234')
  vi.stubEnv('VITE_GOOGLE_MAPS_MAP_ID', '')
  useLocation.mockReturnValue({ coords: null, status: 'denied', retry: vi.fn() })
  mockSnapshots(allSnapshots())
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('MapScreen', () => {
  it('키가 없으면 지도 대신 안내를 띄운다', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')

    render(<MapScreen onSelectArea={vi.fn()} />)

    expect(screen.getByText(/VITE_GOOGLE_MAPS_API_KEY/)).toBeInTheDocument()
    expect(screen.queryByTestId('google-map')).not.toBeInTheDocument()
  })

  it('카탈로그의 모든 명소에 마커를 세운다', () => {
    render(<MapScreen onSelectArea={vi.fn()} />)

    // CongestionMarker가 role="img"다. 버튼 개수로 세면 목업이 심는 트리거
    // 버튼과 FAB까지 딸려 들어와 무엇을 세는 단언인지 흐려진다.
    expect(screen.getAllByRole('img')).toHaveLength(AREA_CATALOG.length)
    expect(screen.getAllByRole('img', { name: /강남역/ })).toHaveLength(1)
  })

  it('좌표가 있어도 초기 중심은 서울 전역이다', () => {
    // 설계에서 고정한 결정이다. 내 위치로 자동 이동하면 서울 밖 사용자에게
    // 마커가 하나도 없는 지도가 뜬다. 이동은 재조정 버튼을 눌렀을 때만 한다.
    useLocation.mockReturnValue({
      coords: { lat: 35.1796, lng: 129.0756 }, // 부산
      status: 'granted',
      retry: vi.fn(),
    })

    render(<MapScreen onSelectArea={vi.fn()} />)

    const map = screen.getByTestId('google-map')
    expect(map).toHaveAttribute(
      'data-center',
      `${SEOUL_CENTER.lat},${SEOUL_CENTER.lng}`,
    )
    expect(map).toHaveAttribute('data-zoom', String(DEFAULT_ZOOM))
  })

  it('재조정을 누르면 내 위치로 이동한다', async () => {
    useLocation.mockReturnValue({
      coords: { lat: 37.5709, lng: 126.9769 },
      status: 'granted',
      retry: vi.fn(),
    })

    render(<MapScreen onSelectArea={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '내 위치로 이동' }))

    const map = screen.getByTestId('google-map')
    expect(map).toHaveAttribute('data-center', '37.5709,126.9769')
    // 중심만 옮기고 줌을 그대로 두면 서울 전역 축척에서 점 하나로 이동할 뿐이라
    // "내 위치로 왔다"가 화면에 드러나지 않는다.
    expect(map).toHaveAttribute('data-zoom', '14')
  })

  it('지도 스크립트가 실패하면 키 문제와 다른 안내를 띄운다', async () => {
    render(<MapScreen onSelectArea={vi.fn()} />)

    await userEvent.click(
      screen.getByRole('button', { name: '테스트: 지도 로드 실패' }),
    )

    expect(screen.getByText(/불러오지 못했어요/)).toBeInTheDocument()
    expect(screen.queryByTestId('google-map')).not.toBeInTheDocument()
  })

  it('불러오는 중에는 마커 대신 안내를 띄운다', () => {
    // "정보 없음" 마커 30개는 "아직 안 왔다"가 아니라 "데이터가 없다"로 읽힌다.
    useAreaSnapshots.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<readonly (AreaSnapshot | null)[]>)

    render(<MapScreen onSelectArea={vi.fn()} />)

    expect(screen.queryAllByRole('img')).toHaveLength(0)
    expect(screen.getByText('혼잡도를 불러오는 중')).toBeInTheDocument()
  })

  it('조회에 실패하면 다시 시도할 수 있다', async () => {
    const refetch = vi.fn()
    useAreaSnapshots.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    } as unknown as UseQueryResult<readonly (AreaSnapshot | null)[]>)

    render(<MapScreen onSelectArea={vi.fn()} />)
    const retryButton = screen.getByRole('button', { name: '다시 시도' })
    await userEvent.click(retryButton)

    expect(refetch).toHaveBeenCalledTimes(1)
    // jsdom은 Tailwind pointer-events를 실제로 계산하지 않아 바깥
    // pointer-events-none만으로는 클릭 차단을 검증할 수 없다. 되살리는
    // 안쪽 래퍼가 실제로 있는지 클래스로 확인한다.
    expect(retryButton.closest('.pointer-events-auto')).toBeInTheDocument()
  })

  it('조회에 실패한 명소도 마커가 남는다', () => {
    // 「내 주변」은 "정보 없음"으로 보여준다. 지도에서만 사라지면 사용자는
    // 그 명소가 존재하지 않는다고 오인한다.
    mockSnapshots(AREA_CATALOG.map(() => null))

    render(<MapScreen onSelectArea={vi.fn()} />)

    expect(screen.getAllByRole('img', { name: /정보 없음/ })).toHaveLength(
      AREA_CATALOG.length,
    )
  })

  it('진입 시에는 바텀시트가 열려 있지 않다', () => {
    // 앱인토스 심사 항목이다.
    render(<MapScreen onSelectArea={vi.fn()} />)

    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('마커를 누르면 그 명소의 바텀시트가 열린다', async () => {
    render(<MapScreen onSelectArea={vi.fn()} />)

    await userEvent.click(screen.getByRole('img', { name: /강남역/ }))

    expect(screen.getByRole('region', { name: '강남역 요약' })).toBeInTheDocument()
  })

  it('바텀시트에서 혼잡예보를 열면 명소 이름을 올려보낸다', async () => {
    const onSelectArea = vi.fn()
    render(<MapScreen onSelectArea={onSelectArea} />)

    await userEvent.click(screen.getByRole('img', { name: /강남역/ }))
    await userEvent.click(screen.getByRole('button', { name: '혼잡예보 보기' }))

    expect(onSelectArea).toHaveBeenCalledWith('강남역')
  })

  it('좌표가 없으면 재조정 버튼이 비활성이다', () => {
    render(<MapScreen onSelectArea={vi.fn()} />)

    expect(screen.getByRole('button', { name: '내 위치로 이동' })).toBeDisabled()
  })

  it('좌표가 있으면 재조정 버튼을 쓸 수 있다', () => {
    useLocation.mockReturnValue({
      coords: { lat: 37.5709, lng: 126.9769 },
      status: 'granted',
      retry: vi.fn(),
    })

    render(<MapScreen onSelectArea={vi.fn()} />)

    expect(
      screen.getByRole('button', { name: '내 위치로 이동' }),
    ).not.toBeDisabled()
  })

  it('좌표가 있으면 현재 위치를 지도에 표시한다', () => {
    useLocation.mockReturnValue({
      coords: { lat: 37.5709, lng: 126.9769 },
      status: 'granted',
      retry: vi.fn(),
    })

    render(<MapScreen onSelectArea={vi.fn()} />)

    expect(screen.getByRole('img', { name: '현재 위치' })).toBeInTheDocument()
  })

  it('좌표가 없으면 현재 위치 표시가 없다', () => {
    render(<MapScreen onSelectArea={vi.fn()} />)

    expect(screen.queryByRole('img', { name: '현재 위치' })).not.toBeInTheDocument()
  })

  it('지도를 움직이면 카메라 상태가 따라온다', async () => {
    // 이 배선이 끊기면 라이브러리가 매 렌더 우리 center/zoom으로 되돌려서
    // 팬·줌이 제자리로 튕긴다. 화면은 멀쩡해 보이는데 지도가 얼어붙는다.
    render(<MapScreen onSelectArea={vi.fn()} />)

    await userEvent.click(
      screen.getByRole('button', { name: '테스트: 카메라 이동' }),
    )

    const map = screen.getByTestId('google-map')
    expect(map).toHaveAttribute('data-zoom', '14')
    expect(map).toHaveAttribute('data-center', '37.4979,127.0276')
  })

  it('확대하면 마커에 혼잡도 라벨이 나타난다', async () => {
    // 줌이 상태로 돌아오지 않으면 shouldShowMarkerLabel이 초기값에 굳어
    // 아무리 확대해도 라벨이 안 뜬다.
    render(<MapScreen onSelectArea={vi.fn()} />)
    expect(screen.queryByText('붐빔')).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: '테스트: 카메라 이동' }),
    )

    expect(screen.getAllByText('붐빔').length).toBeGreaterThan(0)
  })
})
