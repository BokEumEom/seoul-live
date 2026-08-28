import {
  SUBWAY_FACILITY_KINDS,
  type SubwayFacilityKind,
} from '../domain/subwayFacility'
import { findAreaByName } from './areas'
import { buildMockPopulationRows, formatSeoulTime, hashAreaName, mixSeed } from './mock'

// 「더보기」(도시정보) 화면용 목업. buildMockPopulationRows와 같은 씨앗을 쓰되 salt를
// 달리해 섹션끼리 상관이 생기지 않게 한다.
//
// 일부러 "비어 있는" 명소를 만든다. 모든 명소에 주차장·따릉이·문화행사를 채워주면
// 빈 상태 화면을 목업만으로는 한 번도 볼 수 없다 — mock.ts의 예측값이 톱니파라서
// 모든 명소가 여유 시간대를 갖던 문제와 같은 함정이다. mockCityInfo.test.ts가
// "있는 명소와 없는 명소가 둘 다 있다"를 고정한다.

const PARKING_SALT = 1
const BIKE_SALT = 2
const EVENT_SALT = 3
const ALERT_SALT = 4
const WEATHER_SALT = 5
const ROAD_SALT = 6
const ACCIDENT_SALT = 7
const SUBWAY_SALT = 8

// **목업이 이 셋을 쓴다고 해서 화면이 이 셋을 안다고 가정하면 안 된다.** 공식
// 명세에 `ROAD_TRAFFIC_IDX`의 출력명만 있고 값의 종류가 없어서, 서울시 교통정보
// 안내에서 흔히 쓰는 단어를 빌려 쓴 것뿐이다. 파서도 카드도 문자열을 그대로
// 옮기고 어느 값에도 특별한 뜻을 붙이지 않는다 — 실제 값이 다르면 목업만
// 고치면 되도록.
const ROAD_INDEXES = ['원활', '서행', '정체'] as const

const EVENT_NAMES = [
  '한여름 밤의 거리공연',
  '서울 도시건축 비엔날레',
  '고궁 야간 특별관람',
] as const

// 환경부 통합대기환경지수의 미세먼지 구간. 목업 안에서 농도와 등급이 어긋나지
// 않게 값에서 등급을 계산한다.
function pmGrade(value: number, thresholds: readonly [number, number, number]): string {
  if (value <= thresholds[0]) return '좋음'
  if (value <= thresholds[1]) return '보통'
  return value <= thresholds[2] ? '나쁨' : '매우나쁨'
}

const GRADE_RANK = ['좋음', '보통', '나쁨', '매우나쁨'] as const

function worseGrade(left: string, right: string): string {
  return GRADE_RANK.indexOf(left as (typeof GRADE_RANK)[number]) >=
    GRADE_RANK.indexOf(right as (typeof GRADE_RANK)[number])
    ? left
    : right
}

const AIR_MESSAGES: Readonly<Record<string, string>> = {
  좋음: '대기질이 좋아요. 야외활동하기 좋은 날이에요.',
  보통: '외출 시 특별한 주의가 필요하지 않아요.',
  나쁨: '민감군은 장시간 실외활동을 줄이는 게 좋아요.',
  매우나쁨: '실외활동을 줄이고 외출 시 마스크를 챙기세요.',
}

/**
 * 통합대기환경지수(`AIR_IDX_MVL`)의 대표값. 등급 구간 안쪽의 한 점이다.
 *
 * 환경부 CAI 구간: 0~50 좋음 / 51~100 보통 / 101~250 나쁨 / 251~ 매우나쁨.
 * 실응답에서 `좋음 / 33.0`을 봤다(2026-08-25) — 등급과 수치가 어긋나지 않는다.
 */
const AIR_INDEX_VALUES: Readonly<Record<string, number>> = {
  좋음: 33,
  보통: 78,
  나쁨: 160,
  매우나쁨: 290,
}

/** 예보 칸 수. 명세의 이름이 FCST24HOURS라 24를 그대로 쓴다. */
const FORECAST_HOURS = 24

