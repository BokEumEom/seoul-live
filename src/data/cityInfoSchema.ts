import { z } from 'zod'
import type {
  AccidentControl,
  BikeStation,
  BusStop,
  CityAlert,
  CityInfo,
  CulturalEvent,
  HourlyForecast,
  ParkingFee,
  ParkingLot,
  Ridership,
  RidershipWindow,
  RoadTraffic,
  SubwayArrival,
  Weather,
  WeatherWarning,
} from '../domain/cityInfo'
import type { Charger, ChargerStation } from '../domain/charger'
import {
  hasReadableCommerce,
  type Commerce,
  type CommerceCategory,
} from '../domain/commerce'
import { AreaNameMismatchError, seoulApiErrorFrom } from './schema'
import { asRow, coordsOrNull, numberOrNull, text, type Row } from './rowReaders'

// `citydata` 응답을 CityInfo로 옮긴다. `citydata_ppltn`을 다루는 schema.ts와 달리
// 필드 단위 zod 스키마를 세우지 않는다. 이유는 취향이 아니라 검증 가능성이다:
//
//   - 인증키가 없어 실제 응답을 한 번도 못 봤다. 필드 이름·타입·유무를 명세의
//     출력명 표에서만 읽었고, 그중 몇 개는 명세 안에서도 표기가 흔들린다.
//   - 이 화면의 값들은 하나가 없어도 나머지를 보여주는 게 맞다. 엄격한 스키마는
//     주차장 한 곳의 필드 하나 때문에 날씨까지 통째로 날린다.
//
// 그래서 zod는 "봉투가 봉투인가"(CITYDATA와 AREA_NM)까지만 보고, 그 안쪽은
// 아래의 관대한 리더들이 읽는다. 값이 없거나 모양이 다르면 던지지 않고 null·빈
// 배열로 떨어뜨린다. 혼잡도(schema.ts)가 엄격한 것과 반대 방향인데, 그쪽은 값이
// 곧 화면의 존재 이유라 틀린 값을 보여주느니 실패해야 하고, 이쪽은 부가 정보라
// 일부가 비는 게 정상이기 때문이다.
const envelopeSchema = z.object({
  CITYDATA: z
    .object({
      // AREA_NM만 필수다. `sample` 인증키가 무엇을 요청하든 광화문·덕수궁을
      // 돌려주는 문제를 여기서도 막아야 한다 — 이 대조가 없으면 어느 명소를
      // 골라도 같은 날씨가 뜨는데 아무도 모른다.
      AREA_NM: z.string(),
      // 코드는 표시에만 쓴다. 없다고 화면을 죽일 이유가 없다.
      AREA_CD: z.string().optional(),
    })
    .catchall(z.unknown()),
})

// 행 리더는 `rowReaders.ts`가 갖는다 — CCTV(`cctvSchema.ts`)와 나눠 쓰기
// 때문이다. 특히 `coordsOrNull`의 축·범위 가드는 두 벌로 두면 안 된다.

// 서울 API의 하위 섹션은 배열로 오는 것이 원칙이지만 항목이 하나면 객체로 오는
// 사례가 있다. 키 이름도 명세와 실제 응답이 어긋난다는 보고가 있어(문화행사),
// 후보를 여러 개 받아 처음으로 내용이 있는 것을 쓴다.
function sectionRows(container: Row, keys: readonly string[]): readonly Row[] {
  for (const key of keys) {
    const value = container[key]
    if (Array.isArray(value)) {
      const rows = value.map(asRow).filter((row): row is Row => row !== null)
      if (rows.length > 0) {
        return rows
      }
      continue
    }
    const single = asRow(value)
    if (single !== null) {
      return [single]
    }
  }
  return []
}

// PAY_YN이 'Y'/'N'으로 오는지 '유료'/'무료'로 오는지 확정하지 못했다. 명세는
// "유무료 여부"라고만 적혀 있고 주차장과 문화행사가 같은 이름을 쓴다.
const PAID_VALUES: ReadonlySet<string> = new Set(['Y', '유료'])
const FREE_VALUES: ReadonlySet<string> = new Set(['N', '무료'])

