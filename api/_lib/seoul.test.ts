import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiKey, cacheTtlSeconds, fetchArea, redactApiKey } from './seoul.js'

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
