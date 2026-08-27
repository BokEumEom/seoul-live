import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../ppltn.js'

// cctv.test.ts와 같은 이유로 api/_lib/ 안에 둔다 — Vercel은 밑줄로 시작하는
// 디렉터리를 함수 라우팅에서 제외하므로 테스트가 엔드포인트로 오인되지 않는다.

type MockResponse = VercelResponse & {
  setHeader: ReturnType<typeof vi.fn>
  status: ReturnType<typeof vi.fn>
  json: ReturnType<typeof vi.fn>
  end: ReturnType<typeof vi.fn>
}

function createRequest(query: Record<string, string>, method = 'GET'): VercelRequest {
  return { method, query } as unknown as VercelRequest
}

function createResponse(): MockResponse {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
    end: vi.fn(),
  }
  res.status.mockReturnValue(res)
  res.json.mockReturnValue(res)
  res.end.mockReturnValue(res)
  return res as unknown as MockResponse
}

/** 세션 부트스트랩 + 본 요청. 상류가 요청을 둘 받는다(`seoulRtd.ts`). */
function stubUpstream(rows: unknown) {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'set-cookie': 'JSESSIONID=ABC' }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => rows,
      }),
  )
}

const ROWS = [{ hotspot_nm: '강남역', ONEHOUR_RATE_UP_DOWN: 'up', ONEHOUR_RATE: '7.0%' }]

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ppltn 핸들러', () => {
  it('OPTIONS는 CORS 헤더와 함께 204로 응답한다', async () => {
    const res = createResponse()
    await handler(createRequest({}, 'OPTIONS'), res)

    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*')
    expect(res.status).toHaveBeenCalledWith(204)
  })

  it('area가 없으면 400이다', async () => {
    const res = createResponse()
    await handler(createRequest({}), res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  /**
   * **서울 쿼터가 안 걸린 경로라도 허용 목록은 필수다.** 임의 문자열이 통과하면
   * 남의 서버(SeoulRtd)로 우리가 무제한 요청을 흘려보내는 통로가 된다.
   */
  it('카탈로그에 없는 명소는 400이고 상류를 안 부른다', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = createResponse()

    await handler(createRequest({ area: '없는명소' }), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('상류 응답을 그대로 넘긴다', async () => {
    stubUpstream(ROWS)
    const res = createResponse()

    await handler(createRequest({ area: '강남역' }), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(ROWS)
  })

  /**
   * **상세 혼잡도와 같은 시계다.** 이 값은 인구 탭에서 인원수 바로 옆에 놓이므로
   * 시계를 따로 두면 한 화면의 두 숫자가 서로 다른 순간을 말한다. 상류가 5분마다
   * 갱신된다고 5분을 고르면 그 일이 난다.
   */
  it('상세 혼잡도와 같은 TTL로 캐시한다', async () => {
    vi.stubEnv('CACHE_TTL_SECONDS', '1800')
    stubUpstream(ROWS)
    const res = createResponse()

    await handler(createRequest({ area: '강남역' }), res)

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, s-maxage=1800, stale-while-revalidate=3600',
    )
  })

  /**
   * **실패를 502로 올리지 않는다.** 이 상류는 문서화된 API가 아니라 조용히
   * 깨지는데, 그때 인구 탭에 오류가 뜨면 공식 API에서 멀쩡히 온 인원수·구성비까지
   * 고장 난 것처럼 보인다. 관대한 리더가 빈 배열을 세 칸 `null`로 읽는다.
   */
  it('상류가 실패해도 200 + 빈 배열이다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = createResponse()

    await handler(createRequest({ area: '강남역' }), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith([])
  })

  // 실패를 캐시하면 상류가 돌아와도 TTL이 끝날 때까지 빈 절이 된다.
  it('실패는 캐시하지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = createResponse()

    await handler(createRequest({ area: '강남역' }), res)

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
  })
})
