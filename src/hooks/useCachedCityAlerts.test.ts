import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { areaPayloadKey } from '../data/queries'
import { useCachedCityAlerts } from './useCachedCityAlerts'

// 이 훅은 useQueryClient()로 캐시를 직접 뒤진다 — QueryClientProvider가 있어야
// 렌더된다. queries.test.ts의 관례를 그대로 따른다.
function harness(client: QueryClient): { wrapper: (props: { children: ReactNode }) => ReactNode } {
  return {
    wrapper: ({ children }) =>
      createElement(QueryClientProvider, { client }, children),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useCachedCityAlerts', () => {
  it('areaPayloadKey로 심어 둔 캐시가 있으면 그 명소의 재난문자를 꺼낸다', () => {
    // 캐시에는 파싱된 CityInfo가 아니라 원본 citydata 응답(AreaPayload)이
    // 앉는다 — select 결과는 캐시에 안 쓰인다(TanStack Query 표준). 그래서
    // 이 훅도 원본 body를 심어야 한다.
    const client = new QueryClient()
    client.setQueryData(areaPayloadKey('강남역'), {
      body: {
        CITYDATA: {
          AREA_NM: '강남역',
          LIVE_DST_MESSAGE: [
            {
              MSG_CN: '호우주의보',
              DST_SE_NM: '호우',
              EMRG_STEP_NM: '주의보',
              CRT_DT: '2026-08-27 10:00',
            },
          ],
        },
      },
      freshness: null,
    })

    const { result } = renderHook(() => useCachedCityAlerts(), harness(client))

    expect(result.current.map((a) => a.message)).toEqual(['호우주의보'])
  })

  it('캐시가 비어 있으면 빈 배열이고, 조회를 트리거하지 않는다', () => {
    // getQueryData만 쓴다는 계약이 이 훅의 존재 이유다(추가 호출 0). fetch를
    // 스텁해 두고 한 번도 안 불렸는지까지 확인한다 — queryFn이 없으므로
    // 애초에 조회가 나갈 길이 없지만, 그 사실을 테스트로 고정해 둔다.
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const client = new QueryClient()

    const { result } = renderHook(() => useCachedCityAlerts(), harness(client))

    expect(result.current).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('캐시에 깨진 payload가 들어 있어도 던지지 않는다', () => {
    // AREA_NM이 캐시 키의 명소와 달라 parseCityInfoResponse가
    // AreaNameMismatchError를 던진다 — 재난문자는 부가 정보라 한 명소의
    // 파싱 실패가 이 화면 전체를 죽이면 안 된다.
    const client = new QueryClient()
    client.setQueryData(areaPayloadKey('강남역'), {
      body: { CITYDATA: { AREA_NM: '경복궁' } },
      freshness: null,
    })

    expect(() => renderHook(() => useCachedCityAlerts(), harness(client))).not.toThrow()
    const { result } = renderHook(() => useCachedCityAlerts(), harness(client))
    expect(result.current).toEqual([])
  })
})
