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
        FCST_YN: 'Y',
        FCST_PPLTN: forecasts,
      },
    ],
  }
}
