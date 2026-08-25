import type { CongestionTone } from './congestion'
import type { Coords } from './types'

// 전기차충전소(`CHARGER_STTS`). 명세 140~159행.
//
// **명세에 없는 배열이 하나 더 있다.** 명세는 충전기 필드(151~159)를 충전소
// 필드와 같은 층에 펼쳐 적었지만, 실제 응답은 `CHARGER_DETAILS` 배열로 한 겹
// 더 들어가 있다(2026-08-25 실호출). 상권의 `CMRCL_RSB`와 같은 함정이다.
//
// **명소별 편차가 크다** — 실호출에서 여의도한강공원 0곳, 홍대 35곳,
// 광화문·덕수궁 44곳이었다.

/** 충전기 한 대. `CHARGER_DETAILS`의 항목이다. */
export interface Charger {
  /** CHARGER_ID — 충전소 안에서의 번호(`02`). 목록의 키다 */
  readonly id: string
  /**
   * CHARGER_TYPE. 실호출 1,725대에서 네 값을 봤다 —
   * `AC완속` · `DC콤보` · `DC차데모+DC콤보` · `DC차데모+AC3상+DC콤보`.
   * **`+`로 이어진 복합값이 있다**(`chargerTypeParts`가 가른다).
   */
  readonly type: string
  /**
   * CHARGER_STAT. 같은 표본에서 여섯 값 —
   * `사용가능`(1,088) · `충전중`(475) · `상태미확인`(79) · `통신이상`(68) ·
   * `점검중`(14) · `운영중지`(1).
   */
  readonly status: string
  /** OUTPUT — 충전 용량(kW) */
  readonly outputKw: number | null
  /** METHOD — `단독`·`동시`. 빈 값으로도 온다 */
  readonly method: string
  /** STATUPDDT — 상태 갱신 일시 */
  readonly statusAt: string
  /** LASTTSDT / LASTTEDT — 마지막 충전 시작·종료 일시 */
  readonly lastStartAt: string
  readonly lastEndAt: string
  /** NOWTSDT — 지금 충전 중이라면 그 시작 일시. 아니면 빈 값 */
  readonly chargingSince: string
}

export interface ChargerStation {
  readonly name: string
  /** STAT_ID — 충전소 ID. 목록의 키다 */
  readonly id: string
  readonly address: string
  /** STAT_X가 경도, STAT_Y가 위도다 — 따릉이·버스와 같은 축 규칙 */
  readonly coords: Coords | null
  /** STAT_USETIME — **자유 문장이다.** 「24시간 이용가능,입주민만 사용가능
   *  거주자외출입제한」처럼 오는 값이 있어 옮기지 않는다 */
  readonly useTime: string
  /** STAT_PARKPAY — 주차료 유무. 모르면 null */
  readonly parkingPaid: boolean | null
  /** STAT_LIMITYN — 이용자 제한 여부. 실호출 1,725대 중 464대가 제한 있음이었다 */
  readonly limited: boolean | null
  /** STAT_LIMITDETAIL — 제한 사유. 서른일곱 가지가 나온 **자유 문장**이라 안 옮긴다 */
  readonly limitDetail: string
  /** STAT_KINDDETAIL — 시설 종류. 실호출에서 스물여섯 가지를 봤다 */
  readonly kind: string
  readonly chargers: readonly Charger[]
}

/**
 * 지금 꽂을 수 있나. **`사용가능`만 참이다.**
 *
 * `상태미확인`·`통신이상`을 「아마 될 것」으로 세지 않는다 — 그 셋을 합치면
 * 147대가 되는데, 가서 못 꽂는 쪽의 대가가 안 가는 쪽보다 크다.
 */
const AVAILABLE = '사용가능'

export function isChargerAvailable(charger: Charger): boolean {
  return charger.status.trim() === AVAILABLE
}

export function availableChargerCount(station: ChargerStation): number {
  return station.chargers.filter(isChargerAvailable).length
}

