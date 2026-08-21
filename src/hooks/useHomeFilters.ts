import { useCallback, useState } from 'react'
import type { FilterKey } from '../domain/presets'
import type { CategoryFilterValue } from './useNearbyAreas'

export interface HomeFilters {
  readonly query: string
  readonly setQuery: (next: string) => void
  readonly category: CategoryFilterValue
  readonly setCategory: (next: CategoryFilterValue) => void
  /** 혼잡도 칩·목적 칩·「내 장소」 FAB이 한 칸을 나눠 쓴다 — 전부 배타적이다. */
  readonly filter: FilterKey | null
  readonly setFilter: (next: FilterKey | null) => void
  readonly selectedName: string | null
  readonly setSelectedName: (next: string | null) => void
}

// 홈의 상태를 한곳에 모은다. App으로 끌어올리지 않는다 — 홈의 필터·카메라는
// 셸이 알 필요가 없다.
//
// `initialSelectedName`은 주소(`?area=강남역`)에서 온다. **effect로 나중에
// 넣지 않는 이유**는 공유 링크로 들어온 사람이 목록이 한 프레임 번쩍이고
// 사라지는 것을 보기 때문이다. 필터·정렬은 주소에 안 실으므로 여기 없다 —
// 근거는 `domain/route.ts`.
export function useHomeFilters(
  initialSelectedName: string | null = null,
): HomeFilters {
  const [query, setQueryRaw] = useState('')
  const [category, setCategoryRaw] = useState<CategoryFilterValue>('전체')
  const [filter, setFilterRaw] = useState<FilterKey | null>(null)
  const [selectedName, setSelectedName] = useState<string | null>(initialSelectedName)

  // 목록에서 빠질 수 있는 조작은 선택을 해제한다. 걸러져 사라진 명소의
  // 요약 카드가 남으면 목록에 없는 곳이 시트에 떠 있는 상태가 된다.
  //
  // 시트 단계는 이 훅이 들고 있지 않다 — HomeScreen의 지역 상태다.
  // (정렬도 같은 이유로 여기 있었는데 2026-08-20에 없어졌다. 혼잡도 칩이
  // 네 등급으로 갈리면서 「여유한 순·붐비는 순」이 칩과 같은 말이 됐고,
  // 남은 「가까운 순」은 고를 것이 없어 `buildNearbyList`의 기본이 됐다.)
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
    selectedName,
    setSelectedName,
  }
}
