import { z } from 'zod'
import type {
  AccidentControl,
  BikeStation,
  CityAlert,
  CityInfo,
  CulturalEvent,
  HourlyForecast,
  ParkingLot,
  RoadTraffic,
  Weather,
} from '../domain/cityInfo'
import { AreaNameMismatchError, seoulApiErrorFrom } from './schema'

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

type Row = Readonly<Record<string, unknown>>

// 배열도 null도 아닌 순수 객체만 통과시킨다. 여기서 한 번 좁혀두면 아래 리더들은
// 캐스트 없이 인덱싱만 한다.
function asRow(value: unknown): Row | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  return value as Row
}

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

function text(row: Row, key: string): string {
  const value = row[key]
  if (typeof value === 'string') {
    return value.trim()
  }
  // 숫자로 오는 필드를 문자열 자리에서 읽는 경우가 있다(예: 코드값).
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

// 소수와 음수를 허용한다(기온). schema.ts의 인구 정규식과 달리 `-`와 `.`을 받는
// 대신, `Number('')`이 0인 문제는 똑같이 막는다 — 빈 값이 "기온 0도"로 보이면
// 안 된다. `'-'`, `'점검중'`, `'1e5'`는 전부 null이다.
const NUMERIC_PATTERN = /^-?\d+(?:\.\d+)?$/

function numberOrNull(row: Row, key: string): number | null {
  const value = row[key]
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const raw = text(row, key)
  return NUMERIC_PATTERN.test(raw) ? Number(raw) : null
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

function toWeather(row: Row): Weather {
  return {
    temperature: numberOrNull(row, 'TEMP'),
    hourly: toHourly(sectionRows(row, ['FCST24HOURS'])),
    maxTemperature: numberOrNull(row, 'MAX_TEMP'),
    minTemperature: numberOrNull(row, 'MIN_TEMP'),
    precipitationMessage: text(row, 'PCP_MSG'),
    pm10: numberOrNull(row, 'PM10'),
    pm10Grade: text(row, 'PM10_INDEX'),
    pm25: numberOrNull(row, 'PM25'),
    pm25Grade: text(row, 'PM25_INDEX'),
    airGrade: text(row, 'AIR_IDX'),
    airMessage: text(row, 'AIR_MSG'),
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

function toParking(rows: readonly Row[]): readonly ParkingLot[] {
  return named(
    rows,
    'PRK_NM',
    (row, name): ParkingLot => ({
      name,
      capacity: numberOrNull(row, 'CPCTY'),
      available: numberOrNull(row, 'CUR_PRK_CNT'),
      liveAvailable: text(row, 'CUR_PRK_YN').toUpperCase() === 'Y',
      paid: paidFlag(row, 'PAY_YN'),
    }),
  )
}

function toBikes(rows: readonly Row[]): readonly BikeStation[] {
  return named(
    rows,
    'SBIKE_SPOT_NM',
    (row, name): BikeStation => ({
      name,
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
  const roadRows = sectionRows(container, ['ROAD_TRAFFIC_STTS'])

  return {
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
  }
}
