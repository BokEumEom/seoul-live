import type { Coords } from './types'

// 사고통제현황(`ACDNT_CNTRL_STTS`). 명세 131~139행.
//
// **`cityInfo.ts`에서 꺼냈다**(2026-08-25). `bike.ts`와 같은 이유다.

export interface AccidentControl {
  /** ACDNT_INFO — 통제 내용. 재난문자의 `message`처럼 이 항목의 본체다 */
  readonly info: string
  /**
   * ACDNT_ENG_INFO — **명세에 없는 필드다.** 서울 API가 통제 내용의 영어
   * 원문을 함께 준다(2026-08-25 실호출로 확인, 명세 131~139행에 없음).
   *
   * **이것이 이 필드를 읽는 유일한 이유다.** `info`는 서울 쪽 자유 문장이라
   * 사전으로 옮길 수 없고 — 「소공로 보행환경 개선공사(차로축소| 보도확장)
   * 소공로 서울광장~한국은행앞/양방향 하위1개차로 통제」 같은 값이다 —
   * 그동안 영어 화면에 이 줄만 한국어로 남았다. 옮길 수 없는 자리에 번역이
   * 딸려 온 것이라 안 쓸 이유가 없다.
   *
   * 비어 있으면 `info`로 떨어진다. 표본이 두 건뿐이라 「항상 온다」고 단정할
   * 수 없다.
   */
  readonly infoEn: string
  /** ACDNT_TYPE — 사고발생유형 */
  readonly type: string
  /** ACDNT_DTYPE — 사고발생세부유형 */
  readonly detailType: string
  /** ACDNT_OCCR_DT — 사고발생일시 원문 */
  readonly occurredAt: string
  /** EXP_CLR_DT — 통제종료예정일시 원문 */
  readonly expectedClearAt: string
  /**
   * `ACDNT_Y`(위도)와 `ACDNT_X`(경도). 따릉이·버스와 같은 축 규칙이다.
   *
   * 「어느 길이 막혔나」는 글로 적기 어려운 값이다 — 위 예시의 「소공로
   * 서울광장~한국은행앞」을 아는 사람만 읽을 수 있다. 지도가 그걸 대신한다.
   */
  readonly coords: Coords | null
}

/**
 * 사고발생유형. 실호출과 목업에서 본 값이다.
 *
 * **`ACDNT_ENG_TYPE`·`ACDNT_ENG_DTYPE`도 응답에 있지만 안 쓴다.** `info`와
 * 달리 이쪽은 값이 몇 개 안 되는 닫힌 어휘라 사전이 감당하고, 사전에 두면
 * `i18n.test.ts`의 완결성 검사가 새 값을 잡아 준다 — API 번역을 그대로 쓰면
 * 처음 보는 값이 와도 아무도 모른다. 옮길 수 있는 것은 우리가 옮긴다.
 *
 * 목록이 도메인에 있는 이유는 사전 검사가 여기서 값을 가져가기 때문이다.
 * 손으로 적은 목록을 검사 쪽에 두면 값이 늘 때 그 목록만 낡는다.
 */
export const ACCIDENT_TYPES: readonly string[] = [
  '교통사고',
  '공사',
  '집회및행사',
]

/** 사고발생세부유형. 위와 같은 규칙으로 사전에 든다. */
export const ACCIDENT_DETAIL_TYPES: readonly string[] = [
  '차대차',
  '도로보수',
  '행사',
]
