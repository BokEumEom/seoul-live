/**
 * 하늘상태(`SKY_STTS`)의 어휘.
 *
 * **명세에 값 목록이 없다**(`seoul_realdata.md` 206행이 이름만 준다). 이 셋은
 * 2026-08-25 실호출 34곳의 예보 816칸에서 나온 값 전부다 — 흐림 524 ·
 * 구름많음 163 · 맑음 129. 「눈」이나 「비」는 여기 안 온다(그건
 * `PRECPT_TYPE`이 따로 말한다).
 *
 * **처음 보는 값이 오면 그림이 없다.** `skyIcon`이 `null`을 주고 화면은 칸을
 * 비운다 — 틀린 그림보다 없는 그림이 낫다는 이 앱의 `?? null` 규칙이다.
 *
 * `i18n.test.ts`가 이 목록을 읽어 영어 사전 완결성을 잠근다. 새 값을 보거든
 * 여기와 `en.ts`에 함께 더하라.
 */
export const SKY_STATES = ['맑음', '구름많음', '흐림'] as const

export type SkyState = (typeof SKY_STATES)[number]

export function isSkyState(value: string): value is SkyState {
  return (SKY_STATES as readonly string[]).includes(value)
}
