import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocationDeniedError, requestCoords } from './location'

// useCurrentLocation.test.ts와 같은 목업 모양이다 — 설치된
// @apps-in-toss/web-framework 3.0.1에서 권한 함수는 호출 가능한 함수에
// getPermission/openPermissionDialog가 붙은 형태(PermissionFunctionWithDialog)다.
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

function bridgeLocation(lat: number, lng: number) {
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

/** jsdom에는 navigator.geolocation이 없다. 웹 폴백을 볼 때만 심는다. */
function stubWebGeolocation(
  implementation: Pick<Geolocation, 'getCurrentPosition'>['getCurrentPosition'],
) {
  const getCurrentPosition = vi.fn(implementation)
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  })
  return getCurrentPosition
}

function removeWebGeolocation() {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: undefined,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  removeWebGeolocation()
})

describe('requestCoords', () => {
  it('브리지가 좌표를 주면 웹 표준은 건드리지 않는다', async () => {
    getLocation.mockResolvedValue(bridgeLocation(37.5665, 126.978))
    const web = stubWebGeolocation(() => {
      throw new Error('불려서는 안 된다')
    })

    await expect(requestCoords(false)).resolves.toEqual({
      lat: 37.5665,
      lng: 126.978,
    })
    expect(web).not.toHaveBeenCalled()
  })

  it('브리지가 없으면 웹 표준 위치로 떨어진다', async () => {
    // 토스 웹뷰 밖(개발 서버·브라우저)이 이 경우다. 여기서 떨어지지 않으면
    // 「내 주변」이 앱 안에서만 동작하고 브라우저에서는 늘 죽는다.
    getLocation.mockRejectedValue(new Error('bridge not available'))
    stubWebGeolocation((success) => {
      success({
        coords: { latitude: 37.4979, longitude: 127.0276 },
      } as GeolocationPosition)
    })

    await expect(requestCoords(false)).resolves.toEqual({
      lat: 37.4979,
      lng: 127.0276,
    })
  })

  it('브리지 권한 거부는 웹으로 떨어지지 않고 LocationDeniedError가 된다', async () => {
    // 거부는 브리지가 살아 있다는 신호다. 여기서 웹으로 떨어지면 토스에서 이미
    // 거부한 사람에게 웹뷰 팝업을 한 번 더 띄우게 된다.
    getLocation.mockRejectedValue(new GetCurrentLocationPermissionError())
    const web = stubWebGeolocation(() => {
      throw new Error('불려서는 안 된다')
    })

    await expect(requestCoords(false)).rejects.toBeInstanceOf(
      LocationDeniedError,
    )
    expect(web).not.toHaveBeenCalled()
  })

  it('첫 로드에서는 권한 다이얼로그를 열지 않는다', async () => {
    getLocation.mockRejectedValue(new GetCurrentLocationPermissionError())

    await expect(requestCoords(false)).rejects.toBeInstanceOf(
      LocationDeniedError,
    )
    expect(openPermissionDialog).not.toHaveBeenCalled()
  })

  it('사용자가 누른 재시도면 다이얼로그를 열고, 허용되면 좌표를 준다', async () => {
    getLocation.mockRejectedValueOnce(new GetCurrentLocationPermissionError())
    openPermissionDialog.mockResolvedValue('allowed')
    getLocation.mockResolvedValueOnce(bridgeLocation(37.5, 127))

    await expect(requestCoords(true)).resolves.toEqual({ lat: 37.5, lng: 127 })
    expect(openPermissionDialog).toHaveBeenCalledTimes(1)
  })

  it('다이얼로그에서 또 거부하면 LocationDeniedError로 남는다', async () => {
    getLocation.mockRejectedValue(new GetCurrentLocationPermissionError())
    openPermissionDialog.mockResolvedValue('denied')

    await expect(requestCoords(true)).rejects.toBeInstanceOf(
      LocationDeniedError,
    )
  })

  it('웹 표준에서 거부하면 LocationDeniedError가 된다', async () => {
    // 브라우저에서 「차단」을 누른 경우다. 안내 문구가 「허용하기」여야 하므로
    // 브리지 거부와 같은 오류로 모아야 한다.
    getLocation.mockRejectedValue(new Error('bridge not available'))
    stubWebGeolocation((_success, failure) => {
      failure?.({ code: 1, message: 'denied' } as GeolocationPositionError)
    })

    await expect(requestCoords(false)).rejects.toBeInstanceOf(
      LocationDeniedError,
    )
  })

  it('웹 표준이 거부 아닌 이유로 실패하면 거부로 뭉개지 않는다', async () => {
    getLocation.mockRejectedValue(new Error('bridge not available'))
    stubWebGeolocation((_success, failure) => {
      failure?.({ code: 3, message: 'timeout' } as GeolocationPositionError)
    })

    const error = await requestCoords(false).catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(LocationDeniedError)
  })

  it('브리지도 웹 표준도 없으면 거부가 아닌 실패로 올린다', async () => {
    getLocation.mockRejectedValue(new Error('bridge not available'))

    const error = await requestCoords(false).catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(LocationDeniedError)
  })
})
