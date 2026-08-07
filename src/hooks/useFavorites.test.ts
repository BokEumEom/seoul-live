import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFavorites } from './useFavorites'

vi.mock('../platform/favorites', () => ({
  loadFavorites: vi.fn(),
  saveFavorites: vi.fn(),
}))

const favorites = await import('../platform/favorites')
const loadFavorites = vi.mocked(favorites.loadFavorites)
const saveFavorites = vi.mocked(favorites.saveFavorites)

beforeEach(() => {
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
