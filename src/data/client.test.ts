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
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubEnv('VITE_API_BASE_URL', 'https://proxy.example.com')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [PAYLOAD, { RESULT: { 'RESULT.CODE': 'INFO-200', 'RESULT.MESSAGE': '해당하는 데이터가 없습니다.' } }] }),
      }),
    )

    const results = await fetchAreaSnapshots(['강남역', '없는명소'])

    expect(results[0]?.congestion).toBe('붐빔')
    expect(results[1]).toBeNull()
  })
})
