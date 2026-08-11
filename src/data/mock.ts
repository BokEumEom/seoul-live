import { AGE_LABELS } from '../domain/composition'
import { CONGESTION_LEVELS, type CongestionLevel } from '../domain/types'
import { findAreaByName } from './areas'

// CongestionLevel로 키를 고정한다 — Record<string, string>이었다면 레벨이 하나 빠져도
// TypeScript가 잡아주지 못하고 런타임에서야 `undefined` 메시지가 나갔을 것이다.
const MESSAGES: Readonly<Record<CongestionLevel, string>> = {
  여유: '사람이 몰려있을 가능성이 낮고 크게 붐비지 않아요.',
  보통: '사람이 몰려있을 수 있지만 크게 붐비지는 않아요. 도보 이동에 큰 제약이 없어요.',
  '약간 붐빔': '사람들이 몰려있을 가능성이 크고 붐빌 수 있어요. 이동시 주의하세요.',
  붐빔: '사람들이 마주칠 정도로 매우 붐벼요. 안전사고에 주의하세요.',
}

// mockCityInfo.ts도 같은 씨앗을 쓴다. 목업이 둘로 갈라져 각자 다른 해시를 쓰면
// 같은 명소인데 화면마다 다른 성격의 가짜 데이터가 나온다.
export function hashAreaName(value: string): number {
  let result = 0
  for (let i = 0; i < value.length; i += 1) {
    result = (result * 31 + value.charCodeAt(i)) % 100_000
  }
  return result
}

// (seed, index) 조합마다 서로 다른 값이 나오도록 비트 단위로 섞는다.
// `hash(`${name}:${index}`)` 같은 문자열 이어붙이기도 시도해봤지만, 위 `hash()`가
// mod 4에서 지나치게 고르게 섞이는 바람에 30곳 전부가 12시간 안에 반드시 '여유'를
// 한 번은 지나가 버렸다 — "한산해지는 시각이 아예 없음" 빈 상태를 목업으로 재현할 수
// 없었다. 정수 비트 믹싱(xorshift 계열)으로 바꿔 실제 이런 구간이 나오게 했다.
export function mixSeed(seed: number, index: number): number {
  let x = (seed + index * 2_654_435_761) >>> 0
  x ^= x << 13
  x >>>= 0
  x ^= x >>> 17
  x ^= x << 5
  x >>>= 0
  return x >>> 0
}

// 인구 구성용 salt. `mixSeed(seed, n)`의 `n`이 겹치면 같은 명소의 예측·도시정보·인구
// 구성이 서로 상관관계를 갖는다. 예측이 0~11을 쓰고, 같은 씨앗과 같은 mixSeed를 쓰는
// mockCityInfo.ts가 `<SALT>*10 + index` 규약으로 5~8·10~13·20~23·30~32를 쓴다.
// 그쪽 salt가 두 자리로 늘어도(10 → 100~103) 닿지 않도록 네 자리 번호대를 쓴다.
const GENDER_SALT = 1_000
const NON_RESIDENT_SALT = 1_001
const COMPOSITION_PRESENCE_SALT = 1_002
/** 연령대 각 칸이 `AGE_SALT + index`를 쓴다. */
const AGE_SALT = 1_010

/** 인구 구성 필드. 일부 명소는 **빈 객체**를 돌려준다 — 서울 API가 이 필드를 주지 않을 때
 * 상세 화면이 섹션을 통째로 숨기는 길을, 목업만으로도 볼 수 있어야 하기 때문이다.
 * mockCityInfo.ts가 주차장·따릉이를 일부러 비워두는 것과 같은 이유다. */
function buildComposition(seed: number): Readonly<Record<string, string>> {
  if (mixSeed(seed, COMPOSITION_PRESENCE_SALT) % 7 === 0) {
    return {}
  }

  const male = 35 + (mixSeed(seed, GENDER_SALT) % 30)
  const nonResident = 20 + (mixSeed(seed, NON_RESIDENT_SALT) % 70)
  // 칸 수를 AGE_LABELS에 묶는다. 여기 숫자를 따로 적으면 연령 구간이 늘어날 때
  // 목업만 뒤처져 마지막 칸이 조용히 0으로 남는다.
  const rawAges = Array.from(
    { length: AGE_LABELS.length },
    (_, index) => 1 + (mixSeed(seed, AGE_SALT + index) % 40),
  )
  const ageTotal = rawAges.reduce((sum, value) => sum + value, 0)

  return {
    MALE_PPLTN_RATE: String(male),
    FEMALE_PPLTN_RATE: String(100 - male),
    NON_RESNT_PPLTN_RATE: String(nonResident),
    RESNT_PPLTN_RATE: String(100 - nonResident),
    ...Object.fromEntries(
      rawAges.map((value, index) => [
        `PPLTN_RATE_${index * 10}`,
        ((value / ageTotal) * 100).toFixed(1),
      ]),
    ),
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** 서울 API의 비표준 시각 형식(`"2026-08-03 16:00"`). ISO가 아니고 타임존도 없다. */
export function formatSeoulTime(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

// `hoursAhead`시간 뒤의 "정각"을 새 Date로 만든다. `base`는 건드리지 않는다.
// `new Date(y, m, d, h, ...)`는 `h`가 23을 넘어도 setHours처럼 다음 날로 정확히 굴러간다.
function topOfHourAfter(base: Date, hoursAhead: number): Date {
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    base.getHours() + hoursAhead,
    0,
    0,
    0,
  )
}

export function buildMockSnapshot(areaName: string, now: Date = new Date()): unknown {
  const seed = hashAreaName(areaName)
  const level = CONGESTION_LEVELS[seed % CONGESTION_LEVELS.length]
  const base = 8_000 + (seed % 40) * 1_000
  // 실제 응답은 카탈로그에 등록된 코드를 그대로 돌려준다 — 목업도 같은 값을 줘야
  // `snapshot.code === entry.code` 대조(2차 오타 탐지기)나 React key로 안전하게 쓸 수 있다.
  const areaCode = findAreaByName(areaName)?.code ?? 'POI000'

  const forecasts = Array.from({ length: 12 }, (_, index) => {
    const at = topOfHourAfter(now, index + 1)
    const shifted = CONGESTION_LEVELS[mixSeed(seed, index) % CONGESTION_LEVELS.length]
    return {
      FCST_TIME: formatSeoulTime(at),
      FCST_CONGEST_LVL: shifted,
      FCST_PPLTN_MIN: String(base + index * 500),
      FCST_PPLTN_MAX: String(base + index * 500 + 2_000),
    }
  })

  return {
    'SeoulRtd.citydata_ppltn': [
      {
        AREA_NM: areaName,
        AREA_CD: areaCode,
        AREA_CONGEST_LVL: level,
        AREA_CONGEST_MSG: MESSAGES[level],
        AREA_PPLTN_MIN: String(base),
        AREA_PPLTN_MAX: String(base + 2_000),
        PPLTN_TIME: formatSeoulTime(now),
        ...buildComposition(seed),
        FCST_YN: 'Y',
        FCST_PPLTN: forecasts,
      },
    ],
  }
}