// **FCST_DT의 형식은 모른다.** 명세에 출력명(「예보시간」)만 있고 예시가 없어서
// 붙여 쓴 12자리(YYYYMMDDHHmm)를 골랐다. 도메인의 `forecastHourLabel`은 이 형식과
// 구분자가 있는 형식을 둘 다 읽고 어느 쪽도 아니면 원문을 그대로 보여주므로,
// 실제 응답이 다른 모양이어도 여기만 고치면 된다 — ROAD_INDEXES와 같은 규약이다.
function forecastTime(base: Date, offsetHours: number): string {
  const at = new Date(base.getTime() + offsetHours * 60 * 60 * 1000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}${pad(at.getHours())}00`
}

function buildHourlyForecast(
  seed: number,
  now: Date,
  temperature: number,
): readonly Record<string, string>[] {
  return Array.from({ length: FORECAST_HOURS }, (_, index) => {
    // 해가 지면 식는 하루 곡선. 상수 곡선이면 「밤에 시원해지나」를 목업으로
    // 확인할 수 없다(mock.ts의 톱니파 교훈과 같다).
    const hour = (now.getHours() + index) % 24
    const swing = Math.cos(((hour - 14) / 24) * 2 * Math.PI) * 4
    const chance = mixSeed(seed, WEATHER_SALT + 10 + index) % 100

    return {
      FCST_DT: forecastTime(now, index),
      TEMP: (temperature + swing).toFixed(1),
      // 확률을 10 단위로 떨어뜨린다. 기상청도 10% 단위로 낸다.
      RAIN_CHANCE: String(Math.round(chance / 10) * 10),
      SKY_STTS: chance >= 60 ? '흐림' : chance >= 30 ? '구름많음' : '맑음',
      PRECPT_TYPE: chance >= 60 ? '비' : '없음',
      // **여기는 실제로 숫자가 온다.** 2026-08-25 표본에서 현재 날씨는 35곳
      // 전부 `-`였는데 예보 840칸 중 75칸에 1.0~11.0mm가 있었다. 값이 있는
      // 칸과 없는 칸이 섞여 오므로 목업도 섞어 낸다 — `PRECPT_TYPE`이 「비」인
      // 칸에만 붙는 것이 실호출과 같은 짝이다.
      PRECIPITATION: chance >= 60 ? (1 + (chance % 5)).toFixed(1) : '-',
    }
  })
}

// **`WEATHER_SALT + 10 + index`가 24칸 예보에 쓰인다**(위 `buildHourlyForecast`).
// 그래서 15~38이 이미 임자가 있고, 여기 더하는 값들은 그 뒤에서 시작해야 한다 —
// 겹치면 습도와 예보 강수확률이 같은 수에서 나와 함께 움직인다.
const WEATHER_EXTRA_SALT = WEATHER_SALT + 40

/** 16방위. 도메인의 `WIND_DIRECTION_NAMES`가 아는 약자여야 한다. */
const WIND_DIRECTIONS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const

// 기상청 자외선지수 단계 경계. 0~2 낮음 / 3~5 보통 / 6~7 높음 / 8~10 매우높음 / 11+ 위험.
function uvGrade(index: number): string {
  if (index <= 2) return '낮음'
  if (index <= 5) return '보통'
  if (index <= 7) return '높음'
  return index <= 10 ? '매우높음' : '위험'
}

const UV_MESSAGES: Readonly<Record<string, string>> = {
  낮음: '햇볕에 민감한 분들은 자외선 차단제를 발라주세요.',
  보통: '2~3시간 이상 야외활동 시 모자와 선글라스를 쓰세요.',
  높음: '한낮에는 그늘에 머무르고 자외선 차단제를 덧발라주세요.',
  매우높음: '오전 10시~오후 3시 야외활동을 피해주세요.',
  위험: '가능한 실내에 머물러주세요. 짧은 노출로도 피부가 상합니다.',
}

/**
 * 기상특보(NEWS_LIST). **드물게 뜬다** — 5분의 1이다.
 *
 * 재난문자(`buildAlerts`)와 다른 소금을 쓴다. 같은 seed에서 둘이 함께 뜨거나
 * 함께 비면 「둘이 서로 다른 출처」라는 것을 목업으로 확인할 수 없다.
 */
function buildWeatherWarnings(seed: number, now: Date): readonly Record<string, string>[] {
  if (mixSeed(seed, WEATHER_EXTRA_SALT + 5) % 5 !== 0) {
    return []
  }
  const kinds = [
    ['폭염', '야외활동은 최대한 자제해주세요. 외출 시 물병을 휴대해주세요.'],
    ['호우', '하천변·지하차도 접근을 피하고 배수구를 점검해주세요.'],
    ['강풍', '간판·창문 등 시설물 파손에 주의해주세요.'],
  ] as const
  // **비트 시프트를 쓰지 마라.** 한 번의 `mixSeed`에서 여러 갈래를 뽑으려고
  // `roll >> 3`을 썼다가 죽었다 — JS의 비트 연산은 32비트 **부호 있는** 값이라
  // 큰 수에서 음수가 나오고, 그게 그대로 음수 인덱스가 된다. 이 파일의 관용대로
  // 갈래마다 소금을 따로 쓴다.
  const [kind, message] = kinds[mixSeed(seed, WEATHER_EXTRA_SALT + 6) % kinds.length]

  return [
    {
      WARN_VAL: kind,
      WARN_STRESS: mixSeed(seed, WEATHER_EXTRA_SALT + 7) % 4 === 0 ? '경보' : '주의보',
      // 특보는 며칠 전에 발효돼 계속 유효한 경우가 흔하다. 「방금」으로 두면
      // 화면이 늘 갓 나온 특보만 그리게 된다.
      ANNOUNCE_TIME: formatSeoulTime(new Date(now.getTime() - 41 * 60 * 60 * 1000)),
      COMMAND: '발표',
      CANCEL_YN: '정상',
      WARN_MSG: message,
    },
  ]
}

function buildWeather(seed: number, now: Date): Record<string, unknown> {
  const temperature = 18 + (mixSeed(seed, WEATHER_SALT) % 15) + 0.4
  const pm10 = 10 + (mixSeed(seed, WEATHER_SALT + 1) % 140)
  const pm25 = 5 + (mixSeed(seed, WEATHER_SALT + 2) % 70)
  const pm10Grade = pmGrade(pm10, [30, 80, 150])
  const pm25Grade = pmGrade(pm25, [15, 35, 75])
  const airGrade = worseGrade(pm10Grade, pm25Grade)
  const rainy = mixSeed(seed, WEATHER_SALT + 3) % 4 === 0
  const uvIndex = mixSeed(seed, WEATHER_EXTRA_SALT + 3) % 12

  return {
    TEMP: temperature.toFixed(1),
    MAX_TEMP: (temperature + 3.1).toFixed(1),
    MIN_TEMP: (temperature - 4.2).toFixed(1),
    HUMIDITY: String(35 + (mixSeed(seed, WEATHER_EXTRA_SALT) % 55)),
    WIND_DIRCT: WIND_DIRECTIONS[mixSeed(seed, WEATHER_EXTRA_SALT + 1) % WIND_DIRECTIONS.length],
    // 0.3~4.7 m/s. 소수 한 자리로 오는 것을 실응답에서 봤다(`2.8`).
    WIND_SPD: ((3 + (mixSeed(seed, WEATHER_EXTRA_SALT + 2) % 45)) / 10).toFixed(1),
    // 실응답은 `-`로 온다 — 「0」이 아니라 「잴 것이 없다」다. 숫자가 아닌 값을
    // 목업이 한 번도 안 내면 파서의 그 갈래가 죽어 있는지 알 수 없다.
    PRECIPITATION: rainy ? '1.5' : '-',
    PRECPT_TYPE: rainy ? '비' : '없음',
    PCP_MSG: rainy ? '곧 비가 내려요. 우산을 챙기세요.' : '비 소식은 없어요.',
    SUNRISE: '05:43',
    SUNSET: '19:31',
    UV_INDEX: String(uvIndex),
    UV_INDEX_LVL: uvGrade(uvIndex),
    UV_MSG: UV_MESSAGES[uvGrade(uvIndex)],
    PM10: String(pm10),
    PM10_INDEX: pm10Grade,
    PM25: String(pm25),
    PM25_INDEX: pm25Grade,
    AIR_IDX: airGrade,
    // 통합대기환경지수의 수치. 등급과 어긋나지 않게 등급에서 되짚어 만든다 —
    // 따로 굴리면 「좋음 / 180」 같은 화면이 나온다.
    AIR_IDX_MVL: String(AIR_INDEX_VALUES[airGrade]),
    // 실응답에서 빈 문자열로도 온다. 좋을 때는 결정물질이랄 것이 없다.
    AIR_IDX_MAIN: airGrade === '좋음' ? '' : pm10Grade === airGrade ? '미세먼지' : '초미세먼지',
    AIR_MSG: AIR_MESSAGES[airGrade],
    WEATHER_TIME: formatSeoulTime(now),
    FCST24HOURS: buildHourlyForecast(seed, now, temperature),
    NEWS_LIST: buildWeatherWarnings(seed, now),
  }
}

const RIDERSHIP_SALT = 9
const BUS_SALT = 10

/**
 * 승하차 인원 한 벌. **접두어만 받아 지하철과 버스를 같은 코드로 만든다** —
 * 실응답의 두 섹션이 접두어 빼고 키가 똑같다.
 *
 * 값은 **min/max 구간**으로 낸다. 폭 50이 실응답의 모양이고, 화면의
 * `ridershipFlow`가 그 폭을 판단 기준으로 쓰기 때문에 목업이 구간을 안 내면
 * 「겹치면 모른다」 갈래가 한 번도 안 밟힌다.
 *
 * 명소마다 **모이는 중·빠지는 중·모름** 셋이 다 나오게 굴린다. 한 방향만
 * 나오면 나머지 두 문장을 목업으로 확인할 수 없다.
 */
function buildRidership(
  seed: number,
  prefix: string,
  salt: number,
  scale: number,
  now: Date,
): Record<string, string> {
  const pad = (value: number) => String(Math.max(0, Math.round(value / 50) * 50))
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`

  // −1(빠지는 중) · 0(모름) · 1(모이는 중)
  const lean = (mixSeed(seed, salt) % 3) - 1
  const row: Record<string, string> = {}

  for (const [span, share] of [
    ['ACML', 1],
    ['30WTHN', 0.28],
    ['10WTHN', 0.1],
    ['5WTHN', 0.05],
  ] as const) {
    const base = scale * share
    // 0이면 두 구간이 겹치게 만든다 — 그때 화면이 방향을 단정하지 않아야 한다.
    const boarding = base * (1 - lean * 0.25)
    const alighting = base * (1 + lean * 0.25)
    row[`${prefix}_${span}_GTON_PPLTN_MIN`] = pad(boarding)
    row[`${prefix}_${span}_GTON_PPLTN_MAX`] = pad(boarding + 50)
    row[`${prefix}_${span}_GTOFF_PPLTN_MIN`] = pad(alighting)
    row[`${prefix}_${span}_GTOFF_PPLTN_MAX`] = pad(alighting + 50)
  }

  row[`${prefix}_STN_CNT`] = String(1 + (mixSeed(seed, salt + 1) % 8))
  row[`${prefix}_STN_TIME`] = stamp
  return row
}