function paidFlag(row: Row, key: string): boolean | null {
  const raw = text(row, key).toUpperCase()
  if (PAID_VALUES.has(raw)) {
    return true
  }
  return FREE_VALUES.has(raw) ? false : null
}

// 링크는 그대로 <a href>에 들어간다. `javascript:` 스킴을 걸러야 서울 API 쪽
// 데이터가 오염됐을 때 그게 곧바로 스크립트 실행이 되지 않는다.
function httpUrl(row: Row, key: string): string {
  const raw = text(row, key)
  return /^https?:\/\//i.test(raw) ? raw : ''
}

// FCST24HOURS는 WEATHER_STTS 안에 중첩된 배열이다(명세 200~206행). 시각이 이
// 항목의 본체라 시각 없는 칸은 버린다 — 「31°」만 남으면 언제의 기온인지
// 알려주지 못한다. 시각의 **형식**은 모른다: `time`에 원문을 그대로 담고
// 표시용 라벨은 도메인의 `forecastHourLabel`이 만든다.
function toHourly(rows: readonly Row[]): readonly HourlyForecast[] {
  return named(
    rows,
    'FCST_DT',
    (row, time): HourlyForecast => ({
      time,
      temperature: numberOrNull(row, 'TEMP'),
      rainChance: numberOrNull(row, 'RAIN_CHANCE'),
      sky: text(row, 'SKY_STTS'),
      precipitationType: text(row, 'PRECPT_TYPE'),
    }),
  )
}

// NEWS_LIST는 WEATHER_STTS 안의 중첩 배열이다(명세 193~199행). 기상청 특보라
// 재난문자(LIVE_DST_MESSAGE)와 출처가 다르고, 화면에서도 자리가 다르다.
//
// **종류 없는 줄은 버린다.** `WARN_VAL`이 이 항목의 본체다 — 강도만 있고 종류가
// 없으면 「주의보」라고만 뜨는데 무엇의 주의보인지 알려주지 못한다.
function toWarnings(rows: readonly Row[]): readonly WeatherWarning[] {
  return named(
    rows,
    'WARN_VAL',
    (row, kind): WeatherWarning => ({
      kind,
      level: text(row, 'WARN_STRESS'),
      announcedAt: text(row, 'ANNOUNCE_TIME'),
      command: text(row, 'COMMAND'),
      cancelState: text(row, 'CANCEL_YN'),
      message: text(row, 'WARN_MSG'),
    }),
  )
}

function toWeather(row: Row): Weather {
  return {
    temperature: numberOrNull(row, 'TEMP'),
    hourly: toHourly(sectionRows(row, ['FCST24HOURS'])),
    maxTemperature: numberOrNull(row, 'MAX_TEMP'),
    minTemperature: numberOrNull(row, 'MIN_TEMP'),
    humidity: numberOrNull(row, 'HUMIDITY'),
    windDirection: text(row, 'WIND_DIRCT'),
    windSpeed: numberOrNull(row, 'WIND_SPD'),
    sunrise: text(row, 'SUNRISE'),
    sunset: text(row, 'SUNSET'),
    uvIndex: numberOrNull(row, 'UV_INDEX'),
    uvGrade: text(row, 'UV_INDEX_LVL'),
    uvMessage: text(row, 'UV_MSG'),
    precipitationMessage: text(row, 'PCP_MSG'),
    pm10: numberOrNull(row, 'PM10'),
    pm10Grade: text(row, 'PM10_INDEX'),
    pm25: numberOrNull(row, 'PM25'),
    pm25Grade: text(row, 'PM25_INDEX'),
    airGrade: text(row, 'AIR_IDX'),
    airIndexValue: numberOrNull(row, 'AIR_IDX_MVL'),
    airIndexMain: text(row, 'AIR_IDX_MAIN'),
    airMessage: text(row, 'AIR_MSG'),
    // 특보는 **날씨 행 안**에 있다. 재난문자처럼 최상위에 있을 것 같지만
    // 아니다 — 실응답에서 `WEATHER_STTS[0].NEWS_LIST`로 확인했다(2026-08-25).
    warnings: toWarnings(sectionRows(row, ['NEWS_LIST'])),
    updatedAt: text(row, 'WEATHER_TIME'),
  }
}

