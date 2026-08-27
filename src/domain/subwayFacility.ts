/**
 * 역 승강기(`SUB_FACIINFO`) — 명세 80~85행의 「교통약자 이용시설 현황」.
 *
 * **명세의 이름은 `SUB_FACINFO`인데 실제 키는 `SUB_FACIINFO`다**(I가 하나 더 있다).
 * 이름대로 읽으면 언제나 빈 배열이 온다 — 2026-08-25에 그래서 미구현으로 남았다.
 */

/**
 * `ELVTR_SE`의 어휘. **명세에 값 목록이 없다**(`seoul_realdata.md` 85행이 이름만 준다).
 *
 * 넷은 2026-08-27 실호출 44역에서 나온 값 전부다. **뜻은 짐작한 게 아니라
 * 응답이 스스로 적어 준 것이다** — 같은 줄의 `ELVTR_NM`이
 * 「승강기)에스컬레이터-광화문 내부2」처럼 갈래 이름을 앞에 달고 온다. 160건을
 * 코드별로 갈라 세었고 어긋난 건이 없었다(ES→에스컬레이터 111 · EV→엘리베이터 36 ·
 * WL→휠체어리프트 11 · MW→무빙워크 2).
 *
 * **그래서 `PRK_TYPE`과 다르다.** 저쪽은 `BS`·`NS`·`NP` 코드가 오는데 뜻을 말해
 * 주는 필드가 어디에도 없어 「(공영)」을 못 그리고 남겨 뒀다. 여기는 증인이 있다.
 *
 * 그럼 왜 `ELVTR_NM`을 그대로 안 쓰는가. 자유 문장이 섞여 온다 —
 * 「승강기)엘리베이터_고속터미널(7)역 4번출구 E/L 3호기 15인승(P2」. 코드가 깨끗한
 * 값이고 이름은 그 뜻의 증인이다.
 *
 * `i18n.test.ts`가 이 표를 읽어 영어 사전 완결성을 잠근다. 새 코드를 보거든
 * 여기와 `en.ts`에 함께 더하라.
 */
export const SUBWAY_FACILITY_KINDS = {
  ES: '에스컬레이터',
  EV: '엘리베이터',
  WL: '휠체어리프트',
  MW: '무빙워크',
} as const

export type SubwayFacilityKind = keyof typeof SUBWAY_FACILITY_KINDS

export function isSubwayFacilityKind(value: string): value is SubwayFacilityKind {
  return Object.hasOwn(SUBWAY_FACILITY_KINDS, value)
}

/**
 * `USE_YN`의 어휘. 이름은 Y/N을 시사하지만 실제로는 한국어 낱말 둘이 온다 —
 * 2026-08-27 실호출 160건에서 사용가능 149 · 보수중 11이었다.
 */
export const SUBWAY_FACILITY_STATUSES = ['사용가능', '보수중'] as const

export type SubwayFacilityStatus = (typeof SUBWAY_FACILITY_STATUSES)[number]

export function isSubwayFacilityStatus(value: string): value is SubwayFacilityStatus {
  return (SUBWAY_FACILITY_STATUSES as readonly string[]).includes(value)
}

/** `SUB_FACIINFO`의 한 줄 — 승강기 하나. */
export interface SubwayFacility {
  /** ELVTR_SE. 처음 보는 코드면 `null` */
  readonly kind: SubwayFacilityKind | null
  /** OPR_SEC — 운행구간. 「B2-B3」·「B2-B1-1F」 */
  readonly section: string
  /**
   * INSTL_PSTN — 설치위치. 「서대문 방면1-1」·「8번 출입구」·「대합실」·
   * 「환승통로(2호선 방면)」. **자유 문장이라 옮기지 않는다** — 역 이름과
   * 출구 번호가 섞여 있다.
   */
  readonly position: string
  /** USE_YN. 처음 보는 값이면 `null` */
  readonly status: SubwayFacilityStatus | null
}

/**
 * 한 역·한 호선의 승강기 목록.
 *
 * **비어 있다는 것은 「승강기가 없다」가 아니다.** 2026-08-27 실호출 44역 중
 * 13역만 이 배열을 채웠는데, 빈 쪽에 강남역(2호선·신분당선)과 서울역(1·4호선·
 * 공항철도·경의중앙)이 통째로 들어 있다 — 둘 다 실제로는 엘리베이터가 있다.
 * 같은 역이라도 호선마다 갈린다(신당 6호선 22건, 신당 2호선 0건).
 *
 * 그래서 화면은 **있다는 말만 하고 없다는 말은 하지 않는다.**
 */
export interface SubwayStationFacilities {
  readonly station: string
  /** `SubwayArrival.line`과 같은 값이다 — 같은 자리에서 함께 만든다 */
  readonly line: string
  readonly facilities: readonly SubwayFacility[]
}

/**
 * 엘리베이터만. **계단을 못 쓰는 사람에게 에스컬레이터는 답이 아니다** —
 * 「이 역에 들어갈 수 있나」에 답하는 것은 이것뿐이라 따로 센다.
 */
export function elevators(
  facilities: readonly SubwayFacility[],
): readonly SubwayFacility[] {
  return facilities.filter((facility) => facility.kind === 'EV')
}

/**
 * 보수중인 것만. **상태를 모르는 것은 안 센다** — 「모른다」를 「고장」으로
 * 세면 없는 고장이 화면에 뜨고, 그걸 보고 돌아가는 사람이 생긴다.
 */
export function underRepair(
  facilities: readonly SubwayFacility[],
): readonly SubwayFacility[] {
  return facilities.filter((facility) => facility.status === '보수중')
}
