import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// 위치는 목업으로 고정한다. jsdom에는 토스 네이티브 브리지가 없어서, 목업이
// 없으면 SDK가 던지는지 매달리는지에 따라 정렬 순서가 달라진다.
vi.mock('@apps-in-toss/web-framework', () => {
  class GetCurrentLocationPermissionError extends Error {}
  const getLocation = Object.assign(vi.fn(), {
    getPermission: vi.fn(),
    openPermissionDialog: vi.fn(),
  })
  return {
    Accuracy: { Balanced: 3 },
    Device: { getLocation },
    GetCurrentLocationPermissionError,
    // 즐겨찾기 저장소도 같은 이유로 고정한다. 브리지가 없는 환경을 흉내 내
    // localStorage 폴백을 타게 한다.
    Storage: {
      getItem: vi.fn(() => Promise.reject(new Error('브리지 없음'))),
      setItem: vi.fn(() => Promise.reject(new Error('브리지 없음'))),
    },
  }
})

// jsdom에는 Google Maps가 없다. 토스 SDK와 같은 이유로 목업한다.
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

const framework = await import('@apps-in-toss/web-framework')
const getLocation = vi.mocked(framework.Device.getLocation)

/** 광화문 한복판. 카탈로그의 도심 명소가 2km 안에 들어온다. */
function grantLocation(lat = 37.5709, lng = 126.9769): void {
  getLocation.mockResolvedValue({
    timestamp: 0,
    coords: {
      latitude: lat,
      longitude: lng,
      altitude: 0,
      accuracy: 10,
      altitudeAccuracy: 10,
      heading: 0,
    },
  })
}

// 이 파일은 "빌드가 된다"가 아니라 "화면에 실제로 뭔가 뜬다"를 확인한다.
// 타입 검사와 번들링이 통과해도 렌더 중 예외가 나면 사용자는 흰 화면을 본다.
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.clearAllMocks()
  localStorage.clear()
  // 기본값은 권한 거부. 위치 없이도 화면이 서는지가 기본 경로다.
  getLocation.mockRejectedValue(new framework.GetCurrentLocationPermissionError())
})

function tab(name: string): HTMLElement {
  return screen.getByRole('button', { name })
}

