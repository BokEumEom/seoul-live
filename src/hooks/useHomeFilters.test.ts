import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SHEET_RATIO } from '../domain/sheet'
import { useHomeFilters } from './useHomeFilters'

describe('useHomeFilters', () => {
  it('기본값으로 시작한다', () => {
    const { result } = renderHook(() => useHomeFilters())
    expect(result.current.query).toBe('')
    expect(result.current.category).toBe('전체')
    expect(result.current.filter).toBeNull()
    expect(result.current.sort).toBe('distance')
    expect(result.current.selectedName).toBeNull()
    expect(result.current.mapRatio).toBe(SHEET_RATIO.half)
  })

  // 목록에서 빠질 수 있는 조작은 선택을 해제한다. 걸러져 사라진 명소의
  // 상세가 남으면 목록에 없는 곳의 요약이 떠 있는 상태가 된다.
  it('필터를 바꾸면 선택이 해제된다', () => {
    const { result } = renderHook(() => useHomeFilters())
    act(() => result.current.setSelectedName('강남역'))
    expect(result.current.selectedName).toBe('강남역')
    act(() => result.current.setFilter('kids'))
    expect(result.current.selectedName).toBeNull()
  })

  it('즐겨찾기와 프리셋이 한 칸을 나눠 쓴다', () => {
    // 배타적이라는 것이 상태 모양으로 보장된다. 「내 장소 ∩ 아이와 나들이」는
    // 30곳 규모에서 결과가 0이 되기 쉬워 지원하지 않는다.
    const { result } = renderHook(() => useHomeFilters())
    act(() => result.current.setFilter('kids'))
    act(() => result.current.setFilter('fav'))
    expect(result.current.filter).toBe('fav')
  })

  it('카테고리를 바꿔도 선택이 해제된다', () => {
    const { result } = renderHook(() => useHomeFilters())
    act(() => result.current.setSelectedName('강남역'))
    act(() => result.current.setCategory('공원'))
    expect(result.current.selectedName).toBeNull()
  })

  it('검색어를 바꿔도 선택이 해제된다', () => {
    const { result } = renderHook(() => useHomeFilters())
    act(() => result.current.setSelectedName('강남역'))
    act(() => result.current.setQuery('공원'))
    expect(result.current.selectedName).toBeNull()
  })

  it('정렬을 바꾸면 선택은 유지된다', () => {
    // 정렬은 목록에서 빼지 않는다. 순서만 바뀌므로 선택을 지울 이유가 없다.
    const { result } = renderHook(() => useHomeFilters())
    act(() => result.current.setSelectedName('강남역'))
    act(() => result.current.setSort('busy'))
    expect(result.current.selectedName).toBe('강남역')
  })

  it('분할 비율을 바꿔도 선택은 유지된다', () => {
    const { result } = renderHook(() => useHomeFilters())
    act(() => result.current.setSelectedName('강남역'))
    act(() => result.current.setMapRatio(SHEET_RATIO.full))
    expect(result.current.mapRatio).toBe(SHEET_RATIO.full)
    expect(result.current.selectedName).toBe('강남역')
  })

  it('바꾼 값이 실제로 남는다', () => {
    const { result } = renderHook(() => useHomeFilters())
    act(() => result.current.setQuery('성수'))
    act(() => result.current.setCategory('공원'))
    act(() => result.current.setFilter('date'))
    expect(result.current.query).toBe('성수')
    expect(result.current.category).toBe('공원')
    expect(result.current.filter).toBe('date')
  })
})
