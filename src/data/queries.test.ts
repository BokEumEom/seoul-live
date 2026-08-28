import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { AreaSnapshot } from '../domain/types'
import { shouldRetry, useAreaSnapshot, useCityInfo } from './queries'
import { AreaNameMismatchError, SeoulApiError } from './schema'
import { ProxyResponseError } from './client'

// ProxyResponseError는 진짜가 필요하다(위 재시도 테스트가 instanceof로 가른다).
// 망에 나가는 함수만 바꿔 낀다.
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  fetchAreaPayload: vi.fn(),
}))

const client = await import('./client')
const fetchAreaPayload = vi.mocked(client.fetchAreaPayload)

// select 참조 고정(useCallback) 테스트용 — parseCitydataResponse를 실제 구현으로
// 감싸서 몇 번 불렸는지만 센다. 실패를 흉내 내는 게 아니라 재파싱 횟수를 재는
// 것이라, mockReset을 안 쓰고 델타(호출 전후 차)로만 잰다 — 다른 테스트를
// 건드리지 않는다.
vi.mock('./schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./schema')>()
  return { ...actual, parseCitydataResponse: vi.fn(actual.parseCitydataResponse) }
})

const schema = await import('./schema')
const parseCitydataResponse = vi.mocked(schema.parseCitydataResponse)

// I5 — shouldRetry는 재시도 정책이라는, 겉으로는 자명해 보이지만 실은 미묘한
// 규칙(어떤 에러는 절대 재시도해도 안 풀린다)을 담은 순수 함수다. React 렌더
// 없이도 완전히 검증할 수 있다.
describe('shouldRetry', () => {
  it('AreaNameMismatchError는 재시도하지 않는다', () => {
    expect(shouldRetry(0, new AreaNameMismatchError('강남역', ['광화문·덕수궁']))).toBe(false)
  })

  // 아래 코드는 「서울시 실시간 도시데이터」 명세(서울시+실시간+도시데이터.xls)의
  // 에러 코드 표에서 그대로 가져왔다. 같은 SeoulApiError라도 원인이 우리 요청이냐
  // 상대 서버냐에 따라 재시도 가치가 정반대다.
  it('요청 자체가 잘못된 SeoulApiError는 재시도하지 않는다', () => {
    const permanent = [
      ['INFO-100', '인증키가 유효하지 않습니다.'],
      ['INFO-200', '해당하는 데이터가 없습니다.'],
      ['ERROR-300', '필수 값이 누락되어 있습니다.'],
      ['ERROR-301', '파일타입 값이 누락 혹은 유효하지 않습니다.'],
      ['ERROR-310', '해당하는 서비스를 찾을 수 없습니다.'],
      ['ERROR-331', '요청시작위치 값을 확인하십시오.'],
      ['ERROR-336', '데이터요청은 한번에 최대 1000건을 넘을 수 없습니다.'],
      ['ERROR-601', 'SQL 문장 오류 입니다.'],
    ] as const

    for (const [code, message] of permanent) {
      expect(shouldRetry(0, new SeoulApiError(code, message)), code).toBe(false)
    }
  })

  it('상대 서버가 흔들린 SeoulApiError는 재시도한다', () => {
    // ERROR-500(서버 오류)·ERROR-600(DB 연결 오류)은 같은 요청이 잠시 뒤 성공할 수
    // 있다. 전부 non-retryable로 묶으면 서울 API가 1초 삐끗한 것만으로 사용자에게
    // "정보 없음"을 띄운다.
    expect(shouldRetry(0, new SeoulApiError('ERROR-500', '서버 오류입니다.'))).toBe(true)
    expect(shouldRetry(0, new SeoulApiError('ERROR-600', '데이터베이스 연결 오류입니다.'))).toBe(
      true,
    )
  })

  it('상대 서버 오류도 무한히 재시도하지는 않는다', () => {
    expect(shouldRetry(1, new SeoulApiError('ERROR-500', '서버 오류입니다.'))).toBe(true)
    expect(shouldRetry(2, new SeoulApiError('ERROR-500', '서버 오류입니다.'))).toBe(false)
  })

  it('ZodError는 재시도하지 않는다', () => {
    const error = new z.ZodError([])
    expect(shouldRetry(0, error)).toBe(false)
  })

  it('ProxyResponseError의 4xx는 재시도하지 않는다', () => {
    expect(shouldRetry(0, new ProxyResponseError('요청 오류', 400))).toBe(false)
    expect(shouldRetry(0, new ProxyResponseError('찾을 수 없음', 404))).toBe(false)
    expect(shouldRetry(0, new ProxyResponseError('과다 요청', 499))).toBe(false)
  })

  it('ProxyResponseError의 5xx는 실패 횟수가 2 미만이면 재시도한다', () => {
    expect(shouldRetry(0, new ProxyResponseError('상류 실패', 502))).toBe(true)
    expect(shouldRetry(1, new ProxyResponseError('상류 실패', 502))).toBe(true)
    expect(shouldRetry(2, new ProxyResponseError('상류 실패', 502))).toBe(false)
  })

  it('일반 네트워크/타임아웃 에러는 실패 횟수가 2 미만이면 재시도한다', () => {
    expect(shouldRetry(0, new Error('네트워크 문제'))).toBe(true)
    expect(shouldRetry(1, new Error('네트워크 문제'))).toBe(true)
    expect(shouldRetry(2, new Error('네트워크 문제'))).toBe(false)
  })
})