function buildBusStops(areaName: string, seed: number): readonly unknown[] {
  const count = mixSeed(seed, BUS_SALT) % 9
  return Array.from({ length: count }, (_, index) => {
    const mixed = mixSeed(seed, BUS_SALT * 10 + index)
    const at = scatter(areaName, mixed)
    return {
      // 줄마다 같은 값으로 온다. 화면은 첫 줄만 읽는다.
      BUS_RESULT_MSG: '정상 호출되었습니다.',
      BUS_STN_ID: `1000${String(mixed % 100000).padStart(5, '0')}`,
      // 실응답은 네 자리다(`1009`). 정류소 기둥에 붙어 있는 번호다.
      BUS_ARS_ID: String(1000 + (mixed % 9000)),
      BUS_STN_NM: `${areaName}${index === 0 ? '' : `.${index}번출구`}`,
      // X가 경도, Y가 위도다.
      BUS_STN_X: String(at.lng),
      BUS_STN_Y: String(at.lat),
    }
  })
}

const COMMERCE_SALT = 11

/** 실호출 표본(2026-08-25, 명소 8곳 69줄)에서 본 대분류×중분류. */
const COMMERCE_KINDS = [
  ['음식·음료', '한식'],
  ['음식·음료', '제과/커피/패스트푸드'],
  ['음식·음료', '일식/중식/양식'],
  ['음식·음료', '기타요식'],
  ['유통', '편의점'],
  ['유통', '할인점/슈퍼마켓'],
  ['패션·뷰티', '의복/의류'],
  ['패션·뷰티', '패션/잡화'],
  ['의료', '병원'],
  ['의료', '약국'],
  ['여가·오락', '스포츠/문화/레저'],
] as const