// 이름이 없는 항목은 버린다. 화면이 이름으로 항목을 구분하므로 이름 없는 카드는
// 사용자에게 아무것도 알려주지 못하고 자리만 차지한다.
function named<T>(rows: readonly Row[], key: string, build: (row: Row, name: string) => T): readonly T[] {
  return rows.flatMap((row) => {
    const name = text(row, key)
    return name === '' ? [] : [build(row, name)]
  })
}

// 도로소통은 요약 한 줄이라 날씨처럼 첫 행만 읽는다.
//
// **구간 목록은 일부러 안 읽는다.** 같은 섹션에 `LINK_ID`·`ROAD_NM`·`SPD`·
// `XYLIST`가 도로 구간마다 딸려 오는데, `XYLIST`는 보간점 좌표 덩어리이고
// 구간 수는 명소마다 다르다. 시트는 좁고(half에서 목록이 약 5.9행) 여기서
// 필요한 것은 「지금 이 근처가 막히는가」 한 줄이다. 구간별로 보여줄 일이
// 생기면 그건 이 카드가 아니라 지도 위에 그릴 일이다.
function toRoadTraffic(row: Row): RoadTraffic | null {
  const index = text(row, 'ROAD_TRAFFIC_IDX')
  const message = text(row, 'ROAD_MSG')
  // 본체가 없으면 항목을 만들지 않는다 — 주차장의 이름, 재난문자의 내용과 같은
  // 규칙이다. 속도만 남으면 카드에 「18.4」 하나만 뜬다.
  if (index === '' && message === '') {
    return null
  }
  return {
    index,
    message,
    speed: numberOrNull(row, 'ROAD_TRAFFIC_SPD'),
    updatedAt: text(row, 'ROAD_TRAFFIC_TIME'),
  }
}

function toAccidents(rows: readonly Row[]): readonly AccidentControl[] {
  // 사고통제도 내용이 본체다(재난문자와 같다). 유형만 오고 내용이 비면
  // 「교통사고」라고만 적힌 카드가 되어 무엇을 조심하라는 건지 알려주지 못한다.
  return named(
    rows,
    'ACDNT_INFO',
    (row, info): AccidentControl => ({
      info,
      type: text(row, 'ACDNT_TYPE'),
      detailType: text(row, 'ACDNT_DTYPE'),
      occurredAt: text(row, 'ACDNT_OCCR_DT'),
      expectedClearAt: text(row, 'EXP_CLR_DT'),
    }),
  )
}

/** 네 값을 하나도 못 읽으면 요금 자체가 없는 것으로 접는다. */
function toParkingFee(row: Row): ParkingFee | null {
  const fee: ParkingFee = {
    baseFee: numberOrNull(row, 'RATES'),
    baseMinutes: numberOrNull(row, 'TIME_RATES'),
    addFee: numberOrNull(row, 'ADD_RATES'),
    addMinutes: numberOrNull(row, 'ADD_TIME_RATES'),
  }
  return Object.values(fee).every((value) => value === null) ? null : fee
}

function toParking(rows: readonly Row[]): readonly ParkingLot[] {
  return named(
    rows,
    'PRK_NM',
    (row, name): ParkingLot => ({
      name,
      code: text(row, 'PRK_CD'),
      // **도로명이 먼저다.** 실호출 33곳 중 도로명이 있는 곳은 하나뿐이라
      // 대부분 지번으로 떨어지지만, 있을 때 안 쓰면 더 읽기 쉬운 쪽을 버린다.
      address: text(row, 'ROAD_ADDR') || text(row, 'ADDRESS'),
      coords: coordsOrNull(row, 'LAT', 'LNG'),
      capacity: numberOrNull(row, 'CPCTY'),
      available: numberOrNull(row, 'CUR_PRK_CNT'),
      liveAvailable: text(row, 'CUR_PRK_YN').toUpperCase() === 'Y',
      liveCountAt: text(row, 'CUR_PRK_TIME'),
      paid: paidFlag(row, 'PAY_YN'),
      fee: toParkingFee(row),
    }),
  )
}

