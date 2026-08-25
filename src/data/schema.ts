import { z } from 'zod'
import { parseCongestionLevel } from '../domain/congestion'
import type { AreaSnapshot, CongestionLevel, Forecast } from '../domain/types'
import { parseComposition } from './compositionSchema'

/** 요청한 명소와 응답에 담긴 명소가 다를 때. `sample` 인증키는 지역명과 무관하게
 * 항상 광화문·덕수궁을 돌려주므로, 이 대조가 없으면 아무도 모르게 엉뚱한 데이터가 흐른다. */
export class AreaNameMismatchError extends Error {
  readonly requested: string
  readonly received: readonly string[]

  constructor(requested: string, received: readonly string[]) {
    super(
      `요청한 명소(${requested})가 응답에 없습니다. 받은 명소: ${
        received.length > 0 ? received.join(', ') : '(없음)'
      }`,
    )
    this.name = 'AreaNameMismatchError'
    this.requested = requested
    this.received = received
  }
}

/** 서울 API가 데이터 대신 `RESULT` 봉투로 에러를 돌려줄 때 (예: 오타 난 명소, 서비스 장애).
 * 이 정보를 버리지 않고 그대로 전달해야 오타 진단이 가능하다. */
export class SeoulApiError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(`서울 API 오류 (${code}): ${message}`)
    this.name = 'SeoulApiError'
    this.code = code
  }
}

// `code: 'custom'`은 zod v3·v4 양쪽에서 동작한다.
// v3의 `z.ZodIssueCode.custom`은 v4에서 제거됐으므로 문자열 리터럴을 쓴다.
const congestionSchema = z.string().transform((value, ctx): CongestionLevel => {
  const level = parseCongestionLevel(value)
  if (level === null) {
    ctx.addIssue({ code: 'custom', message: `알 수 없는 혼잡도 값: ${value}` })
    return z.NEVER
  }
  return level
})

// 인구는 음수도 소수도 없다. 자릿수 문자만 허용해 `''`(→ Number('')는 0), `-500`, `0x1f`,
// `1e5`가 그럴듯한 숫자로 통과하는 걸 막는다.
const numericSchema = z
  .string()
  .regex(/^\d+$/, '숫자가 아닌 값')
  .transform(Number)

interface ParsedTime {
  readonly raw: string
  /** 0~23 */
  readonly hour: number
  /** "HH:MM" */
  readonly label: string
}

// 서울 API는 "2026-08-03 16:00" 형식을 준다. ISO가 아니고 타임존도 없다.
// 이 형식에 대한 의존을 여기 zod 파이프라인 한 곳에 가둔다 — 시각 파싱 실패도
// 다른 필드처럼 하나의 ZodError 경로로 나가야 호출부가 분기하기 쉽다.
// 시(hour)는 00~23으로 범위를 좁힌다 — 느슨한 `\d{2}`였다면 "99:99"도 통과해
// 화면에 "99시엔 여유 예상"이 뜨고 차트 축이 깨진다. 분(minute)도 00~59로 좁힌다.
const TIME_PATTERN = /^\d{4}-\d{2}-\d{2} ((?:[01]\d|2[0-3]):[0-5]\d)$/

const timeSchema = z.string().transform((value, ctx): ParsedTime => {
  const matched = value.match(TIME_PATTERN)
  if (matched === null) {
    ctx.addIssue({ code: 'custom', message: `예상치 못한 시각 형식: ${value}` })
    return z.NEVER
  }
  const label = matched[1]
  return { raw: value, hour: Number(label.slice(0, 2)), label }
})

const forecastSchema = z
  .object({
    FCST_TIME: timeSchema,
    FCST_CONGEST_LVL: congestionSchema,
    FCST_PPLTN_MIN: numericSchema,
    FCST_PPLTN_MAX: numericSchema,
  })
  .refine((value) => value.FCST_PPLTN_MIN <= value.FCST_PPLTN_MAX, {
    message: '최소 인구가 최대 인구보다 큽니다',
    path: ['FCST_PPLTN_MAX'],
  })

