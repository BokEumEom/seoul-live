import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../cityinfo.js'

// citydata.test.ts와 같은 이유로 api/_lib/ 안에 둔다 — Vercel은 밑줄로 시작하는
// 디렉터리를 함수 라우팅에서 제외하므로, 테스트 파일이 엔드포인트로 오인되지 않는다.

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

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('cityinfo 핸들러', () => {
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

  // 혼잡도 엔드포인트와 같은 이유(C1) — 허용 목록이 없으면 임의 문자열마다 별개의
  // 캐시 키가 생기고 하루 1,000회 한도가 몇 번의 요청으로 사라진다.
  it('허용 목록에 없는 명소는 400으로 거부하고 서울 API를 호출하지 않는다', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubEnv('SEOUL_API_KEY', 'test-key')

    const res = createResponse()
    await handler(createRequest({ area: '없는명소' }), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('citydata_ppltn이 아니라 citydata 서비스를 호출한다', async () => {
    vi.stubEnv('SEOUL_API_KEY', 'test-key')
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ CITYDATA: {} }) })
    vi.stubGlobal('fetch', fetchSpy)

    await handler(createRequest({ area: '강남역' }), createResponse())

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain('/citydata/')
    expect(calledUrl).not.toContain('citydata_ppltn')
  })

  it('전용 TTL 환경변수를 쓰면 그 값으로 캐시한다', async () => {
    vi.stubEnv('SEOUL_API_KEY', 'test-key')
    vi.stubEnv('CACHE_TTL_SECONDS', '600')
    vi.stubEnv('CITYINFO_CACHE_TTL_SECONDS', '10800')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ CITYDATA: {} }) }),
    )

    const res = createResponse()
    await handler(createRequest({ area: '강남역' }), res)

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, s-maxage=10800, stale-while-revalidate=21600',
    )
  })

  it('전용 TTL이 없으면 혼잡도와 같은 TTL로 캐시한다', async () => {
    vi.stubEnv('SEOUL_API_KEY', 'test-key')
    vi.stubEnv('CACHE_TTL_SECONDS', '600')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ CITYDATA: {} }) }),
    )

    const res = createResponse()
    await handler(createRequest({ area: '강남역' }), res)

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, s-maxage=600, stale-while-revalidate=1200',
    )
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ CITYDATA: {} })
  })

  it('상류 실패 시 no-store와 502를 돌려준다', async () => {
    vi.stubEnv('SEOUL_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    const res = createResponse()
    await handler(createRequest({ area: '강남역' }), res)

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
    expect(res.status).toHaveBeenCalledWith(502)
    expect(res.json).toHaveBeenCalledWith({ error: '도시 정보를 가져오지 못했습니다.' })
  })

  // 응답에 원본 예외를 실으면 인증키가 담긴 URL이 그대로 사용자에게 나갈 수 있다.
  it('실패 응답에 원본 예외를 담지 않는다', async () => {
    vi.stubEnv('SEOUL_API_KEY', 'secret-key-123')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to parse URL from .../secret-key-123/json')),
    )

    const res = createResponse()
    await handler(createRequest({ area: '강남역' }), res)

    const body = JSON.stringify(res.json.mock.calls.at(-1)?.[0])
    expect(body).not.toContain('secret-key-123')
  })
})
