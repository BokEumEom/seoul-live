import type { CongestionTone } from './congestion'

// 「더보기」(도시정보) 화면이 쓰는 타입과 순수 함수. 혼잡도(citydata_ppltn)와 달리
// 이쪽 값들은 서울 API가 "없으면 아예 안 보내거나 빈 문자열로 보내는" 필드가 많아
// 숫자·문자열 모두 null을 정상 상태로 취급한다. 화면이 아니라 여기서 흡수한다.

export interface Weather {
  readonly temperature: number | null
  readonly maxTemperature: number | null
  readonly minTemperature: number | null
  /** PCP_MSG — "비 소식이 없어요" 같은 서울 API 원문 */
  readonly precipitationMessage: string
  readonly pm10: number | null
  /** PM10_INDEX — 좋음/보통/나쁨/매우나쁨 */
  readonly pm10Grade: string
  readonly pm25: number | null
  readonly pm25Grade: string
  /** AIR_IDX — 통합대기환경등급 */
  readonly airGrade: string
  readonly airMessage: string
  /** WEATHER_TIME 원문. 혼잡도와 달리 형식을 강제하지 않는다 — 표시에만 쓴다 */
  readonly updatedAt: string
}

export interface ParkingLot {
  readonly name: string
  /** CPCTY — 총 수용 면수 */
  readonly capacity: number | null
  /** CUR_PRK_CNT — 지금 댈 수 있는 면수 */
  readonly available: number | null
  /** CUR_PRK_YN === 'Y'. 실시간 정보를 주지 않는 주차장이 섞여 있다 */
  readonly liveAvailable: boolean
  /** PAY_YN. 모르면 null */
  readonly paid: boolean | null
}

export interface BikeStation {
  readonly name: string
  /** SBIKE_PARKING_CNT — 거치된 자전거 수(= 지금 빌릴 수 있는 대수) */
  readonly bikes: number | null
  /** SBIKE_RACK_CNT — 거치대 수 */
  readonly racks: number | null
}

export interface CulturalEvent {
  readonly name: string
  readonly period: string
  readonly place: string
  /** PAY_YN을 뒤집은 값. 모르면 null */
  readonly free: boolean | null
  readonly url: string
}

export interface CityAlert {
  /** DST_SE_NM — 재해구분명 */
  readonly category: string
  /** EMRG_STEP_NM — 긴급단계명 */
  readonly step: string
  readonly message: string
  readonly createdAt: string
}

export interface RoadTraffic {
  /**
   * ROAD_TRAFFIC_IDX — 전체도로소통평균현황.
   *
   * **문자열 그대로 보여주고 톤에 겹치지 않는다.** 대기등급을 혼잡도 네 톤에
   * 얹은 것(`TONE_BY_AIR_GRADE`)과 다르게 가는 이유는 값 목록을 모르기
   * 때문이다 — 공식 명세(`서울시+실시간+도시데이터.xls`)에 이 필드의 출력명만
   * 있고 값의 종류가 없다. 「원활」·「서행」·「정체」로 짐작해 매핑을 넣으면
   * 실제 값이 다를 때 **화면에 아무 톤도 안 붙는 게 아니라 틀린 톤이 붙는다.**
   * 인증키가 나오면 실제 값을 확인하고 그때 톤을 붙일지 정한다(STATE.md).
   */
  readonly index: string
  /** ROAD_TRAFFIC_SPD — 전체 평균 속도(km/h로 읽는다) */
  readonly speed: number | null
  /** ROAD_MSG — 서울 API 원문 안내 */
  readonly message: string
  /** ROAD_TRAFFIC_TIME 원문. 날씨와 같이 형식을 강제하지 않는다 */
  readonly updatedAt: string
}

export interface AccidentControl {
  /** ACDNT_INFO — 통제 내용. 재난문자의 `message`처럼 이 항목의 본체다 */
  readonly info: string
  /** ACDNT_TYPE — 사고발생유형 */
  readonly type: string
  /** ACDNT_DTYPE — 사고발생세부유형 */
  readonly detailType: string
  /** ACDNT_OCCR_DT — 사고발생일시 원문 */
  readonly occurredAt: string
  /** EXP_CLR_DT — 통제종료예정일시 원문 */
  readonly expectedClearAt: string
}

