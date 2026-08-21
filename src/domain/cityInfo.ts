import type { CongestionTone } from './congestion'
import type { Freshness } from './freshness'
import type { Coords } from './types'

// 「더보기」(도시정보) 화면이 쓰는 타입과 순수 함수. 혼잡도(citydata_ppltn)와 달리
// 이쪽 값들은 서울 API가 "없으면 아예 안 보내거나 빈 문자열로 보내는" 필드가 많아
// 숫자·문자열 모두 null을 정상 상태로 취급한다. 화면이 아니라 여기서 흡수한다.

/**
 * 지도에서 짚어 줄 수 있는 시설 하나. 주차장·따릉이 대여소가 이 모양이 된다.
 *
 * 좌표가 **있는** 것만 이 타입이 된다(`ParkingLot.coords`는 `null`일 수 있다) —
 * 화면이 「좌표가 있나」를 매번 되묻지 않게 경계를 여기서 긋는다.
 */
export interface FacilityLocation {
  readonly name: string
  readonly coords: Coords
}

/** 좌표가 있는 것만 지도로 보낼 수 있는 모양으로 바꾼다. */
export function toFacilityLocation(place: {
  readonly name: string
  readonly coords: Coords | null
}): FacilityLocation | null {
  return place.coords === null ? null : { name: place.name, coords: place.coords }
}

/** FCST24HOURS의 한 칸. 명세 200~206행. */
export interface HourlyForecast {
  /** FCST_DT 원문. 형식을 모르므로 표시용 라벨은 `forecastHourLabel`이 만든다 */
  readonly time: string
  /** TEMP — 이 시각의 기온 */
  readonly temperature: number | null
  /** RAIN_CHANCE — 강수확률(%) */
  readonly rainChance: number | null
  /** SKY_STTS — 하늘상태 */
  readonly sky: string
  /** PRECPT_TYPE — 강수형태 */
  readonly precipitationType: string
}