describe('App', () => {
  it('첫 화면이 지도이고 목록이 함께 채워진다', async () => {
    render(<App />)

    expect(screen.getByRole('region', { name: '지도' })).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /광화문·덕수궁/ }).length,
      ).toBeGreaterThan(0),
    )
    expect(
      screen.getAllByRole('button', { name: /성수카페거리/ }).length,
    ).toBeGreaterThan(0)
  })

  it('탭이 셋이고 옛 탭은 없다', () => {
    render(<App />)
    expect(tab('지도')).toBeInTheDocument()
    expect(tab('즐겨찾기')).toBeInTheDocument()
    expect(tab('더보기')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '내 주변 ' })).toBeNull()
    expect(screen.queryByRole('button', { name: '혼잡예보' })).toBeNull()
  })

  it('명소를 누르면 상세가 열리고 지도는 남는다', async () => {
    render(<App />)
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /광화문·덕수궁/ }).length,
      ).toBeGreaterThan(0),
    )

    await userEvent.click(screen.getAllByRole('button', { name: /광화문·덕수궁/ })[0])

    expect(screen.getByRole('button', { name: '목록으로' })).toBeInTheDocument()
    // 예전 구조에서는 상세로 가면 지도가 통째로 사라졌다.
    expect(screen.getByRole('region', { name: '지도' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))
    expect(screen.queryByRole('button', { name: '목록으로' })).toBeNull()
  })

  // 홈을 hidden으로 남겨 두는 구현을 요구한다. 탭을 오갈 때 지도가 매번 다시
  // 만들어지면 타일을 다시 받고 카메라가 초기화된다.
  it('탭을 오가도 홈의 상태가 남는다', async () => {
    render(<App />)
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /광화문·덕수궁/ }).length,
      ).toBeGreaterThan(0),
    )

    await userEvent.type(screen.getByRole('searchbox'), '경복궁')
    await userEvent.click(tab('더보기'))
    await userEvent.click(tab('지도'))

    // 검색어가 살아 있으면 HomeScreen이 언마운트되지 않은 것이다.
    expect(screen.getByRole('searchbox')).toHaveValue('경복궁')
    expect(screen.getByRole('region', { name: '지도' })).toBeInTheDocument()
  })

  it('더보기는 오늘의 서울이다', async () => {
    render(<App />)
    await userEvent.click(tab('더보기'))

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: '지금 가장 붐비는 곳' }),
      ).toBeInTheDocument(),
    )
    expect(screen.getByRole('heading', { name: '오늘의 서울' })).toBeInTheDocument()
  })

  it('오늘의 서울에서 명소를 누르면 홈의 상세로 간다', async () => {
    render(<App />)
    await userEvent.click(tab('더보기'))
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: '지금 가장 붐비는 곳' }),
      ).toBeInTheDocument(),
    )

    const busiest = screen.getByRole('heading', { name: '지금 가장 붐비는 곳' })
      .parentElement as HTMLElement
    await userEvent.click(busiest.querySelectorAll('button')[0])

    expect(screen.getByRole('button', { name: '목록으로' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '지도' })).toBeInTheDocument()
  })

  it('별을 누르면 즐겨찾기 탭에 나타난다', async () => {
    render(<App />)
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /광화문·덕수궁/ }).length,
      ).toBeGreaterThan(0),
    )

    await userEvent.click(screen.getAllByRole('button', { name: /광화문·덕수궁/ })[0])
    await userEvent.click(screen.getByRole('button', { name: '즐겨찾기에 추가' }))
    await userEvent.click(tab('즐겨찾기'))

    expect(
      await screen.findByRole('button', { name: /광화문·덕수궁/ }),
    ).toBeInTheDocument()
  })

  it('즐겨찾기가 비어 있으면 지도로 가는 길을 준다', async () => {
    render(<App />)
    await userEvent.click(tab('즐겨찾기'))

    expect(await screen.findByText('지도에서 ☆를 눌러 담아보세요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '지도로 가기' }))
    expect(screen.getByRole('region', { name: '지도' })).toBeInTheDocument()
  })

  it('위치를 거부하면 여유한 순으로 내려가고 허용 안내가 뜬다', async () => {
    render(<App />)
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /광화문·덕수궁/ }).length,
      ).toBeGreaterThan(0),
    )

    expect(
      screen.getByText('위치를 허용하면 가까운 곳부터 볼 수 있어요.'),
    ).toBeInTheDocument()
    // 좌표가 없으면 거리순을 고를 수 없다.
    expect(screen.getByRole('tab', { name: '거리순' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '내 주변' })).toBeDisabled()
  })

  it('위치를 허용하면 거리순이 열리고 내 주변을 누를 수 있다', async () => {
    grantLocation()
    render(<App />)

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: '거리순' })).toBeEnabled(),
    )
    expect(screen.getByRole('button', { name: '내 주변' })).toBeEnabled()
    expect(screen.queryByText(/위치를 허용하면/)).not.toBeInTheDocument()
  })

  it('정렬 기준을 바꾸면 선택된 기준이 옮겨간다', async () => {
    grantLocation()
    render(<App />)
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: '거리순' })).toBeEnabled(),
    )

    await userEvent.click(screen.getByRole('tab', { name: '붐비는 순' }))

    expect(screen.getByRole('tab', { name: '붐비는 순' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('상세에 갔다 돌아와도 위치를 다시 요청하지 않는다', async () => {
    grantLocation()
    render(<App />)
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /광화문·덕수궁/ }).length,
      ).toBeGreaterThan(0),
    )
    const callsAfterMount = getLocation.mock.calls.length

    await userEvent.click(screen.getAllByRole('button', { name: /광화문·덕수궁/ })[0])
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))

    // 위치는 LocationProvider가 앱 수준에서 한 번만 잡는다.
    expect(getLocation.mock.calls.length).toBe(callsAfterMount)
  })
})
