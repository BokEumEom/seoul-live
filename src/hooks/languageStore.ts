import { useEffect, useSyncExternalStore } from 'react'
import { DEFAULT_LANGUAGE, type Language } from '../i18n/language'
import { applyLanguage, currentLanguage } from '../i18n/t'
import { loadLanguage, saveLanguage } from '../platform/language'

// `themeStore`와 같은 모양이다. 값을 모듈에 한 벌만 두고 `useSyncExternalStore`로
// 잇는다 — 화면 전체가 함께 보는 값이라 인스턴스마다 들면 한쪽만 바뀐다.
//
// **`t()`는 훅이 아니라 모듈 함수다**(근거는 `i18n/t.ts`). 그래서 언어가 바뀔 때
// 화면이 따라오는 길이 따로 필요하다 — 앱 루트가 이 스토어를 구독하고, 언어가
// 바뀌면 루트가 다시 그려지면서 트리 전체가 새 문자열로 다시 렌더된다.

type Listener = () => void

let loading = false
/**
 * 사용자가 이번 세션에서 언어를 **직접 골랐는가.**
 *
 * `themeStore`와 같은 경쟁을 막는다 — 저장소 읽기가 비동기라, 앱이 뜬 직후
 * 언어를 바꾸면 뒤늦게 도착한 저장값이 그것을 덮는다. 그쪽에서 실제로 겪었다.
 */
let chosen = false
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSnapshot(): Language {
  return currentLanguage()
}

/** 저장소를 한 번만 읽는다. 저장된 적이 없으면 브라우저 선호 언어로 추측한다. */
export function ensureLoaded(): void {
  if (loading) {
    return
  }
  loading = true
  void loadLanguage()
    .then((stored) => {
      if (chosen) return
      // 저장된 적이 없으면 기본(한국어)이다 — 추측하지 않는다.
      applyLanguage(stored ?? DEFAULT_LANGUAGE)
      emit()
    })
    .catch(() => undefined)
}

export function setLanguage(next: Language): void {
  chosen = true
  applyLanguage(next)
  emit()
  // 저장을 기다리지 않는다. 브리지가 느리거나 실패해도 누른 즉시 바뀌어야 한다.
  void saveLanguage(next)
}

/** 테스트가 모듈 상태를 되돌리는 수단. 화면 코드에서는 쓰지 않는다. */
export function reset(): void {
  loading = false
  chosen = false
  listeners.clear()
  applyLanguage(DEFAULT_LANGUAGE)
}

/**
 * 앱이 뜰 때 한 번. 저장된 언어를 읽어 적용한다.
 *
 * 루트가 이 훅을 쓰므로, 언어가 바뀌면 루트가 다시 그려지고 트리 전체가
 * 새 문자열로 렌더된다 — `t()`가 훅이 아니어도 화면이 따라오는 이유다.
 */
export function useLanguage(): Language {
  useEffect(() => {
    ensureLoaded()
  }, [])
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_LANGUAGE)
}
