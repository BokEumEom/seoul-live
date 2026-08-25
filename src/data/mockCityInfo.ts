import { findAreaByName } from './areas'
import { formatSeoulTime, hashAreaName, mixSeed } from './mock'

// 「더보기」(도시정보) 화면용 목업. buildMockSnapshot과 같은 씨앗을 쓰되 salt를
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
    const at = scatter(areaName, mixed)
    return {
      SBIKE_SPOT_NM: `${areaName} ${index + 1}번 대여소`,
      // **실응답은 숫자로 주고 X가 경도, Y가 위도다.** 주차장과 다르다.
      SBIKE_X: at.lng,
      SBIKE_Y: at.lat,
      SBIKE_SPOT_ID: `ST-${1000 + (mixed % 900)}`,
      SBIKE_PARKING_CNT: String(mixed % (racks + 1)),
      SBIKE_RACK_CNT: String(racks),
    }
  })
}

// 문구와 구조 모두 **2026-08-13 실호출 응답을 본떴다**(고정 자료:
// docs/fixtures/citydata-광화문덕수궁.json). 열차는 역 안의 `SUB_DETAIL`에 있고,
// 역 쪽 `SUB_STN_LINE`은 「3」처럼 숫자만, 열차 쪽 `SUB_LINE`은 「3호선」으로 온다.
// 도착 메세지는 「전역 출발」·「9분 후 (동대입구)」 두 모양이 섞여 온다.
const SUB_MESSAGES = ['전역 출발', '전역 진입', '전역 도착'] as const
const SUB_TERMINALS = ['대화', '오금', '소요산', '인천'] as const

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
    }
  })
}

function buildEvents(areaName: string, seed: number): readonly unknown[] {
  const count = mixSeed(seed, EVENT_SALT) % 3
  return Array.from({ length: count }, (_, index) => {
    const mixed = mixSeed(seed, EVENT_SALT * 10 + index)
    return {
      EVENT_NM: EVENT_NAMES[mixed % EVENT_NAMES.length],
      EVENT_PERIOD: '2026-08-01~2026-08-31',
      EVENT_PLACE: areaName,
      PAY_YN: mixed % 2 === 0 ? '무료' : '유료',
      URL: `https://culture.seoul.go.kr/culture/mock/${mixed % 1000}`,
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
function buildRoadTraffic(seed: number, now: Date): unknown {
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
    ROAD_TRAFFIC_STTS: [
      {
        LINK_ID: `116${String(mixed % 10000)}`,
        ROAD_NM: '세종대로',
        SPD: speed,
        XYLIST: '126.977,37.570_126.978,37.571',
      },
    ],
  }
}

// 사고통제는 재난문자처럼 대부분의 명소에서 비어 있는 게 정상이다. 4곳 중 1곳쯤만
// 채워야 "없을 때의 화면"이 개발 중에도 기본으로 보인다.
function buildAccidents(seed: number, now: Date): readonly unknown[] {
  if (mixSeed(seed, ACCIDENT_SALT) % 4 !== 0) {
    return []
  }
  const clearAt = new Date(now.getTime() + 90 * 60 * 1000)
  return [
    {
      ACDNT_OCCR_DT: formatSeoulTime(now),
      EXP_CLR_DT: formatSeoulTime(clearAt),
      ACDNT_TYPE: '교통사고',
      ACDNT_DTYPE: '차대차',
      ACDNT_INFO: '차량 2대 추돌로 1개 차로가 통제되고 있어요. 우회를 권합니다.',
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
      WEATHER_STTS: [buildWeather(seed, now)],
      ROAD_TRAFFIC_STTS: buildRoadTraffic(seed, now),
      ACDNT_CNTRL_STTS: buildAccidents(seed, now),
      PRK_STTS: buildParking(areaName, seed, now),
      SBIKE_STTS: buildBikes(areaName, seed),
      CULTURALEVENTINFO: buildEvents(areaName, seed),
      LIVE_DST_MESSAGE: buildAlerts(seed, now),
      SUB_STTS: buildSubway(seed),
      // 지하철이 버스보다 규모가 크다 — 실호출에서 광화문 지하철 승차 누적
      // 10,400 대 버스 6,000이었다. 둘을 같은 크기로 내면 화면에서 두 절이
      // 구별되지 않는다.
      LIVE_SUB_PPLTN: buildRidership(seed, 'SUB', RIDERSHIP_SALT, 12_000, now),
      LIVE_BUS_PPLTN: buildRidership(seed, 'BUS', RIDERSHIP_SALT + 5, 6_000, now),
      BUS_STN_STTS: buildBusStops(areaName, seed),
    },
  }
}
