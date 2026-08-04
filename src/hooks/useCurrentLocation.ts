import {
  Accuracy,
  Device,
  GetCurrentLocationPermissionError,
  type Location as DeviceLocation,
} from '@apps-in-toss/web-framework'
import { useCallback, useEffect, useState } from 'react'
import type { Coords } from '../domain/types'

export type LocationStatus = 'loading' | 'granted' | 'denied' | 'unavailable'

export interface CurrentLocation {
  readonly coords: Coords | null
  readonly status: LocationStatus
  /** 사용자가 직접 누르는 재시도. 거부 상태면 권한 다이얼로그를 먼저 연다. */
  readonly retry: () => void
}

// 수백 m 오차. 거리순 정렬과 "2km 이내 추천"에는 이 정도면 충분하고,
// High 이상은 GPS를 깨워 배터리를 더 쓴다.
const OPTIONS = { accuracy: Accuracy.Balanced } as const

function toCoords(location: DeviceLocation): Coords {
  return { lat: location.coords.latitude, lng: location.coords.longitude }
}

// 권한 거부 뒤 다이얼로그를 다시 여는 건 사용자가 직접 누른 재시도일 때뿐이다.
// 화면 진입만으로 팝업이 연달아 뜨면 거부한 사람을 계속 붙잡는 꼴이 된다.
async function requestCoords(userInitiated: boolean): Promise<Coords> {
  try {
    return toCoords(await Device.getLocation(OPTIONS))
  } catch (error) {
    const denied = error instanceof GetCurrentLocationPermissionError
    if (!denied || !userInitiated) throw error

    const status = await Device.getLocation.openPermissionDialog()
    if (status !== 'allowed') throw error

    return toCoords(await Device.getLocation(OPTIONS))
  }
}

/**
 * 토스 위치 권한을 거쳐 현재 좌표를 얻는다.
 *
 * 권한 거부(`denied`)와 그 외 실패(`unavailable`)를 구분한다. 화면이 둘을
 * 다르게 안내해야 하기 때문이다 — 전자는 사용자가 풀 수 있고 후자는 아니다.
 * 어느 쪽이든 좌표는 `null`이고, 목록은 거리순 대신 혼잡도순으로 내려간다.
 */
export function useCurrentLocation(): CurrentLocation {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [status, setStatus] = useState<LocationStatus>('loading')
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => {
    setStatus('loading')
    setAttempt((value) => value + 1)
  }, [])

  useEffect(() => {
    let active = true

    async function load(): Promise<void> {
      try {
        const next = await requestCoords(attempt > 0)
        if (!active) return
        setCoords(next)
        setStatus('granted')
      } catch (error) {
        if (!active) return
        setCoords(null)
        setStatus(
          error instanceof GetCurrentLocationPermissionError
            ? 'denied'
            : 'unavailable',
        )
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [attempt])

  return { coords, status, retry }
}