/**
 * 승하차 인원. **접두어만 받아 지하철과 버스를 같은 코드로 읽는다.**
 *
 * 2026-08-25 실호출에서 `LIVE_SUB_PPLTN`과 `LIVE_BUS_PPLTN`의 키 18개가 접두어
 * 빼고 한 글자도 안 다른 것을 대조했다. 두 벌로 두면 한쪽만 고치는 날이 온다.
 */
function toRidershipWindow(row: Row, prefix: string, span: string): RidershipWindow {
  return {
    boardingMin: numberOrNull(row, `${prefix}_${span}_GTON_PPLTN_MIN`),
    boardingMax: numberOrNull(row, `${prefix}_${span}_GTON_PPLTN_MAX`),
    alightingMin: numberOrNull(row, `${prefix}_${span}_GTOFF_PPLTN_MIN`),
    alightingMax: numberOrNull(row, `${prefix}_${span}_GTOFF_PPLTN_MAX`),
  }
}

function toRidership(rows: readonly Row[], prefix: string): Ridership | null {
  const row = rows[0]
  if (row === undefined) {
    return null
  }
  const ridership: Ridership = {
    total: toRidershipWindow(row, prefix, 'ACML'),
    last30Minutes: toRidershipWindow(row, prefix, '30WTHN'),
    last10Minutes: toRidershipWindow(row, prefix, '10WTHN'),
    last5Minutes: toRidershipWindow(row, prefix, '5WTHN'),
    stopCount: numberOrNull(row, `${prefix}_STN_CNT`),
    stopCountAt: text(row, `${prefix}_STN_TIME`),
  }
  // 네 시간창이 모두 비고 개수도 없으면 섹션 자체가 없는 것으로 접는다.
  // 빈 껍데기를 돌려주면 화면이 「승하차 정보 있음」으로 읽고 빈 절을 그린다.
  const windows = [
    ridership.total,
    ridership.last30Minutes,
    ridership.last10Minutes,
    ridership.last5Minutes,
  ]
  const anyValue =
    windows.some((window) => Object.values(window).some((value) => value !== null)) ||
    ridership.stopCount !== null
  return anyValue ? ridership : null
}

/**
 * 실시간 상권. **`CMRCL_RSB`가 명세에 없다** — 명세 222~229행은 업종 필드를
 * 한 겹 펼쳐 적어 놓고 그것들을 담는 배열 이름을 안 적었다. 실호출로 확인했다
 * (2026-08-25). 명세의 순번만 보고 평평하게 읽으면 업종이 통째로 빈다.
 */
function toCommerceCategories(rows: readonly Row[]): readonly CommerceCategory[] {
  return named(
    rows,
    'RSB_MID_CTGR',
    (row, minor): CommerceCategory => ({
      major: text(row, 'RSB_LRG_CTGR'),
      minor,
      level: text(row, 'RSB_PAYMENT_LVL'),
      paymentCount: numberOrNull(row, 'RSB_SH_PAYMENT_CNT'),
      paymentMin: numberOrNull(row, 'RSB_SH_PAYMENT_AMT_MIN'),
      paymentMax: numberOrNull(row, 'RSB_SH_PAYMENT_AMT_MAX'),
      storeCount: numberOrNull(row, 'RSB_MCT_CNT'),
      storeCountAt: text(row, 'RSB_MCT_TIME'),
    }),
  )
}