/** 실호출에서 확인한 네 단계. `commerceLevelTone`이 아는 값과 같아야 한다. */
const COMMERCE_LEVEL_VALUES = ['한산한', '보통', '분주한', '바쁜'] as const

/**
 * 실시간 상권. **다섯 곳 중 한 곳은 통째로 없다** — 실호출에서 여의도한강공원이
 * 그랬다. 목업이 언제나 상권을 내면 「상권이 없는 명소」의 빈 탭을 한 번도
 * 확인할 수 없다.
 */
function buildCommerce(seed: number, now: Date): Record<string, unknown> | undefined {
  if (mixSeed(seed, COMMERCE_SALT) % 5 === 0) {
    return undefined
  }
  const level = COMMERCE_LEVEL_VALUES[mixSeed(seed, COMMERCE_SALT + 1) % 4]
  const count = 3 + (mixSeed(seed, COMMERCE_SALT + 2) % 9)
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`

  // 여섯 칸을 100에 맞춘다. 남는 몫은 30·40대로 몰아 실데이터의 모양을 닮게 한다.
  const ageRaw = Array.from(
    { length: 6 },
    (_, index) => 5 + (mixSeed(seed, COMMERCE_SALT + 10 + index) % 25),
  )
  const ageSum = ageRaw.reduce((sum, value) => sum + value, 0)
  const ageRates = ageRaw.map((value) => Math.round((value / ageSum) * 1000) / 10)
  const male = 30 + (mixSeed(seed, COMMERCE_SALT + 3) % 41)

  return {
    AREA_CMRCL_LVL: level,
    AREA_SH_PAYMENT_CNT: String(20 + (mixSeed(seed, COMMERCE_SALT + 4) % 400)),
    // 실응답은 이 둘을 **숫자**로 준다(다른 필드는 문자열이다).
    AREA_SH_PAYMENT_AMT_MIN: 500_000 + (mixSeed(seed, COMMERCE_SALT + 5) % 60) * 100_000,
    AREA_SH_PAYMENT_AMT_MAX: 550_000 + (mixSeed(seed, COMMERCE_SALT + 5) % 60) * 100_000,
    CMRCL_RSB: Array.from({ length: count }, (_, index) => {
      const [major, minor] = COMMERCE_KINDS[index % COMMERCE_KINDS.length]
      const mixed = mixSeed(seed, COMMERCE_SALT * 10 + index)
      return {
        RSB_LRG_CTGR: major,
        RSB_MID_CTGR: minor,
        RSB_PAYMENT_LVL: COMMERCE_LEVEL_VALUES[mixed % 4],
        RSB_SH_PAYMENT_CNT: 1 + (mixed % 90),
        RSB_SH_PAYMENT_AMT_MIN: 100_000 + (mixed % 20) * 100_000,
        RSB_SH_PAYMENT_AMT_MAX: 150_000 + (mixed % 20) * 100_000,
        RSB_MCT_CNT: 5 + (mixed % 400),
        RSB_MCT_TIME: '202607',
      }
    }),
    CMRCL_MALE_RATE: male,
    CMRCL_FEMALE_RATE: 100 - male,
    CMRCL_10_RATE: ageRates[0],
    CMRCL_20_RATE: ageRates[1],
    CMRCL_30_RATE: ageRates[2],
    CMRCL_40_RATE: ageRates[3],
    CMRCL_50_RATE: ageRates[4],
    CMRCL_60_RATE: ageRates[5],
    CMRCL_PERSONAL_RATE: 60 + (mixSeed(seed, COMMERCE_SALT + 6) % 35),
    CMRCL_CORPORATION_RATE: 40 - (mixSeed(seed, COMMERCE_SALT + 6) % 35),
    CMRCL_TIME: stamp,
  }
}

const CHARGER_SALT = 12

/** 실호출 1,725대 표본에서 본 값들. 도메인의 목록과 같아야 한다. */
const CHARGER_KIND_VALUES = ['사업장(사옥)', '아파트', '공영주차장', '백화점', '공원'] as const
const CHARGER_TYPE_VALUES = ['AC완속', 'DC콤보', 'DC차데모+AC3상+DC콤보'] as const
const CHARGER_STATUS_VALUES = [
  '사용가능',
  '충전중',
  '상태미확인',
  '통신이상',
  '점검중',
] as const

/**
 * 전기차충전소. **명소별 편차가 크다** — 실호출에서 0곳부터 44곳까지 봤다.
 * 목업이 언제나 몇 곳씩 내면 「충전소가 없는 명소」의 빈 절을 확인할 수 없다.
 *
 * **이용 제한을 반드시 섞는다.** 실호출에서 1,725대 중 464대(27%)가 제한
 * 있음이었고, 화면이 그런 곳을 뒤로 미는지가 목업으로 확인돼야 한다.
 */
function buildChargers(areaName: string, seed: number, now: Date): readonly unknown[] {
  const count = mixSeed(seed, CHARGER_SALT) % 6
  return Array.from({ length: count }, (_, index) => {
    const mixed = mixSeed(seed, CHARGER_SALT * 10 + index)
    const at = scatter(areaName, mixed)
    const limited = mixed % 4 === 0
    const kind = CHARGER_KIND_VALUES[mixed % CHARGER_KIND_VALUES.length]
    const plugs = 1 + (mixed % 4)

    return {
      STAT_NM: `${areaName} ${kind}`,
      STAT_ID: `MOCK${String(mixed % 100000).padStart(5, '0')}`,
      STAT_ADDR: `서울특별시 ${areaName} ${100 + (mixed % 300)}`,
      // X가 경도, Y가 위도다.
      STAT_X: String(at.lng),
      STAT_Y: String(at.lat),
      STAT_USETIME: mixed % 3 === 0 ? '09:00~18:00' : '24시간 이용가능',
      STAT_PARKPAY: mixed % 2 === 0 ? 'Y' : 'N',
      STAT_LIMITYN: limited ? 'Y' : 'N',
      // 자유 문장이다. 제한이 없으면 빈 값으로 온다.
      STAT_LIMITDETAIL: limited ? '해당 시설 정책에 따라 이용이 불가할 수 있습니다' : '',
      STAT_KINDDETAIL: kind,
      CHARGER_DETAILS: Array.from({ length: plugs }, (_, plug) => {
        const inner = mixSeed(seed, CHARGER_SALT * 100 + index * 10 + plug)
        const type = CHARGER_TYPE_VALUES[inner % CHARGER_TYPE_VALUES.length]
        const status = CHARGER_STATUS_VALUES[inner % CHARGER_STATUS_VALUES.length]
        return {
          CHARGER_ID: String(plug + 1).padStart(2, '0'),
          CHARGER_TYPE: type,
          CHARGER_STAT: status,
          STATUPDDT: formatSeoulTime(now),
          LASTTSDT: formatSeoulTime(new Date(now.getTime() - 5 * 60 * 60 * 1000)),
          LASTTEDT: formatSeoulTime(new Date(now.getTime() - 3 * 60 * 60 * 1000)),
          // 충전 중일 때만 온다. 아니면 빈 값이다.
          NOWTSDT: status === '충전중' ? formatSeoulTime(new Date(now.getTime() - 1800_000)) : '',
          // 완속은 7kW, 급속은 50~100kW가 실데이터의 모양이다.
          OUTPUT: type === 'AC완속' ? '7' : String([50, 100, 200][inner % 3]),
          METHOD: inner % 5 === 0 ? '동시' : '단독',
        }
      }),
    }
  })
}

const PARKING_KINDS = ['공영주차장', '노외주차장', '민영주차장'] as const

/**
 * 명소 좌표 근처에 흩뿌린다. 실데이터의 주차장·따릉이가 그 명소 주변에 있는
 * 것과 같은 모양이라야 「지도에서 보기」를 목업으로 확인할 수 있다.
 *
 * 0.004도는 위도로 약 440m, 경도로 약 350m다 — 걸어갈 만한 거리다.
 */
function scatter(areaName: string, mixed: number): { lat: number; lng: number } {
  const entry = findAreaByName(areaName)
  const base = entry ?? { lat: 37.5665, lng: 126.978 }
  return {
    lat: base.lat + (((mixed % 9) - 4) * 0.004) / 4,
    lng: base.lng + ((((mixed >> 3) % 9) - 4) * 0.004) / 4,
  }
}

function buildParking(areaName: string, seed: number, now: Date): readonly unknown[] {
  const count = mixSeed(seed, PARKING_SALT) % 4
  return Array.from({ length: count }, (_, index) => {
    const mixed = mixSeed(seed, PARKING_SALT * 10 + index)
    const capacity = 50 + (mixed % 8) * 50
    // 5곳 중 1곳은 만차로 둔다. 만차 배지를 목업으로 확인할 수 있어야 한다.
    const full = mixed % 5 === 0
    const at = scatter(areaName, mixed)
    const free = mixed % 3 === 0
    // **기본요금 0원짜리 유료 주차장을 반드시 하나는 낸다.** 실호출에 셋
    // 있었고(「30분까지 무료, 이후 과금」), 목업이 그 갈래를 한 번도 안 내면
    // 화면이 그것을 「무료 주차장」으로 잘못 적어도 아무도 모른다.
    const freeGrace = !free && mixed % 4 === 1
    return {
      PRK_NM: `${areaName} ${PARKING_KINDS[index % PARKING_KINDS.length]}`,
      PRK_CD: `MOCK${String(mixed % 100000).padStart(5, '0')}`,
      // 실응답은 문자열로 준다(docs/fixtures/citydata-광화문덕수궁.json).
      LAT: String(at.lat),
      LNG: String(at.lng),
      CPCTY: String(capacity),
      CUR_PRK_CNT: full ? '0' : String(mixed % capacity),
      CUR_PRK_TIME: formatSeoulTime(now),
      CUR_PRK_YN: 'Y',
      PAY_YN: free ? 'N' : 'Y',
      // 무료 주차장은 네 값이 전부 0으로 온다 — 실호출의 관광버스 승하차
      // 구간 셋이 그랬다. 「10분당 0원」이 화면에 새지 않는지 이것이 확인한다.
      RATES: free ? '0' : freeGrace ? '0' : String(1000 + (mixed % 3) * 1000),
      TIME_RATES: free ? '0' : String([10, 15, 30][mixed % 3]),
      ADD_RATES: free ? '0' : String(500 + (mixed % 3) * 500),
      ADD_TIME_RATES: free ? '0' : '10',
      // 실호출은 도로명주소가 거의 비어 있고 지번만 온다. 그 쪽을 기본으로
      // 두어야 화면이 지번을 그리는 자리를 목업으로 확인할 수 있다.
      ADDRESS: `${areaName} ${100 + (mixed % 400)}-${mixed % 30}`,
      ROAD_ADDR: '',
    }
  })
}

function buildBikes(areaName: string, seed: number): readonly unknown[] {
  const count = mixSeed(seed, BIKE_SALT) % 4
  return Array.from({ length: count }, (_, index) => {
    const mixed = mixSeed(seed, BIKE_SALT * 10 + index)
    const racks = 8 + (mixed % 15)
    // **거치대보다 많이 꽂힌 대여소가 있다** — 실호출 227곳 중 61곳(27%)이
    // 그랬고 최대 450%였다. `% (racks + 1)`로 두면 그 갈래가 목업에 아예
    // 없어서 「반납 자리 없음」 줄을 개발 중에 한 번도 못 본다.
    const parked = mixed % Math.round(racks * 1.6)
    const at = scatter(areaName, mixed)
    return {
      SBIKE_SPOT_NM: `${areaName} ${index + 1}번 대여소`,
      // **실응답은 숫자로 주고 X가 경도, Y가 위도다.** 주차장과 다르다.
      SBIKE_X: at.lng,
      SBIKE_Y: at.lat,
      SBIKE_SPOT_ID: `ST-${1000 + (mixed % 900)}`,
      SBIKE_PARKING_CNT: String(parked),
      SBIKE_RACK_CNT: String(racks),
      // **실호출 227곳에서 `parked / racks * 100`과 반올림까지 같았다.**
      // 목업이 딴 숫자를 내면 화면이 「7대 가능 / 거치율 3%」처럼 모순된 두
      // 값을 그리는데, 그건 실데이터에서는 안 일어나는 모양이다.
      SBIKE_SHARED: String(Math.round((parked / racks) * 100)),
    }
  })
}

// 문구와 구조 모두 **2026-08-13 실호출 응답을 본떴다**(고정 자료:
// docs/fixtures/citydata-광화문덕수궁.json). 열차는 역 안의 `SUB_DETAIL`에 있고,
// 역 쪽 `SUB_STN_LINE`은 「3」처럼 숫자만, 열차 쪽 `SUB_LINE`은 「3호선」으로 온다.
// 도착 메세지는 「전역 출발」·「9분 후 (동대입구)」 두 모양이 섞여 온다.
const SUB_MESSAGES = ['전역 출발', '전역 진입', '전역 도착'] as const
const SUB_TERMINALS = ['대화', '오금', '소요산', '인천'] as const

/**
 * 승강기 갈래 코드. **네 코드를 다 돌려야** 갈래마다 다른 이름이 뜨는지 목업으로
 * 볼 수 있다 — 실호출에서는 무빙워크가 160건 중 2건이라 우연에 맡기면 안 나온다.
 *
 * 도메인 표에서 뽑는다. 코드가 하나 늘면 목업도 함께 는다.
 */
const SUB_FACILITY_KINDS = Object.keys(
  SUBWAY_FACILITY_KINDS,
) as readonly SubwayFacilityKind[]

function buildSubway(seed: number): readonly unknown[] {
  // 역이 0~2곳. 지하철역이 없는 명소(한강공원 등)를 목업으로도 볼 수 있어야 한다.
  const stationCount = mixSeed(seed, SUBWAY_SALT) % 3

  return Array.from({ length: stationCount }, (_, stationIndex) => {
    const mixed = mixSeed(seed, SUBWAY_SALT * 10 + stationIndex)
    const lineNumber = 1 + (mixed % 9)

    return {
      SUB_STN_NM: `${mixed % 90}번가`,
      // 실제 응답이 숫자 문자열이다. 파서가 여기에 「호선」을 붙인다.
      SUB_STN_LINE: String(lineNumber),
      SUB_STN_X: '126.97353',
      SUB_STN_Y: '37.575762',
      // 역마다 열차 2~4대. 넷이면 「외 1대」가 붙어 잘림 안내도 볼 수 있다.
      SUB_DETAIL: Array.from({ length: 2 + (mixed % 3) }, (_, trainIndex) => {
        const train = mixSeed(mixed, trainIndex + 1)
        const minutes = train % 12
        const terminal = SUB_TERMINALS[train % SUB_TERMINALS.length]
        return {
          SUB_LINE: `${lineNumber}호선`,
          SUB_ROUTE_NM: `${terminal}행 - ${train % 90}번가방면`,
          SUB_DIR: train % 2 === 0 ? '상행' : '하행',
          SUB_TERMINAL: terminal,
          SUB_ARVTIME: String(minutes * 60),
          // 분 단위와 문구형이 섞여 온다. 한쪽만 넣으면 다른 쪽 표시를 못 본다.
          SUB_ARMG1:
            minutes === 0
              ? SUB_MESSAGES[train % SUB_MESSAGES.length]
              : `${minutes}분 후 (${train % 90}번가)`,
          SUB_ARMG2: `${train % 90}번가`,
        }
      }),
      SUB_FACIINFO: buildSubwayFacilities(mixed),
    }
  })
}

/**
 * 역 승강기. **역마다 0~4건이다** — 실호출에서 44역 중 13역만 이 배열을 채웠고,
 * 「승강기를 안 주는 역」이 정상 상태라 목업으로도 그 모습을 봐야 한다.
 *
 * **보수중이 반드시 섞인다**(넷 중 하나). 화면에서 이 절이 실제로 하는 말은
 * 「지금 멈춘 것이 있다」인데, 전부 사용가능이면 그 자리를 목업으로 못 본다 —
 * 실호출 비율은 6.9%라 우연에 맡기면 안 나온다.
 */
function buildSubwayFacilities(mixed: number): readonly unknown[] {
  const count = mixed % 5

  return Array.from({ length: count }, (_, index) => {
    const facility = mixSeed(mixed, index + 20)
    const kind = SUB_FACILITY_KINDS[facility % SUB_FACILITY_KINDS.length]
    return {
      // 실응답이 갈래 이름을 이 문자열에 담아 온다 — 코드의 뜻을 확인한 증인이
      // 그것이다(`domain/subwayFacility.ts`). 파서는 안 읽지만 모양을 맞춘다.
      ELVTR_NM: `승강기)${SUBWAY_FACILITY_KINDS[kind]}-${mixed % 90}번가 ${index + 1}`,
      OPR_SEC: `B${1 + (facility % 3)}-B${2 + (facility % 3)}`,
      INSTL_PSTN: `${1 + (facility % 9)}번 출입구`,
      USE_YN: index % 4 === 3 ? '보수중' : '사용가능',
      ELVTR_SE: kind,
    }
  })
}

function buildEvents(areaName: string, seed: number): readonly unknown[] {
  const count = mixSeed(seed, EVENT_SALT) % 3
  return Array.from({ length: count }, (_, index) => {
    const mixed = mixSeed(seed, EVENT_SALT * 10 + index)
    const at = scatter(areaName, mixed)
    return {
      EVENT_NM: EVENT_NAMES[mixed % EVENT_NAMES.length],
      EVENT_PERIOD: '2026-08-01~2026-08-31',
      EVENT_PLACE: areaName,
      PAY_YN: mixed % 2 === 0 ? '무료' : '유료',
      URL: `https://culture.seoul.go.kr/culture/mock/${mixed % 1000}`,
      // X가 경도, Y가 위도다(따릉이와 같은 규칙).
      EVENT_X: at.lng,
      EVENT_Y: at.lat,
      // **셋 중 하나는 그림이 없다.** 실호출 53건은 전부 있었지만 「끝난 행사의
      // 파일이 내려간 경우」를 개발 중에 봐야 `EventThumbnail`의 빈 자리 처리가
      // 눈에 띈다.
      THUMBNAIL:
        mixed % 3 === 0 ? '' : `https://culture.seoul.go.kr/cmmn/file/mock/${mixed % 1000}`,
      // `EVENT_ETC_DETAIL`은 안 만든다 — 파서가 일부러 안 읽는다.
    }
  })
}

