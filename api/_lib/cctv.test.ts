import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../cctv.js'

// cityinfo.test.ts와 같은 이유로 api/_lib/ 안에 둔다 — Vercel은 밑줄로 시작하는
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

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('cctv 핸들러', () => {
  it('OPTIONS는 CORS 헤더와 함께 204로 응답한다', async () => {
    const res = createResponse()
    await handler(createRequest({}, 'OPTIONS'), res)

    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*')
    expect(res.status).toHaveBeenCalledWith(204)
  })

  it('area 파라미터가 없으면 400을 돌려준다', async () => {
    const res = createResponse()
    await handler(createRequest({}), res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  // 쿼터가 아니라 **남의 서버를 향한 통로**를 막는 것이다. 임의 문자열이
  // 통과하면 우리가 SeoulRtd로 무제한 요청을 흘려보내는 중계기가 된다.
  it('허용 목록에 없는 명소는 400으로 거부하고 상류를 호출하지 않는다', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const res = createResponse()
    await handler(createRequest({ area: '없는명소' }), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('행을 그대로 돌려주고 기본 1시간으로 캐시한다', async () => {
    stubUpstream([{ src: '', STRMID: 'L1', XCOORD: '127', YCOORD: '37.5', CCTVNAME: '가' }])

    const res = createResponse()
    await handler(createRequest({ area: '강남역' }), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=7200',
    )
  })

  it('전용 TTL 환경변수를 쓰면 그 값으로 캐시한다', async () => {
    vi.stubEnv('CCTV_CACHE_TTL_SECONDS', '600')
    stubUpstream([])

    const res = createResponse()
    await handler(createRequest({ area: '강남역' }), res)

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, s-maxage=600, stale-while-revalidate=1200',
    )
  })

  // **이 기능의 안전장치다.** 상류는 문서화된 API가 아니라 언제든 막힐 수 있는데,
  // 그때 502를 올리면 상세 화면에 오류가 떠서 멀쩡한 나머지 정보까지 고장 난
  // 것처럼 보인다. 30곳 중 10곳은 애초에 빈 배열이 정상이라, 빈 목록은
  // 사용자에게 이미 익숙한 상태다.
  it('상류가 실패해도 200과 빈 배열로 접는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('상류 죽음')))

    const res = createResponse()
    await handler(createRequest({ area: '강남역' }), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith([])
  })

  // 실패를 캐시하면 상류가 돌아와도 TTL이 끝날 때까지 빈 목록이 굳는다.
  it('상류 실패는 캐시하지 않는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('상류 죽음')))

    const res = createResponse()
    await handler(createRequest({ area: '강남역' }), res)

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
  })

  // 서울 OpenAPI 쿼터를 나눠 쓰지 않는다는 사실을 못박는다. 인증키를 요구하게
  // 되는 순간 쿼터 표(AGENTS.md)가 통째로 틀어진다.
  it('SEOUL_API_KEY가 없어도 동작한다', async () => {
    vi.stubEnv('SEOUL_API_KEY', '')
    stubUpstream([])

    const res = createResponse()
    await handler(createRequest({ area: '강남역' }), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith([])
  })
})