// REPLACE_YN의 값을 명세가 알려주지 않는다 — 출력명 표에 필드명과 「대체 데이터
// 여부」만 있고 값의 종류가 없다. `PAY_YN`·`CUR_PRK_YN`과 같은 상황이라 도시정보
// 쪽과 같은 방식으로 다룬다: 아는 값이면 읽고 아니면 **모름**으로 둔다.
//
// 타입을 `z.unknown()`으로 열어두는 것이 핵심이다. `z.string()`으로 조이면 이
// 필드가 숫자나 객체로 오는 날 **혼잡도까지 통째로 날아간다** — 이건 값이 아니라
// 값에 대한 메모라 그럴 자격이 없다. 엄격함은 화면의 존재 이유인 값에만 건다.
const REPLACED_VALUES: ReadonlySet<string> = new Set(['Y'])
const MEASURED_VALUES: ReadonlySet<string> = new Set(['N'])

function replacedFlag(value: unknown): boolean | null {
  if (typeof value !== 'string') {
    return null
  }
  const raw = value.trim().toUpperCase()
  if (REPLACED_VALUES.has(raw)) {
    return true
  }
  return MEASURED_VALUES.has(raw) ? false : null
}

const areaSchema = z
  .object({
    AREA_NM: z.string(),
    AREA_CD: z.string(),
    AREA_CONGEST_LVL: congestionSchema,
    AREA_CONGEST_MSG: z.string(),
    AREA_PPLTN_MIN: numericSchema,
    AREA_PPLTN_MAX: numericSchema,
    PPLTN_TIME: timeSchema,
    REPLACE_YN: z.unknown().optional(),
    FCST_YN: z.unknown().optional(),
    FCST_PPLTN: z.array(forecastSchema).nullish(),
  })
  .refine((value) => value.AREA_PPLTN_MIN <= value.AREA_PPLTN_MAX, {
    message: '최소 인구가 최대 인구보다 큽니다',
    path: ['AREA_PPLTN_MAX'],
  })

const responseSchema = z.object({
  'SeoulRtd.citydata_ppltn': z.array(areaSchema).min(1),
})

// api/citydata-bulk.ts가 돌려주는 봉투 모양. 값 하나하나(각 명소의 원본 응답)는
// 여기서 검증하지 않는다 — 그건 parseCitydataResponse의 몫이다(파싱은 schema.ts
// 안에서도 한 곳에만 두고, 이 스키마는 "봉투가 봉투답게 생겼는지"만 본다).
// z.unknown()으로 값을 열어두는 이유: api/는 원본을 정규화하지 않고 그대로
// 넘기므로, 성공 값과 실패 봉투(RESULT.CODE 등)가 같은 자리에 섞여 들어올 수 있다.
const bulkEnvelopeSchema = z.object({
  results: z.record(z.string(), z.unknown()),
})

// 서울 API가 데이터 대신 에러를 돌려줄 때의 봉투. 성공 응답에도 부수적으로
// `RESULT`가 실려 있을 수 있으므로, 이 스키마는 `responseSchema` 파싱이 실패했을 때만
// 진단용으로 시도한다 — 그래야 성공 응답을 오탐하지 않는다.
const errorEnvelopeSchema = z.object({
  RESULT: z.object({
    'RESULT.CODE': z.string(),
    'RESULT.MESSAGE': z.string(),
  }),
})

/** 응답이 `RESULT` 봉투를 달고 있으면 그 에러를, 아니면 `null`을 돌려준다.
 *
 * 성공 응답에도 `RESULT`(INFO-000)가 실려 오므로 **본 파싱이 실패한 뒤에만** 부른다.
 * 먼저 부르면 정상 응답을 에러로 오탐한다. `citydata_ppltn`(아래)과
 * `citydata`(cityInfoSchema.ts)가 같은 봉투를 쓰므로 판별을 한 곳에 둔다. */