// Task 5 Step 1 — 분기점. 두 훅(useAreaSnapshot·useCityInfo)이 같은 queryKey를
// 공유하면서 각자 select로 파싱을 나눠 하려면, 한 select가 던져도 다른 select는
// 멀쩡해야 한다. TanStack Query 5의 select는 옵저버별로 돈다는 것이 이 설계의
// 바닥이다 — 여기가 깨지면 select를 버리고 훅 안에서 파싱해야 한다.
describe('select 오염 여부 (Task 5 설계의 분기점)', () => {
  it('한 select가 던져도 다른 select는 멀쩡하다', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children)
    const payload = { ok: 1 }

    const bad = renderHook(
      () =>
        useQuery({
          queryKey: ['shared'],
          queryFn: async () => payload,
          select: () => {
            throw new Error('던진다')
          },
        }),
      { wrapper },
    )
    const good = renderHook(
      () =>
        useQuery({
          queryKey: ['shared'],
          queryFn: async () => payload,
          select: (p: typeof payload) => p.ok,
        }),
      { wrapper },
    )

    await waitFor(() => expect(good.result.current.data).toBe(1))
    expect(bad.result.current.isError).toBe(true)
    expect(good.result.current.isError).toBe(false)
  })
})

function snapshot(name: string): AreaSnapshot {
  return {
    code: 'POI014',
    name,
    congestion: '보통',
    message: '조금 붐벼요.',
    populationMin: 39_000,
    populationMax: 41_000,
    observedAt: '2026-08-14 14:00',
    observedAtLabel: '14:00',
    forecasts: [],
    forecastProvided: null,
    composition: null,
    replaced: null,
  }
}

/**
 * `useAreaSnapshot`·`useCityInfo`가 함께 소비하는 `citydata` 봉투. `snapshot(name)`이
 * 기대하는 여섯 필드를 그대로 담아, select(`parseCitydataResponse`)를 거치면 정확히
 * `snapshot(name)`이 나오게 맞춘다.
 */
function citydataPayload(name: string): unknown {
  return {
    CITYDATA: {
      AREA_NM: name,
      AREA_CD: 'POI014',
      LIVE_PPLTN_STTS: [
        {
          AREA_NM: name,
          AREA_CD: 'POI014',
          AREA_CONGEST_LVL: '보통',
          AREA_CONGEST_MSG: '조금 붐벼요.',
          AREA_PPLTN_MIN: '39000',
          AREA_PPLTN_MAX: '41000',
          PPLTN_TIME: '2026-08-14 14:00',
          FCST_PPLTN: [],
        },
      ],
    },
  }
}

/**
 * `LIVE_PPLTN_STTS`가 비어 `rowsSchema`(min 1)를 못 채운다 — `parseCitydataResponse`만
 * 던지고, `parseCityInfoResponse`는 `AREA_NM`만 보므로 멀쩡하다.
 */
function brokenCongestionPayload(name: string): unknown {
  return {
    CITYDATA: {
      AREA_NM: name,
      AREA_CD: 'POI014',
      LIVE_PPLTN_STTS: [],
      WEATHER_STTS: [{ TEMP: '29.1' }],
    },
  }
}