export interface Weather {
  readonly temperature: number | null
  readonly maxTemperature: number | null
  readonly minTemperature: number | null
  /**
   * FCST24HOURS — 시간대별 예보. 없으면 빈 배열이다.
   *
   * `citydata`의 같은 응답 안에 있어 추가 호출이 0이다. 현재 날씨(`temperature`)와
   * 달리 「앞으로 몇 시간」을 말하므로 카드에서 자리가 다르다.
   */
  readonly hourly: readonly HourlyForecast[]
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
  /**
   * `LAT`/`LNG`. 지도에서 자리를 짚어 주는 데 쓴다.
   *
   * `null`일 수 있다 — 실응답에도 빈 문자열로 오는 행이 있고, 좌표 없는
   * 주차장에 「지도에서 보기」를 띄우면 눌러도 아무 일이 안 일어난다.
   */
  readonly coords: Coords | null
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
   * **2026-08-21에 톤이 붙었다** — `roadIndexTone`. 「인증키가 나오면 실제
   * 값을 확인하고 그때 정한다」던 자리이고, 실호출 응답에서 `정체`·`서행`을
   * 확인했다. 명세에 값 목록이 없는 것은 그대로라 **표에 없는 값은 색이
   * 안 붙는다**(`?? null`) — 미룰 때 걱정한 「틀린 톤이 붙는다」를 그것이 막는다.
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

/** SUB_STTS의 한 줄 — 곧 도착하는 열차 하나. 명세 62~78행. */
export interface SubwayArrival {
  /** SUB_STN_NM — 지하철역명 */
  readonly station: string
  /**
   * 호선 이름. 2026-08-13 실측: **열차 쪽 `SUB_LINE`이 「3호선」**으로 오고,
   * 역 쪽 `SUB_STN_LINE`은 「3」처럼 숫자만 온다. 그래서 열차 쪽을 먼저 쓰고
   * 없으면 역의 숫자에 「호선」을 붙인다 — 숫자만 쓰면 「경복궁 3」이 된다.
   */
  readonly line: string
  /** SUB_DIR — 지하철방향 */
  readonly direction: string
  /** SUB_TERMINAL — 종착역 */
  readonly terminal: string
  /**
   * SUB_ARMG1 원문. 실측값은 「전역 출발」·「9분 후 (동대입구)」·「4분 30초 후 (무악재)」다.
   *
   * **그대로 보여주고 파싱하지 않는다**(`ROAD_TRAFFIC_IDX`와 같은 규칙). 「분」을
   * 숫자로 뽑으려 들면 「전역 출발」에서 무엇을 뽑을지가 없다.
   *
   * SUB_ARMG2는 읽지 않는다 — 실제 값이 이 문자열의 괄호 안에 이미 들어 있는
   * 역 이름이라, 따로 붙이면 같은 말이 두 번 나온다.
   */
  readonly message: string
}

/** 같은 역·같은 호선의 도착 열차를 묶은 것. 화면이 역 이름을 한 번만 적는다. */
export interface SubwayLineArrivals {
  readonly station: string
  readonly line: string
  readonly arrivals: readonly SubwayArrival[]
}

/**
 * 역·호선으로 묶는다. **순서는 응답 그대로 둔다.**
 *
 * 도착 시각으로 다시 정렬하지 않는 이유는 정렬 기준을 만들 수 없어서다 —
 * `message`가 「4분 20초 후」일 수도 「전역 출발」일 수도 있어 둘을 한 축에
 * 세울 방법이 없다. 서울 API가 내려준 차례가 유일하게 근거 있는 순서다.
 */
export function groupSubwayArrivals(
  arrivals: readonly SubwayArrival[],
): readonly SubwayLineArrivals[] {
  // 역명과 호선이 함께 키다. 강남역에 2호선과 신분당선이 함께 오는데 역명만으로
  // 묶으면 서로 다른 노선의 열차가 한 덩어리로 보인다(detail_page.png).
  const keyOf = (arrival: SubwayArrival) => `${arrival.station} ${arrival.line}`

  // Set이 처음 나온 순서를 지킨다. 누산기에 push하지 않으므로 입력도 중간값도
  // 건드리지 않는다 — 목록이 한 자릿수라 filter를 다시 도는 비용은 무시할 만하다.
  return [...new Set(arrivals.map(keyOf))].map((key) => {
    const bucket = arrivals.filter((arrival) => keyOf(arrival) === key)
    return {
      station: bucket[0].station,
      line: bucket[0].line,
      arrivals: bucket,
    }
  })
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
  readonly subway: readonly SubwayArrival[]
  /**
   * 이 응답이 얼마나 묵었나. **모르면 `null`이고, 그때 화면은 모른다고 말한다.**
   *
   * 선택 항목으로 두지 않는다(`nameEn`과 같은 이유) — 빠뜨린 자리가 조용히
   * `undefined`가 되면 화면이 「방금」과 「모름」 중 무엇을 골랐는지 알 수 없다.
   * 필수로 두어 컴파일러가 만드는 쪽마다 답하게 한다.
   */
  readonly freshness: Freshness | null
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

/**
 * 도로소통 지표의 톤. **2026-08-21에 붙였다** — `RoadTraffic.index`의 주석이
 * 「인증키가 나오면 실제 값을 확인하고 그때 톤을 붙일지 정한다」였고, 그 조건이
 * 충족됐다.
 *
 * **확인한 것:** 실호출 응답(`docs/fixtures/citydata-광화문덕수궁.json`)에
 * 전체 지표 `정체`, 구간 지표 `정체`·`서행`이 들어 있다. `원활`은 사전
 * (`i18n/en.ts`)에 이미 있고 `i18n.test.ts`의 `ROAD_STATE_LABELS`가 셋을
 * 붙들어 둔다.
 *
 * **여전히 명세에는 값 목록이 없다**(`seoul_realdata.md`의 「값 목록이 명세에
 * 없다」 항목). 그래서 표에 없는 값은 `null`이다 — 미룰 때 걱정했던 것은
 * 「처음 보는 값에 **틀린 색**이 붙는 것」이었는데, `?? null`이 정확히 그것을
 * 막는다. 색이 안 붙을 뿐 틀리지는 않는다.
 *
 * **네 톤 중 `normal`을 안 쓴다.** 도로 지표에는 중립에 해당하는 값이 없다 —
 * `서행`은 이미 「막히기 시작했다」라서 `normal`(보통)로 적으면 실제보다
 * 낫게 말하게 된다. 값이 셋이므로 톤도 셋이다.
 */
const TONE_BY_ROAD_INDEX: Readonly<Record<string, CongestionTone>> = {
  원활: 'calm',
  서행: 'busy',
  정체: 'crowded',
}

export function roadIndexTone(index: string): CongestionTone | null {
  return TONE_BY_ROAD_INDEX[index.trim()] ?? null
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

/**
 * 예보 칸의 기온. 현재 기온(`formatTemperature`)과 달리 소수점을 뺀다.
 *
 * 같은 값을 두 가지로 적는 것은 정밀도가 아니라 폭 때문이다 — 예보 타일은
 * 56px이라 「31.0°」가 넘친다. 카드 상단의 지금 기온은 0.1도까지 그대로 둔다.
 */
export function formatForecastTemperature(celsius: number | null): string {
  return celsius === null ? '—' : `${Math.round(celsius)}°`
}

// 붙여 쓴 형식(YYYYMMDDHHmm)과 구분자가 있는 형식(… HH:mm) 둘 다 받는다.
// FCST_DT의 형식이 공식 명세에 없어서 — 출력명 「예보시간」만 있고 예시가 없다 —
// 실제 응답이 어느 쪽인지 모른다. 둘 다 읽고, 어느 쪽도 아니면 뽑지 않는다.
const COMPACT_HOUR = /^\d{8}(\d{2})\d{2}$/
const DELIMITED_HOUR = /(\d{1,2}):\d{2}/

const HOURS_IN_DAY = 24

/**
 * 예보 시각에서 **0~23의 시(hour)를 뽑는다.** 모르는 형식이면 `null`이다.
 *
 * 짐작으로 두 자리를 자르면 처음 보는 형식에서 엉뚱한 숫자가 시각으로 둔갑한다.
 * `ROAD_TRAFFIC_IDX`를 톤에 겹치지 않은 것과 같은 판단이다 — 모르면 원문이 낫다.
 *
 * **예전에는 「14시」라는 완성된 글자를 돌려줬다.** 그래서 영어 화면의 시간대
 * 날씨 줄이 통째로 한국어로 남았다 — 도메인은 언어를 모르는데 글자를 지었기
 * 때문이다. 지금은 숫자만 주고 「어느 말로 적을지」는 화면이 정한다
 * (`t('{시}시')` → `14:00`). 원문 폴백도 화면 몫이다: 뽑지 못했다는 사실만
 * `null`로 전하고, 그때 무엇을 적을지는 부르는 쪽이 안다.
 */
export function forecastHour(raw: string): number | null {
  const matched = raw.trim().match(COMPACT_HOUR) ?? raw.trim().match(DELIMITED_HOUR)
  if (matched === null) {
    return null
  }

  const hour = Number(matched[1])
  // 25시는 시각이 아니다. 뽑아서 적으면 없는 시각을 단정하게 된다.
  return hour >= 0 && hour < HOURS_IN_DAY ? hour : null
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
    info.alerts.length > 0 ||
    info.subway.length > 0
  )
}