function buildAlerts(seed: number, now: Date): readonly unknown[] {
  if (mixSeed(seed, ALERT_SALT) % 5 !== 0) {
    return []
  }
  return [
    {
      DST_SE_NM: '호우',
      EMRG_STEP_NM: '주의보',
      MSG_CN: '[서울시] 호우주의보 발효. 하천 산책로 출입을 자제하고 안전에 유의하세요.',
      CRT_DT: formatSeoulTime(now),
    },
  ]
}

// **한 겹 안이다.** 2026-08-13 실호출로 확인했다 — 바깥은 `{ AVG_ROAD_DATA, 구간
// 배열 }`이고 지표·안내·평균속도는 `AVG_ROAD_DATA` 안에 있다. 예전 목업은 이걸
// 평평하게 두어, 파서가 바깥을 읽어도 목업에서는 통과하고 실데이터에서만 카드가
// 사라졌다. 목업이 실제 모양을 흉내 내야 그 차이가 테스트에서 드러난다.
//
// 평균속도는 **문자열이 아니라 number**로 온다. 구간 배열은 파서가 일부러
// 읽지 않지만(XYLIST 좌표 덩어리다) 모양은 남겨 둔다.
function buildRoadTraffic(areaName: string, seed: number, now: Date): unknown {
  const mixed = mixSeed(seed, ROAD_SALT)
  const index = ROAD_INDEXES[mixed % ROAD_INDEXES.length]
  const speed = 12 + (mixed % 28)
  return {
    AVG_ROAD_DATA: {
      ROAD_TRAFFIC_IDX: index,
      ROAD_TRAFFIC_SPD: speed,
      ROAD_MSG: `주변 도로 평균 속도는 ${String(speed)}km/h, 소통 상태는 ${index}입니다.`,
      ROAD_TRAFFIC_TIME: formatSeoulTime(now),
    },
    ROAD_TRAFFIC_STTS: buildRoadSegments(areaName, seed),
  }
}

