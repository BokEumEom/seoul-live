import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { ensureLoaded, getSnapshot, subscribe, toggle } from './favoritesStore'

// 상태는 favoritesStore가 한 벌만 들고 있다. 이 훅은 그걸 화면에 잇기만 한다 —
// 여러 곳(홈의 칩·상세의 별·즐겨찾기 목록)이 동시에 봐도 같은 값을 보고,
// 명소를 다시 열어 상세가 새로 마운트돼도 방금 담은 것을 그대로 본다.
//
// touchedRef가 없어졌다. "늦게 온 저장소 읽기가 방금 누른 것을 덮지 않는다"는
// 스토어의 ensureLoaded가 한 번만 판단한다 — 인스턴스마다 따로 들 이유가 없다.
export function useFavorites(): {
  readonly favorites: readonly string[]
  readonly isFavorite: (name: string) => boolean
  readonly toggle: (name: string) => void
} {
  const favorites = useSyncExternalStore(subscribe, getSnapshot)

  // 렌더 중에 부르지 않는다. 실제 읽기는 첫 번째 것만 나가고 나머지는
  // 스토어가 걸러낸다.
  useEffect(() => {
    ensureLoaded()
  }, [])

  const isFavorite = useCallback(
    (name: string) => favorites.includes(name),
    [favorites],
  )

  return { favorites, isFavorite, toggle }
}
