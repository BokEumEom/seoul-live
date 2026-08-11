import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reset } from './favoritesStore'
import { useFavorites } from './useFavorites'

vi.mock('../platform/favorites', () => ({
  loadFavorites: vi.fn(),
  saveFavorites: vi.fn(),
}))

const favorites = await import('../platform/favorites')
const loadFavorites = vi.mocked(favorites.loadFavorites)
const saveFavorites = vi.mocked(favorites.saveFavorites)

beforeEach(() => {
  // 스토어는 모듈에 값을 한 벌 든다. 비우지 않으면 앞 테스트의 즐겨찾기가 샌다.
  reset()
  vi.clearAllMocks()
  loadFavorites.mockResolvedValue([])
  saveFavorites.mockResolvedValue(undefined)
})

describe('useFavorites', () => {
  it('저장된 목록을 처음에 읽어온다', async () => {
    loadFavorites.mockResolvedValue(['경복궁'])
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.isFavorite('경복궁')).toBe(true))
  })

  it('토글하면 담기고 다시 누르면 빠진다', async () => {
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.favorites).toEqual([]))

    act(() => result.current.toggle('강남역'))
    await waitFor(() => expect(result.current.isFavorite('강남역')).toBe(true))

    act(() => result.current.toggle('강남역'))
    await waitFor(() => expect(result.current.isFavorite('강남역')).toBe(false))
  })

  it('토글할 때마다 저장한다', async () => {
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.favorites).toEqual([]))

    act(() => result.current.toggle('강남역'))
    await waitFor(() => expect(saveFavorites).toHaveBeenCalledWith(['강남역']))
  })

  it('저장이 막혀도 화면 상태는 바뀐다', async () => {
    // 저장 결과를 기다리지 않고 화면부터 바꾼다. 별이 안 눌리는 것보다
    // 저장이 안 되는 편이 낫다.
    saveFavorites.mockRejectedValue(new Error('quota'))
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.favorites).toEqual([]))

    act(() => result.current.toggle('경복궁'))
    await waitFor(() => expect(result.current.isFavorite('경복궁')).toBe(true))
  })

  it('저장이 막혀도 새로 마운트된 인스턴스가 방금 담은 것을 본다', async () => {
    // 저장 실패는 별을 막지 않는다고 정해뒀다. 그 대가로 저장소에는 아무것도
    // 안 남으므로, 새로 마운트되는 쪽이 저장소만 읽으면 옛 값을 본다.
    // 명소를 다시 열 때마다 AreaDetail이 새로 마운트된다 — 그러면 한 화면에서
    // 칩은 1이라 하고 별은 안 담겼다고 한다.
    saveFavorites.mockRejectedValue(new Error('quota'))
    const chips = renderHook(() => useFavorites())
    await waitFor(() => expect(chips.result.current.favorites).toEqual([]))

    act(() => chips.result.current.toggle('강남역'))

    const detail = renderHook(() => useFavorites())
    expect(detail.result.current.isFavorite('강남역')).toBe(true)
  })

  it('인스턴스가 여럿이어도 저장소는 한 번만 읽는다', async () => {
    renderHook(() => useFavorites())
    renderHook(() => useFavorites())
    renderHook(() => useFavorites())

    await waitFor(() => expect(loadFavorites).toHaveBeenCalledTimes(1))
  })

  it('같은 화면의 다른 인스턴스에도 곧바로 반영된다', async () => {
    // 홈의 필터 칩과 명소 상세의 별이 각자 useFavorites를 부른다. 인스턴스마다
    // 상태가 따로 놀면 상세에서 별을 눌러도 칩의 개수가 그대로고, 0이면 칩이
    // 비활성이라 즐겨찾기 필터를 켤 수조차 없다.
    const chips = renderHook(() => useFavorites())
    const detail = renderHook(() => useFavorites())
    await waitFor(() => expect(chips.result.current.favorites).toEqual([]))

    act(() => detail.result.current.toggle('강남역'))

    await waitFor(() =>
      expect(chips.result.current.isFavorite('강남역')).toBe(true),
    )
  })

  it('남이 토글한 값도 늦게 온 읽기에 덮이지 않는다', async () => {
    // 저장소 읽기는 인스턴스마다 따로 나간다. 알림을 받은 쪽이 "손 안 댔음"으로
    // 남아 있으면 뒤늦게 도착한 목록이 방금 담은 곳을 지운다.
    let resolveLoad: (value: readonly string[]) => void = () => {}
    loadFavorites.mockReturnValue(
      new Promise<readonly string[]>((resolve) => {
        resolveLoad = resolve
      }),
    )

    const chips = renderHook(() => useFavorites())
    const detail = renderHook(() => useFavorites())

    act(() => detail.result.current.toggle('강남역'))
    expect(chips.result.current.isFavorite('강남역')).toBe(true)

    await act(async () => {
      resolveLoad(['경복궁'])
    })

    expect(chips.result.current.isFavorite('강남역')).toBe(true)
    expect(chips.result.current.isFavorite('경복궁')).toBe(false)
  })

  it('읽기가 늦게 끝나도 그 사이의 토글을 덮지 않는다', async () => {
    // 저장소 읽기는 비동기다. 그 사이에 사용자가 별을 누르면 뒤늦게 도착한
    // 저장 목록이 방금 누른 것을 지운다 — 사용자에게는 별이 눌렸다가 저절로
    // 풀리는 것으로 보인다. 「더보기」의 늦은 좌표 문제와 같은 종류다.
    let resolveLoad: (value: readonly string[]) => void = () => {}
    loadFavorites.mockReturnValue(
      new Promise<readonly string[]>((resolve) => {
        resolveLoad = resolve
      }),
    )

    const { result } = renderHook(() => useFavorites())
    act(() => result.current.toggle('강남역'))
    expect(result.current.isFavorite('강남역')).toBe(true)

    await act(async () => {
      resolveLoad(['경복궁'])
    })

    expect(result.current.isFavorite('강남역')).toBe(true)
  })
})
