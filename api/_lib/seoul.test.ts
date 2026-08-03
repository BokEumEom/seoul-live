import { afterEach, describe, expect, it, vi } from 'vitest'
import { cacheTtlSeconds } from './seoul.js'

afterEach(() => {
  vi.unstubAllEnvs()
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
