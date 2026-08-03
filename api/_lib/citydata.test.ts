import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../citydata.js'

// Vercel은 밑줄(_)로 시작하는 디렉터리를 함수 라우팅에서 제외한다. 이 파일이
// api/_lib/ 안에 있는 이유가 그거다 — describe/it 같은 vitest 전역을 쓰는 이
// 파일이 api/ 바로 아래 있었다면, Vercel이 이걸 실제 엔드포인트로 오인해
// 번들링을 시도하다가 배포가 깨질 수 있다.

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

describe('citydata 핸들러', () => {
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

  // C1 회귀 방지 — 허용 목록에 없는 이름은 서울 API까지 가지 않는다.
  it('허용 목록에 없는 명소는 400으로 거부하고 서울 API를 호출하지 않는다', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubEnv('SEOUL_API_KEY', 'test-key')

    const res = createResponse()
    await handler(createRequest({ area: '없는명소' }), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('허용된 명소는 정상 TTL 캐시 헤더와 함께 200을 돌려준다', async () => {
    vi.stubEnv('SEOUL_API_KEY', 'test-key')
    vi.stubEnv('CACHE_TTL_SECONDS', '600')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }),
    )

    const res = createResponse()
    await handler(createRequest({ area: '강남역' }), res)

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, s-maxage=600, stale-while-revalidate=1200',
    )
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  // C2와 짝을 이루는 단일 명소 쪽 회귀 방지 — 이쪽은 원래도 정상이었지만
  // (실패 시 캐시 헤더 자체를 안 붙였다) 이제 no-store를 명시적으로 붙인다.
  it('상류 실패 시 no-store와 502를 돌려준다', async () => {
    vi.stubEnv('SEOUL_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    const res = createResponse()
    await handler(createRequest({ area: '강남역' }), res)

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
    expect(res.status).toHaveBeenCalledWith(502)
    expect(res.json).toHaveBeenCalledWith({ error: '혼잡도 정보를 가져오지 못했습니다.' })
  })
})
