import { useCallback, useEffect, useState } from 'react'
import type { Coords } from '../domain/types'
import { LocationDeniedError, requestCoords } from '../platform/location'

export type LocationStatus = 'loading' | 'granted' | 'denied' | 'unavailable'

export interface CurrentLocation {
  readonly coords: Coords | null
  readonly status: LocationStatus
  /** 사용자가 직접 누르는 재시도. 거부 상태면 권한 다이얼로그를 먼저 연다. */
  readonly retry: () => void
}

/**
 * 현재 좌표를 얻어 화면이 쓸 수 있는 상태로 바꾼다.
 *
 * 권한 거부(`denied`)와 그 외 실패(`unavailable`)를 구분한다. 화면이 둘을
 * 다르게 안내해야 하기 때문이다 — 전자는 사용자가 풀 수 있고 후자는 아니다.
 * 어느 쪽이든 좌표는 `null`이고, 목록은 거리순 대신 혼잡도순으로 내려간다.
 *
 * 토스 브리지와 웹 표준 중 무엇으로 얻는지는 `platform/location`이 안다.
 * 이 훅은 상태 기계만 갖는다.
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
        // attempt가 0보다 크면 사용자가 「다시 시도」를 눌렀다는 뜻이다.
        const next = await requestCoords(attempt > 0)
        if (!active) return
        setCoords(next)
        setStatus('granted')
      } catch (error) {
        if (!active) return
        setCoords(null)
        setStatus(error instanceof LocationDeniedError ? 'denied' : 'unavailable')
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [attempt])

  return { coords, status, retry }
}
