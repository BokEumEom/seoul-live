import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAreaSnapshot, fetchAreaSnapshots } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const PAYLOAD = {
  'SeoulRtd.citydata_ppltn': [
    {
      AREA_NM: '강남역',
      AREA_CD: 'POI014',
      AREA_CONGEST_LVL: '붐빔',
      AREA_CONGEST_MSG: '매우 붐벼요.',
      AREA_PPLTN_MIN: '50000',
      AREA_PPLTN_MAX: '52000',
      PPLTN_TIME: '2026-08-03 14:00',
      FCST_PPLTN: [],
    },
  ],
}

describe('fetchAreaSnapshot', () => {
  it('목업 모드에서는 네트워크를 타지 않는다', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const snapshot = await fetchAreaSnapshot('강남역')

    expect(snapshot.name).toBe('강남역')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('실데이터 모드에서는 프록시를 호출한다', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubEnv('VITE_API_BASE_URL', 'https://proxy.example.com')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => PAYLOAD }),
    )

    const snapshot = await fetchAreaSnapshot('강남역')

    expect(snapshot.congestion).toBe('붐빔')
    expect(fetch).toHaveBeenCalledWith(
      'https://proxy.example.com/api/citydata?area=%EA%B0%95%EB%82%A8%EC%97%AD',
      expect.anything(),
    )
  })

  it('HTTP 실패는 사용자용 메시지로 바꾼다', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubEnv('VITE_API_BASE_URL', 'https://proxy.example.com')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }))

    await expect(fetchAreaSnapshot('강남역')).rejects.toThrow('혼잡도 정보를 가져오지 못했어요')
  })

  it('다른 명소 응답이 오면 그대로 던진다', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubEnv('VITE_API_BASE_URL', 'https://proxy.example.com')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => PAYLOAD }),
    )

    await expect(fetchAreaSnapshot('경복궁')).rejects.toThrow()
  })
})

describe('fetchAreaSnapshots', () => {
  it('목업 모드에서 요청한 수만큼 돌려준다', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const results = await fetchAreaSnapshots(['강남역', '경복궁'])
    expect(results).toHaveLength(2)
    expect(results[0]?.name).toBe('강남역')
    expect(results[1]?.name).toBe('경복궁')
  })

  it('한 명소가 실패해도 나머지는 살린다', async () => {
    // 봉투는 위치가 아니라 이름을 키로 쓴다(api/citydata-bulk.ts 참고) — 순서
    // 의존이 없다는 걸 보여주려고 일부러 요청 순서와 다르게 응답을 구성한다.
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubEnv('VITE_API_BASE_URL', 'https://proxy.example.com')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: {
            없는명소: { RESULT: { 'RESULT.CODE': 'INFO-200', 'RESULT.MESSAGE': '해당하는 데이터가 없습니다.' } },
            강남역: PAYLOAD,
          },
        }),
      }),
    )

    const results = await fetchAreaSnapshots(['강남역', '없는명소'])

    expect(results[0]?.congestion).toBe('붐빔')
    expect(results[1]).toBeNull()
  })

  it('요청 URL은 이름을 중복 제거 + 정렬해서 보낸다 (CDN 캐시 키 수렴)', async () => {
    // 호출부가 areaNames를 어떤 순서로·중복 포함해서 넘기든, 실제로 프록시로
    // 나가는 쿼리스트링은 항상 하나로 수렴해야 한다 — 그래야 사용자마다 다른
    // 순서로 보내는 순간 CDN 캐시가 쪼개지는 문제(사용자 수에 비례한 호출량
    // 증가)를 피할 수 있다.
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubEnv('VITE_API_BASE_URL', 'https://proxy.example.com')
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ results: { 강남역: PAYLOAD } }) })
    vi.stubGlobal('fetch', fetchSpy)

    await fetchAreaSnapshots(['경복궁', '강남역', '경복궁'])

    const requestedUrl = fetchSpy.mock.calls[0]?.[0] as string
    const areasParam = new URL(requestedUrl).searchParams.get('areas')
    // 정렬 + 중복 제거된 결과: 강남역이 경복궁보다 코드포인트 순으로 앞선다.
    expect(areasParam).toBe('강남역,경복궁')
  })

  it('반환 순서는 요청부가 넘긴 areaNames 순서를 따른다 (서버 응답 순서와 무관)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubEnv('VITE_API_BASE_URL', 'https://proxy.example.com')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: {
            강남역: PAYLOAD,
            경복궁: {
              'SeoulRtd.citydata_ppltn': [
                { ...PAYLOAD['SeoulRtd.citydata_ppltn'][0], AREA_NM: '경복궁', AREA_CD: 'POI007' },
              ],
            },
          },
        }),
      }),
    )

    const results = await fetchAreaSnapshots(['경복궁', '강남역'])

    expect(results[0]?.name).toBe('경복궁')
    expect(results[1]?.name).toBe('강남역')
  })

  it('봉투 모양이 아예 다르면(null 등) 원본 TypeError가 아니라 안전하게 실패한다', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubEnv('VITE_API_BASE_URL', 'https://proxy.example.com')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => null }))

    // "Cannot read properties of null" 같은 미번역 원본 에러가 아니라, parseBulkEnvelope가
    // 던지는 ZodError로 실패해야 한다. reject 자체가 나는지만 확인한다 — 정확한 에러
    // 타입은 schema.test.ts의 parseBulkEnvelope 테스트가 고정한다.
    await expect(fetchAreaSnapshots(['강남역'])).rejects.toBeTruthy()
  })
})
