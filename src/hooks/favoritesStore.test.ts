import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensureLoaded,
  getSnapshot,
  reset,
  subscribe,
  toggle,
} from './favoritesStore'

vi.mock('../platform/favorites', () => ({
  loadFavorites: vi.fn(),
  saveFavorites: vi.fn(),
}))

const platform = await import('../platform/favorites')
const loadFavorites = vi.mocked(platform.loadFavorites)
const saveFavorites = vi.mocked(platform.saveFavorites)

/** 마이크로태스크를 흘려보낸다. 저장·읽기가 전부 프라미스 뒤에 있다. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  vi.clearAllMocks()
  loadFavorites.mockResolvedValue([])
  saveFavorites.mockResolvedValue(undefined)
  reset()
})

describe('favoritesStore', () => {
  // 읽기가 거절돼도 loading이 풀려야 한다. 안 풀리면 current가 영원히 null,
  // loading이 영원히 true라 세션 내내 빈 목록에 갇히고 재시도 경로도 없다.
  // 지금은 platform/favorites가 예외를 삼켜 도달하지 않지만, 이 모듈의
  // 정합성을 남의 파일 내부 구현에 걸어 두지 않는다.
  it('읽기가 실패해도 다음 시도가 다시 나간다', async () => {
    loadFavorites.mockRejectedValueOnce(new Error('저장소 없음'))
    ensureLoaded()
    await flush()
    expect(getSnapshot()).toEqual([])

    loadFavorites.mockResolvedValueOnce(['경복궁'])
    ensureLoaded()
    await flush()
    expect(loadFavorites).toHaveBeenCalledTimes(2)
    expect(getSnapshot()).toEqual(['경복궁'])
  })

  // reset() 뒤에 앞 테스트의 읽기가 도착해 current를 채우면, 다음 테스트는
  // current !== null이라 제 읽기를 아예 안 내보내고 앞 값 위에서 돈다.
  it('reset 뒤에 도착한 앞 세대의 읽기는 버린다', async () => {
    let deliver: (value: readonly string[]) => void = () => {}
    loadFavorites.mockReturnValueOnce(
      new Promise<readonly string[]>((resolve) => {
        deliver = resolve
      }),
    )
    ensureLoaded()

    reset()
    deliver(['앞테스트값'])
    await flush()
    expect(getSnapshot()).toEqual([])

    loadFavorites.mockResolvedValueOnce(['이번테스트값'])
    ensureLoaded()
    await flush()
    expect(getSnapshot()).toEqual(['이번테스트값'])
  })

  it('구독을 해제하면 더 이상 알림을 받지 않는다', () => {
    // 이 커밋에서 가장 위험한 구조물이 모듈 수준 Set이다. 해제가 빠지면
    // AreaDetail을 열 때마다 리스너가 쌓이고 언마운트된 컴포넌트의 클로저를
    // 붙잡는다. 훅의 공개 표면에서는 이게 관측되지 않는다 — 스토어를 뽑은
    // 이유의 절반이 해제를 직접 볼 수 있게 만드는 것이다.
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)

    toggle('강남역')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    toggle('경복궁')

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('값이 그대로면 같은 스냅샷 참조를 준다', () => {
    // useSyncExternalStore는 스냅샷이 매번 새 배열이면 무한 루프로 죽는다.
    expect(getSnapshot()).toBe(getSnapshot())

    toggle('강남역')

    expect(getSnapshot()).toBe(getSnapshot())
  })

  it('토글하면 새 배열이 된다', () => {
    const before = getSnapshot()

    toggle('강남역')

    expect(getSnapshot()).not.toBe(before)
    expect(getSnapshot()).toEqual(['강남역'])

    toggle('강남역')

    expect(getSnapshot()).toEqual([])
  })

  it('인스턴스가 몇이든 저장소는 한 번만 읽는다', () => {
    ensureLoaded()
    ensureLoaded()
    ensureLoaded()

    expect(loadFavorites).toHaveBeenCalledTimes(1)
  })

  it('늦게 온 읽기가 그 사이의 토글을 덮지 않는다', async () => {
    let resolveLoad: (value: readonly string[]) => void = () => {}
    loadFavorites.mockReturnValue(
      new Promise<readonly string[]>((resolve) => {
        resolveLoad = resolve
      }),
    )

    ensureLoaded()
    toggle('강남역')
    resolveLoad(['경복궁'])
    await flush()

    expect(getSnapshot()).toEqual(['강남역'])
  })

  it('저장을 직렬로 내보낸다', async () => {
    // 두 인스턴스가 같은 배치에서 토글하면 저장 둘이 await 없이 연달아 나간다.
    // 브리지가 순서를 보장하지 않으면 나중에 끝난 옛 목록이 마지막에 남는다.
    const sent: string[][] = []
    let releaseFirst: () => void = () => {}
    saveFavorites.mockImplementation((names) => {
      sent.push([...names])
      return sent.length === 1
        ? new Promise<void>((resolve) => {
            releaseFirst = () => {
              resolve()
            }
          })
        : Promise.resolve()
    })

    toggle('가')
    toggle('나')
    await flush()

    expect(sent).toEqual([['가']])

    releaseFirst()
    await flush()

    expect(sent).toEqual([['가'], ['가', '나']])
  })

  it('저장이 실패해도 다음 저장이 나간다', async () => {
    // 큐가 한 번 끊기면 이후 저장이 전부 조용히 사라진다.
    saveFavorites.mockRejectedValueOnce(new Error('quota'))

    toggle('가')
    await flush()
    toggle('나')
    await flush()

    expect(saveFavorites).toHaveBeenLastCalledWith(['가', '나'])
  })

  it('reset이 값과 구독을 비운다', () => {
    const listener = vi.fn()
    subscribe(listener)
    toggle('강남역')

    reset()

    expect(getSnapshot()).toEqual([])
    toggle('경복궁')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
