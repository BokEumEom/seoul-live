import { useEffect, useSyncExternalStore } from 'react'
import {
  DEFAULT_THEME,
  resolveTheme,
  type ResolvedTheme,
  type ThemeSetting,
} from '../domain/theme'
import { loadTheme, saveTheme } from '../platform/theme'

// 테마는 화면 전체가 함께 본다. `favoritesStore`와 같은 이유로 값을 모듈에
// 한 벌만 두고 `useSyncExternalStore`로 잇는다 — 여러 인스턴스가 각자 들면
// 한쪽만 바뀐다.
//
// **CSS가 아니라 여기서 기기 설정을 읽는다.** `index.css`가
// `@media (prefers-color-scheme: dark)`를 직접 보면 「시스템을 골랐을 때만
// 기기를 본다」를 표현할 수 없어 다크 블록을 두 벌로 적게 되고, 두 벌이 되는
// 순간 갈린다. 여기서 셋을 하나로 합쳐 `data-theme` 한 글자로 내보낸다.

type Listener = () => void

const DARK_QUERY = '(prefers-color-scheme: dark)'

let setting: ThemeSetting = DEFAULT_THEME
let loading = false
/**
 * 사용자가 이번 세션에서 테마를 **직접 골랐는가.**
 *
 * 저장소 읽기가 비동기(토스 브리지)라 앱이 뜬 직후 토글을 누르면 그 뒤에
 * 도착한 저장값이 방금 누른 것을 덮는다 — 사용자에게는 **화면이 바뀌었다가
 * 저절로 되돌아가는** 것으로 보인다. `favoritesStore`가 같은 종류의 경쟁을
 * 겪고 같은 방법으로 막았다(그쪽 `ensureLoaded` 주석 참고).
 *
 * 이 플래그가 없으면 실제로 재현된다 — 테스트로 확인했다.
 */
let chosen = false
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches
}

/**
 * 실제로 칠할 색을 `<html data-theme>`에 적는다. CSS가 이 속성만 본다.
 *
 * 클래스가 아니라 속성인 이유: `<html>`의 클래스는 다른 것도 쓸 수 있는
 * 공용 자리라, 우리가 지우고 다시 쓰면 남의 것을 밟는다.
 */
const THEME_COLOR: Readonly<Record<ResolvedTheme, string>> = {
  // `index.css`의 `--color-surface` / `--color-dark-surface`와 같아야 한다.
  // 갈리면 주소창과 화면 맨 윗줄 사이에 경계선이 보인다.
  light: '#fffbf4',
  dark: '#16120c',
}

function apply(): void {
  const resolved: ResolvedTheme = resolveTheme(setting, systemPrefersDark())
  document.documentElement.dataset.theme = resolved

  // 주소창 색도 같이 옮긴다. `index.html`의 `theme-color`는 기본값일 뿐이라,
  // 안 고치면 어둡게를 고른 사용자의 화면 위쪽에 크림색 띠가 남는다.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[resolved])
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSnapshot(): ThemeSetting {
  return setting
}

/**
 * 지금 **실제로 칠해지고 있는** 색. 토글 버튼이 「무엇으로 바꿀지」를 정하는 데
 * 쓴다 — 고른 값이 `'system'`이면 그것만으로는 지금이 밝은지 어두운지 알 수 없다.
 *
 * 문자열(원시값)을 돌려주므로 `useSyncExternalStore`가 매 렌더 새 참조로
 * 오해하지 않는다. 객체로 묶어 돌려주면 무한 루프가 난다.
 */
export function getResolvedSnapshot(): ResolvedTheme {
  return resolveTheme(setting, systemPrefersDark())
}

/** 저장소를 한 번만 읽는다. 인스턴스마다 불러도 요청은 하나다. */
export function ensureLoaded(): void {
  if (loading) {
    return
  }
  loading = true
  void loadTheme()
    .then((stored) => {
      // 읽는 사이에 사용자가 골랐으면 그쪽이 이긴다.
      if (chosen) return
      setting = stored
      apply()
      emit()
    })
    .catch(() => undefined)
}

export function setTheme(next: ThemeSetting): void {
  setting = next
  chosen = true
  // 저장을 기다리지 않고 먼저 칠한다. 브리지가 느리거나 실패해도 누른 즉시
  // 화면이 바뀌어야 한다 — 저장 실패의 대가는 다음에 열 때 기본으로 돌아가는
  // 것이지, 지금 안 바뀌는 것이 아니다.
  apply()
  emit()
  void saveTheme(next)
}

/**
 * 기기 설정이 바뀌는 것을 듣는다. 「시스템」을 고른 사용자는 폰에서 다크로
 * 바꾸는 순간 앱도 따라와야 한다 — 앱을 껐다 켜야 반영되면 「시스템 따르기」가
 * 아니다.
 *
 * 반환값으로 해제 함수를 준다. 앱 루트가 한 번 부르고 언마운트에서 푼다.
 */
export function watchSystemTheme(): () => void {
  const query = window.matchMedia(DARK_QUERY)
  const onChange = (): void => {
    // 밝게·어둡게를 고른 사용자에게는 기기 변화가 아무 일도 아니다.
    if (setting === 'system') {
      apply()
      emit()
    }
  }
  query.addEventListener('change', onChange)
  return () => {
    query.removeEventListener('change', onChange)
  }
}

/** 테스트가 모듈 상태를 되돌리는 수단. 화면 코드에서는 쓰지 않는다. */
export function reset(): void {
  setting = DEFAULT_THEME
  loading = false
  chosen = false
  listeners.clear()
  delete document.documentElement.dataset.theme
}

/**
 * 앱이 뜰 때 한 번. 저장된 값을 읽어 칠하고 기기 설정 변화를 듣기 시작한다.
 *
 * **`useThemeSetting`에 맡길 수 없다.** 그 훅은 설정 UI가 그려질 때만 도는데,
 * 그 UI는 「오늘의 서울」 안에 있어 열지 않으면 영영 안 그려진다 — 저장해 둔
 * 어둡게가 적용되지 않는다.
 *
 * 첫 페인트에는 `data-theme`이 아직 없어 라이트로 그려진다. 기본이 밝게라
 * 대부분은 깜빡임이 없고, 어둡게를 저장한 사용자만 잠깐 밝은 화면을 본다 —
 * 저장소 읽기가 비동기(토스 브리지)라 피할 수 없다.
 */
export function useAppTheme(): void {
  useEffect(() => {
    ensureLoaded()
    return watchSystemTheme()
  }, [])
}

export function useThemeSetting(): ThemeSetting {
  ensureLoaded()
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_THEME)
}

/** 지금 칠해지고 있는 색. 「기기 설정」까지 풀어낸 값이다. */
export function useResolvedTheme(): ResolvedTheme {
  ensureLoaded()
  return useSyncExternalStore(subscribe, getResolvedSnapshot, () => 'light')
}
