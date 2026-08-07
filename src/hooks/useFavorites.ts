import { useCallback, useEffect, useRef, useState } from 'react'
import { loadFavorites, saveFavorites } from '../platform/favorites'

export function useFavorites(): {
  readonly favorites: readonly string[]
  readonly isFavorite: (name: string) => boolean
  readonly toggle: (name: string) => void
} {
  const [favorites, setFavorites] = useState<readonly string[]>([])
  // 사용자가 이미 손을 댔는지. 저장소 읽기가 그보다 늦게 끝나면 방금 누른
  // 별이 저절로 풀린다 — 「더보기」에서 늦게 온 좌표가 선택을 덮던 것과 같다.
  const touchedRef = useRef(false)

  useEffect(() => {
    // 언마운트 뒤에 읽기가 끝나면 상태를 건드리지 않는다. 상세를 빠르게
    // 열고 닫으면 실제로 일어난다.
    let alive = true
    void loadFavorites().then((stored) => {
      if (alive && !touchedRef.current) setFavorites(stored)
    })
    return () => {
      alive = false
    }
  }, [])

  const toggle = useCallback((name: string) => {
    touchedRef.current = true
    // 저장 결과를 기다리지 않고 화면부터 바꾼다. 저장이 막혀도 별은 눌린다.
    setFavorites((current) => {
      const next = current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name]
      void saveFavorites(next)
      return next
    })
  }, [])

  const isFavorite = useCallback(
    (name: string) => favorites.includes(name),
    [favorites],
  )

  return { favorites, isFavorite, toggle }
}
