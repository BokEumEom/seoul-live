import type { AccidentControl } from './accident'
import type { BikeStation } from './bike'
import type { ChargerStation } from './charger'
import type { Commerce } from './commerce'
import type { CongestionTone } from './congestion'
import type { Freshness } from './freshness'
import type { RoadSegment } from './roadSegment'
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
  /**
   * 지도에 그을 선. **도로 구간만 갖는다**(`XYLIST`).
   *
   * 주차장·따릉이·충전소·행사·사고는 점이라 이 자리가 비고, 도로는 길이가
   * 있는 것이라 핀만 찍으면 「어디서 어디까지」가 빠진다. 선택 필드로 둔 이유는
   * 「이름 붙은 자리」라는 뜻이 같아서다 — 타입을 갈라 두면 `ShowOnMapButton`과
   * 지도 쪽 배선이 두 벌이 된다.
   */
  readonly path?: readonly Coords[]
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
  /**
   * PRECIPITATION — 이 시각의 강수량(mm). 안 오면 `null`이다.
   *
   * **여기가 이 필드의 쓸모 있는 자리다.** 같은 이름이 현재 날씨(명세 176행)
   * 에도 있는데 그쪽은 2026-08-25 표본 35곳 전부가 `-`였고, 예보 840칸에서는
   * 75칸에 실제 값이 있었다(2.0~11.0mm). 지금 안 오는 비를 알려 주는 값이
   * 아니라 **몇 시에 얼마나 오는지**를 말하는 값이다.
   *
   * `-`는 `numberOrNull`의 정규식이 걸러 `null`이 된다 — 그 대시를 숫자로
   * 읽으면 0mm가 되어 「비가 안 온다」와 「모른다」가 같은 값이 된다.
   */
  readonly precipitation: number | null
}

/**
 * NEWS_LIST의 한 줄 — 기상특보 하나. 명세 193~199행.
 *
 * **재난문자(`CityAlert`)와 다른 것이다.** 저쪽은 행정안전부 긴급재난문자이고
 * 이쪽은 기상청 특보라 출처도 갱신 주기도 다르다. 같은 화면에 함께 뜰 수 있다.
 */
export interface WeatherWarning {
  /** WARN_VAL — 기상특보종류. 실응답에서 `폭염`을 봤다(2026-08-25) */
  readonly kind: string
  /** WARN_STRESS — 기상특보강도. 실응답에서 `주의보`를 봤다 */
  readonly level: string
  /** ANNOUNCE_TIME 원문. 형식을 강제하지 않는다 — 표시에만 쓴다 */
  readonly announcedAt: string
  /**
   * COMMAND — 발표/해제. 실응답에서 `발표`만 봤다.
   *
   * **모르는 값을 「해제」로 읽지 않는다.** 아래 `isActiveWarning` 참고.
   */
  readonly command: string
  /** CANCEL_YN — 정상/취소. 실응답에서 `정상`만 봤다 */
  readonly cancelState: string
  /** WARN_MSG — 행동강령. 서울 API의 자유 문장이라 옮기지 않는다 */
  readonly message: string
}

/**
 * 지금 유효한 특보인가. **모르면 유효한 쪽으로 읽는다.**
 *
 * 이 저장소의 기본은 반대다 — 아는 모양이 통째로 맞을 때만 옮기고 아니면
 * 원문을 흘려보낸다(`i18n/subway.ts`). 여기서 뒤집는 이유는 **틀렸을 때의
 * 대가가 비대칭**이라서다. 해제된 특보를 띄우면 사용자가 한 번 헛걸음하지만,
 * 살아 있는 폭염경보를 숨기면 그 사람은 그것을 **어디서도 못 본다.**
 *
 * 그래서 「해제」·「취소」라고 **명시된 것만** 걷어낸다. 실응답에서 본 값은
 * `발표`·`정상`뿐이라 나머지 어휘는 확인된 것이 아니다 — 다른 말로 오면 그건
 * 그대로 배너에 남고, 그 편이 안전하다.
 */
const CLEARED_COMMANDS: ReadonlySet<string> = new Set(['해제'])
const CANCELLED_STATES: ReadonlySet<string> = new Set(['취소'])

