import { currentLanguage } from './t'

/**
 * 큰 인원 수를 축 눈금용으로 줄여 적는다.
 *
 * **`t()`로 못 푼다.** 한국어는 만 단위(4.5만), 영어는 천 단위(45k)라 **자릿수
 * 자체가 다르다** — 사전은 문자열을 바꿀 뿐 나눗셈을 바꾸지 못한다. 그래서
 * 이것만 사전이 아니라 함수로 갈라 둔다.
 *
 * 도메인(`forecast.ts`)이 아니라 여기 있는 이유: 언어를 읽어야 하는데 도메인은
 * 순수 함수 자리라 모듈 상태를 보면 안 된다.
 */
export function formatPopulationTick(value: number): string {
  if (currentLanguage() === 'en') {
    // 45,000 → 45k. 1,000 미만은 그대로.
    return value >= 1000
      ? `${String(Number((value / 1000).toFixed(1)))}k`
      : value.toLocaleString('en-US')
  }
  if (value >= 10000) {
    // 4.5만은 남기고 6.0만은 6만으로. `Number`가 뒤 0을 알아서 턴다.
    return `${String(Number((value / 10000).toFixed(1)))}만`
  }
  return value.toLocaleString('ko-KR')
}