function toCommerce(rows: readonly Row[]): Commerce | null {
  const row = rows[0]
  if (row === undefined) {
    return null
  }
  const commerce: Commerce = {
    level: text(row, 'AREA_CMRCL_LVL'),
    paymentCount: numberOrNull(row, 'AREA_SH_PAYMENT_CNT'),
    paymentMin: numberOrNull(row, 'AREA_SH_PAYMENT_AMT_MIN'),
    paymentMax: numberOrNull(row, 'AREA_SH_PAYMENT_AMT_MAX'),
    categories: toCommerceCategories(sectionRows(row, ['CMRCL_RSB'])),
    maleRate: numberOrNull(row, 'CMRCL_MALE_RATE'),
    femaleRate: numberOrNull(row, 'CMRCL_FEMALE_RATE'),
    // **여섯 칸이다**(인구 구성은 여덟). 못 읽은 칸은 0으로 떨어뜨린다 —
    // 막대는 0을 빈자리로 그리고, 문구는 `hasReadableCommerce`가 막는다.
    ageRates: [
      'CMRCL_10_RATE',
      'CMRCL_20_RATE',
      'CMRCL_30_RATE',
      'CMRCL_40_RATE',
      'CMRCL_50_RATE',
      'CMRCL_60_RATE',
    ].map((key) => numberOrNull(row, key) ?? 0),
    personalRate: numberOrNull(row, 'CMRCL_PERSONAL_RATE'),
    corporationRate: numberOrNull(row, 'CMRCL_CORPORATION_RATE'),
    updatedAt: text(row, 'CMRCL_TIME'),
  }
  // 섹션은 왔는데 값이 하나도 없으면 없는 것으로 접는다 — 승하차와 같은 규칙이다.
  return hasReadableCommerce(commerce) ? commerce : null
}

/**
 * 전기차충전소. **`CHARGER_DETAILS`가 명세에 없다** — 명세 151~159행은 충전기
 * 필드를 충전소와 같은 층에 펼쳐 적었지만 실제로는 배열로 한 겹 더 들어가 있다
 * (상권의 `CMRCL_RSB`와 같은 함정이다).
 */
function toChargers(rows: readonly Row[]): readonly Charger[] {
  return named(
    rows,
    'CHARGER_ID',
    (row, id): Charger => ({
      id,
      type: text(row, 'CHARGER_TYPE'),
      status: text(row, 'CHARGER_STAT'),
      outputKw: numberOrNull(row, 'OUTPUT'),
      method: text(row, 'METHOD'),
      statusAt: text(row, 'STATUPDDT'),
      lastStartAt: text(row, 'LASTTSDT'),
      lastEndAt: text(row, 'LASTTEDT'),
      chargingSince: text(row, 'NOWTSDT'),
    }),
  )
}

function toChargerStations(rows: readonly Row[]): readonly ChargerStation[] {
  return named(
    rows,
    'STAT_NM',
    (row, name): ChargerStation => ({
      name,
      id: text(row, 'STAT_ID'),
      address: text(row, 'STAT_ADDR'),
      // X가 경도, Y가 위도다 — 따릉이·버스와 같은 규칙이다.
      coords: coordsOrNull(row, 'STAT_Y', 'STAT_X'),
      useTime: text(row, 'STAT_USETIME'),
      parkingPaid: paidFlag(row, 'STAT_PARKPAY'),
      // `LIMITYN`은 「제한이 있나」다 — `paidFlag`의 Y/N 어휘를 그대로 쓴다.
      limited: paidFlag(row, 'STAT_LIMITYN'),
      limitDetail: text(row, 'STAT_LIMITDETAIL'),
      kind: text(row, 'STAT_KINDDETAIL'),
      chargers: toChargers(sectionRows(row, ['CHARGER_DETAILS'])),
    }),
  )
}

function toBusStops(rows: readonly Row[]): readonly BusStop[] {
  return named(
    rows,
    'BUS_STN_NM',
    (row, name): BusStop => ({
      name,
      arsId: text(row, 'BUS_ARS_ID'),
      id: text(row, 'BUS_STN_ID'),
      // X가 경도, Y가 위도다 — 따릉이(`SBIKE_X`)와 같은 규칙이다.
      coords: coordsOrNull(row, 'BUS_STN_Y', 'BUS_STN_X'),
    }),
  )
}

function toBikes(rows: readonly Row[]): readonly BikeStation[] {
  return named(
    rows,
    'SBIKE_SPOT_NM',
    (row, name): BikeStation => ({
      name,
      // X가 경도, Y가 위도다. 이름만 보고 순서를 정하면 뒤집힌다.
      coords: coordsOrNull(row, 'SBIKE_Y', 'SBIKE_X'),
      bikes: numberOrNull(row, 'SBIKE_PARKING_CNT'),
      racks: numberOrNull(row, 'SBIKE_RACK_CNT'),
    }),
  )
}

