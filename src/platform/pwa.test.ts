import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAppsInTossGlobals } from '@apps-in-toss/web-framework'
import { isInsideToss, registerServiceWorker } from './pwa'

vi.mock('@apps-in-toss/web-framework', () => ({
  getAppsInTossGlobals: vi.fn(),
}))

const insideToss = vi.mocked(getAppsInTossGlobals)

/** 웹뷰 밖에서 SDK가 실제로 하는 일. 탐침으로 확인했다 — 전역이 없어 TypeError다. */
function outsideToss(): void {
  insideToss.mockImplementation(() => {
    throw new TypeError("Cannot read properties of undefined (reading 'appsInTossGlobals')")
  })
}

const original = navigator.serviceWorker

function setServiceWorker(value: unknown): void {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  setServiceWorker(original)
})

describe('isInsideToss', () => {
  it('SDK가 전역을 돌려주면 토스 안이다', () => {
    insideToss.mockReturnValue({ deploymentId: 'x' } as never)
    expect(isInsideToss()).toBe(true)
  })

  it('SDK가 던지면 토스 밖이다', () => {
    // 브라우저·개발 서버·테스트가 전부 이쪽이다.
    outsideToss()
    expect(isInsideToss()).toBe(false)
  })

  it('SDK가 던져도 예외를 밖으로 내보내지 않는다', () => {
    // 이 함수는 앱이 뜨는 첫 순간에 불린다. 여기서 터지면 화면이 통째로 빈다.
    outsideToss()
    expect(() => isInsideToss()).not.toThrow()
  })
})

describe('registerServiceWorker', () => {
  it('토스 밖에서는 서비스워커를 등록한다', async () => {
    outsideToss()
    const register = vi.fn().mockResolvedValue({})
    setServiceWorker({ register })

    await registerServiceWorker()

    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' })
  })

  it('토스 웹뷰 안에서는 등록하지 않는다', async () => {
    // **이 규칙이 이 파일의 존재 이유다.** 토스가 서비스워커를 붙들면 옛 번들이
    // 남고, 사용자에게는 캐시를 지울 방법이 없다. 미니앱은 토스가 판올림하므로
    // 여기서 얻을 것도 없다.
    insideToss.mockReturnValue({ deploymentId: 'x' } as never)
    const register = vi.fn().mockResolvedValue({})
    setServiceWorker({ register })

    await registerServiceWorker()

    expect(register).not.toHaveBeenCalled()
  })

  it('서비스워커를 모르는 브라우저에서는 아무 일도 안 한다', async () => {
    // 구형 웹뷰·비보안 컨텍스트에는 `navigator.serviceWorker`가 아예 없다.
    outsideToss()
    setServiceWorker(undefined)

    await expect(registerServiceWorker()).resolves.toBeUndefined()
  })

  it('등록이 실패해도 앱을 죽이지 않는다', async () => {
    // 서비스워커는 덤이다. 실패하면 그냥 네트워크를 쓰는 평범한 웹앱이 된다 —
    // 첫 화면이 뜨는 경로에서 이 실패가 밖으로 나가면 안 된다.
    outsideToss()
    setServiceWorker({ register: vi.fn().mockRejectedValue(new Error('막힘')) })

    await expect(registerServiceWorker()).resolves.toBeUndefined()
  })
})
