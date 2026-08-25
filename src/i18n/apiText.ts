import { currentLanguage } from './t'

/**
 * **서울 API가 함께 준 영어 원문을 쓴다.** `t()`와 다른 자리다.
 *
 * `t()`는 우리가 쓴 한국어를 우리 사전으로 옮긴다. 여기는 **옮길 수 없는
 * 자리** — 서울 쪽 자유 문장 — 인데 서울이 영어를 함께 주는 경우를 위한
 * 것이다. 지금은 사고통제 내용(`ACDNT_ENG_INFO`) 하나가 그렇다.
 *
 * 영어가 비어 있으면 한국어로 떨어진다. `t()`가 사전에 없는 키를 그대로
 * 돌려주는 것과 같은 판단이다 — **빈 칸보다 못 읽는 글자가 낫다.** 뜻은
 * 안 통해도 자리와 길이가 남아 화면이 안 깨진다.
 *
 * **`t()`로 대신할 수 없다.** 사전 키는 한국어 원문인데 이 문장들은 통제
 * 건마다 달라서, 사전에 넣으면 항목이 무한히 늘고 다음 사고에서는 또 없다.
 */
export function apiText(korean: string, english: string): string {
  return currentLanguage() === 'en' && english !== '' ? english : korean
}
