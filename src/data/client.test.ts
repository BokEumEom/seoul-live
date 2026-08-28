import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAreaCongestion, fetchAreaPayload } from './client'
import { AREA_NAMES } from './areas'

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
  // 1시간 전」이라는 뭉뚱그린 문구에 머문다.
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
    // 두면 최대 1시간 묵은 값이 「방금」으로 둔갑해 고치기 전보다 나빠진다.
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

// **목록·지도·「오늘의 서울」·「내 주변」이 전부 이 함수 하나에 걸려 있다.**
// 그런데 화면 쪽 테스트는 예외 없이 `useAreaCongestion`을 `vi.mock`으로 갈아
// 끼우고 준비된 값을 먹인다 — 즉 이 describe가 없으면 URL도, 목업 갈래도,
// 실패 문구도 **아무도 안 본다.** `useCachedCityAlerts`가 정확히 그 모양으로
// 조용히 죽은 적이 있다(1736개가 전부 초록인 채로).
//
// 짝이 되던 `fetchAreaSnapshots`에는 이런 테스트가 여섯 개 있었는데, 그 함수는
// Task 7에서 죽은 경로와 함께 지웠다. 남은 쪽이 검사를 물려받는다.
describe('fetchAreaCongestion', () => {
  function stubOk(body: unknown): ReturnType<typeof vi.fn> {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      json: async () => body,
    })
    vi.stubGlobal('fetch', fetchSpy)
    return fetchSpy
  }

  // **이름을 인자로 안 받는 것이 이 경로의 핵심이다.** 인자가 없어야 URL이
  // 하나로 굳어 CDN 캐시를 사용자 전체가 나눠 쓴다. 쿼리스트링이 붙는 순간
  // 캐시가 사용자별로 쪼개지므로, 그 사실을 문자열로 잠근다.
  it('/api/hotspots를 인자 없이 한 번 부른다', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubEnv('VITE_API_BASE_URL', 'https://proxy.example.com')
    const fetchSpy = stubOk({ rows: [{ area_nm: '강남역', area_congest_lvl: '붐빔' }] })

    const parsed = await fetchAreaCongestion()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0][0])).toBe('https://proxy.example.com/api/hotspots')
    expect(parsed).toEqual([{ name: '강남역', congestion: '붐빔' }])
  })

  // 카탈로그에 없는 이름이 섞여 와도 여기서 안 거른다 — 거르는 자리는
  // 호출부이고, 여기서 또 거르면 같은 일을 두 번 한다.
  it('카탈로그에 없는 명소도 그대로 넘긴다', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    stubOk({ rows: [{ area_nm: '없는 명소', area_congest_lvl: '여유' }] })

    expect(await fetchAreaCongestion()).toEqual([{ name: '없는 명소', congestion: '여유' }])
  })

  // **상류가 통째로 바뀌면 화면이 오류를 말해야 한다.** 빈 배열로 접으면 121곳이
  // 전부 「정보 없음」이 되면서 아무 문제 없는 척한다(`hotspotsSchema.test.ts`).
  it('rows가 없는 봉투는 던진다', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    stubOk({ ok: true })

    await expect(fetchAreaCongestion()).rejects.toThrow('rows 배열이 없다')
  })

  it('HTTP 실패는 사용자용 메시지로 바꾼다', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }))

    await expect(fetchAreaCongestion()).rejects.toThrow('혼잡도 정보를 가져오지 못했어요')
  })

  it('네트워크가 죽어도 원본 메시지를 사용자에게 보여주지 않는다', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(fetchAreaCongestion()).rejects.toThrow('혼잡도 정보를 가져오지 못했어요')
  })

  describe('목업 모드', () => {
    it('네트워크를 타지 않고 카탈로그 전체를 준다', async () => {
      vi.stubEnv('VITE_USE_MOCK', 'true')
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)

      const parsed = await fetchAreaCongestion()

      expect(fetchSpy).not.toHaveBeenCalled()
      expect(parsed).toHaveLength(AREA_NAMES.length)
      // 등급이 실제로 채워져야 목업만으로 지도를 볼 수 있다 — 이름만 오면
      // 121곳이 전부 회색 핀이 된다.
      expect(parsed.every((entry) => entry.congestion !== null)).toBe(true)
    })

    // M2 — 목업 경로도 「정보 없음」을 만들 수 있어야 그 상태를 목업만으로
    // 개발·테스트할 수 있다. 여기서는 실패한 명소가 **목록에서 빠지는** 모양이다
    // (`fetchAreaPayload`처럼 던지는 것이 아니다 — 전체 목록이 한 번에 오므로
    // 한 곳 때문에 다 던지면 화면이 텅 빈다).
    it('VITE_MOCK_FAIL_AREAS에 있는 명소만 목록에서 빠진다', async () => {
      vi.stubEnv('VITE_USE_MOCK', 'true')
      vi.stubEnv('VITE_MOCK_FAIL_AREAS', '강남역,경복궁')

      const names = (await fetchAreaCongestion()).map((entry) => entry.name)

      expect(names).not.toContain('강남역')
      expect(names).not.toContain('경복궁')
      expect(names).toHaveLength(AREA_NAMES.length - 2)
    })
  })
})