export function isActiveWarning(warning: WeatherWarning): boolean {
  return (
    !CLEARED_COMMANDS.has(warning.command.trim()) &&
    !CANCELLED_STATES.has(warning.cancelState.trim())
  )
}

export interface Weather {
  readonly temperature: number | null
  readonly maxTemperature: number | null
  readonly minTemperature: number | null
  /** HUMIDITY — 습도(%) */
  readonly humidity: number | null
  /**
   * WIND_DIRCT — 풍향. **16방위 영문 약자로 온다**(실응답 2026-08-25: `SSE`).
   *
   * 원문 그대로 담고 한국어 이름은 `windDirectionLabel`이 고른다 — 도메인이
   * 완성된 글자를 지으면 영어 화면에서 그대로 남는다(`forecastHour`와 같은 규칙).
   */
  readonly windDirection: string
  /** WIND_SPD — 풍속(m/s) */
  readonly windSpeed: number | null
  /** SUNRISE — `05:43` 꼴. 형식을 강제하지 않는다 */
  readonly sunrise: string
  /** SUNSET — `19:31` 꼴 */
  readonly sunset: string
  /** UV_INDEX — 자외선지수. 실응답에서 `1`을 봤다 */
  readonly uvIndex: number | null
  /** UV_INDEX_LVL — 자외선지수 단계. 실응답에서 `낮음`을 봤다 */
  readonly uvGrade: string
  /** UV_MSG — 서울 API의 자유 문장이라 옮기지 않는다 */
  readonly uvMessage: string
  /** AIR_IDX_MVL — 통합대기환경지수의 **수치**. 등급(`airGrade`)과 짝이다 */
  readonly airIndexValue: number | null
  /** AIR_IDX_MAIN — 지수를 결정한 물질. 실응답에서 빈 문자열로도 온다 */
  readonly airIndexMain: string
  /** NEWS_LIST — 기상특보. 없으면 빈 배열이다 */
  readonly warnings: readonly WeatherWarning[]
  /**
   * FCST24HOURS — 시간대별 예보. 없으면 빈 배열이다.
   *
   * `citydata`의 같은 응답 안에 있어 추가 호출이 0이다. 현재 날씨(`temperature`)와
   * 달리 「앞으로 몇 시간」을 말하므로 카드에서 자리가 다르다.
   */
  readonly hourly: readonly HourlyForecast[]
  /** PCP_MSG — "비 소식이 없어요" 같은 서울 API 원문 */
  readonly precipitationMessage: string
  /**
   * PRECIPITATION — 지금 내리는 강수량(mm). 안 오면 `null`이다.
   *
   * **표본에서 한 번도 값을 못 봤다.** 2026-08-25 실호출 35곳 전부 `-`였다.
   * 비 오는 날 확인할 자리로 남겨 둔다 — 예보 쪽(`HourlyForecast`)은 같은
   * 이름으로 실제 숫자가 오므로 형식은 그쪽에서 확인했다(mm 단위 소수).
   */
  readonly precipitation: number | null
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

/**
 * 주차요금 네 값. 명세 54~57행.
 *
 * **`baseFee`가 0인 것과 값이 없는 것은 다르다.** 실호출에서 `PAY_YN: 'Y'`인데
 * `RATES: '0'`인 주차장이 셋 있었다(서울파이낸스빌딩·서울시청 본청사·
 * 광화문오피시아빌딩, 2026-08-25). 유료 주차장인데 기본요금이 0 — 그건
 * 「기본 시간 동안은 무료이고 그 뒤부터 과금」이라는 뜻이다. 이걸 「30분
 * 0원」이라고 적으면 공짜 주차장으로 읽힌다.
 */
export interface ParkingFee {
  /** RATES — 기본주차요금(원) */
  readonly baseFee: number | null
  /** TIME_RATES — 기본주차단위시간(분) */
  readonly baseMinutes: number | null
  /** ADD_RATES — 추가주차단위요금(원) */
  readonly addFee: number | null
  /** ADD_TIME_RATES — 추가주차단위시간(분) */
  readonly addMinutes: number | null
}

/**
 * 기본요금 문구의 **재료**. 도메인은 완성된 글자를 짓지 않는다 — 어떤 문장을
 * 쓸지(`kind`)와 값만 주고 문장은 화면이 `t()`로 만든다.
 */
export type ParkingBaseFee =
  | { readonly kind: 'paid'; readonly minutes: number; readonly won: number }
  | { readonly kind: 'freeFor'; readonly minutes: number }

/** 단위시간이 0이거나 없으면 요금을 말할 수 없다 — 「0분에 2,000원」은 뜻이 없다. */
export function parkingBaseFee(fee: ParkingFee | null): ParkingBaseFee | null {
  if (fee === null || fee.baseMinutes === null || fee.baseMinutes <= 0) {
    return null
  }
  if (fee.baseFee === null) {
    return null
  }
  return fee.baseFee <= 0
    ? { kind: 'freeFor', minutes: fee.baseMinutes }
    : { kind: 'paid', minutes: fee.baseMinutes, won: fee.baseFee }
}

/**
 * 추가요금. **0원은 안 적는다** — 무료 주차장이 네 값을 전부 0으로 보내는데
 * (`PAY_YN: 'N'`인 관광버스 승하차 구간 셋이 그랬다), 「10분당 0원」은
 * 정보가 아니라 잡음이다.
 */
export function parkingAddFee(
  fee: ParkingFee | null,
): { readonly minutes: number; readonly won: number } | null {
  if (fee === null || fee.addMinutes === null || fee.addMinutes <= 0) {
    return null
  }
  return fee.addFee === null || fee.addFee <= 0
    ? null
    : { minutes: fee.addMinutes, won: fee.addFee }
}

export interface ParkingLot {
  readonly name: string
  /**
   * PRK_CD — 주차장코드. **화면에 안 나온다. 목록의 키다.**
   *
   * 예전에는 이름을 키로 썼는데 한 명소에 같은 이름의 주차장이 둘 올 수 있다
   * (실호출에 「세종대로1·2·3 관광버스 승하차 허용 구간」처럼 번호만 다른
   * 것들이 있다). 코드가 없으면 이름으로 돌아간다.
   */
  readonly code: string
  /** ROAD_ADDR가 있으면 그것, 없으면 ADDRESS. 실호출은 33곳 중 1곳만 도로명이 있었다 */
  readonly address: string
  /** 요금 네 값. 하나도 못 읽으면 `null` */
  readonly fee: ParkingFee | null
  /** CUR_PRK_TIME — 실시간 주차 대수의 기준 시각. 실시간을 주는 곳에만 있다 */
  readonly liveCountAt: string
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

export interface CulturalEvent {
  readonly name: string
  readonly period: string
  readonly place: string
  /**
   * PAY_YN을 뒤집은 값. 모르면 null.
   *
   * **대부분 모른다.** 2026-08-25 실호출 53건 중 45건이 `null`이었고 값이 온
   * 여덟 건은 전부 `N`(무료)이었다 — `Y`는 한 번도 못 봤다. 시안(`_7`)의
   * 「유료」 배지가 실제로 뜨는 것을 본 적이 없다는 뜻이다.
   */
  readonly free: boolean | null
  readonly url: string
  /**
   * `EVENT_Y`(위도)와 `EVENT_X`(경도). 따릉이와 같은 축 규칙이다.
   *
   * 실호출 53건 전부에 있었다. `EVENT_PLACE`가 「더 갤러리 호수」처럼 아는
   * 사람만 아는 이름으로 오는 자리라 지도가 그걸 대신한다.
   */
  readonly coords: Coords | null
  /**
   * THUMBNAIL — 대표 이미지 URL. 시안 `_7`이 카드마다 그리는 그림이다.
   *
   * 실호출 53건 전부에 있었고 전부 `https://culture.seoul.go.kr`이었다.
   * `httpUrl`을 통과시켜 스킴을 확인한다 — 그대로 `<img src>`에 들어간다.
   *
   * **`EVENT_ETC_DETAIL`은 일부러 안 읽는다.** 53건 중 한 건만 값이 있었고
   * 그 한 건이 「기존 DDP 건축투어(…) 삭제해주시고， 새로 업로드 부탁드립니다」
   * 였다 — 사용자가 아니라 **담당자에게 쓴 메모**다. 「기타 세부정보」라는
   * 이름만 보고 화면에 얹으면 그런 문장이 행사 설명 자리에 뜬다.
   */
  readonly thumbnail: string
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

/** SUB_STTS의 한 줄 — 곧 도착하는 열차 하나. 명세 62~78행. */
export interface SubwayArrival {
  /** SUB_STN_NM — 지하철역명 */
  readonly station: string
  /**
   * 호선 이름. **역이 말한 것(`SUB_STN_LINE`)이 먼저다** — 2026-08-27 실측 34역에서
   * 샛강(신림선)의 열차가 `SUB_LINE: '4호선'`으로 왔다. 규칙과 근거는
   * `cityInfoSchema.ts`의 `lineOf`에 있다.
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

/** 버스정류소 하나. `BUS_STN_STTS`의 한 줄(명세 107~111행). */
export interface BusStop {
  readonly name: string
  /**
   * BUS_ARS_ID — 정류소 고유번호. **화면에 적는다.**
   *
   * 이름보다 이게 실물이다 — 정류소 기둥에 붙어 있는 번호이고, 버스 앱에서
   * 검색하는 것도 이 번호다. 「광화문역」이라는 이름의 정류소는 여럿이지만
   * `1009`는 하나다.
   */
  readonly arsId: string
  /** BUS_STN_ID — 내부 ID. 목록의 키로만 쓴다 */
  readonly id: string
  /** BUS_STN_X가 경도, BUS_STN_Y가 위도다. 따릉이와 같은 축 규칙이다 */
  readonly coords: Coords | null
}

/**
 * 승하차 인원 한 시간창. **min/max 쌍이다** — 서울 API가 값이 아니라 구간을 준다.
 *
 * 구간인 것이 중요하다. 「550~600명」의 폭 50이 이 데이터가 인정하는 불확실성
 * 이고, 아래 `ridershipFlow`가 그 폭을 그대로 판단 기준으로 쓴다.
 */
export interface RidershipWindow {
  readonly boardingMin: number | null
  readonly boardingMax: number | null
  readonly alightingMin: number | null
  readonly alightingMax: number | null
}

/**
 * 지하철·버스 승하차 인원. `LIVE_SUB_PPLTN`과 `LIVE_BUS_PPLTN`이다.
 *
 * **둘의 구조가 정확히 같다** — 접두어(`SUB_`/`BUS_`)만 다르고 나머지 18개
 * 키가 한 글자도 안 다르다(2026-08-25 실호출 대조). 그래서 타입도 파서도
 * 화면도 한 벌이다.
 */
export interface Ridership {
  /** 첫차 이후 누적 */
  readonly total: RidershipWindow
  readonly last30Minutes: RidershipWindow
  readonly last10Minutes: RidershipWindow
  readonly last5Minutes: RidershipWindow
  /** SUB_STN_CNT / BUS_STN_CNT — 이 명소 안의 역·정류장 개수 */
  readonly stopCount: number | null
  /** SUB_STN_TIME / BUS_STN_TIME — 개수의 기준 년월일(`20260825`) */
  readonly stopCountAt: string
}

/**
 * 지금 사람이 모이는 중인가 빠지는 중인가.
 *
 * **이 앱의 성격과 맞는 값이라 굳이 뽑는다.** 승하차 숫자 열여섯 개를 늘어놓는
 * 것보다, 하차가 승차보다 많으면 「모이는 중」이라고 한 문장으로 말하는 편이
 * 혼잡도 앱의 답에 가깝다.
 *
 * **문턱을 지어내지 않는다.** 두 구간이 겹치면 우열을 단정할 수 없으므로
 * `null`이다 — 「20% 이상 차이」 같은 임의의 숫자를 만들지 않고, 서울 API가
 * 스스로 인정한 불확실성(구간 폭)을 그대로 기준으로 쓴다.
 */
export type CrowdFlow = 'arriving' | 'leaving'

export function ridershipFlow(window: RidershipWindow): CrowdFlow | null {
  const { boardingMin, boardingMax, alightingMin, alightingMax } = window
  if (
    boardingMin === null ||
    boardingMax === null ||
    alightingMin === null ||
    alightingMax === null
  ) {
    return null
  }
  if (alightingMin > boardingMax) {
    return 'arriving'
  }
  return boardingMin > alightingMax ? 'leaving' : null
}

/**
 * 실호출에서 본 버스 호출 성공 메시지. **이것이 아니면 뭔가 잘못된 것이다.**
 *
 * 이 판정이 도메인에 있는 이유: 화면 파일에 두면 `i18n.test.ts`의 「감싸지 않은
 * 한국어」 검사가 잡는다. 그리고 그 검사가 옳다 — 이건 화면 글자가 아니라
 * **서울 API의 어휘**라 번역 대상이 아니고, 화면이 알아야 할 것은 「실패했나」
 * 뿐이다.
 */
const BUS_CALL_OK = '정상 호출되었습니다.'

/**
 * 버스 쪽 호출이 실패했나. **빈 메시지는 실패가 아니다** — 섹션 자체가 안 온
 * 것이고, 그때 화면은 절을 아예 안 그린다.
 *
 * 성공 문구를 하나만 아는 상태라 「아는 것이 아니면 실패」로 읽는다. 여기서
 * 틀리면 낯선 성공 메시지의 원문이 화면에 뜨는데, 그건 조용히 빈 목록을
 * 보여주는 것보다 낫다 — 적어도 무슨 일이 있었는지는 읽힌다.
 */
export function isBusCallFailure(message: string): boolean {
  const trimmed = message.trim()
  return trimmed !== '' && trimmed !== BUS_CALL_OK
}

/** 구간을 화면 글자로 만들 수 있나. 한쪽만 읽힌 구간은 못 그린다. */
export function hasRidershipRange(window: RidershipWindow): boolean {
  return (
    (window.boardingMin !== null && window.boardingMax !== null) ||
    (window.alightingMin !== null && window.alightingMax !== null)
  )
}

export interface CityInfo {
  readonly areaName: string
  readonly areaCode: string
  readonly weather: Weather | null
  readonly roadTraffic: RoadTraffic | null
  /**
   * 도로 구간별 소통. 요약(`roadTraffic`)과 **같은 섹션의 한 겹 안**이다.
   *
   * 실호출 35곳에서 3~281개였다. 화면은 이 중 몇 개만 그린다 —
   * 어느 것을 고르는지는 `sortRoadSegments`.
   */
  readonly roadSegments: readonly RoadSegment[]
  readonly accidents: readonly AccidentControl[]
  /**
   * ACDNT_TIME — 사고통제 갱신 시각. **행이 아니라 절의 값이다.**
   *
   * 명세는 이걸 통제 건마다 딸린 필드로 적었지만, 2026-08-25 실호출에서 같은
   * 명소의 두 건이 **같은 시각**(`2026-08-25 11:01`)이었다. 건별 발생 시각은
   * `occurredAt`이 따로 갖고 있으니 이쪽은 「이 목록이 언제 기준인가」다 —
   * `RoadTraffic.updatedAt`과 같은 값이다.
   *
   * 줄마다 적으면 같은 시각이 목록 길이만큼 반복된다. 첫 행에서 읽어 절의
   * 머리에 한 번 적는다.
   */
  readonly accidentsUpdatedAt: string
  readonly parking: readonly ParkingLot[]
  readonly bikes: readonly BikeStation[]
  readonly events: readonly CulturalEvent[]
  readonly alerts: readonly CityAlert[]
  readonly subway: readonly SubwayArrival[]
  /** 지하철 승하차 인원. 못 읽으면 `null` */
  readonly subwayRidership: Ridership | null
  readonly busStops: readonly BusStop[]
  /** 버스 승하차 인원. 지하철 쪽과 같은 모양이다 */
  readonly busRidership: Ridership | null
  /**
   * BUS_RESULT_MSG — 버스 데이터 호출 메시지.
   *
   * **정류소가 0곳일 때만 쓸모가 있다.** 「이 근처에 정류소가 없다」와 「버스
   * 쪽 호출이 실패했다」는 사용자에게 다른 안내인데, 목록만 보면 구분이 안 된다.
   * 실호출에서 본 값은 `정상 호출되었습니다.` 하나뿐이라, 그것이 아닐 때만
   * 원문을 그대로 보여준다(자유 문장이라 옮기지 않는다).
   */
  readonly busResultMessage: string
  /**
   * 실시간 상권. **명소에 따라 통째로 안 온다** — 실호출에서 여의도한강공원은
   * 이 섹션 자체가 없었다(2026-08-25). 공원·한강은 결제가 일어나는 곳이 아니라
   * 정상이고, 그때 상권 탭은 빈 상태를 그린다.
   */
  readonly commerce: Commerce | null
  /**
   * 전기차충전소. **명소별 편차가 크다** — 실호출에서 여의도한강공원 0곳,
   * 홍대 35곳, 광화문·덕수궁 44곳이었다(2026-08-25).
   */
  readonly chargers: readonly ChargerStation[]
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

/**
 * 자외선지수 단계의 톤. 기상청 5단계(`낮음`·`보통`·`높음`·`매우높음`·`위험`)다.
 *
 * **네 톤에 다섯 단계를 얹는다.** `매우높음`과 `위험`이 같은 `crowded`로
 * 접히는데, 톤을 하나 늘리는 것보다 낫다고 봤다 — 둘 다 「지금 나가면 안 된다」
 * 쪽이고, 실제로 갈라야 하는 정보는 **단계 이름 자체**가 옆에 그대로 적힌다.
 *
 * 실응답에서 본 값은 `낮음`뿐이다(2026-08-25). 나머지 넷은 기상청이 공표하는
 * 닫힌 목록이라 함께 적었다 — 도로 지표처럼 목록이 없는 자리와 다르다.
 * 모르는 값은 `?? null`이라 색이 안 붙을 뿐 틀리지 않는다.
 */
const TONE_BY_UV_GRADE: Readonly<Record<string, CongestionTone>> = {
  낮음: 'calm',
  보통: 'normal',
  높음: 'busy',
  매우높음: 'crowded',
  위험: 'crowded',
}

export function uvGradeTone(grade: string): CongestionTone | null {
  return TONE_BY_UV_GRADE[grade.trim()] ?? null
}

/**
 * 풍향 약자를 한국어 이름으로. `SSE` → `남남동`.
 *
 * **완성된 글자를 돌려주지 않는다** — 키를 돌려주고 화면이 `t()`로 감싼다
 * (`forecastHour`와 같은 규칙). 모르는 약자는 `null`이고, 그때 화면은 원문을
 * 그대로 적는다: 지어낸 방위보다 `SSE`가 낫다.
 *
 * 16방위는 기상 자료의 표준 어휘라 목록이 닫혀 있다. 실응답에서는 `SSE`를
 * 봤다(2026-08-25).
 */
const WIND_DIRECTION_NAMES: Readonly<Record<string, string>> = {
  N: '북',
  NNE: '북북동',
  NE: '북동',
  ENE: '동북동',
  E: '동',
  ESE: '동남동',
  SE: '남동',
  SSE: '남남동',
  S: '남',
  SSW: '남남서',
  SW: '남서',
  WSW: '서남서',
  W: '서',
  WNW: '서북서',
  NW: '북서',
  NNW: '북북서',
}

export function windDirectionLabel(raw: string): string | null {
  return WIND_DIRECTION_NAMES[raw.trim().toUpperCase()] ?? null
}

/** 사전과 검사가 같은 목록을 보게 한다. 방위가 하나 늘면 양쪽이 함께 죽는다. */
export const WIND_DIRECTION_LABELS: readonly string[] =
  Object.values(WIND_DIRECTION_NAMES)

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
    info.roadSegments.length > 0 ||
    info.accidents.length > 0 ||
    info.parking.length > 0 ||
    info.bikes.length > 0 ||
    info.events.length > 0 ||
    info.alerts.length > 0 ||
    info.subway.length > 0
  )
}
