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

function buildWeather(seed: number, now: Date): Record<string, string> {
  const temperature = 18 + (mixSeed(seed, WEATHER_SALT) % 15) + 0.4
  const pm10 = 10 + (mixSeed(seed, WEATHER_SALT + 1) % 140)
  const pm25 = 5 + (mixSeed(seed, WEATHER_SALT + 2) % 70)
  const pm10Grade = pmGrade(pm10, [30, 80, 150])
  const pm25Grade = pmGrade(pm25, [15, 35, 75])
  const airGrade = worseGrade(pm10Grade, pm25Grade)
  const rainy = mixSeed(seed, WEATHER_SALT + 3) % 4 === 0

  return {
    TEMP: temperature.toFixed(1),
    MAX_TEMP: (temperature + 3.1).toFixed(1),
    MIN_TEMP: (temperature - 4.2).toFixed(1),
    PRECPT_TYPE: rainy ? '비' : '없음',
    PCP_MSG: rainy ? '곧 비가 내려요. 우산을 챙기세요.' : '비 소식은 없어요.',
    PM10: String(pm10),
    PM10_INDEX: pm10Grade,
    PM25: String(pm25),
    PM25_INDEX: pm25Grade,
    AIR_IDX: airGrade,
    AIR_MSG: AIR_MESSAGES[airGrade],
    WEATHER_TIME: formatSeoulTime(now),
  }
}

const PARKING_KINDS = ['공영주차장', '노외주차장', '민영주차장'] as const

function buildParking(areaName: string, seed: number, now: Date): readonly unknown[] {
  const count = mixSeed(seed, PARKING_SALT) % 4
  return Array.from({ length: count }, (_, index) => {
    const mixed = mixSeed(seed, PARKING_SALT * 10 + index)
    const capacity = 50 + (mixed % 8) * 50
    // 5곳 중 1곳은 만차로 둔다. 만차 배지를 목업으로 확인할 수 있어야 한다.
    const full = mixed % 5 === 0
    return {
      PRK_NM: `${areaName} ${PARKING_KINDS[index % PARKING_KINDS.length]}`,
      CPCTY: String(capacity),
      CUR_PRK_CNT: full ? '0' : String(mixed % capacity),
      CUR_PRK_TIME: formatSeoulTime(now),
      CUR_PRK_YN: 'Y',
      PAY_YN: mixed % 3 === 0 ? 'N' : 'Y',
    }
  })
}

function buildBikes(areaName: string, seed: number): readonly unknown[] {
  const count = mixSeed(seed, BIKE_SALT) % 4
  return Array.from({ length: count }, (_, index) => {
    const mixed = mixSeed(seed, BIKE_SALT * 10 + index)
    const racks = 8 + (mixed % 15)
    return {
      SBIKE_SPOT_NM: `${areaName} ${index + 1}번 대여소`,
      SBIKE_SPOT_ID: `ST-${1000 + (mixed % 900)}`,
      SBIKE_PARKING_CNT: String(mixed % (racks + 1)),
      SBIKE_RACK_CNT: String(racks),
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

function buildRoadTraffic(seed: number, now: Date): readonly unknown[] {
  const mixed = mixSeed(seed, ROAD_SALT)
  const index = ROAD_INDEXES[mixed % ROAD_INDEXES.length]
  const speed = 12 + (mixed % 28)
  return [
    {
      ROAD_TRAFFIC_IDX: index,
      ROAD_TRAFFIC_SPD: String(speed),
      ROAD_MSG: `주변 도로 평균 속도는 ${String(speed)}km/h, 소통 상태는 ${index}입니다.`,
      ROAD_TRAFFIC_TIME: formatSeoulTime(now),
    },
  ]
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
    },
  }
}
