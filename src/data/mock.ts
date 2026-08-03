import { CONGESTION_LEVELS, type CongestionLevel } from '../domain/types'

// CongestionLevel로 키를 고정한다 — Record<string, string>이었다면 레벨이 하나 빠져도
// TypeScript가 잡아주지 못하고 런타임에서야 `undefined` 메시지가 나갔을 것이다.
const MESSAGES: Readonly<Record<CongestionLevel, string>> = {
  여유: '사람이 몰려있을 가능성이 낮고 크게 붐비지 않아요.',
  보통: '사람이 몰려있을 수 있지만 크게 붐비지는 않아요. 도보 이동에 큰 제약이 없어요.',
  '약간 붐빔': '사람들이 몰려있을 가능성이 크고 붐빌 수 있어요. 이동시 주의하세요.',
  붐빔: '사람들이 마주칠 정도로 매우 붐벼요. 안전사고에 주의하세요.',
}

function hash(value: string): number {
  let result = 0
  for (let i = 0; i < value.length; i += 1) {
    result = (result * 31 + value.charCodeAt(i)) % 100_000
  }
  return result
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatTime(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

export function buildMockSnapshot(areaName: string): unknown {
  const seed = hash(areaName)
  const level = CONGESTION_LEVELS[seed % CONGESTION_LEVELS.length]
  const base = 8_000 + (seed % 40) * 1_000
  const now = new Date()

  const forecasts = Array.from({ length: 12 }, (_, index) => {
    const at = new Date(now)
    at.setHours(now.getHours() + index + 1, 0, 0, 0)
    const shifted = CONGESTION_LEVELS[(seed + index) % CONGESTION_LEVELS.length]
    return {
      FCST_TIME: formatTime(at),
      FCST_CONGEST_LVL: shifted,
      FCST_PPLTN_MIN: String(base + index * 500),
      FCST_PPLTN_MAX: String(base + index * 500 + 2_000),
    }
  })

  return {
    'SeoulRtd.citydata_ppltn': [
      {
        AREA_NM: areaName,
        AREA_CD: `MOCK${pad(seed % 100)}`,
        AREA_CONGEST_LVL: level,
        AREA_CONGEST_MSG: MESSAGES[level],
        AREA_PPLTN_MIN: String(base),
        AREA_PPLTN_MAX: String(base + 2_000),
        PPLTN_TIME: formatTime(now),
        FCST_YN: 'Y',
        FCST_PPLTN: forecasts,
      },
    ],
  }
}
