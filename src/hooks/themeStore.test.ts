import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensureLoaded,
  getSnapshot,
  reset,
  setTheme,
  subscribe,
  watchSystemTheme,
} from './themeStore'

vi.mock('../platform/theme', () => ({
  loadTheme: vi.fn(),
  saveTheme: vi.fn(),
}))

const platform = await import('../platform/theme')
const loadTheme = vi.mocked(platform.loadTheme)
const saveTheme = vi.mocked(platform.saveTheme)

/** 기기가 어둡다고 답하는 `matchMedia`. 리스너를 붙잡아 두어 변화도 흉내 낸다. */
function stubMatchMedia(matches: boolean): { change: (next: boolean) => void } {
  let current = matches
  const handlers = new Set<() => void>()
  window.matchMedia = ((query: string) =>
    ({
      get matches() {
        return current
      },
      media: query,
      addEventListener: (_: string, handler: () => void) => handlers.add(handler),
      removeEventListener: (_: string, handler: () => void) => handlers.delete(handler),
    }) as unknown as MediaQueryList) as typeof window.matchMedia

  return {
    change: (next: boolean) => {
      current = next
      for (const handler of handlers) handler()
    },
  }
}

function themeAttribute(): string | undefined {
  return document.documentElement.dataset.theme
}

beforeEach(() => {
  reset()
  loadTheme.mockReset()
  saveTheme.mockReset()
  loadTheme.mockResolvedValue('light')
  saveTheme.mockResolvedValue(undefined)
  stubMatchMedia(false)
})

afterEach(() => {
  reset()
})

describe('themeStore', () => {
  it('기기가 어두워도 기본은 밝게다', async () => {
    // **이 테스트가 이번 변경의 전부다.** 예전에는 CSS가
    // `prefers-color-scheme`를 직접 봐서 폰이 어두우면 앱도 어두웠다 —
    // 다크 모드를 지원한 것이 아니라 기본으로 삼은 것이었다.
    stubMatchMedia(true)
    ensureLoaded()
    await vi.waitFor(() => {
      expect(themeAttribute()).toBe('light')
    })
    expect(getSnapshot()).toBe('light')
  })

  it('어둡게를 고르면 기기가 밝아도 어둡다', () => {
    stubMatchMedia(false)
    setTheme('dark')

    expect(themeAttribute()).toBe('dark')
    expect(getSnapshot()).toBe('dark')
  })

  it('시스템을 고르면 그때 기기를 본다', () => {
    stubMatchMedia(true)
    setTheme('system')

    expect(themeAttribute()).toBe('dark')
    // 저장되는 값은 해석한 결과가 아니라 고른 값이어야 한다 — 'dark'로 저장하면
    // 다음에 기기를 밝게 바꿔도 앱이 어두운 채로 남는다.
    expect(saveTheme).toHaveBeenCalledWith('system')
  })

  it('고른 값을 저장한다', () => {
    setTheme('dark')
    expect(saveTheme).toHaveBeenCalledWith('dark')
  })

  it('저장을 기다리지 않고 먼저 칠한다', () => {
    // 브리지가 느리거나 실패해도 누른 즉시 화면이 바뀌어야 한다.
    saveTheme.mockReturnValue(new Promise(() => undefined))
    setTheme('dark')

    expect(themeAttribute()).toBe('dark')
  })

  it('저장소에 있던 값을 읽어 칠한다', async () => {
    loadTheme.mockResolvedValue('dark')
    ensureLoaded()

    await vi.waitFor(() => {
      expect(themeAttribute()).toBe('dark')
    })
  })

  it('읽는 중에 고르면 늦게 온 저장값이 그것을 덮지 않는다', async () => {
    // **실제로 겪은 경쟁이다.** 저장소 읽기가 비동기(토스 브리지)라, 앱이 뜬
    // 직후 토글을 누르면 그 뒤 도착한 값이 방금 누른 것을 덮었다 — 사용자에게는
    // 화면이 바뀌었다가 **저절로 되돌아가는** 것으로 보인다.
    // `favoritesStore`가 별에서 같은 종류의 경쟁을 겪었다.
    let deliver: (value: 'light' | 'dark' | 'system') => void = () => undefined
    loadTheme.mockReturnValue(
      new Promise((resolve) => {
        deliver = resolve
      }),
    )

    ensureLoaded() // 읽기 시작 — 아직 안 끝났다
    setTheme('dark') // 그 사이에 사용자가 골랐다
    deliver('light') // 이제야 저장값이 도착한다
    await Promise.resolve()
    await Promise.resolve()

    expect(getSnapshot()).toBe('dark')
    expect(themeAttribute()).toBe('dark')
  })

  it('여러 번 불러도 저장소는 한 번만 읽는다', () => {
    ensureLoaded()
    ensureLoaded()
    ensureLoaded()

    expect(loadTheme).toHaveBeenCalledTimes(1)
  })

  it('바뀌면 구독자에게 알린다', () => {
    const listener = vi.fn()
    subscribe(listener)
    setTheme('dark')

    expect(listener).toHaveBeenCalled()
  })

  describe('watchSystemTheme', () => {
    it('시스템을 고른 사용자는 기기가 바뀌면 따라간다', () => {
      const media = stubMatchMedia(false)
      const stop = watchSystemTheme()
      setTheme('system')
      expect(themeAttribute()).toBe('light')

      media.change(true)

      expect(themeAttribute()).toBe('dark')
      stop()
    })

    it('밝게를 고른 사용자는 기기가 바뀌어도 그대로다', () => {
      // 명시적으로 고른 것을 기기 설정이 뒤집으면 고른 의미가 없다.
      const media = stubMatchMedia(false)
      const stop = watchSystemTheme()
      setTheme('light')

      media.change(true)

      expect(themeAttribute()).toBe('light')
      stop()
    })

    it('고른 값과 무관한 기기 변화로는 화면을 다시 그리지 않는다', () => {
      // **위 테스트만으로는 부족하다.** `apply()`가 이미 고른 값을 존중하므로
      // 기기 변화를 걸러내지 않아도 칠해지는 색은 같다 — 변이로 확인했다.
      // 걸러내는 값은 다른 데 있다: 밝게·어둡게를 고른 사용자에게 기기 변화는
      // 아무 일도 아닌데, 알리면 트리 전체가 까닭 없이 다시 그려진다.
      const media = stubMatchMedia(false)
      const stop = watchSystemTheme()
      setTheme('light')
      const listener = vi.fn()
      subscribe(listener)

      media.change(true)

      expect(listener).not.toHaveBeenCalled()
      stop()
    })

    it('그만 들으면 더 이상 반응하지 않는다', () => {
      // 리스너를 안 풀면 언마운트된 뒤에도 모듈 상태를 계속 건드린다.
      const media = stubMatchMedia(false)
      const stop = watchSystemTheme()
      setTheme('system')
      stop()

      media.change(true)

      expect(themeAttribute()).toBe('light')
    })
  })
})
