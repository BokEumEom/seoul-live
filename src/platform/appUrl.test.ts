import { afterEach, describe, expect, it, vi } from 'vitest'
import { appBaseUrl, shareUrl } from './appUrl'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('appBaseUrl', () => {
  it('설정된 공개 주소를 그대로 쓴다', () => {
    vi.stubEnv('VITE_PUBLIC_APP_URL', 'https://seoul-live.vercel.app')
    expect(appBaseUrl()).toBe('https://seoul-live.vercel.app')
  })

  it('앞뒤 공백은 떼고 쓴다', () => {
    // `.env` 파일에 손으로 적는 값이라 흔한 실수다.
    vi.stubEnv('VITE_PUBLIC_APP_URL', '  https://seoul-live.vercel.app  ')
    expect(appBaseUrl()).toBe('https://seoul-live.vercel.app')
  })

  it('설정이 없으면 지금 열려 있는 주소를 쓴다', () => {
    vi.stubEnv('VITE_PUBLIC_APP_URL', '')
    // jsdom의 기본 오리진이다. Vercel 웹에서는 이 갈래가 정답이다.
    expect(appBaseUrl()).toBe('http://localhost:3000/')
  })

  it('http(s) 절대 주소가 아니면 무시하고 지금 주소로 떨어진다', () => {
    // **이걸 그대로 쓰면 공유 링크가 조용히 깨진다.** 받은 사람은 아무 데도
    // 못 가고, 보낸 사람은 무엇이 잘못됐는지 알 길이 없다.
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubEnv('VITE_PUBLIC_APP_URL', 'seoul-live.vercel.app')

    expect(appBaseUrl()).toBe('http://localhost:3000/')
    expect(error).toHaveBeenCalled()
  })
})

describe('shareUrl', () => {
  it('명소 주소를 만든다', () => {
    vi.stubEnv('VITE_PUBLIC_APP_URL', 'https://seoul-live.vercel.app')
    expect(shareUrl({ kind: 'area', name: '강남역' })).toBe(
      'https://seoul-live.vercel.app?area=%EA%B0%95%EB%82%A8%EC%97%AD',
    )
  })

  it('목록은 쿼리 없이 기본 주소다', () => {
    vi.stubEnv('VITE_PUBLIC_APP_URL', 'https://seoul-live.vercel.app')
    expect(shareUrl({ kind: 'list' })).toBe('https://seoul-live.vercel.app')
  })
})
