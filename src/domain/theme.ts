/**
 * 사용자가 고른 값. **`'system'`이 기본이 아니다.**
 *
 * 처음에는 `prefers-color-scheme`만 보고 기기 설정을 그대로 따랐는데, 그러면
 * 폰이 어두운 사용자에게는 다크가 **기본**이 된다. 우리가 하려던 것은 다크
 * 모드를 **지원**하는 것이지 기본으로 삼는 것이 아니다 — 이 앱의 얼굴은 밝은
 * 크림색이고, 스크린샷·심사·처음 여는 화면이 전부 그쪽이다.
 *
 * 그래서 세 값을 두고 기본을 `'light'`로 잡는다. 기기를 따르고 싶은 사용자는
 * `'system'`을 고르면 되고, 그건 고른 것이므로 기본이 아니다.
 */
export type ThemeSetting = 'light' | 'dark' | 'system'

/** 실제로 화면에 칠하는 값. `'system'`은 여기까지 오지 않는다. */
export type ResolvedTheme = 'light' | 'dark'

export const DEFAULT_THEME: ThemeSetting = 'light'

const SETTINGS: readonly ThemeSetting[] = ['light', 'dark', 'system']

/** 저장소에서 읽은 문자열을 값으로 좁힌다. 모르는 값은 기본으로 떨어진다. */
export function parseThemeSetting(raw: unknown): ThemeSetting {
  return SETTINGS.includes(raw as ThemeSetting) ? (raw as ThemeSetting) : DEFAULT_THEME
}

/**
 * 고른 값과 기기 설정을 합쳐 실제로 칠할 색을 정한다.
 *
 * `'system'`일 때만 기기를 본다 — 밝게·어둡게는 사용자가 명시적으로 정한
 * 것이라 기기 설정이 그것을 뒤집으면 안 된다.
 */
export function resolveTheme(
  setting: ThemeSetting,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (setting === 'system') {
    return systemPrefersDark ? 'dark' : 'light'
  }
  return setting
}
