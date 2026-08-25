import { z } from 'zod'
import type { PopulationComposition } from '../domain/composition'

// cityInfoSchema.ts와 같은 방향의 관대한 파싱이다. schema.ts의 엄격한
// areaSchema에 이 필드들을 얹으면, 비율 하나가 비어 오는 순간 혼잡도까지
// 통째로 날아간다. 부가 정보 때문에 본체를 잃지 않으려고 분리했다.
//
// **이 파일의 함수는 절대 예외를 던지지 않는다.**

/** payload 안의 원본 명소 객체만 꺼낸다. areaSchema와 달리 키를 버리지 않는다. */
const looseListSchema = z.object({
  'SeoulRtd.citydata_ppltn': z.array(z.unknown()),
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// cityInfoSchema.ts의 NUMERIC_PATTERN과 같다. `Number()`를 맨몸으로 쓰면 '0x1f' → 31,
// '1e1' → 10, '+50' → 50이 되어 "없는 값"이 아니라 **그럴듯한 틀린 값**이 화면에 뜬다.
// schema.ts의 numericSchema도 같은 이유로 정규식을 세웠다. 여기는 백분율이라 소수점을
// 받아야 하므로(`'48.2'`) 인구 쪽의 `^\d+$`가 아니라 도시정보 쪽 패턴을 따른다.
const NUMERIC_PATTERN = /^-?\d+(?:\.\d+)?$/

function numberOrNull(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null
  }
  if (typeof raw !== 'string') {
    return null
  }
  const trimmed = raw.trim()
  return NUMERIC_PATTERN.test(trimmed) ? Number(trimmed) : null
}

/** 백분율 한 칸. 읽을 수 없으면 0이다 — null로 두면 화면이 칸마다 분기해야 한다.
 *
 * 대신 0이 "실제로 0%"인지 "읽지 못함"인지 구분되지 않는다. domain/composition.ts의
 * `residentLabel()`이 0을 근거로 단정하지 않는 것은 이 손실을 아는 채로 다루는 것이다. */
function rate(raw: unknown): number {
  const value = numberOrNull(raw)
  if (value === null || value < 0 || value > 100) {
    return 0
  }
  return value
}

const AGE_KEYS: readonly string[] = [
  'PPLTN_RATE_0',
  'PPLTN_RATE_10',
  'PPLTN_RATE_20',
  'PPLTN_RATE_30',
  'PPLTN_RATE_40',
  'PPLTN_RATE_50',
  'PPLTN_RATE_60',
  'PPLTN_RATE_70',
]

const COMPOSITION_KEYS: readonly string[] = [
  'MALE_PPLTN_RATE',
  'FEMALE_PPLTN_RATE',
  'NON_RESNT_PPLTN_RATE',
  'RESNT_PPLTN_RATE',
  ...AGE_KEYS,
]

export function parseComposition(
  payload: unknown,
  expectedName: string,
): PopulationComposition | null {
  const parsed = looseListSchema.safeParse(payload)
  if (!parsed.success) {
    return null
  }

  const area = parsed.data['SeoulRtd.citydata_ppltn'].find(
    (item) => isRecord(item) && item.AREA_NM === expectedName,
  )
  if (!isRecord(area)) {
    return null
  }

  // 관련 키가 하나도 없으면 이 API 버전이 인구 구성을 안 준다는 뜻이다.
  // 0으로 채운 껍데기를 돌려주면 화면이 "남 0% 여 0%"를 그린다.
  if (!COMPOSITION_KEYS.some((key) => key in area)) {
    return null
  }

  return {
    maleRate: rate(area.MALE_PPLTN_RATE),
    femaleRate: rate(area.FEMALE_PPLTN_RATE),
    nonResidentRate: rate(area.NON_RESNT_PPLTN_RATE),
    residentRate: rate(area.RESNT_PPLTN_RATE),
    ageRates: AGE_KEYS.map((key) => rate(area[key])),
  }
}
