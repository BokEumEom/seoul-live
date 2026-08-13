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

function buildWeather(seed: number, now: Date): Record<string, unknown> {
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
    FCST24HOURS: buildHourlyForecast(seed, now, temperature),
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
    },
  }
}
