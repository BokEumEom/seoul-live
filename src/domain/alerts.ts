import type { CityAlert } from './cityInfo.js'

/**
 * 같은 문구를 한 번만 남긴다.
 *
 * `citydata`는 명소마다 따로 재난문자를 싣고, 서울 전역에 걸린 경보는 명소
 * 수만큼 반복된다 — 지우지 않으면 폭염 경보 하나가 30줄이 된다.
 *
 * **문구가 열쇠다.** 같은 문구가 명소마다 다른 `category`·`step`을 달고 올 수
 * 있는데 화면이 보여주는 것은 문구다. 다른 필드까지 열쇠에 넣으면 같은 문장이
 * 두 줄 뜬다.
 *
 * **정렬하지 않는다.** `createdAt`의 형식이 명세에 없어 시각순으로 세울 근거가
 * 없고(`SubwayArrival.message`와 같은 처지다), 짐작해 정렬하면 처음 보는
 * 형식에서 순서가 조용히 뒤집힌다. 배너는 첫 줄만 보여주므로 그게 곧 틀린
 * 경보가 된다.
 */
export function dedupeAlerts(
  alerts: readonly CityAlert[],
): readonly CityAlert[] {
  return Array.from(
    new Map(alerts.map((alert) => [alert.message, alert])).values(),
  )
}