export interface CityInfo {
  readonly areaName: string
  readonly areaCode: string
  readonly weather: Weather | null
  readonly roadTraffic: RoadTraffic | null
  readonly accidents: readonly AccidentControl[]
  readonly parking: readonly ParkingLot[]
  readonly bikes: readonly BikeStation[]
  readonly events: readonly CulturalEvent[]
  readonly alerts: readonly CityAlert[]
}

// 통합대기환경등급을 혼잡도와 같은 네 톤에 겹친다. 색 토큰을 하나만 유지하려는
// 것이다 — 대기용 색을 따로 만들면 같은 화면에 "초록"이 두 종류 생긴다.
const TONE_BY_AIR_GRADE: Readonly<Record<string, CongestionTone>> = {
  좋음: 'calm',
  보통: 'normal',
  나쁨: 'busy',
  매우나쁨: 'crowded',
}

/** 모르는 등급은 null이다. 임의로 'normal'에 떨어뜨리면 "보통"이라고 단정하게 된다. */
export function airGradeTone(grade: string): CongestionTone | null {
  return TONE_BY_AIR_GRADE[grade.trim()] ?? null
}

// 여유 면수 비율의 경계. 30% 이상이면 그냥 가도 되고, 10% 미만이면 도착해서
// 못 댈 가능성이 실제로 있다.
const PARKING_CALM_RATIO = 0.3
const PARKING_NORMAL_RATIO = 0.1

/** 수용 면수를 모르거나 0이면 null. "만차"와 "값 없음"은 다르다. */
export function parkingTone(
  available: number | null,
  capacity: number | null,
): CongestionTone | null {
  if (available === null || capacity === null || capacity <= 0) {
    return null
  }
  if (available <= 0) {
    return 'crowded'
  }
  const ratio = available / capacity
  if (ratio >= PARKING_CALM_RATIO) {
    return 'calm'
  }
  return ratio >= PARKING_NORMAL_RATIO ? 'normal' : 'busy'
}

// 값을 모르는 항목을 맨 뒤로 보내는 정렬 키. -1을 쓰면 "0대 남음"보다도 뒤로 가는데,
// 0은 실제로 확인된 값이라 모르는 것보다 앞에 와야 한다.
function descendingByCount<T>(items: readonly T[], count: (item: T) => number | null): readonly T[] {
  return items.toSorted((a, b) => {
    const left = count(a)
    const right = count(b)
    if (left === null) return right === null ? 0 : 1
    if (right === null) return -1
    return right - left
  })
}

function limited<T>(items: readonly T[], limit?: number): readonly T[] {
  return limit === undefined ? items : items.slice(0, limit)
}

export function sortParkingByAvailable(
  lots: readonly ParkingLot[],
  limit?: number,
): readonly ParkingLot[] {
  return limited(
    descendingByCount(lots, (entry) => entry.available),
    limit,
  )
}

export function sortBikesByStock(
  stations: readonly BikeStation[],
  limit?: number,
): readonly BikeStation[] {
  return limited(
    descendingByCount(stations, (entry) => entry.bikes),
    limit,
  )
}

/** 값이 없을 때 화면마다 다른 문자를 쓰지 않도록 대시 하나로 고정한다. */
export function formatTemperature(celsius: number | null): string {
  return celsius === null ? '—' : `${celsius.toFixed(1)}°`
}

/** 어느 섹션에도 내용이 없으면 화면이 빈 상태 문구 하나만 보여준다. */
export function hasAnyCityInfo(info: CityInfo): boolean {
  // **섹션을 더할 때 여기도 더해야 한다.** 빠뜨리면 그 섹션만 있는 명소가
  // 「정보 없음」으로 뜨는데, 정작 화면에는 그 섹션이 그려져 있어 안내와 내용이
  // 서로 다른 말을 한다. 새 필드를 넣고 이 함수를 안 고쳐서 실제로 겪었다.
  return (
    info.weather !== null ||
    info.roadTraffic !== null ||
    info.accidents.length > 0 ||
    info.parking.length > 0 ||
    info.bikes.length > 0 ||
    info.events.length > 0 ||
    info.alerts.length > 0
  )
}
