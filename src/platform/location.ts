import {
  Accuracy,
  Device,
  GetCurrentLocationPermissionError,
  type Location as DeviceLocation,
} from '@apps-in-toss/web-framework'
import type { Coords } from '../domain/types'

// favorites.ts·links.ts와 같은 폴백이다 — 토스 브리지를 먼저 쓰고, 브리지가 없는
// 환경(개발 서버·브라우저·테스트)에서만 웹 표준으로 떨어진다. 이 폴백이 없으면
// 「내 주변」이 토스 앱 안에서만 살아 있고 그 밖에서는 항상 unavailable이라,
// 브라우저로 화면을 보는 내내 거리순 정렬도 근처 추천도 확인할 수가 없다.
//
// 다만 **거부는 떨어뜨리지 않는다.** 거부는 브리지가 살아 있다는 신호이고,
// 여기서 웹으로 넘기면 토스에서 이미 거부한 사람에게 웹뷰 팝업을 한 번 더
// 띄우게 된다. 그래서 「브리지가 없다」와 「사용자가 거부했다」를 갈라 잡는다.

/** 사용자가 위치를 거부했다. 그 외 실패와 구분해야 화면이 다르게 안내한다. */
export class LocationDeniedError extends Error {
  constructor() {
    super('위치 권한이 거부되었습니다')
    this.name = 'LocationDeniedError'
  }
}

// 수백 m 오차. 거리순 정렬과 "2km 이내 추천"에는 이 정도면 충분하고,
// High 이상은 GPS를 깨워 배터리를 더 쓴다.
const OPTIONS = { accuracy: Accuracy.Balanced } as const

// 웹 표준도 같은 이유로 고정밀을 끈다. 타임아웃이 없으면 실패도 성공도 아닌
// 채로 화면이 계속 loading에 머무른다.
const WEB_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 60_000,
}

/**
 * `GeolocationPositionError.PERMISSION_DENIED`의 값이다.
 *
 * 상수 대신 숫자인 이유: jsdom에 `GeolocationPositionError`가 전역으로 없어
 * 참조하면 테스트가 ReferenceError로 죽는다. 값 1은 W3C Geolocation 명세가
 * 고정한 것이다.
 */
const WEB_PERMISSION_DENIED = 1

function toCoords(location: DeviceLocation): Coords {
  return { lat: location.coords.latitude, lng: location.coords.longitude }
}

// 권한 거부 뒤 다이얼로그를 다시 여는 건 사용자가 직접 누른 재시도일 때뿐이다.
// 화면 진입만으로 팝업이 연달아 뜨면 거부한 사람을 계속 붙잡는 꼴이 된다.
async function fromBridge(userInitiated: boolean): Promise<Coords> {
  try {
    return toCoords(await Device.getLocation(OPTIONS))
  } catch (error) {
    if (!(error instanceof GetCurrentLocationPermissionError)) {
      throw error
    }
    if (!userInitiated) {
      throw new LocationDeniedError()
    }

    const status = await Device.getLocation.openPermissionDialog()
    if (status !== 'allowed') {
      throw new LocationDeniedError()
    }

    try {
      return toCoords(await Device.getLocation(OPTIONS))
    } catch {
      // 허용을 눌렀는데도 못 얻었다. 브리지는 살아 있으니 웹으로 떨어뜨리지
      // 않고 거부로 남긴다 — 사용자가 다시 시도할 수 있는 자리다.
      throw new LocationDeniedError()
    }
  }
}

async function fromWeb(): Promise<Coords> {
  const geolocation: Geolocation | undefined = navigator.geolocation
  if (geolocation === undefined) {
    throw new Error('이 환경에는 위치 기능이 없습니다')
  }

  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (error) => {
        reject(
          error.code === WEB_PERMISSION_DENIED
            ? new LocationDeniedError()
            : new Error(`위치를 확인하지 못했습니다: ${error.message}`),
        )
      },
      WEB_OPTIONS,
    )
  })
}

/**
 * 현재 좌표를 얻는다. 토스 브리지 우선, 없으면 웹 표준.
 *
 * @param userInitiated 사용자가 직접 누른 재시도인가. 거부 상태에서 권한
 *   다이얼로그를 여는 것은 이때뿐이다.
 * @throws {LocationDeniedError} 사용자가 위치를 거부했을 때
 * @throws {Error} 그 외 실패 — 브리지도 웹 표준도 없거나, 타임아웃이거나
 */
export async function requestCoords(userInitiated: boolean): Promise<Coords> {
  try {
    return await fromBridge(userInitiated)
  } catch (error) {
    if (error instanceof LocationDeniedError) {
      throw error
    }
    // 브리지가 없다. 웹 표준으로 넘어간다.
  }

  return fromWeb()
}