// 씨앗 심기 테스트 넷이 여기 있었다. `['areas', …]` 캐시를 seed해서 useAreaSnapshot이
// `findSeededSnapshot`으로 즉시 값을 보여주는지 재던 것들인데, 목록 출처가 SeoulRtd로
// 가면서(AGENTS.md, 2026-08-20) 그 캐시를 아무도 안 채우게 됐다.
//
// **기능은 2026-08-28에 되살렸고, 여기로는 안 돌아온다.** 새 모양은 캐시를 키로
// 뒤지지 않는다 — `HomeScreen`이 손에 든 등급을 prop으로 내려주므로 이 훅과
// 무관하고, `queries.ts`에 잴 함수도 없다. 잠그는 자리가 두 곳으로 옮겨갔다:
// 「홈이 그 값을 골라 넘기는가」는 `HomeScreen.test.tsx`, 「히어로가 씨앗만으로
// 무엇을 그리는가」는 `AreaDetailScreen.test.tsx`.
describe('useAreaSnapshot·useCityInfo', () => {
  let queryClient: QueryClient

  function harness(): { wrapper: (props: { children: ReactNode }) => ReactNode } {
    return {
      wrapper: ({ children }) =>
        createElement(QueryClientProvider, { client: queryClient }, children),
    }
  }

  beforeEach(() => {
    fetchAreaPayload.mockReset()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  it('상세 혼잡도를 조회해서 파싱한 값을 돌려준다', async () => {
    fetchAreaPayload.mockResolvedValue({
      body: citydataPayload('강남역'),
      freshness: { ageSeconds: 0, receivedAt: Date.now() },
    })

    const { result } = renderHook(() => useAreaSnapshot('강남역'), harness())

    await waitFor(() => {
      expect(result.current.data).toEqual(snapshot('강남역'))
    })
    expect(fetchAreaPayload).toHaveBeenCalledWith('강남역')
  })

  it('areaName이 없으면 조회하지 않는다', () => {
    const { result } = renderHook(() => useAreaSnapshot(undefined), harness())

    expect(result.current.fetchStatus).toBe('idle')
    expect(fetchAreaPayload).not.toHaveBeenCalled()
  })

  it('같은 명소를 두 훅이 물으면 fetchAreaPayload는 한 번만 나간다', async () => {
    // Task 5의 존재 이유다. 예전에는 useAreaSnapshot이 `/api/citydata`를,
    // useCityInfo가 `/api/cityinfo`를 따로 불렀다 — 이제 캐시 키(['areaPayload', name])를
    // 공유하므로 같은 명소를 여는 순간 한 왕복으로 줄어든다.
    fetchAreaPayload.mockResolvedValue({
      body: citydataPayload('강남역'),
      freshness: { ageSeconds: 5, receivedAt: Date.now() },
    })

    const snap = renderHook(() => useAreaSnapshot('강남역'), harness())
    const info = renderHook(() => useCityInfo('강남역'), harness())

    await waitFor(() => {
      expect(snap.result.current.data).toEqual(snapshot('강남역'))
      expect(info.result.current.data?.areaName).toBe('강남역')
    })
    expect(fetchAreaPayload).toHaveBeenCalledTimes(1)
    // useCityInfo의 select가 `{ ...parseCityInfoResponse(...), freshness: payload.freshness }`
    // 순서인지 잠근다. 스프레드 순서가 뒤집히면 파서 내부 기본값 null이
    // (cityInfoSchema.ts) 실제 나이를 덮어써도 화면은 멀쩡해 보이고 「받은 지
    // N분」만 조용히 사라진다.
    expect(info.result.current.data?.freshness?.ageSeconds).toBe(5)
  })

  it('areaName이 그대로면 재렌더링해도 다시 파싱하지 않는다', async () => {
    // TanStack Query 5는 select를 "함수 참조가 같을 때만" 메모한다
    // (`@tanstack/query-core`의 `queryObserver.js`, `options.select === this.#selectFn`,
    // v5.101.4로 확인). useAreaSnapshot이 select를 useCallback으로 고정하지
    // 않으면 렌더마다 새 참조가 되어 이 비교가 항상 거짓이 되고, 데이터가
    // 안 바뀌어도 렌더마다 parseCitydataResponse가 다시 돈다 — 상세는 홈의
    // 바텀시트 안에 있어 지도를 움직이거나 시트를 드래그할 때마다 리렌더된다.
    fetchAreaPayload.mockResolvedValue({
      body: citydataPayload('강남역'),
      freshness: { ageSeconds: 0, receivedAt: Date.now() },
    })

    const { result, rerender } = renderHook(() => useAreaSnapshot('강남역'), harness())

    await waitFor(() => {
      expect(result.current.data).toEqual(snapshot('강남역'))
    })
    const callsAfterFirstRender = parseCitydataResponse.mock.calls.length
    expect(callsAfterFirstRender).toBeGreaterThan(0)

    rerender()
    rerender()

    // 캐시 데이터도 areaName도 안 바뀌었으니 select 참조가 고정된 채라면
    // 다시 안 돈다. useCallback 없이 인라인 select를 쓰면 이 값이 늘어난다.
    expect(parseCitydataResponse.mock.calls.length).toBe(callsAfterFirstRender)
  })

  it('혼잡도 파싱이 실패해도 도시정보는 멀쩡하다', async () => {
    // Task 5 Step 1에서 확인한 전제(옵저버별 select 격리)가 실제 훅 조합에서도
    // 성립하는지 확인한다. LIVE_PPLTN_STTS가 비면 parseCitydataResponse만 던진다.
    fetchAreaPayload.mockResolvedValue({
      body: brokenCongestionPayload('강남역'),
      freshness: { ageSeconds: 0, receivedAt: Date.now() },
    })

    const snap = renderHook(() => useAreaSnapshot('강남역'), harness())
    const info = renderHook(() => useCityInfo('강남역'), harness())

    await waitFor(() => {
      expect(info.result.current.isSuccess).toBe(true)
    })
    expect(snap.result.current.isError).toBe(true)
    expect(info.result.current.data?.weather?.temperature).toBe(29.1)
  })
})
