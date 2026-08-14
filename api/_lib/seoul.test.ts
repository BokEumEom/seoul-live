import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  apiKey,
  cacheTtlSeconds,
  cityInfoCacheTtlSeconds,
  fetchArea,
  redactApiKey,
} from './seoul.js'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('cacheTtlSeconds', () => {
  it('환경변수가 없으면 3600을 돌려준다', () => {
    vi.stubEnv('CACHE_TTL_SECONDS', undefined)
    expect(cacheTtlSeconds()).toBe(3_600)
  })

  it('환경변수가 숫자가 아니면 3600을 돌려준다', () => {
    vi.stubEnv('CACHE_TTL_SECONDS', '이상한값')
    expect(cacheTtlSeconds()).toBe(3_600)
  })

  it('환경변수가 0 이하이면 3600을 돌려준다', () => {
    vi.stubEnv('CACHE_TTL_SECONDS', '0')
    expect(cacheTtlSeconds()).toBe(3_600)

    vi.stubEnv('CACHE_TTL_SECONDS', '-100')
    expect(cacheTtlSeconds()).toBe(3_600)
  })

  it('정상적인 양의 정수면 그 값을 돌려준다', () => {
    vi.stubEnv('CACHE_TTL_SECONDS', '300')
    expect(cacheTtlSeconds()).toBe(300)
  })

  // I3: delta-seconds는 정수만 유효하다(RFC 9111 §1.2.2). 소수를 그대로 통과시키면
  // `s-maxage=300.5`가 만들어지고, 이를 거부하는 CDN/파서는 디렉티브가 없는 것으로
  // 취급해 캐시가 통째로 꺼진다 — 겉으로는 "동작하는" 숫자처럼 보여서 위험하다.
  it('소수는 3600을 돌려준다 (delta-seconds는 정수만 유효하다)', () => {
    vi.stubEnv('CACHE_TTL_SECONDS', '300.5')
    expect(cacheTtlSeconds()).toBe(3_600)
  })
})

// 「더보기」와 혼잡도가 같은 하루 1,000회를 나눠 쓴다. 더보기 쪽 TTL을 따로
// 늘려 호출량을 줄일 수 있어야 한다 — 근거는 seoul.ts의 주석.
describe('cityInfoCacheTtlSeconds', () => {
  it('전용 환경변수가 있으면 그 값을 쓴다', () => {
    vi.stubEnv('CACHE_TTL_SECONDS', '3600')
    vi.stubEnv('CITYINFO_CACHE_TTL_SECONDS', '10800')
    expect(cityInfoCacheTtlSeconds()).toBe(10_800)
  })

  it('전용 환경변수가 없으면 3시간으로 떨어진다', () => {
    // **혼잡도와 같은 TTL로 떨어지면 안 된다.** 도시정보는 이제 상세를 열 때마다
    // 자동으로 조회되므로 호출량이 사용자 행동에 열려 있다. 혼잡도의 1시간을
    // 따라가면 최악 30곳 × 24 = 720회/일이 되고, 혼잡도의 720회와 합쳐
    // 1,440회로 하루 1,000회 한도를 넘긴다. 3시간이면 240회라 합계 960회다.
    vi.stubEnv('CACHE_TTL_SECONDS', '600')
    vi.stubEnv('CITYINFO_CACHE_TTL_SECONDS', undefined)
    expect(cityInfoCacheTtlSeconds()).toBe(10_800)
  })

  it('혼잡도를 더 길게 캐시하면 도시정보는 그보다 짧아지지 않는다', () => {
    // 도시정보는 혼잡도와 같은 한도를 쓰면서 더 느리게 변한다(날씨는 정시,
    // 문화행사는 하루 단위). 혼잡도보다 자주 받을 이유가 없다 — 운영자가
    // 한도 때문에 혼잡도를 6시간으로 늘렸는데 도시정보만 3시간이면
    // 도시정보가 더 비싼 쪽이 된다.
    vi.stubEnv('CACHE_TTL_SECONDS', '21600')
    vi.stubEnv('CITYINFO_CACHE_TTL_SECONDS', undefined)
    expect(cityInfoCacheTtlSeconds()).toBe(21_600)
  })

  it('소수·0 이하는 무시한다 (delta-seconds는 양의 정수만 유효하다)', () => {
    vi.stubEnv('CACHE_TTL_SECONDS', '600')

    vi.stubEnv('CITYINFO_CACHE_TTL_SECONDS', '300.5')
    expect(cityInfoCacheTtlSeconds()).toBe(10_800)

    vi.stubEnv('CITYINFO_CACHE_TTL_SECONDS', '-1')
    expect(cityInfoCacheTtlSeconds()).toBe(10_800)
  })
})

