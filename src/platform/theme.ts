import { Storage } from '@apps-in-toss/web-framework'
import { DEFAULT_THEME, parseThemeSetting, type ThemeSetting } from '../domain/theme'

// 화면 테마는 기기에 남는다. `favorites.ts`와 같은 폴백이다 — 토스 Storage
// 브리지를 먼저 쓰고, 브리지가 없는 환경(개발 서버·브라우저·테스트)에서만
// localStorage로 떨어진다.
//
// 저장 실패로 화면을 막지 않는다. 실패하면 이번 세션에만 적용되고 다음에
// 열면 기본(밝게)으로 돌아온다 — 테마가 안 바뀌는 것보다 낫다.
export const STORAGE_KEY = 'seoul-live:theme'

export async function loadTheme(): Promise<ThemeSetting> {
  try {
    return parseThemeSetting(await Storage.getItem(STORAGE_KEY))
  } catch {
    // 브리지가 없다. 웹 표준으로 넘어간다.
  }
  try {
    return parseThemeSetting(localStorage.getItem(STORAGE_KEY))
  } catch (error) {
    // localStorage조차 못 읽는 환경이 있다(사생활 보호 모드 등).
    console.error('화면 테마를 읽지 못했습니다:', error)
    return DEFAULT_THEME
  }
}

export async function saveTheme(setting: ThemeSetting): Promise<void> {
  try {
    await Storage.setItem(STORAGE_KEY, setting)
    return
  } catch {
    // 브리지가 없다. 웹 표준으로 넘어간다.
  }
  try {
    localStorage.setItem(STORAGE_KEY, setting)
  } catch (error) {
    console.error('화면 테마를 저장하지 못했습니다:', error)
  }
}
