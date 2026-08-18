/**
 * 지원하는 언어.
 *
 * **한국어가 기본이다.** 이 앱의 주 무대가 토스 미니앱이고 그 사용자는
 * 한국인이다. 영어는 서울을 찾은 외국인 방문객을 위한 것으로, 「지금 명동이
 * 붐비나」는 이 앱과 가장 잘 맞는 쓰임이다.
 */
export type Language = 'ko' | 'en'

export const DEFAULT_LANGUAGE: Language = 'ko'

// **브라우저 선호 언어로 추측하지 않는다.** 처음엔 `navigator.languages`에
// 한국어가 없으면 영어로 시작하게 했는데, 그러면 **기기를 영어로 쓰는 한국인**이
// 앱을 열자마자 영어 화면을 마주한다. 이 앱의 사용자는 대부분 한국인이고
// (토스 미니앱), 잘못 고쳤을 때 손해가 그쪽이 훨씬 크다.
//
// jsdom의 기본 로케일이 `en-US`라 테스트가 통째로 영어로 떠서 63개가 깨졌고,
// 그게 실사용에서 벌어질 일을 그대로 보여줬다.
//
// 대신 언어 버튼을 **검색 줄에 상시로 내놓는다**(`LanguageToggle`) — 못 읽는
// 말로 묻힌 설정보다 눈에 보이는 두 글자가 낫다.

const LANGUAGES: readonly Language[] = ['ko', 'en']

/** 저장소에서 읽은 문자열을 값으로 좁힌다. 모르는 값은 기본으로 떨어진다. */
export function parseLanguage(raw: unknown): Language {
  return LANGUAGES.includes(raw as Language) ? (raw as Language) : DEFAULT_LANGUAGE
}

