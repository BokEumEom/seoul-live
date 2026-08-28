import { z } from 'zod'
import type {
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
import type { AccidentControl } from '../domain/accident'
import {
  isSubwayFacilityKind,
  isSubwayFacilityStatus,
  type SubwayFacility,
  type SubwayStationFacilities,
} from '../domain/subwayFacility'
import type { RoadSegment } from '../domain/roadSegment'
import type { BikeStation } from '../domain/bike'
import type { Charger, ChargerStation } from '../domain/charger'
import {
  hasReadableCommerce,
  type Commerce,
  type CommerceCategory,
} from '../domain/commerce'
import { AreaNameMismatchError, seoulApiErrorFrom } from './schema'
import {
  asRow,
  coordsOrNull,
  numberOrNull,
  packedCoords,
  packedCoordsList,
  text,
  type Row,
} from './rowReaders'

// `citydata` 응답을 CityInfo로 옮긴다. 같은 봉투에서 인구 행을 읽는 schema.ts와 달리
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
      // **날씨 쪽 `PRECIPITATION`과 같은 이름이다**(명세 176 vs 203). 컨테이너를
      // 타고 내려와 읽으므로 섞이지 않는다 — 명세를 읽을 때 걸리는 것 1번.
      precipitation: numberOrNull(row, 'PRECIPITATION'),
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
    precipitation: numberOrNull(row, 'PRECIPITATION'),
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

// 도로소통 요약은 한 줄이라 날씨처럼 첫 행만 읽는다.
//
// **구간 목록은 2026-08-25에 붙었다**(`toRoadSegments`). 예전 주석은 「일부러
// 안 읽는다 — 시트가 좁고 필요한 것은 한 줄이다」였는데, 상세가 전체 화면이
// 되면서 그 전제가 사라졌다. 「구간별로 보여줄 일이 생기면 그건 이 카드가
// 아니라 지도 위에 그릴 일이다」던 것도 그대로 지켰다 — `XYLIST`가 선이 된다.
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

/**
 * 도로 구간. **`LINK_ID`가 본체다** — 없으면 어느 구간인지 말할 수 없다.
 *
 * `START_ND_CD`·`END_ND_CD`(명세 108·111행)는 **일부러 안 읽는다.** 도로망을
 * 이어 붙이라고 있는 노드 코드인데, 2026-08-25 실호출에서 그게 이 화면에
 * 쓸모가 없다는 것이 확인됐다: 구간이 둘 이상인 도로 318개 중 **한 줄로
 * 이어지는 것은 2개뿐**이었고(나머지는 2~10 조각으로 흩어진다), 같은 구간의
 * 반대 방향 쌍은 1,893건 중 **0쌍**이었다. 이을 수도, 짝지을 수도 없는 키다.
 *
 * 그래서 시안 `_4`의 「세종대로사거리 → 광화문」 같은 **도로 단위 시작→끝은
 * 만들지 않는다.** 조각난 구간들의 첫 시작과 마지막 끝을 이어 적으면, 실제로는
 * 떨어져 있는 두 지점을 한 구간처럼 말하게 된다.
 */
function toRoadSegments(rows: readonly Row[]): readonly RoadSegment[] {
  return named(
    rows,
    'LINK_ID',
    (row, linkId): RoadSegment => ({
      linkId,
      roadName: text(row, 'ROAD_NM'),
      startName: text(row, 'START_ND_NM'),
      endName: text(row, 'END_ND_NM'),
      meters: numberOrNull(row, 'DIST'),
      speed: numberOrNull(row, 'SPD'),
      index: text(row, 'IDX'),
      path: packedCoordsList(text(row, 'XYLIST')),
      startCoords: packedCoords(text(row, 'START_ND_XY')),
      endCoords: packedCoords(text(row, 'END_ND_XY')),
    }),
  )
}

function toAccidents(rows: readonly Row[]): readonly AccidentControl[] {
  // 사고통제도 내용이 본체다(재난문자와 같다). 유형만 오고 내용이 비면
  // 「교통사고」라고만 적힌 카드가 되어 무엇을 조심하라는 건지 알려주지 못한다.
  return named(
    rows,
    'ACDNT_INFO',
    (row, info): AccidentControl => ({
      info,
      // 명세에 없는 필드다 — 근거는 `domain/accident.ts`.
      infoEn: text(row, 'ACDNT_ENG_INFO'),
      type: text(row, 'ACDNT_TYPE'),
      detailType: text(row, 'ACDNT_DTYPE'),
      occurredAt: text(row, 'ACDNT_OCCR_DT'),
      expectedClearAt: text(row, 'EXP_CLR_DT'),
      // X가 경도, Y가 위도다. 따릉이·버스와 같은 축 규칙이라 순서를 지킨다.
      coords: coordsOrNull(row, 'ACDNT_Y', 'ACDNT_X'),
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
      id: text(row, 'SBIKE_SPOT_ID'),
      // X가 경도, Y가 위도다. 이름만 보고 순서를 정하면 뒤집힌다.
      coords: coordsOrNull(row, 'SBIKE_Y', 'SBIKE_X'),
      bikes: numberOrNull(row, 'SBIKE_PARKING_CNT'),
      racks: numberOrNull(row, 'SBIKE_RACK_CNT'),
      dockRate: numberOrNull(row, 'SBIKE_SHARED'),
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
      // X가 경도, Y가 위도다.
      coords: coordsOrNull(row, 'EVENT_Y', 'EVENT_X'),
      // `<img src>`에 그대로 들어간다. `URL`과 같은 스킴 가드를 통과시킨다 —
      // `javascript:`가 걸러지는 것은 물론이고, 상대 경로가 오면 우리 도메인의
      // 엉뚱한 자리를 가리키게 되는 것도 여기서 막힌다.
      thumbnail: httpUrl(row, 'THUMBNAIL'),
      // **`EVENT_ETC_DETAIL`은 일부러 안 읽는다** — 근거는 `CulturalEvent`.
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
// **호선은 역이 말한 것을 쓴다.** 예전에는 열차의 `SUB_LINE`이 먼저였고, 여기에
// 「명세에 호선 후보가 셋인데 무엇이 채워지는지 모른다」는 주석과 함께
// 「실호출로 세 필드를 나란히 찍어 보라」는 확인법이 적혀 있었다. 2026-08-27에
// 34역으로 그 확인을 했고 차례가 뒤집혔다:
//
// - 역의 `SUB_STN_LINE` — 「3」·「경의중앙」·「공항철도」·「신림선」. 역 자신의 호선이다.
// - 열차의 `SUB_LINE` — 대개 「3호선」으로 같은 값인데, **샛강(신림선)의 열차
//   셋이 전부 「4호선」으로 온다.** 종착역이 관악산이라 신림선이 맞다. 열차를
//   먼저 믿는 동안 그 역은 4호선 하늘색 배지를 달고 있었다.
// - 열차의 `SUB_ROUTE_NM` — 「샛강행 - 샛강방면」. 명세의 이름이 「지하철노선명」이라
//   후보에 뒀던 것이고 실제로는 행선지와 방면이다. **후보에서 뺀다.**
//
// 둘 다 비면 화면이 호선 없이 역명만 적는다.
function lineOf(stationLine: string, train: Row): string {
  return stationLine !== '' ? stationLineName(stationLine) : text(train, 'SUB_LINE')
}

// 「3」처럼 숫자만 오면 「호선」을 붙인다 — 그대로 쓰면 「경복궁 3」이 된다.
// **숫자일 때만이다.** 무턱대고 붙이면 「경의중앙호선」이라는 없는 노선이 생긴다.
function stationLineName(value: string): string {
  return /^\d+$/.test(value) ? `${value}호선` : value
}

// **열차는 역 한 겹 안에 있다.** 2026-08-13 실호출로 확인했다 — 바깥 행은 역
// (`SUB_STN_NM`·`SUB_STN_LINE`·좌표·주소)이고 도착 열차는 `SUB_DETAIL` 배열이다.
// 명세의 출력명 표는 62~80행을 한 층으로 늘어놓아서 이 중첩이 안 보인다.
//
// `SUB_ARMG2`는 읽지 않는다. 실제 값이 `SUB_ARMG1`("9분 후 (동대입구)")에 이미
// 괄호로 들어 있는 역 이름("동대입구")이라, 따로 붙이면 같은 말이 두 번 나온다.
//
// **도착과 승강기를 한 자리에서 만든다.** 화면은 둘을 역·호선으로 이어 붙이는데,
// 그 키를 두 곳에서 따로 계산하면 한쪽만 「호선」을 붙이거나 한쪽만 열차를 보는
// 순간 승강기가 영영 안 그려진다 — 화면에는 아무 표시도 안 난다. 호선을 역마다
// 한 번 정하고 도착과 승강기가 그 값을 나눠 쓴다.
function toSubway(rows: readonly Row[]): {
  readonly arrivals: readonly SubwayArrival[]
  readonly facilities: readonly SubwayStationFacilities[]
} {
  const arrivals: SubwayArrival[] = []
  const facilities: SubwayStationFacilities[] = []

  for (const stationRow of rows) {
    const station = text(stationRow, 'SUB_STN_NM')
    if (station === '') {
      continue
    }
    // 열차가 없는 역은 통째로 버린다 — 제목만 있고 아래가 빈 묶음이 남는다.
    // **승강기도 함께 버린다.** 화면이 도착 묶음 안에 그리므로 열차가 없으면
    // 그릴 자리 자체가 없다. 실호출 44역에서 「승강기는 있는데 열차가 없는 역」은
    // 0곳이었다(2026-08-27).
    const trains = sectionRows(stationRow, ['SUB_DETAIL'])
    if (trains.length === 0) {
      continue
    }

    const line = lineOf(text(stationRow, 'SUB_STN_LINE'), trains[0])
    for (const train of trains) {
      arrivals.push({
        station,
        line,
        direction: directionOf(train),
        terminal: text(train, 'SUB_TERMINAL'),
        message: text(train, 'SUB_ARMG1'),
      })
    }

    const stationFacilities = toFacilities(stationRow)
    if (stationFacilities.length > 0) {
      facilities.push({ station, line, facilities: stationFacilities })
    }
  }

  return { arrivals, facilities }
}

// **명세가 키 이름을 틀렸다.** 출력명 표(80행)는 `SUB_FACINFO`인데 실응답은
// `SUB_FACIINFO`(I가 하나 더)다. 명세대로만 읽으면 언제나 빈 배열이 온다 —
// 2026-08-25에 이 필드가 미구현으로 남은 이유가 그것이었다. 문화행사가
// `CULTURALEVENTINFO`가 아니라 `EVENT_STTS`로 왔을 때와 같은 자리라, 이 파서가
// 관대한 덕에 쓰는 처방(후보를 둘 다 받는다)을 그대로 쓴다.
const FACILITY_KEYS = ['SUB_FACIINFO', 'SUB_FACINFO'] as const

function toFacilities(stationRow: Row): readonly SubwayFacility[] {
  return sectionRows(stationRow, FACILITY_KEYS).map((row): SubwayFacility => {
    const kind = text(row, 'ELVTR_SE')
    const status = text(row, 'USE_YN')
    return {
      // 처음 보는 코드·상태는 비운다. 갈래를 모르면서 「엘리베이터」라고 적거나
      // 상태를 모르면서 「보수중」이라고 적는 것이 이 앱이 가장 피하는 일이다.
      kind: isSubwayFacilityKind(kind) ? kind : null,
      section: text(row, 'OPR_SEC'),
      position: text(row, 'INSTL_PSTN'),
      status: isSubwayFacilityStatus(status) ? status : null,
    }
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
  // 두 번 읽는다 — 목록과 갱신 시각이 같은 행에서 나온다.
  const accidentRows = sectionRows(container, ['ACDNT_CNTRL_STTS'])

  const roadContainers = sectionRows(container, ['ROAD_TRAFFIC_STTS'])
  const roadRows = roadContainers.flatMap((row) => {
    const average = sectionRows(row, ['AVG_ROAD_DATA'])
    return average.length > 0 ? average : [row]
  })
  // **구간은 껍데기와 이름이 같다.** 바깥 `ROAD_TRAFFIC_STTS` 안에 같은 이름의
  // 배열이 또 있다(2026-08-25 실호출). 한 겹 안으로 못 들어가면 구간이 통째로
  // 안 잡히는데, 요약은 `AVG_ROAD_DATA`에서 멀쩡히 나오므로 화면은 정상으로
  // 보인다 — 조용히 비는 자리라 픽스처 테스트가 개수를 잰다.
  const segmentRows = roadContainers.flatMap((row) =>
    sectionRows(row, ['ROAD_TRAFFIC_STTS']),
  )

  // 도착과 승강기가 역·호선 키를 나눠 쓰므로 한 번에 읽는다 — `toSubway` 주석.
  const subway = toSubway(sectionRows(container, ['SUB_STTS']))

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
    roadSegments: toRoadSegments(segmentRows),
    accidents: toAccidents(accidentRows),
    // 첫 행에서 읽는다 — 절의 값이라는 근거는 `CityInfo.accidentsUpdatedAt`.
    accidentsUpdatedAt: accidentRows.length > 0 ? text(accidentRows[0], 'ACDNT_TIME') : '',
    parking: toParking(sectionRows(container, ['PRK_STTS'])),
    bikes: toBikes(sectionRows(container, ['SBIKE_STTS'])),
    events: toEvents(sectionRows(container, ['CULTURALEVENTINFO', 'EVENT_STTS'])),
    alerts: toAlerts(sectionRows(container, ['LIVE_DST_MESSAGE'])),
    subway: subway.arrivals,
    subwayFacilities: subway.facilities,
    subwayRidership: toRidership(sectionRows(container, ['LIVE_SUB_PPLTN']), 'SUB'),
    busStops: toBusStops(sectionRows(container, ['BUS_STN_STTS'])),
    busRidership: toRidership(sectionRows(container, ['LIVE_BUS_PPLTN']), 'BUS'),
    // 정류소 목록의 첫 줄이 이고 온다. 줄마다 같은 값이라 하나만 읽는다.
    busResultMessage: text(sectionRows(container, ['BUS_STN_STTS'])[0] ?? {}, 'BUS_RESULT_MSG'),
    commerce: toCommerce(sectionRows(container, ['LIVE_CMRCL_STTS'])),
    chargers: toChargerStations(sectionRows(container, ['CHARGER_STTS'])),
  }
}
