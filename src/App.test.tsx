import { render, screen, waitFor, within } from '@testing-library/react'
import { AREA_NAMES } from './data/areas'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { reset } from './hooks/favoritesStore'

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
  // 선은 `RoadPath.test.tsx`가 잰다. 여기서는 훅이 있기만 하면 된다.
  useMap: () => null,
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
  reset()
  // 기본값은 권한 거부. 위치 없이도 화면이 서는지가 기본 경로다.
  getLocation.mockRejectedValue(new framework.GetCurrentLocationPermissionError())
})

/**
 * 시트 안 목록 행. 지도 마커가 같은 이름을 갖고 있고 DOM 순서상 마커가
 * 앞서므로(`data-map-layer`가 시트보다 앞이다) `getAllByRole(...)[0]`은
 * 마커다. 「목록에서 열었다」를 뜻하려면 시트 안으로 좁혀야 한다.
 */
function sheetRow(name: string | RegExp): HTMLElement {
  const sheet = document.querySelector('[data-sheet-content]') as HTMLElement
  return within(sheet).getAllByRole('button', { name })[0]
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

  it('갈 곳을 고르는 탭바가 없다', async () => {
    // 「탭바 안으로 좁혀서 묻는다」가 이제 불가능하다 — `<nav>`가 통째로
    // 사라지기 때문이다. 이름만 물으면 무엇이 있든 통과하는 공허한 단언이
    // 되므로(Task 9에서 실제로 그런 단언이 있었다) **랜드마크가 없다**는 것과
    // **옛 탭이 가던 곳을 지금 무엇이 대신하는가**를 함께 잠근다. 탭바를
    // 되살리면 첫 단언이 곧바로 깨진다.
    render(<App />)

    expect(screen.queryAllByRole('navigation')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: '즐겨찾기' })).toBeNull()
    expect(screen.queryByRole('button', { name: '더보기' })).toBeNull()
    // 즐겨찾기 탭의 자리는 필터 칩이, 더보기 탭의 자리는 요약 스트립이 받았다.
    expect(await screen.findByRole('button', { name: /내 장소/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /오늘의 서울 열기/ })).toBeInTheDocument()
  })

  it('앱이 자체 헤더를 두지 않고 제목은 보조기술에만 남는다', () => {
    // 지도 위에 뜬 검색 바가 이미 상단바의 자리를 쓰고 있어 같은 층이 두 겹
    // 이었고, 토스가 미니앱에 주는 네이티브 헤더까지 치면 세 겹이었다.
    // 오버레이 시트를 쓰는 이상 세로 3.5rem은 시트가 계속 손해 보는 값이다.
    render(<App />)
    expect(screen.queryByRole('banner')).toBeNull()

    // 그래도 제목 트리의 뿌리는 남긴다. TopAppBar의 h1이 앱의 유일한 h1이었고
    // 없애면 시트 안 h2부터 시작하는 뿌리 없는 트리가 된다. 이름은
    // index.html의 <title>과 같은 「서울 라이브」다 — TopAppBar는 「Seoul Live」라
    // 둘이 어긋나 있었다.
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      '서울 라이브',
    )
    // 랜드마크까지 함께 잃지는 않는다.
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('명소를 누르면 상세가 열리고 지도는 남는다', async () => {
    render(<App />)
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /광화문·덕수궁/ }).length,
      ).toBeGreaterThan(0),
    )

    await userEvent.click(sheetRow(/광화문·덕수궁/))

    // **상세가 전체 화면 층이 됐다**(2026-08-20) — 시트 안의 「목록으로」 링크가
    // 상단 바의 뒤로 화살표로 바뀌었다. 근거는 `AreaDetailScreen`의 주석.
    expect(screen.getByRole('button', { name: '뒤로' })).toBeInTheDocument()
    // **지도는 덮이되 언마운트되지 않는다.** 그래야 뒤로가기가 즉시이고,
    // 상세 안의 「지도에서 보기」가 그 지도를 옮길 수 있다.
    expect(screen.getByRole('region', { name: '지도' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '뒤로' }))
    // 상세 층이 오른쪽으로 밀려 나가는 동안(0.22초) DOM에 남는다 —
    // `AnimatePresence`가 나가는 애니메이션을 끝내고서야 언마운트한다.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '뒤로' })).toBeNull(),
    )
  })

  it('오늘의 서울은 탭이 아니라 시트 안 뷰다', async () => {
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /오늘의 서울 열기/ }))

    expect(
      await screen.findByRole('heading', { name: '지금 가장 붐비는 곳' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '오늘의 서울' })).toBeInTheDocument()
    // 탭이었을 때는 이 자리에서 지도가 통째로 사라졌다.
    expect(screen.getByRole('region', { name: '지도' })).toBeInTheDocument()
  })

  it('오늘의 서울에서 명소를 누르면 같은 시트가 그 상세로 바뀐다', async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /오늘의 서울 열기/ }))
    const busiest = (await screen.findByRole('heading', { name: '지금 가장 붐비는 곳' }))
      .parentElement as HTMLElement

    // 첫 줄이 아니라 **둘째 줄**을 누른다. 첫 줄을 누르면 「무엇을 눌렀든
    // 1위를 연다」는 구현이 그대로 통과해 단언이 공허해진다.
    const second = busiest.querySelectorAll('button')[1]
    // 누른 그 명소가 열려야 한다. 「상세가 열렸다」까지만 보면 이름을 흘려버리는
    // 통로도 통과한다.
    const name = AREA_NAMES.find((area) => (second.textContent ?? '').includes(area))
    // 이름을 못 찾으면 아래 단언이 「이름 조건 없음」이 되어 역시 공허해진다.
    expect(name).toBeDefined()

    await userEvent.click(second)

    expect(screen.getByRole('button', { name: '뒤로' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '지도' })).toBeInTheDocument()
  })

  it('상세에서 저장한 곳이 내 장소 칩의 개수가 된다', async () => {
    // 즐겨찾기 탭이 필터 칩이 됐으므로 「담았다」의 결과가 보이는 자리도
    // 칩 하나뿐이다. 상세가 열리면 시트가 full이라 칩이 물러나 있어
    // 목록으로 돌아와서 본다.
    render(<App />)
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /광화문·덕수궁/ }).length,
      ).toBeGreaterThan(0),
    )

    await userEvent.click(sheetRow(/광화문·덕수궁/))
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    await userEvent.click(screen.getByRole('button', { name: '뒤로' }))

    expect(await screen.findByRole('button', { name: '내 장소 1' })).toBeInTheDocument()
  })

  it('담은 곳이 하나도 없어도 담는 방법에 닿을 수 있다', async () => {
    // 즐겨찾기 화면이 사라지면서 「지도에서 ☆를 눌러 담아보세요」도 함께
    // 없어졌다. 그 안내가 없으면 신규 사용자가 만나는 것은 「내 장소 0」 칩
    // 하나뿐이고, 그 칩은 자기가 무엇인지도 어떻게 채우는지도 말하지 않는다.
    // 그래서 「내 장소」만은 0에서도 눌리고, 누르면 빈 목록 문구가 답한다.
    render(<App />)

    const chip = await screen.findByRole('button', { name: '내 장소 0' })
    expect(chip).toBeEnabled()
    await userEvent.click(chip)

    expect(
      screen.getByText('아직 담은 곳이 없어요. 명소를 열고 「저장」을 누르면 여기에 모여요.'),
    ).toBeInTheDocument()

    // 되돌아올 길도 그 자리에 있다.
    await userEvent.click(screen.getByRole('button', { name: '필터 해제' }))
    expect(
      screen.getAllByRole('button', { name: /광화문·덕수궁/ }).length,
    ).toBeGreaterThan(0)
  })

  // **정렬 줄이 사라졌다**(2026-08-21). 「거리순 / 여유한 순 / 붐비는 순」에서
  // 뒤 둘이 혼잡도 칩과 같은 말을 하게 됐고(칩이 네 등급으로 갈렸다), 남은
  // 「가까운 순」은 고를 것이 없어 기본이 됐다 — 근거는 `useNearbyAreas`.
  //
  // 그래서 여기서 재는 것도 「무엇이 눌려 있나」가 아니라 **「위치가 화면을
  // 어떻게 바꾸나」**로 옮겼다. 좌표가 없으면 안내가 뜨고 「내 주변」이 잠기며,
  // 허용하면 둘 다 풀린다.
  it('위치를 거부하면 안내가 뜨고 내 주변이 잠긴다', async () => {
    render(<App />)
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /광화문·덕수궁/ }).length,
      ).toBeGreaterThan(0),
    )

    expect(
      screen.getByText('위치를 허용하면 가까운 곳부터 볼 수 있어요.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '내 주변' })).toBeDisabled()
    // 목록은 그래도 선다 — 쓸 수 있는 유일한 축인 혼잡도로 세운다.
    expect(screen.getByRole('button', { name: /^전체 \d+$/ })).toBeEnabled()
  })

  it('위치를 허용하면 안내가 사라지고 내 주변을 누를 수 있다', async () => {
    grantLocation()
    render(<App />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '내 주변' })).toBeEnabled(),
    )
    expect(screen.queryByText(/위치를 허용하면/)).not.toBeInTheDocument()
  })

  // 정렬 줄이 있던 자리다. 목록을 좁히는 조작은 이제 칩 줄 하나이므로 그쪽이
  // 실제로 배선돼 있는지를 앱 전체 렌더로 확인한다.
  it('혼잡도 칩을 고르면 그 칩만 눌린 상태가 된다', async () => {
    grantLocation()
    render(<App />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^전체 \d+$/ })).toBeEnabled(),
    )

    await userEvent.click(screen.getByRole('button', { name: /^붐빔 \d+$/ }))

    expect(screen.getByRole('button', { name: /^붐빔 \d+$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /^전체 \d+$/ })).toHaveAttribute(
      'aria-pressed',
      'false',
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

    await userEvent.click(sheetRow(/광화문·덕수궁/))
    await userEvent.click(screen.getByRole('button', { name: '뒤로' }))

    // 위치는 LocationProvider가 앱 수준에서 한 번만 잡는다.
    expect(getLocation.mock.calls.length).toBe(callsAfterMount)
  })
})
