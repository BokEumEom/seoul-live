import type { Coords } from './types'

// 따릉이(`SBIKE_STTS`). 명세 160~167행.
//
// **`cityInfo.ts`에서 꺼냈다**(2026-08-25). 저쪽이 736행이라 거치율이 들어갈
// 자리가 없었다 — `charger.ts`·`commerce.ts`와 같은 이유의 같은 분리다.

export interface BikeStation {
  readonly name: string
  /**
   * SBIKE_SPOT_ID — 대여소 ID(`ST-126`). **목록의 키다.**
   *
   * 이름을 키로 쓰던 자리인데, 한 명소 안에서는 이름이 안 겹쳐도(실호출 35곳
   * 227건에서 확인) 명소를 건너뛰면 겹친다. 이름은 서울 쪽에서 바뀔 수 있는
   * 표시용 값이고 ID는 그러라고 있는 값이다.
   */
  readonly id: string
  /**
   * `SBIKE_Y`(위도)와 `SBIKE_X`(경도).
   *
   * **축 이름이 위경도와 반대다.** X가 경도, Y가 위도다 — 실응답에서
   * `SBIKE_X: 126.977`, `SBIKE_Y: 37.569`로 확인했다(광화문·덕수궁).
   * 뒤집으면 지도가 서울이 아니라 중국 어딘가로 간다.
   */
  readonly coords: Coords | null
  /** SBIKE_PARKING_CNT — 거치된 자전거 수(= 지금 빌릴 수 있는 대수) */
  readonly bikes: number | null
  /** SBIKE_RACK_CNT — 거치대 수 */
  readonly racks: number | null
  /**
   * SBIKE_SHARED — 거치율(%). **100을 넘는다.**
   *
   * 2026-08-25 실호출 227곳에서 최댓값이 450이었고 61곳(27%)이 100을 넘었다.
   * 거치대에 못 꽂은 자전거를 옆에 세워 두기 때문이다.
   *
   * **`bikes / racks`로 계산하지 않고 받아 읽는다.** 227곳 전부에서 두 값이
   * 소수점 반올림까지 같았으니 지금은 계산해도 같은 숫자가 나온다. 그래도
   * 받아 읽는 쪽인 이유는 `racks`가 0인 대여소에서 나눗셈이 정의되지 않는데
   * 서울 API는 그때도 비율을 준다는 것, 그리고 「거치율」의 정의를 우리가
   * 아니라 서울이 갖는다는 것이다.
   */
  readonly dockRate: number | null
}

/**
 * 거치율이 이 값 이상이면 거치대가 찼다. 100%가 곧 「자전거 수 = 거치대 수」다.
 *
 * 여유를 두지 않는다 — 95%를 「거의 참」으로 접으면 실제로 한 자리가 남은
 * 대여소에서 「반납 못 함」이라고 말하게 된다. 넘겨짚는 쪽이 아니라 서울이
 * 준 숫자가 넘는 순간만 말한다.
 */
const FULL_DOCK_RATE = 100

/**
 * **반납할 자리가 없나.** 모르면 `null`이다.
 *
 * 이 술어가 있는 이유는 화면이 답하지 못하던 질문이 있어서다 — 목록은 「몇 대
 * 빌릴 수 있나」만 말했고, 자전거를 **가지고 온** 사람에게는 그게 오히려 반대
 * 신호다(자전거가 많다 = 꽂을 데가 없다). 실호출에서 네 곳 중 한 곳이 이
 * 상태였다.
 */
export function isDockFull(station: BikeStation): boolean | null {
  return station.dockRate === null ? null : station.dockRate >= FULL_DOCK_RATE
}