/** 실호출에서 자주 본 도로명들. 고유명사라 옮기지 않는 자리다. */
const ROAD_NAMES = ['세종대로', '종로', '올림픽대로', '여의동로', '테헤란로'] as const

/** 노드 이름. **실호출의 4분의 1이 번지꼴이라** 그쪽도 섞는다 — 화면이 그 값을
 *  그대로 적기로 했으니 개발 중에 보여야 한다. */
const NODE_NAMES = [
  '세종대로사거리',
  '광화문',
  '종로1가',
  '노량진동 118-14',
  '수산시장입구교차로',
  '역삼초등학교',
] as const

/**
 * 도로 구간. **명세에 없는 한 겹 안이다** — 바깥 `ROAD_TRAFFIC_STTS` 안에 같은
 * 이름의 배열이 또 있다(2026-08-25 실호출).
 *
 * 구간 수를 6~13으로 낸다. 실호출은 3~281개였는데, 목업이 `VISIBLE_LIMIT`(5)를
 * 넘겨야 「외 N곳」 줄이 개발 중에 보인다.
 */
function buildRoadSegments(areaName: string, seed: number): readonly unknown[] {
  const count = 6 + (mixSeed(seed, ROAD_SALT + 1) % 8)
  return Array.from({ length: count }, (_, index) => {
    const mixed = mixSeed(seed, ROAD_SALT * 100 + index)
    const from = scatter(areaName, mixed)
    const to = scatter(areaName, mixed + 1)
    // **지표와 속도를 따로 굴린다.** 실호출에서 둘의 범위가 크게 겹쳤고
    // (정체 2~28 · 원활 25~67) 화면이 그 사실 위에 서 있다 — 속도로 지표를
    // 지어내는 목업을 두면 화면 규칙이 목업에서만 성립한다.
    const idx = ROAD_INDEXES[mixed % ROAD_INDEXES.length]
    return {
      LINK_ID: `116${String(mixed % 100000)}${String(index)}`,
      ROAD_NM: ROAD_NAMES[mixed % ROAD_NAMES.length],
      START_ND_NM: NODE_NAMES[mixed % NODE_NAMES.length],
      END_ND_NM: NODE_NAMES[(mixed + 1) % NODE_NAMES.length],
      // 노드 코드는 파서가 일부러 안 읽는다(근거는 `toRoadSegments`).
      // 실응답에 있는 값이라 모양만 남긴다.
      START_ND_CD: `1220${String(mixed % 1000000)}`,
      END_ND_CD: `1220${String((mixed + 7) % 1000000)}`,
      // **문자열로 온다**(같은 행의 `SPD`는 숫자인데). 실호출 범위가 11~653m다.
      DIST: String(11 + (mixed % 640)) + '.0',
      SPD: 2 + (mixed % 66),
      IDX: idx,
      // **밑줄 앞이 경도, 점 사이는 파이프다.** 예전 목업은 이 둘이 반대였는데
      // (`'126.977,37.570_126.978,37.571'`) 아무도 `XYLIST`를 안 읽어서 몰랐다.
      //
      // **끝에서 시작으로 간다.** 실호출 1,893건 전부가 그랬다 — 이름의 순서와
      // 반대다. 목업이 바로 내면 그 사실이 개발 중에 사라진다.
      XYLIST: `${String(to.lng)}_${String(to.lat)}|${String(from.lng)}_${String(from.lat)}`,
      START_ND_XY: `${String(from.lng)}_${String(from.lat)}`,
      END_ND_XY: `${String(to.lng)}_${String(to.lat)}`,
    }
  })
}

