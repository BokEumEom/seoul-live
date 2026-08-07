import { z } from 'zod'
import type {
  BikeStation,
  CityAlert,
  CityInfo,
  CulturalEvent,
  ParkingLot,
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

function toWeather(row: Row): Weather {
  return {
    temperature: numberOrNull(row, 'TEMP'),
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

  return {
    // 표시용 이름은 카탈로그 값이 권위다(schema.ts와 같은 이유). 위에서 이미
    // 일치를 확인했으므로 문자열은 같다.
    areaName: expectedName,
    areaCode: container.AREA_CD ?? '',
    weather: weatherRows.length > 0 ? toWeather(weatherRows[0]) : null,
    parking: toParking(sectionRows(container, ['PRK_STTS'])),
    bikes: toBikes(sectionRows(container, ['SBIKE_STTS'])),
    events: toEvents(sectionRows(container, ['CULTURALEVENTINFO', 'EVENT_STTS'])),
    alerts: toAlerts(sectionRows(container, ['LIVE_DST_MESSAGE'])),
  }
}
