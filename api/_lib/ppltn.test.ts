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

/**
 * **요청이 셋이다.** 세션 부트스트랩 한 번 + 엔드포인트 둘. URL로 갈라 응답한다 —
 * 호출 순서에 기대면 병렬로 부르는 두 요청의 차례가 바뀌는 날 조용히 어긋난다.
 */
function stubUpstream(ppltn: unknown, congest: unknown) {
  const fetchMock = vi.fn((url: string) => {
    if (url.includes('/api/ppltn_congest')) {
      return Promise.resolve(json(congest))
    }
    if (url.includes('/api/ppltn')) {
      return Promise.resolve(json(ppltn))
    }
    // 지도 페이지 = 세션 부트스트랩.
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers({ 'set-cookie': 'JSESSIONID=ABC' }),
      text: async () => '',
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function json(body: unknown) {
  return { ok: true, status: 200, headers: new Headers(), json: async () => body }
}

const PPLTN = [{ hotspot_nm: '강남역', ONEHOUR_RATE_UP_DOWN: 'up', ONEHOUR_RATE: '7.0%' }]
const CONGEST = [{ hotspot_nm: '강남역', time_cd: '11시|현재', people_value: '10|20' }]

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

  it('두 엔드포인트를 한 봉투로 넘긴다', async () => {
    stubUpstream(PPLTN, CONGEST)
    const res = createResponse()

    await handler(createRequest({ area: '강남역' }), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ppltn: PPLTN, congest: CONGEST })
  })

  /**
   * **세션을 한 번만 연다.** 둘을 따로 부르면 부트스트랩이 두 번이라 남의 서버에
   * 요청이 넷 나간다. 이건 화면에 아무 표시도 안 나는 종류의 낭비라 수로 잠근다.
   */
  it('상류 요청이 셋이다 — 부트스트랩 하나에 호출 둘', async () => {
    const fetchMock = stubUpstream(PPLTN, CONGEST)

    await handler(createRequest({ area: '강남역' }), createResponse())

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const urls = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(urls.filter((url) => url.includes('/map?'))).toHaveLength(1)
  })

  /**
   * **상세 혼잡도와 같은 시계다.** 이 값은 인구 탭에서 인원수 바로 옆에 놓이므로
   * 시계를 따로 두면 한 화면의 두 숫자가 서로 다른 순간을 말한다. 상류가 5분마다
   * 갱신된다고 5분을 고르면 그 일이 난다.
   */
  it('상세 혼잡도와 같은 TTL로 캐시한다', async () => {
    vi.stubEnv('CACHE_TTL_SECONDS', '1800')
    stubUpstream(PPLTN, CONGEST)
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
   * 고장 난 것처럼 보인다. 관대한 리더가 빈 봉투를 세 칸 `null`과 빈 흐름으로 읽는다.
   */
  it('상류가 실패해도 200 + 빈 봉투다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = createResponse()

    await handler(createRequest({ area: '강남역' }), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ppltn: [], congest: [] })
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
