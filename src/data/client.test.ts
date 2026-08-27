import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAreaPayload } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

// citydata 봉투. fetchAreaPayload는 이 안을 파싱하지 않고 그대로 넘긴다 —
// 파싱(혼잡도·도시정보 양쪽)은 이제 queries.ts의 select가 한다.
const CITY_PAYLOAD = {
  CITYDATA: {
    AREA_NM: '강남역',
    AREA_CD: 'POI014',
    WEATHER_STTS: [{ TEMP: '29.1', AIR_IDX: '보통' }],
  },
}

describe('fetchAreaPayload', () => {
  it('목업 모드에서는 네트워크를 타지 않는다', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const payload = await fetchAreaPayload('강남역')

    expect(fetchSpy).not.toHaveBeenCalled()
    // body는 파싱하지 않고 그대로 넘긴다 — 목업이 실데이터와 같은 `citydata`
    // 봉투(`CITYDATA.AREA_NM`)를 주는지, select(queries.ts)가 먹을 모양인지 확인한다.
    const body = payload.body as { CITYDATA?: { AREA_NM?: string } }
    expect(body.CITYDATA?.AREA_NM).toBe('강남역')
    // 목업에는 CDN도 서울 API도 없으므로 나이가 0이다 — 「모른다」가 아니라
    // 실제로 아는 사실이다.
    expect(payload.freshness?.ageSeconds).toBe(0)
  })

  it('/api/cityinfo 하나만 부르고 나이를 함께 준다', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubEnv('VITE_API_BASE_URL', 'https://proxy.example.com')
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ Age: '42' }),
      json: async () => ({ CITYDATA: { AREA_NM: '강남역' } }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const result = await fetchAreaPayload('강남역')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/cityinfo?area=')
    // **`citydata_ppltn` 프록시는 더 이상 안 부른다.**
    expect(String(fetchSpy.mock.calls[0][0])).not.toContain('/api/citydata?')
    expect(result.freshness?.ageSeconds).toBe(42)
  })

  it('HTTP 실패는 사용자용 메시지로 바꾼다', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubEnv('VITE_API_BASE_URL', 'https://proxy.example.com')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }))

    await expect(fetchAreaPayload('강남역')).rejects.toThrow('도시 정보를 가져오지 못했어요')
  })

  // M2 — 목업 경로도 실패를 흉내 낼 수 있어야 T17/T18의 "정보 없음" 상태를
  // 목업만으로 개발·테스트할 수 있다.
  it('VITE_MOCK_FAIL_AREAS에 있는 명소는 목업 모드에서도 실패한다', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    vi.stubEnv('VITE_MOCK_FAIL_AREAS', '강남역,경복궁')

    await expect(fetchAreaPayload('강남역')).rejects.toThrow()
  })

  it('VITE_MOCK_FAIL_AREAS에 없는 명소는 목업 모드에서 평소대로 성공한다', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    vi.stubEnv('VITE_MOCK_FAIL_AREAS', '경복궁')

    const payload = await fetchAreaPayload('강남역')
    expect(payload.freshness).not.toBeNull()
  })

  // 프록시가 CDN 캐시에서 준 응답이면 얼마나 묵었는지 `Age`에 실려 온다. 그 값이
  // 화면의 「12분 전 값이에요」가 되는 유일한 근거다 — 없으면 세 절이 「최대
  // 3시간 전」이라는 뭉뚱그린 문구에 머문다.
  describe('응답의 나이', () => {
    function stubCityFetch(headers: Headers) {
      vi.stubEnv('VITE_USE_MOCK', 'false')
      vi.stubEnv('VITE_API_BASE_URL', 'https://proxy.example.com')
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, headers, json: async () => CITY_PAYLOAD }),
      )
    }

    it('Age 헤더를 받은 시각과 함께 싣는다', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-18T09:00:00Z'))
      stubCityFetch(new Headers({ Age: '742' }))

      const payload = await fetchAreaPayload('강남역')

      expect(payload.freshness).toEqual({ ageSeconds: 742, receivedAt: Date.now() })
      vi.useRealTimers()
    })

    // **0으로 떨어뜨리면 안 된다.** 프록시에 `Access-Control-Expose-Headers`가
    // 아직 안 배포됐거나 CDN을 안 거친 응답이면 이 헤더가 없는데, 그때 0으로
    // 두면 최대 3시간 묵은 값이 「방금」으로 둔갑해 고치기 전보다 나빠진다.
    it('Age 헤더가 없으면 모른다고 한다', async () => {
      stubCityFetch(new Headers())

      expect((await fetchAreaPayload('강남역')).freshness).toBeNull()
    })

    it('Age가 숫자가 아니면 모른다고 한다', async () => {
      // `Number('')`는 0이고 `Number('1e1')`은 10이다 — 맨몸 `Number()`를 쓰면
      // 「없는 값」이 아니라 **그럴듯한 틀린 값**이 화면에 뜬다(AGENTS.md의 규칙).
      stubCityFetch(new Headers({ Age: '1e1' }))

      expect((await fetchAreaPayload('강남역')).freshness).toBeNull()
    })

    it('목업은 방금 만든 값이다', async () => {
      vi.stubEnv('VITE_USE_MOCK', 'true')

      const payload = await fetchAreaPayload('강남역')

      expect(payload.freshness?.ageSeconds).toBe(0)
    })
  })
})
