import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { AreaSnapshot } from '../domain/types'
import { shouldRetry, useAreaSnapshot } from './queries'
import { AreaNameMismatchError, SeoulApiError } from './schema'
import { ProxyResponseError } from './client'

// ProxyResponseError는 진짜가 필요하다(위 재시도 테스트가 instanceof로 가른다).
// 망에 나가는 함수만 바꿔 낀다.
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  fetchAreaSnapshot: vi.fn(),
}))

const client = await import('./client')
const fetchAreaSnapshot = vi.mocked(client.fetchAreaSnapshot)

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

describe('useAreaSnapshot', () => {
  let queryClient: QueryClient

  function harness(): { wrapper: (props: { children: ReactNode }) => ReactNode } {
    return {
      wrapper: ({ children }) =>
        createElement(QueryClientProvider, { client: queryClient }, children),
    }
  }

  /** 홈 목록이 방금 받아 둔 것. queryKey의 두 번째 칸이 곧 자리 번호표다. */
  function seedList(names: readonly string[], data: readonly (AreaSnapshot | null)[]): void {
    queryClient.setQueryData(['areas', names], data)
  }

  beforeEach(() => {
    fetchAreaSnapshot.mockReset()
    fetchAreaSnapshot.mockResolvedValue(snapshot('강남역'))
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  it('목록이 이미 받아 둔 명소는 기다리지 않고 곧바로 보여준다', () => {
    // **이 테스트가 이 훅의 존재 이유다.** 홈의 일괄 조회(`useAreaSnapshots`)가
    // 30곳을 통째로 받아 두는데, 상세는 그중 한 곳을 **다시** 물었다. 이미
    // 메모리에 있는 값을 받으려고 왕복 한 번을 더 기다린 것이고, 그동안 화면에는
    // 스켈레톤이 떴다 — 서울 인파레이더가 즉시 열리는 것과 갈리는 자리다.
    // 게다가 그 왕복은 CDN 캐시 키가 따로라 서울 API 호출을 **또** 썼다.
    seedList(['강남역', '광화문·덕수궁'], [snapshot('강남역'), snapshot('광화문·덕수궁')])

    const { result } = renderHook(() => useAreaSnapshot('광화문·덕수궁'), harness())

    // 첫 렌더에 이미 값이 있어야 한다. waitFor로 감싸면 "한 틱 뒤에 왔다"도
    // 통과해버려 스켈레톤이 뜨는 것을 못 잡는다.
    expect(result.current.isPending).toBe(false)
    expect(result.current.data?.name).toBe('광화문·덕수궁')
    expect(fetchAreaSnapshot).not.toHaveBeenCalled()
  })

  it('목록에 없는 명소는 평소대로 조회한다', async () => {
    seedList(['광화문·덕수궁'], [snapshot('광화문·덕수궁')])

    const { result } = renderHook(() => useAreaSnapshot('강남역'), harness())

    await waitFor(() => {
      expect(result.current.data?.name).toBe('강남역')
    })
    expect(fetchAreaSnapshot).toHaveBeenCalledWith('강남역')
  })

  it('목록에서 그 자리가 비어 있으면 상세에서 다시 조회한다', async () => {
    // 일괄 조회는 명소 하나가 실패하면 그 자리를 null로 돌려준다(client.ts).
    // null을 「받아 둔 값」으로 세면 상세가 영영 빈 화면이 된다.
    seedList(['강남역', '광화문·덕수궁'], [null, snapshot('광화문·덕수궁')])

    const { result } = renderHook(() => useAreaSnapshot('강남역'), harness())

    await waitFor(() => {
      expect(result.current.data?.name).toBe('강남역')
    })
    expect(fetchAreaSnapshot).toHaveBeenCalledWith('강남역')
  })

  it('목록이 오래됐으면 보여주면서 뒤에서 새로 받는다', async () => {
    // 값을 즉시 보여주는 것과 최신으로 유지하는 것은 양자택일이 아니다.
    // 일괄 조회가 5분을 넘겼으면 화면은 옛 값으로 즉시 그리되 조회는 나가야 한다.
    seedList(['강남역'], [snapshot('강남역')])
    const state = queryClient.getQueryState(['areas', ['강남역']])
    // 6분 전에 받은 것으로 되돌린다. staleTime(5분)을 넘긴 상태를 만드는 것이다.
    if (state !== undefined) {
      state.dataUpdatedAt = state.dataUpdatedAt - 6 * 60 * 1_000
    }

    const { result } = renderHook(() => useAreaSnapshot('강남역'), harness())

    expect(result.current.isPending).toBe(false) // 스켈레톤 없이 즉시
    await waitFor(() => {
      expect(fetchAreaSnapshot).toHaveBeenCalledWith('강남역') // 그래도 새로 받는다
    })
  })
})
