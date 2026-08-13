import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCurrentLocation } from './useCurrentLocation'

// 브리지냐 웹 표준이냐는 platform/location이 정한다 — 권한 다이얼로그와 폴백
// 순서는 그쪽 테스트가 잠근다. 여기서 잠그는 것은 상태 기계뿐이다:
// 실패의 종류를 status로 옮기는 것, 재시도가 사용자 의도를 전달하는 것,
// 언마운트 뒤 갱신하지 않는 것.
vi.mock('../platform/location', async () => {
  const actual =
    await vi.importActual<typeof import('../platform/location')>(
      '../platform/location',
    )
  return {
    LocationDeniedError: actual.LocationDeniedError,
    requestCoords: vi.fn(),
  }
})

const { LocationDeniedError, requestCoords } = await import(
  '../platform/location'
)
const mockedRequestCoords = vi.mocked(requestCoords)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useCurrentLocation', () => {
  it('성공하면 좌표를 주고 granted가 된다', async () => {
    mockedRequestCoords.mockResolvedValue({ lat: 37.5665, lng: 126.978 })

    const { result } = renderHook(() => useCurrentLocation())

    await waitFor(() => expect(result.current.status).toBe('granted'))
    expect(result.current.coords).toEqual({ lat: 37.5665, lng: 126.978 })
  })

  it('권한 거부면 denied가 되고 좌표는 없다', async () => {
    mockedRequestCoords.mockRejectedValue(new LocationDeniedError())

    const { result } = renderHook(() => useCurrentLocation())

    await waitFor(() => expect(result.current.status).toBe('denied'))
    expect(result.current.coords).toBeNull()
  })

  it('그 외 실패는 unavailable이 된다', async () => {
    mockedRequestCoords.mockRejectedValue(new Error('timeout'))

    const { result } = renderHook(() => useCurrentLocation())

    await waitFor(() => expect(result.current.status).toBe('unavailable'))
    expect(result.current.coords).toBeNull()
  })

  it('첫 로드는 사용자가 누른 재시도가 아니라고 알린다', async () => {
    // 이 인자가 권한 다이얼로그를 여는지를 가른다. 화면에 들어오자마자 팝업이
    // 뜨는 걸 막는 것은 여기서 false를 넘기는 것에 달려 있다.
    mockedRequestCoords.mockResolvedValue({ lat: 37.5, lng: 127 })

    const { result } = renderHook(() => useCurrentLocation())

    await waitFor(() => expect(result.current.status).toBe('granted'))
    expect(mockedRequestCoords).toHaveBeenCalledWith(false)
  })

  it('retry는 사용자가 누른 재시도라고 알리고, 성공하면 좌표를 준다', async () => {
    mockedRequestCoords.mockRejectedValueOnce(new LocationDeniedError())

    const { result } = renderHook(() => useCurrentLocation())
    await waitFor(() => expect(result.current.status).toBe('denied'))

    mockedRequestCoords.mockResolvedValueOnce({ lat: 37.4979, lng: 127.0276 })
    act(() => result.current.retry())

    await waitFor(() => expect(result.current.status).toBe('granted'))
    expect(mockedRequestCoords).toHaveBeenLastCalledWith(true)
    expect(result.current.coords).toEqual({ lat: 37.4979, lng: 127.0276 })
  })

  it('재시도가 또 거부되면 denied로 남는다', async () => {
    mockedRequestCoords.mockRejectedValue(new LocationDeniedError())

    const { result } = renderHook(() => useCurrentLocation())
    await waitFor(() => expect(result.current.status).toBe('denied'))

    act(() => result.current.retry())

    await waitFor(() => expect(mockedRequestCoords).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.status).toBe('denied'))
    expect(result.current.coords).toBeNull()
  })

  it('언마운트된 뒤 응답이 와도 상태를 갱신하지 않는다', async () => {
    let resolve: ((value: { lat: number; lng: number }) => void) | undefined
    mockedRequestCoords.mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )

    const { result, unmount } = renderHook(() => useCurrentLocation())
    expect(result.current.status).toBe('loading')

    unmount()
    resolve?.({ lat: 37.5, lng: 127 })

    // 언마운트 뒤 setState가 일어나면 React가 경고를 낸다. 경고 없이
    // 마지막 값이 loading으로 남아 있어야 한다.
    await waitFor(() => expect(result.current.status).toBe('loading'))
  })
})