// 사고통제는 재난문자처럼 대부분의 명소에서 비어 있는 게 정상이다. 4곳 중 1곳쯤만
// 채워야 "없을 때의 화면"이 개발 중에도 기본으로 보인다.
function buildAccidents(areaName: string, seed: number, now: Date): readonly unknown[] {
  if (mixSeed(seed, ACCIDENT_SALT) % 4 !== 0) {
    return []
  }
  const clearAt = new Date(now.getTime() + 90 * 60 * 1000)
  const center = scatter(areaName, mixSeed(seed, ACCIDENT_SALT))
  return [
    {
      ACDNT_OCCR_DT: formatSeoulTime(now),
      EXP_CLR_DT: formatSeoulTime(clearAt),
      ACDNT_TYPE: '교통사고',
      ACDNT_DTYPE: '차대차',
      ACDNT_INFO: '차량 2대 추돌로 1개 차로가 통제되고 있어요. 우회를 권합니다.',
      // **명세에 없는 필드다.** 2026-08-25 실호출에서 확인했다 — 서울이 통제
      // 내용의 영어 원문을 함께 준다. 목업이 이걸 안 내면 영어 화면의 이 줄이
      // 개발 중에는 한국어로 보이고, 실데이터에서만 영어가 된다.
      ACDNT_ENG_INFO:
        'One lane is closed due to a two-vehicle collision. Detour recommended.',
      ACDNT_X: center.lng,
      ACDNT_Y: center.lat,
      // 건별이 아니라 절의 값이다 — 실호출에서 같은 명소의 두 건이 같은 시각이었다.
      ACDNT_TIME: formatSeoulTime(now),
    },
  ]
}