function toEvents(rows: readonly Row[]): readonly CulturalEvent[] {
  return named(rows, 'EVENT_NM', (row, name): CulturalEvent => {
    const paid = paidFlag(row, 'PAY_YN')
    return {
      name,
      period: text(row, 'EVENT_PERIOD'),
      place: text(row, 'EVENT_PLACE'),
      free: paid === null ? null : !paid,
      url: httpUrl(row, 'URL'),
    }
  })
}

function toAlerts(rows: readonly Row[]): readonly CityAlert[] {
  // 재난문자는 이름이 아니라 내용이 본체다. 내용이 없으면 배너가 빈 채로 뜬다.
  return named(
    rows,
    'MSG_CN',
    (row, message): CityAlert => ({
      category: text(row, 'DST_SE_NM'),
      step: text(row, 'EMRG_STEP_NM'),
      message,
      createdAt: text(row, 'CRT_DT'),
    }),
  )
}

// 역명이 이 항목의 본체다 — 어느 역인지 모르면 「4분 20초 후」는 쓸모가 없다.
//
// 호선은 셋 중 처음 채워진 것을 쓴다. 명세에 「지하철호선」·「지하철노선명」·
// 「지하철역 호선」 셋이 따로 있는데 값의 예시가 없어 무엇이 「9호선」·
// 「신분당선」으로 오는지 모른다. 셋 다 비면 화면이 호선 없이 역명만 적는다.
// **확인법:** 실호출 응답에서 세 필드의 값을 나란히 찍어 무엇이 채워지는지 본다.
const LINE_KEYS = ['SUB_LINE', 'SUB_ROUTE_NM', 'SUB_STN_LINE'] as const

function firstText(row: Row, keys: readonly string[]): string {
  for (const key of keys) {
    const value = text(row, key)
    if (value !== '') {
      return value
    }
  }
  return ''
}

// **열차는 역 한 겹 안에 있다.** 2026-08-13 실호출로 확인했다 — 바깥 행은 역
// (`SUB_STN_NM`·`SUB_STN_LINE`·좌표·주소)이고 도착 열차는 `SUB_DETAIL` 배열이다.
// 명세의 출력명 표는 62~80행을 한 층으로 늘어놓아서 이 중첩이 안 보인다.
//
// `SUB_ARMG2`는 읽지 않는다. 실제 값이 `SUB_ARMG1`("9분 후 (동대입구)")에 이미
// 괄호로 들어 있는 역 이름("동대입구")이라, 따로 붙이면 같은 말이 두 번 나온다.
function toSubway(rows: readonly Row[]): readonly SubwayArrival[] {
  return rows.flatMap((stationRow) => {
    const station = text(stationRow, 'SUB_STN_NM')
    if (station === '') {
      return []
    }
    // 바깥 호선은 "3"처럼 숫자만 온다. 그대로 쓰면 「경복궁 3」이 된다.
    const stationLine = text(stationRow, 'SUB_STN_LINE')
    const fallbackLine = stationLine === '' ? '' : `${stationLine}호선`

    // 열차가 없는 역은 통째로 버린다 — 제목만 있고 아래가 빈 묶음이 남는다.
    return sectionRows(stationRow, ['SUB_DETAIL']).map(
      (train): SubwayArrival => ({
        station,
        // 열차 쪽 SUB_LINE이 "3호선"으로 온다. 없으면 역의 숫자로 만든다.
        line: firstText(train, LINE_KEYS) || fallbackLine,
        direction: directionOf(train),
        terminal: text(train, 'SUB_TERMINAL'),
        message: text(train, 'SUB_ARMG1'),
      }),
    )
  })
}

// 화면 왼쪽 칸에 들어갈 방면. `SUB_DIR`은 「상행」·「하행」이라 어디로 가는지를
// 말해주지 않고, `SUB_ROUTE_NM`은 「대화행 - 독립문방면」이라 좁은 칸에 길다.
// 종착역에 「행」을 붙인 「대화행」이 detail_page.png의 왼쪽 칸과 같은 모양이다.
function directionOf(train: Row): string {
  const terminal = text(train, 'SUB_TERMINAL')
  if (terminal !== '') {
    return `${terminal}행`
  }
  // 종착역이 없으면 노선명의 앞머리(「대화행」)라도 쓴다.
  return text(train, 'SUB_ROUTE_NM').split(' - ')[0]
}

