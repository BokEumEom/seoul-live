import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCurrentLocation } from './useCurrentLocation'

// 설치된 @apps-in-toss/web-framework 3.0.1 기준.
// `getCurrentLocation`은 deprecated이고 `Device.getLocation`이 정본이다.
// 권한 함수는 호출 가능한 함수에 getPermission/openPermissionDialog가 붙은
// 형태(PermissionFunctionWithDialog)라 목업도 같은 모양이어야 한다.
vi.mock('@apps-in-toss/web-framework', () => {
  class GetCurrentLocationPermissionError extends Error {}
  const getLocation = Object.assign(vi.fn(), {
    getPermission: vi.fn(),
    openPermissionDialog: vi.fn(),
  })
  return {
    Accuracy: {
      Lowest: 1,
      Low: 2,
      Balanced: 3,
      High: 4,
      Highest: 5,
      BestForNavigation: 6,
    },
    Device: { getLocation },
    GetCurrentLocationPermissionError,
  }
})

const framework = await import('@apps-in-toss/web-framework')
const getLocation = vi.mocked(framework.Device.getLocation)
const openPermissionDialog = vi.mocked(
  framework.Device.getLocation.openPermissionDialog,
)
const { GetCurrentLocationPermissionError } = framework

function locationOf(lat: number, lng: number) {
  return {
    timestamp: 0,
    coords: {
      latitude: lat,
      longitude: lng,
      altitude: 0,
      accuracy: 10,
      altitudeAccuracy: 10,
      heading: 0,
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useCurrentLocation', () => {
  it('성공하면 좌표를 주고 granted가 된다', async () => {
    getLocation.mockResolvedValue(locationOf(37.5665, 126.978))

    const { result } = renderHook(() => useCurrentLocation())

    await waitFor(() => expect(result.current.status).toBe('granted'))
    expect(result.current.coords).toEqual({ lat: 37.5665, lng: 126.978 })
  })

  it('deprecated된 getCurrentLocation이 아니라 Device.getLocation을 쓴다', async () => {
    getLocation.mockResolvedValue(locationOf(37.5, 127))

    const { result } = renderHook(() => useCurrentLocation())

    await waitFor(() => expect(result.current.status).toBe('granted'))
    expect(getLocation).toHaveBeenCalledWith({
      accuracy: framework.Accuracy.Balanced,
    })
  })

  it('권한 거부면 denied가 되고 좌표는 없다', async () => {
    getLocation.mockRejectedValue(
      new GetCurrentLocationPermissionError(),
    )

    const { result } = renderHook(() => useCurrentLocation())

    await waitFor(() => expect(result.current.status).toBe('denied'))
    expect(result.current.coords).toBeNull()
  })

  it('첫 로드에서는 권한 다이얼로그를 직접 열지 않는다', async () => {
    // 화면에 들어오자마자 팝업이 두 번 뜨는 걸 막는다. 재요청은 사용자가
    // 명시적으로 누를 때만 한다.
    getLocation.mockRejectedValue(
      new GetCurrentLocationPermissionError(),
    )

    const { result } = renderHook(() => useCurrentLocation())

    await waitFor(() => expect(result.current.status).toBe('denied'))
    expect(openPermissionDialog).not.toHaveBeenCalled()
  })

  it('그 외 실패는 unavailable이 된다', async () => {
    getLocation.mockRejectedValue(new Error('timeout'))

    const { result } = renderHook(() => useCurrentLocation())

    await waitFor(() => expect(result.current.status).toBe('unavailable'))
    expect(result.current.coords).toBeNull()
  })

  it('거부 상태에서 retry하면 권한 다이얼로그를 열고, 허용되면 좌표를 준다', async () => {
    getLocation.mockRejectedValueOnce(
      new GetCurrentLocationPermissionError(),
    )

    const { result } = renderHook(() => useCurrentLocation())
    await waitFor(() => expect(result.current.status).toBe('denied'))

    getLocation.mockRejectedValueOnce(
      new GetCurrentLocationPermissionError(),
    )
    openPermissionDialog.mockResolvedValue('allowed')
    getLocation.mockResolvedValueOnce(locationOf(37.4979, 127.0276))

    act(() => result.current.retry())

    await waitFor(() => expect(result.current.status).toBe('granted'))
    expect(openPermissionDialog).toHaveBeenCalledTimes(1)
    expect(result.current.coords).toEqual({ lat: 37.4979, lng: 127.0276 })
  })

  it('다이얼로그에서 또 거부하면 denied로 남는다', async () => {
    getLocation.mockRejectedValue(
      new GetCurrentLocationPermissionError(),
    )

    const { result } = renderHook(() => useCurrentLocation())
    await waitFor(() => expect(result.current.status).toBe('denied'))

    openPermissionDialog.mockResolvedValue('denied')
    act(() => result.current.retry())

    await waitFor(() => expect(openPermissionDialog).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.status).toBe('denied'))
    expect(result.current.coords).toBeNull()
  })

  it('언마운트된 뒤 응답이 와도 상태를 갱신하지 않는다', async () => {
    let resolve: ((value: ReturnType<typeof locationOf>) => void) | undefined
    getLocation.mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )

    const { result, unmount } = renderHook(() => useCurrentLocation())
    expect(result.current.status).toBe('loading')

    unmount()
    resolve?.(locationOf(37.5, 127))

    // 언마운트 뒤 setState가 일어나면 React가 경고를 낸다. 경고 없이
    // 마지막 값이 loading으로 남아 있어야 한다.
    await waitFor(() => expect(result.current.status).toBe('loading'))
  })
})