describe('apiKey', () => {
  it('SEOUL_API_KEY가 없으면 던진다', () => {
    vi.stubEnv('SEOUL_API_KEY', undefined)
    expect(() => apiKey()).toThrow()
  })

  it('SEOUL_API_KEY가 있으면 그 값을 돌려준다', () => {
    vi.stubEnv('SEOUL_API_KEY', 'secret-key-123')
    expect(apiKey()).toBe('secret-key-123')
  })
})

// I4 우선순위 1 — redactApiKey는 키 유출을 막는 게 존재 이유인 함수인데 테스트가
// 없었다. 순수 함수 자체와, 그 함수가 실제로 fetchArea의 에러 경로에 배선돼 있는지
// 둘 다 검증한다.
describe('redactApiKey', () => {
  it('메시지에 포함된 원본 키를 [REDACTED]로 바꾼다', () => {
    expect(redactApiKey('http://x/secret-key-123/json', 'secret-key-123')).toBe(
      'http://x/[REDACTED]/json',
    )
  })

  it('URL 인코딩된 형태의 키도 바꾼다 (M1)', () => {
    const key = 'a+b/c'
    const encoded = encodeURIComponent(key)
    expect(redactApiKey(`Failed to parse URL from .../${encoded}/json`, key)).not.toContain(
      encoded,
    )
  })

  it('키가 빈 문자열이면 메시지를 그대로 돌려준다', () => {
    expect(redactApiKey('아무 메시지', '')).toBe('아무 메시지')
  })

  it('키가 없는 메시지는 그대로 둔다', () => {
    expect(redactApiKey('키가 안 섞인 메시지', 'secret-key-123')).toBe('키가 안 섞인 메시지')
  })
})

describe('fetchArea', () => {
  it('URL에 인증키를 담아 서울 API를 호출한다', async () => {
    vi.stubEnv('SEOUL_API_KEY', 'secret-key-123')
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchSpy)

    await fetchArea('강남역')

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain('secret-key-123')
    expect(calledUrl).toContain(encodeURIComponent('강남역'))
  })

  it('상류가 실패하면(!ok) 상태 코드를 담되 키는 메시지에 없다', async () => {
    vi.stubEnv('SEOUL_API_KEY', 'secret-key-123')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    await expect(fetchArea('강남역')).rejects.toThrow(/500/)
    try {
      await fetchArea('강남역')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect((error as Error).message).not.toContain('secret-key-123')
    }
  })

  // 이게 이 파일에서 가장 중요한 테스트다: fetch 자체가 키가 담긴 URL을 그대로
  // 포함한 메시지로 거부하는 상황(undici의 "Failed to parse URL from ..." 패턴)을
  // 재현하고, fetchArea가 던지는 최종 에러에는 키가 전혀 남지 않는지 확인한다.
  it('fetch가 키가 담긴 URL로 거부해도, fetchArea가 던지는 에러에는 키가 없다', async () => {
    vi.stubEnv('SEOUL_API_KEY', 'secret-key-123')
    const urlWithKey =
      'http://openapi.seoul.go.kr:8088/secret-key-123/json/citydata_ppltn/1/5/%EA%B0%95%EB%82%A8%EC%97%AD'
    const leaky = new TypeError(`Failed to parse URL from ${urlWithKey}`)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(leaky))

    try {
      await fetchArea('강남역')
      expect.unreachable('should have thrown')
    } catch (error) {
      const message = (error as Error).message
      expect(message).not.toContain('secret-key-123')
      expect(message).toContain('[REDACTED]')
      // error.name은 리댁션 후에도 남아 있어야 진단(타임아웃/DNS/HTTP 실패 구분)이 된다.
      expect(message).toContain('[TypeError]')
    }
  })
})
