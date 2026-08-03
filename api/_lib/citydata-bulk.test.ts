import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../citydata-bulk.js'

// api/_lib/citydata.test.ts와 같은 이유로 이 파일도 api/ 바로 아래가 아니라
// _lib/ 안에 둔다 — Vercel의 밑줄 디렉터리 제외 규칙에 기댄다.

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

describe('citydata-bulk 핸들러', () => {
  it('areas 파라미터가 없으면 400을 돌려준다', async () => {
    const res = createResponse()
    await handler(createRequest({}), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('원시 입력이 MAX_AREAS(40)를 넘으면 400을 돌려준다', async () => {
    const junk = Array.from({ length: 41 }, (_, i) => `z${i}`).join(',')
    const res = createResponse()
    await handler(createRequest({ areas: junk }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  // C1 회귀 방지 — 허용 목록에 없는 문자열은 서울 API를 한 번도 부르지 않는다.
  // 리뷰가 지적한 시나리오를 그대로 재현한다: `areas=z1,...,z40` 같은 40개
  // 문자열 요청.
  it('허용 목록에 없는 이름들은 전부 걸러지고 서울 API를 부르지 않는다', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubEnv('SEOUL_API_KEY', 'test-key')

    const junk = Array.from({ length: 40 }, (_, i) => `z${i}`).join(',')
    const res = createResponse()
    await handler(createRequest({ areas: junk }), res)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('중복된 이름은 한 번만 조회한다', async () => {
    vi.stubEnv('SEOUL_API_KEY', 'test-key')
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchSpy)

    const res = createResponse()
    await handler(createRequest({ areas: '강남역,강남역,강남역' }), res)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(res.json).toHaveBeenCalledWith({ results: { 강남역: { ok: true } } })
  })

  it('이름 키 봉투로 응답한다 (위치가 아니라 이름으로 대응한다)', async () => {
    vi.stubEnv('SEOUL_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }),
    )

    const res = createResponse()
    await handler(createRequest({ areas: '경복궁,강남역' }), res)

    const [{ results }] = res.json.mock.calls[0] as [{ results: Record<string, unknown> }]
    expect(Object.keys(results).toSorted()).toEqual(['강남역', '경복궁'])
  })

  // C2 회귀 방지 — 전부 실패하면 no-store + 502.
  it('전부 실패하면 no-store와 502를 돌려준다', async () => {
    vi.stubEnv('SEOUL_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    const res = createResponse()
    await handler(createRequest({ areas: '강남역,경복궁' }), res)

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
    expect(res.status).toHaveBeenCalledWith(502)
  })

  // C2 회귀 방지 — 일부만 실패하면 정상 TTL 유지.
  it('일부만 실패하면 정상 TTL을 유지하고 200을 돌려준다', async () => {
    vi.stubEnv('SEOUL_API_KEY', 'test-key')
    vi.stubEnv('CACHE_TTL_SECONDS', '600')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes(encodeURIComponent('강남역'))) {
          return { ok: true, json: async () => ({ ok: true }) }
        }
        return { ok: false, status: 500 }
      }),
    )

    const res = createResponse()
    await handler(createRequest({ areas: '강남역,경복궁' }), res)

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, s-maxage=600, stale-while-revalidate=1200',
    )
    expect(res.status).toHaveBeenCalledWith(200)
    const [{ results }] = res.json.mock.calls[0] as [{ results: Record<string, unknown> }]
    expect(results['강남역']).toEqual({ ok: true })
    expect(results['경복궁']).toBeNull()
  })
})