export function seoulApiErrorFrom(payload: unknown): SeoulApiError | null {
  const envelope = errorEnvelopeSchema.safeParse(payload)
  if (!envelope.success) {
    return null
  }
  return new SeoulApiError(
    envelope.data.RESULT['RESULT.CODE'],
    envelope.data.RESULT['RESULT.MESSAGE'],
  )
}

function toForecast(raw: z.infer<typeof forecastSchema>): Forecast {
  return {
    time: raw.FCST_TIME.raw,
    hour: raw.FCST_TIME.hour,
    congestion: raw.FCST_CONGEST_LVL,
    populationMin: raw.FCST_PPLTN_MIN,
    populationMax: raw.FCST_PPLTN_MAX,
  }
}

export function parseCitydataResponse(payload: unknown, expectedName: string): AreaSnapshot {
  const result = responseSchema.safeParse(payload)
  if (!result.success) {
    const apiError = seoulApiErrorFrom(payload)
    if (apiError !== null) {
      throw apiError
    }
    throw result.error
  }

  const areas = result.data['SeoulRtd.citydata_ppltn']
  const area = areas.find((entry) => entry.AREA_NM === expectedName)
  if (area === undefined) {
    throw new AreaNameMismatchError(
      expectedName,
      areas.map((entry) => entry.AREA_NM),
    )
  }

  return {
    code: area.AREA_CD,
    // 표시용 이름은 카탈로그 값(expectedName)이 권위다. 응답의 AREA_NM은 대조에만 쓴다 —
    // 위에서 이미 일치를 확인했으므로 문자열은 같지만, 신뢰 소스는 카탈로그 쪽으로 고정한다.
    name: expectedName,
    congestion: area.AREA_CONGEST_LVL,
    message: area.AREA_CONGEST_MSG,
    populationMin: area.AREA_PPLTN_MIN,
    populationMax: area.AREA_PPLTN_MAX,
    observedAt: area.PPLTN_TIME.raw,
    observedAtLabel: area.PPLTN_TIME.label,
    forecasts: (area.FCST_PPLTN ?? []).map(toForecast),
    // **`Y`가 아닌 것이 아니라 `N`인 것만 「안 준다」로 읽는다.** 필드가 없거나
    // 처음 보는 값이면 「모른다」이고, 그때는 예보가 비어도 「아직 없다」로
    // 두는 쪽이 맞다 — 없는 사실을 단정하지 않는다(`replacedFlag`와 같은 규칙).
    // `FCST_YN`. **`Y`가 아닌 것이 아니라 `N`인 것만 「안 준다」로 읽는다** —
    // 필드가 없거나 처음 보는 값이면 「모른다」다. `replacedFlag`와 같은 규칙이라
    // 같은 함수를 쓴다(둘 다 Y/N 메모다). 뜻이 반대라 뒤집는다: 「예측 제공 =
    // Y」이므로 `replacedFlag`가 주는 true가 곧 제공이다.
    forecastProvided: replacedFlag(area.FCST_YN),
    replaced: replacedFlag(area.REPLACE_YN),
    // 원본 payload에서 따로 읽는다. 실패해도 null일 뿐 위 값들은 그대로다.
    composition: parseComposition(payload, expectedName),
  }
}

// api/citydata-bulk.ts 응답의 봉투만 검증한다. `payload`가 `null`이거나 객체가
// 아니거나 `results`가 없으면 ZodError를 던진다 — client.ts가 검증 없이
// `(payload as {...}).results`로 캐스트하면, 응답 본문이 JSON `null`일 때
// "Cannot read properties of null" 같은 번역되지 않은 원본 TypeError가 그대로
// 사용자에게 샐 수 있었다. 이제 다른 형태가 와도 항상 ZodError 하나로 실패한다.
export function parseBulkEnvelope(payload: unknown): Readonly<Record<string, unknown>> {
  const result = bulkEnvelopeSchema.safeParse(payload)
  if (!result.success) {
    throw result.error
  }
  return result.data.results
}
