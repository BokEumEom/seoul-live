import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

// jsdom에는 Google Maps가 없다. 토스 SDK와 같은 이유로 목업한다.
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Map: ({ children }: { children: ReactNode }) => (
    <div data-testid="google-map">{children}</div>
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

    // 헤더만 바뀌고 본문이 비면 사용자에겐 고장이다. 실제 예보 내용까지 확인한다.
    await waitFor(() =>
      expect(
        screen.getByRole('img', { name: '시간별 혼잡도 예측' }),
      ).toBeInTheDocument(),
    )
    expect(screen.getByRole('heading', { name: '시간별 예측' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))
    expect(screen.getByRole('heading', { name: '내 주변 명소' })).toBeInTheDocument()
  })

  it('위치를 거부하면 혼잡도순으로 내려가고 허용 안내가 뜬다', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('강남역')).toBeInTheDocument())

    expect(
      screen.getByRole('heading', { name: '혼잡도순 주변 장소' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('위치를 허용하면 가까운 곳부터 볼 수 있어요.'),
    ).toBeInTheDocument()

    // 좌표가 없으니 거리는 계산될 수 없다. "0m"이나 "NaN"이 새어나오면 잡는다.
    const item = screen.getByText('강남역').closest('button')
    expect(item?.textContent).not.toMatch(/\d+(\.\d+)?\s*(m|km)/)
  })

  it('위치를 허용하면 거리순으로 바뀌고 거리가 보인다', async () => {
    grantLocation()
    render(<App />)

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: '거리순 주변 장소' }),
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

  it('위치를 허용하면 가까우면서 여유로운 곳을 추천으로 띄운다', async () => {
    grantLocation()
    render(<App />)

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: '가까우면서 여유로운 곳 추천' }),
      ).toBeInTheDocument(),
    )
  })

  it('정렬 기준을 바꾸면 목록 제목과 순서가 함께 바뀐다', async () => {
    grantLocation()
    render(<App />)
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: '거리순 주변 장소' }),
      ).toBeInTheDocument(),
    )

    await userEvent.click(screen.getByRole('button', { name: /정렬 기준/ }))

    expect(
      screen.getByRole('heading', { name: '혼잡도순 주변 장소' }),
    ).toBeInTheDocument()
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

  it('상세에 갔다 돌아와도 위치를 다시 요청하지 않는다', async () => {
    // 위치 훅이 화면 안에 있으면 화면이 언마운트될 때마다 GPS가 다시 켜지고,
    // 권한을 아직 안 정한 사용자에게는 팝업이 반복해서 뜬다.
    grantLocation()
    render(<App />)
    // 위치를 허용하면 추천 카드에도 같은 명소가 뜰 수 있어 첫 번째를 집는다.
    await waitFor(() =>
      expect(screen.getAllByText('경복궁').length).toBeGreaterThan(0),
    )
    expect(getLocation).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getAllByText('경복궁')[0])
    await userEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))
    await waitFor(() => expect(screen.getByText('강남역')).toBeInTheDocument())

    expect(getLocation).toHaveBeenCalledTimes(1)
  })

  it('네 탭이 모두 활성이다', async () => {
    // 더보기까지 붙으면서 비활성 탭이 없어졌다. 화면 전환은 아래 '탭 전환'에서 다룬다.
    render(<App />)
    await waitFor(() => expect(screen.getByText('강남역')).toBeInTheDocument())

    for (const label of [/지도/, /내 주변/, /혼잡예보/, /더보기/]) {
      expect(screen.getByRole('button', { name: label })).not.toBeDisabled()
    }
  })
})

describe('탭 전환', () => {
  // 저장소의 .env에 실제 키가 들어 있어서, 명시하지 않으면 로컬 환경에 따라
  // 통과 여부가 달라진다. 테스트가 던져도 풀리도록 afterEach에 둔다.
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'demo-key-1234')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('지도 탭을 누르면 지도가 뜬다', async () => {
    grantLocation()
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /지도/ }))

    expect(await screen.findByTestId('google-map')).toBeInTheDocument()
  })

  it('지도에서 명소를 열고 뒤로 가면 지도로 돌아온다', async () => {
    // 예전에는 뒤로 가기가 무조건 「내 주변」으로 보냈다. 지도에서 들어온
    // 사용자는 보고 있던 지도 위치를 잃는다.
    grantLocation()
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /지도/ }))
    await userEvent.click(await screen.findByRole('img', { name: /강남역/ }))
    await userEvent.click(screen.getByRole('button', { name: '혼잡예보 보기' }))

    await userEvent.click(await screen.findByRole('button', { name: '뒤로 가기' }))

    expect(await screen.findByTestId('google-map')).toBeInTheDocument()
  })

  it('더보기 탭을 누르면 도시 정보가 목업 데이터로 채워진다', async () => {
    grantLocation()
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /더보기/ }))

    expect(
      await screen.findByRole('heading', { name: '도시 정보' }),
    ).toBeInTheDocument()

    // 제목만 뜨고 본문이 비면 사용자에겐 고장이다. 데이터가 실제로 흘러
    // 들어왔는지 섹션 내용까지 확인한다.
    expect(await screen.findByText('미세먼지')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '주차장' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '따릉이' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '문화행사' })).toBeInTheDocument()
  })

  it('더보기는 위치가 있으면 가장 가까운 명소로 시작한다', async () => {
    // 광화문 한복판을 준다.
    grantLocation()
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /더보기/ }))

    expect(await screen.findByLabelText('명소 선택')).toHaveValue('광화문·덕수궁')
  })

  it('더보기에서 명소를 바꾸면 그 명소 정보로 갈아탄다', async () => {
    grantLocation()
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /더보기/ }))
    const picker = await screen.findByLabelText('명소 선택')
    await userEvent.selectOptions(picker, '서울숲공원')

    expect(picker).toHaveValue('서울숲공원')
    // 갈아탄 뒤에도 화면이 서 있어야 한다 — 빈 명소를 고르면 안내 문구가 뜬다.
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: '주차장' }) ??
          screen.getByText(/제공되는 도시 정보가 없어요/),
      ).toBeInTheDocument(),
    )
  })

  it('혼잡예보 탭을 눌러도 강조와 화면이 어긋나지 않는다', async () => {
    // 혼잡예보는 명소를 골라야 열리는 상세 화면이다. 독립 화면이 없으므로
    // 탭 상태로 받으면 강조만 옮겨가고 내용은 「내 주변」에 머문다 — 탭바가
    // 거짓말을 하고 스크린리더에는 aria-current가 잘못 전달된다.
    grantLocation()
    render(<App />)
    await screen.findByText('내 주변 명소')

    await userEvent.click(screen.getByRole('button', { name: /혼잡예보/ }))

    expect(screen.getByText('내 주변 명소')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /혼잡예보/ })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('혼잡예보 화면에서 지도 탭을 누르면 상세가 닫히고 지도가 뜬다', async () => {
    // 하단 탭바는 상세 화면에서도 계속 보인다(App.tsx에서 main 바깥에 있다).
    // 그래서 handleTab의 setSelectedArea(null)은 방어적 코드가 아니라 이 경로를
    // 실제로 떠받친다 — 지우면 상세가 닫히지 않아 지도가 영영 안 뜬다.
    grantLocation()
    render(<App />)

    await userEvent.click(
      await screen.findByRole('button', { name: /강남역/ }),
    )
    await screen.findByRole('button', { name: '뒤로 가기' })

    await userEvent.click(screen.getByRole('button', { name: /지도/ }))

    expect(await screen.findByTestId('google-map')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '뒤로 가기' })).not.toBeInTheDocument()
  })
})
