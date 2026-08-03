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
})
