import { useCallback, useState } from 'react'
import type { FilterKey } from '../domain/presets'
import { SHEET_RATIO } from '../domain/sheet'
import type { CategoryFilterValue, SortMode } from './useNearbyAreas'

export interface HomeFilters {
  readonly query: string
  readonly setQuery: (next: string) => void
  readonly category: CategoryFilterValue
  readonly setCategory: (next: CategoryFilterValue) => void
  /** 즐겨찾기와 목적 프리셋이 한 칸을 나눠 쓴다 — 칩 줄이 배타적이다. */
  readonly filter: FilterKey | null
  readonly setFilter: (next: FilterKey | null) => void
  readonly sort: SortMode
  readonly setSort: (next: SortMode) => void
  readonly selectedName: string | null
  readonly setSelectedName: (next: string | null) => void
  readonly mapRatio: number
  readonly setMapRatio: (next: number) => void
}

// 홈의 상태를 한곳에 모은다. App으로 끌어올리지 않는다 — 홈의 필터·카메라는
// 셸이 알 필요가 없다.
export function useHomeFilters(): HomeFilters {
  const [query, setQueryRaw] = useState('')
  const [category, setCategoryRaw] = useState<CategoryFilterValue>('전체')
  const [filter, setFilterRaw] = useState<FilterKey | null>(null)
  const [sort, setSort] = useState<SortMode>('distance')
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [mapRatio, setMapRatio] = useState(SHEET_RATIO.half)

  // 목록에서 빠질 수 있는 조작은 선택을 해제한다. 걸러져 사라진 명소의
  // 상세가 남으면 목록에 없는 곳의 요약이 떠 있는 상태가 된다.
  //
  // 정렬과 분할 비율은 목록에서 빼지 않으므로 선택을 지우지 않는다.
  const setQuery = useCallback((next: string) => {
    setQueryRaw(next)
    setSelectedName(null)
  }, [])

  const setCategory = useCallback((next: CategoryFilterValue) => {
    setCategoryRaw(next)
    setSelectedName(null)
  }, [])

  const setFilter = useCallback((next: FilterKey | null) => {
    setFilterRaw(next)
    setSelectedName(null)
  }, [])

  return {
    query,
    setQuery,
    category,
    setCategory,
    filter,
    setFilter,
    sort,
    setSort,
    selectedName,
    setSelectedName,
    mapRatio,
    setMapRatio,
  }
}
