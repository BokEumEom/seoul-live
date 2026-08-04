import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  }
})

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
  // 기본값은 권한 거부. 위치 없이도 화면이 서는지가 기본 경로다.
  getLocation.mockRejectedValue(
    new framework.GetCurrentLocationPermissionError(),
  )
})

describe('App', () => {
  it('내 주변 화면이 뜨고 명소 목록이 채워진다', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '내 주변 명소' })).toBeInTheDocument()

    await waitFor(() =>
      expect(screen.getByText('광화문·덕수궁')).toBeInTheDocument(),
    )
    expect(screen.getByText('성수카페거리')).toBeInTheDocument()
  })

  it('혼잡도 배지가 실제 값으로 그려진다', async () => {
    render(<App />)

    await waitFor(() => expect(screen.getByText('광화문·덕수궁')).toBeInTheDocument())

    // 목업은 카탈로그 전체에서 4단계가 모두 나오도록 만들어져 있다.
    for (const level of ['여유', '보통', '약간 붐빔', '붐빔']) {
      expect(screen.getAllByText(level).length).toBeGreaterThan(0)
    }
  })

  it('카테고리를 고르면 목록이 걸러진다', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('강남역')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('tab', { name: '공원' }))

    expect(screen.queryByText('강남역')).not.toBeInTheDocument()
    expect(screen.getByText('남산공원')).toBeInTheDocument()
  })

  it('명소를 누르면 상세로 넘어가고 뒤로 돌아온다', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('경복궁')).toBeInTheDocument())

    await userEvent.click(screen.getByText('경복궁'))
    expect(screen.getByRole('heading', { name: '경복궁' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))
    expect(screen.getByRole('heading', { name: '내 주변 명소' })).toBeInTheDocument()
  })

  it('위치를 거부하면 혼잡도순으로 내려가고 허용 안내가 뜬다', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('강남역')).toBeInTheDocument())

    expect(
      screen.getByRole('heading', { name: '혼잡도 낮은 순' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('위치를 허용하면 가까운 곳부터 볼 수 있어요.'),
    ).toBeInTheDocument()

    // 좌표가 없으니 거리는 계산될 수 없다. "0m"이나 "NaN"이 새어나오면 잡는다.
    const item = screen.getByText('강남역').closest('button')
    expect(item?.textContent).not.toMatch(/\d+(\.\d+)?\s*(m|km)/)
  })

  it('위치를 허용하면 가까운 순으로 바뀌고 거리가 보인다', async () => {
    grantLocation()
    render(<App />)

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: '가까운 순' }),
      ).toBeInTheDocument(),
    )

    // 광화문 한복판에서 가장 가까운 건 광화문·덕수궁이다.
    const names = screen
      .getAllByRole('button')
      .map((button) => button.textContent ?? '')
      .filter((text) => text.includes('·') || text.includes('역'))
    expect(names[0]).toContain('광화문·덕수궁')
    expect(screen.queryByText(/위치를 허용하면/)).not.toBeInTheDocument()
  })

  it('위치를 허용하면 2km 안 한산한 곳을 추천으로 띄운다', async () => {
    grantLocation()
    render(<App />)

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: '지금 가기 좋은 곳' }),
      ).toBeInTheDocument(),
    )
    expect(screen.getByText('2km 안에서 한산한 곳')).toBeInTheDocument()
  })

  it('거부한 뒤 허용하기를 누르면 권한 다이얼로그를 연다', async () => {
    render(<App />)
    await waitFor(() =>
      expect(screen.getByText('위치를 허용하면 가까운 곳부터 볼 수 있어요.')).toBeInTheDocument(),
    )

    vi.mocked(framework.Device.getLocation.openPermissionDialog).mockResolvedValue(
      'allowed',
    )
    await userEvent.click(screen.getByRole('button', { name: '허용하기' }))

    expect(
      framework.Device.getLocation.openPermissionDialog,
    ).toHaveBeenCalledTimes(1)
  })

  it('지도·더보기 탭은 비활성이다', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('강남역')).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /지도/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /더보기/ })).toBeDisabled()
  })
})
