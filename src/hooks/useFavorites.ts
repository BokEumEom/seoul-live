import { useCallback, useEffect, useRef, useState } from 'react'
import { loadFavorites, saveFavorites } from '../platform/favorites'

type Listener = (next: readonly string[]) => void

// 한 화면에서 useFavorites가 여러 번 불린다 — 홈의 필터 칩과 명소 상세의 별이
// 각자 인스턴스를 갖는다. 인스턴스마다 상태가 따로 놀면 상세에서 별을 눌러도
// 칩의 개수가 그대로고, 0이면 칩이 비활성이라 즐겨찾기 필터를 켤 수조차 없다.
// 홈은 언제나 마운트된 채라 다시 마운트되며 저절로 맞춰질 일도 없다.
//
// 저장소를 다시 읽는 것으로는 늦다(비동기고 실패할 수도 있다). 토글한 쪽이
// 나머지에 곧장 알린다. 값을 모듈에 쌓아두지는 않는다 — 그러면 테스트마다
// 앞 테스트의 즐겨찾기가 남는다.
const listeners = new Set<Listener>()

export function useFavorites(): {
  readonly favorites: readonly string[]
  readonly isFavorite: (name: string) => boolean
  readonly toggle: (name: string) => void
} {
  const [favorites, setFavorites] = useState<readonly string[]>([])
  // 토글은 이벤트 핸들러에서 현재 값을 읽어야 한다. setState 콜백 안에서 남에게
  // 알리면 렌더 도중 다른 컴포넌트의 상태를 바꾸게 된다.
  const favoritesRef = useRef<readonly string[]>([])
  // 사용자가 이미 손을 댔는지. 저장소 읽기가 그보다 늦게 끝나면 방금 누른
  // 별이 저절로 풀린다 — 「더보기」에서 늦게 온 좌표가 선택을 덮던 것과 같다.
  const touchedRef = useRef(false)

  const apply = useCallback((next: readonly string[]) => {
    favoritesRef.current = next
    setFavorites(next)
  }, [])

  useEffect(() => {
    const listener: Listener = (next) => {
      // 다른 인스턴스가 손을 댔다. 이쪽으로 늦게 도착할 저장소 읽기도 막는다.
      touchedRef.current = true
      apply(next)
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [apply])

  useEffect(() => {
    // 언마운트 뒤에 읽기가 끝나면 상태를 건드리지 않는다. 상세를 빠르게
    // 열고 닫으면 실제로 일어난다.
    let alive = true
    void loadFavorites().then((stored) => {
      if (alive && !touchedRef.current) apply(stored)
    })
    return () => {
      alive = false
    }
  }, [apply])

  const toggle = useCallback(
    (name: string) => {
      touchedRef.current = true
      const current = favoritesRef.current
      const next = current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name]

      apply(next)
      // 저장 결과를 기다리지 않고 화면부터 바꾼다. 저장이 막혀도 별은 눌린다.
      void saveFavorites(next)
      // 자기 자신도 목록에 있지만 같은 배열이라 React가 다시 그리지 않는다.
      for (const listener of listeners) {
        listener(next)
      }
    },
    [apply],
  )

  const isFavorite = useCallback(
    (name: string) => favorites.includes(name),
    [favorites],
  )

  return { favorites, isFavorite, toggle }
}