/**
 * 급속인가. **`DC`가 들어 있으면 급속이다.**
 *
 * 실호출에서 본 네 값이 이 규칙으로 정확히 갈린다 — `AC완속`만 완속이고
 * 나머지 셋은 전부 `DC`를 포함한다. `AC3상`은 복합값 안에서만 나타나는데 그
 * 값에도 `DC`가 함께 있어 규칙이 흔들리지 않는다.
 *
 * **출력(kW)으로 가르지 않는다.** 완속에도 11kW·14kW가 있고 급속의 하한과
 * 겹쳐서, 숫자로는 규칙을 세울 수 없다.
 */
export function isFastCharger(charger: Charger): boolean {
  return charger.type.toUpperCase().includes('DC')
}

/**
 * 복합 타입을 조각으로 가른다. `DC차데모+AC3상+DC콤보` → 셋.
 *
 * 통째로 옮기려 들면 조합마다 사전 항목이 필요하다 — 조각은 넷인데 조합은
 * 그보다 많이 늘 수 있다(`AlertBanner`의 갈래 이름과 같은 규칙이다).
 */
export function chargerTypeParts(type: string): readonly string[] {
  return type
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part !== '')
}

/**
 * 충전소의 톤. **주차장과 같은 방향이다** — 빈자리가 많아야 좋다.
 *
 * 대수가 아니라 **비율**로 가르지 않는다. 충전기는 한 자리가 있느냐 없느냐가
 * 답이라, 2대 중 1대나 20대 중 1대나 「지금 갈 수 있다」는 같다.
 */
export function chargerStationTone(station: ChargerStation): CongestionTone | null {
  if (station.chargers.length === 0) {
    return null
  }
  const available = availableChargerCount(station)
  if (available === 0) {
    return 'crowded'
  }
  return available >= 2 ? 'calm' : 'normal'
}

/**
 * 화면에 올릴 차례. **제한 없는 곳이 먼저다.**
 *
 * 실호출 1,725대 중 464대가 이용 제한이 걸려 있었다(「외부인 사용불가」·
 * 「입주민 전용」…). 사용가능 대수만으로 줄 세우면 **못 들어가는 충전소가 맨
 * 위에 온다** — 거기까지 가서야 알게 되는 것이 이 목록의 최악이다.
 *
 * 제한 여부를 **모르는 곳(`null`)은 제한 없는 쪽에 둔다.** 모른다고 뒤로
 * 미루면 정보가 부실한 충전소가 실제보다 나쁘게 취급된다.
 */
export function sortChargerStations(
  stations: readonly ChargerStation[],
  limit?: number,
): readonly ChargerStation[] {
  const sorted = [...stations].sort((left, right) => {
    const byLimit = Number(left.limited === true) - Number(right.limited === true)
    if (byLimit !== 0) {
      return byLimit
    }
    return availableChargerCount(right) - availableChargerCount(left)
  })
  return limit === undefined ? sorted : sorted.slice(0, limit)
}

/** 사전과 검사가 같은 목록을 보게 한다. 새 값을 보거든 여기와 `en.ts`에 함께 더하라. */
export const CHARGER_STATUSES: readonly string[] = [
  '사용가능',
  '충전중',
  '상태미확인',
  '통신이상',
  '점검중',
  '운영중지',
]

/** 복합값의 **조각**이다. 조합(`DC차데모+DC콤보`)이 아니라 이 넷이 사전에 든다. */
export const CHARGER_TYPE_PARTS: readonly string[] = [
  'AC완속',
  'DC콤보',
  'DC차데모',
  'AC3상',
]

export const CHARGER_METHODS: readonly string[] = ['단독', '동시']

/**
 * 시설 종류. 실호출 1,725대에서 스물여섯 가지를 봤다 — 환경부 코드표처럼
 * 닫혀 보이지만 **명세에 목록이 없어 단언할 수는 없다.** 없는 값은 `t()`가
 * 키를 그대로 돌려준다.
 */
export const CHARGER_KINDS: readonly string[] = [
  '사업장(사옥)',
  '아파트',
  '기타',
  '오피스텔',
  '백화점',
  '일반주차장',
  '마트(쇼핑몰)',
  '공원',
  '공공기관',
  '공영주차장',
  '관광지',
  '금융기관',
  '숙박시설',
  '종교시설',
  '관공서',
  '빌라',
  '주유소',
  '박물관',
  '카페',
  '영화관',
  '공연장',
  '음식점',
  '학교',
  '병원',
  '주민센터',
  '지자체시설',
]