export function buildMockCityInfo(areaName: string, now: Date = new Date()): unknown {
  const seed = hashAreaName(areaName)

  return {
    RESULT: { 'RESULT.CODE': 'INFO-000', 'RESULT.MESSAGE': '정상 처리되었습니다' },
    CITYDATA: {
      AREA_NM: areaName,
      AREA_CD: findAreaByName(areaName)?.code ?? 'POI000',
      // **혼잡도 파서와 도시정보 파서가 이 payload 하나를 나눠 먹는다.**
      // 실제 `citydata` 응답도 인구 블록을 여기 담아 준다 — 2026-08-27에
      // 명소 3곳에서 `citydata_ppltn`과 대조해 6필드와 예보 12칸이 전부
      // 일치하는 것을 확인했다(스펙 참고).
      LIVE_PPLTN_STTS: buildMockPopulationRows(areaName, now),
      WEATHER_STTS: [buildWeather(seed, now)],
      ROAD_TRAFFIC_STTS: buildRoadTraffic(areaName, seed, now),
      ACDNT_CNTRL_STTS: buildAccidents(areaName, seed, now),
      PRK_STTS: buildParking(areaName, seed, now),
      SBIKE_STTS: buildBikes(areaName, seed),
      // **명세는 `CULTURALEVENTINFO`, 응답은 `EVENT_STTS`다.** 2026-08-25
      // 실호출 35곳 전부 후자였다 — 목업은 실제로 오는 모양을 낸다. 파서는
      // 둘 다 받고, 명세 쪽 이름은 `cityInfoSchema.test.ts`가 잠근다.
      EVENT_STTS: buildEvents(areaName, seed),
      LIVE_DST_MESSAGE: buildAlerts(seed, now),
      SUB_STTS: buildSubway(seed),
      // 지하철이 버스보다 규모가 크다 — 실호출에서 광화문 지하철 승차 누적
      // 10,400 대 버스 6,000이었다. 둘을 같은 크기로 내면 화면에서 두 절이
      // 구별되지 않는다.
      LIVE_SUB_PPLTN: buildRidership(seed, 'SUB', RIDERSHIP_SALT, 12_000, now),
      LIVE_BUS_PPLTN: buildRidership(seed, 'BUS', RIDERSHIP_SALT + 5, 6_000, now),
      BUS_STN_STTS: buildBusStops(areaName, seed),
      LIVE_CMRCL_STTS: buildCommerce(seed, now),
      CHARGER_STTS: buildChargers(areaName, seed, now),
    },
  }
}
