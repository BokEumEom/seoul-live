import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useOnlineStatus } from './useOnlineStatus'

const original = Object.getOwnPropertyDescriptor(
  window.navigator.constructor.prototype,
  'onLine',
)

function setOnLine(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })
}

afterEach(() => {
  // jsdom의 navigator는 프로토타입에 getter를 둔다. 인스턴스에 심은 값만 지운다.
  Reflect.deleteProperty(navigator, 'onLine')
  if (original !== undefined) {
    Object.defineProperty(window.navigator.constructor.prototype, 'onLine', original)
  }
})

describe('useOnlineStatus', () => {
  it('처음에는 브라우저가 아는 상태를 그대로 쓴다', () => {
    // 이미 끊긴 채로 앱을 여는 경로다(설치된 PWA를 비행기 모드에서 여는 것).
    // 낙관적으로 true에서 시작하면 첫 화면이 「지도 로딩 중」처럼 보인다.
    setOnLine(false)

    const { result } = renderHook(() => useOnlineStatus())

    expect(result.current).toBe(false)
  })

  it('연결이 끊기면 false가 된다', () => {
    setOnLine(true)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)

    act(() => {
      setOnLine(false)
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current).toBe(false)
  })

  it('연결이 돌아오면 true가 된다', () => {
    setOnLine(false)
    const { result } = renderHook(() => useOnlineStatus())

    act(() => {
      setOnLine(true)
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current).toBe(true)
  })

  it('언마운트하면 건 리스너를 그대로 뗀다', () => {
    // **「언마운트 뒤 이벤트를 쏴도 값이 안 변한다」로는 못 잡는다.** 변이로
    // 확인했다: 해제를 통째로 지워도 그 단언이 통과한다 — 언마운트된 훅은
    // 어차피 다시 렌더되지 않아 `result.current`가 얼어 있기 때문이다.
    // 잠글 것은 「값이 안 변한다」가 아니라 **리스너가 남지 않는다**이고,
    // 그건 등록/해제 짝으로만 관측된다. 남으면 화면을 오갈 때마다 쌓인다.
    setOnLine(true)
    const added = vi.spyOn(window, 'addEventListener')
    const removed = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useOnlineStatus())
    // `addEventListener`는 오버로드가 여럿이라 목의 호출 튜플이 유니온으로
    // 잡힌다. 우리가 세는 것은 (종류, 핸들러) 두 자리뿐이라 그 모양으로 좁힌다.
    const subscriptions: readonly (readonly [string, unknown])[] = added.mock.calls
      .map((call) => [String(call[0]), call[1]] as const)
      .filter(([type]) => type === 'online' || type === 'offline')
    expect(subscriptions.map(([type]) => type).sort()).toEqual(['offline', 'online'])

    unmount()

    // **같은 핸들러 신원으로** 떼야 한다. 다른 함수를 넘기면 브라우저는 조용히
    // 아무것도 안 지운다 — 지운 것처럼 보이면서 새는 가장 흔한 모양이다.
    for (const [type, handler] of subscriptions) {
      expect(removed).toHaveBeenCalledWith(type, handler)
    }
  })
})