export function parseCityInfoResponse(payload: unknown, expectedName: string): CityInfo {
  const result = envelopeSchema.safeParse(payload)
  if (!result.success) {
    const apiError = seoulApiErrorFrom(payload)
    if (apiError !== null) {
      throw apiError
    }
    throw result.error
  }

  const container = result.data.CITYDATA
  if (container.AREA_NM !== expectedName) {
    throw new AreaNameMismatchError(expectedName, [container.AREA_NM])
  }

  const weatherRows = sectionRows(container, ['WEATHER_STTS'])
  // **도로소통도 한 겹 안에 있다.** 2026-08-13 실호출로 확인했다 — 바깥
  // `ROAD_TRAFFIC_STTS`는 `{ AVG_ROAD_DATA, ROAD_TRAFFIC_STTS: [구간 159개] }`이고
  // 지표·안내·평균속도는 `AVG_ROAD_DATA` 안이다. 바깥에서 읽으면 `toRoadTraffic`의
  // 가드에 걸려 **실데이터에서 도로소통 카드가 통째로 사라진다.**
  // 안쪽이 있으면 안쪽을, 없으면 바깥을 읽는다 — 응답이 평평해지는 날 조용히
  // 죽지 않게 두 모양을 다 받는다.
  const roadRows = sectionRows(container, ['ROAD_TRAFFIC_STTS']).flatMap((row) => {
    const average = sectionRows(row, ['AVG_ROAD_DATA'])
    return average.length > 0 ? average : [row]
  })

  return {
    // **파서는 나이를 모른다.** `Age`는 응답 본문이 아니라 HTTP 헤더에 있어
    // 여기까지 오지 않는다. `client.ts`가 받아서 이 값을 덮어쓴다 — 여기서
    // 0으로 두면 목업 픽스처를 파싱한 것까지 「방금 받았다」가 된다.
    freshness: null,
    // 표시용 이름은 카탈로그 값이 권위다(schema.ts와 같은 이유). 위에서 이미
    // 일치를 확인했으므로 문자열은 같다.
    areaName: expectedName,
    areaCode: container.AREA_CD ?? '',
    weather: weatherRows.length > 0 ? toWeather(weatherRows[0]) : null,
    // `roadRows[0] ?? {}`로 바꿔도 결과가 같다 — 빈 행이면 `text()`가 두 필드
    // 모두 ''를 돌려줘 `toRoadTraffic`의 가드에 걸려 null이 된다. 변이가 살아도
    // 테스트 구멍이 아니라 **동치 변이**이니 쫓지 마라. 바로 위 `weather`와 같은
    // 모양을 유지하는 쪽을 택했다.
    roadTraffic: roadRows.length > 0 ? toRoadTraffic(roadRows[0]) : null,
    accidents: toAccidents(sectionRows(container, ['ACDNT_CNTRL_STTS'])),
    parking: toParking(sectionRows(container, ['PRK_STTS'])),
    bikes: toBikes(sectionRows(container, ['SBIKE_STTS'])),
    events: toEvents(sectionRows(container, ['CULTURALEVENTINFO', 'EVENT_STTS'])),
    alerts: toAlerts(sectionRows(container, ['LIVE_DST_MESSAGE'])),
    subway: toSubway(sectionRows(container, ['SUB_STTS'])),
    subwayRidership: toRidership(sectionRows(container, ['LIVE_SUB_PPLTN']), 'SUB'),
    busStops: toBusStops(sectionRows(container, ['BUS_STN_STTS'])),
    busRidership: toRidership(sectionRows(container, ['LIVE_BUS_PPLTN']), 'BUS'),
    // 정류소 목록의 첫 줄이 이고 온다. 줄마다 같은 값이라 하나만 읽는다.
    busResultMessage: text(sectionRows(container, ['BUS_STN_STTS'])[0] ?? {}, 'BUS_RESULT_MSG'),
    commerce: toCommerce(sectionRows(container, ['LIVE_CMRCL_STTS'])),
    chargers: toChargerStations(sectionRows(container, ['CHARGER_STTS'])),
  }
}
