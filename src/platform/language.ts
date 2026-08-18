import { Storage } from '@apps-in-toss/web-framework'
import { DEFAULT_LANGUAGE, parseLanguage, type Language } from '../i18n/language'

// 언어는 기기에 남는다. `theme.ts`·`favorites.ts`와 같은 폴백이다 — 토스
// Storage 브리지를 먼저 쓰고, 브리지가 없는 환경에서만 localStorage로 떨어진다.
export const STORAGE_KEY = 'seoul-live:language'

/** 저장된 적이 없으면 `null`이다 — 「한국어를 골랐다」와 구분해야 브라우저 */
/** 선호 언어로 첫 추측을 할지 정할 수 있다. */
export async function loadLanguage(): Promise<Language | null> {
  try {
    const raw = await Storage.getItem(STORAGE_KEY)
    return raw === null ? null : parseLanguage(raw)
  } catch {
    // 브리지가 없다. 웹 표준으로 넘어간다.
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === null ? null : parseLanguage(raw)
  } catch (error) {
    console.error('언어 설정을 읽지 못했습니다:', error)
    return null
  }
}

export async function saveLanguage(language: Language): Promise<void> {
  try {
    await Storage.setItem(STORAGE_KEY, language)
    return
  } catch {
    // 브리지가 없다. 웹 표준으로 넘어간다.
  }
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch (error) {
    console.error('언어 설정을 저장하지 못했습니다:', error)
  }
}

export { DEFAULT_LANGUAGE }
