import { z } from 'zod'
import { parseCongestionLevel } from '../domain/congestion'
import type { AreaSnapshot, CongestionLevel, Forecast } from '../domain/types'

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

const numericSchema = z.string().transform((value, ctx): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    ctx.addIssue({ code: 'custom', message: `숫자가 아닌 값: ${value}` })
    return z.NEVER
  }
  return parsed
})

const forecastSchema = z.object({
  FCST_TIME: z.string(),
  FCST_CONGEST_LVL: congestionSchema,
  FCST_PPLTN_MIN: numericSchema,
  FCST_PPLTN_MAX: numericSchema,
})

const areaSchema = z.object({
  AREA_NM: z.string(),
  AREA_CD: z.string(),
  AREA_CONGEST_LVL: congestionSchema,
  AREA_CONGEST_MSG: z.string(),
  AREA_PPLTN_MIN: numericSchema,
  AREA_PPLTN_MAX: numericSchema,
  PPLTN_TIME: z.string(),
  FCST_PPLTN: z.array(forecastSchema).nullish(),
})

const responseSchema = z.object({
  'SeoulRtd.citydata_ppltn': z.array(areaSchema).min(1),
})

// 서울 API는 "2026-08-03 16:00" 형식을 준다. ISO가 아니고 타임존도 없다.
// 이 형식에 대한 의존을 여기 한 곳에 가두고, 바깥에는 파싱된 hour를 넘긴다.
const TIME_PATTERN = /^\d{4}-\d{2}-\d{2} (\d{2}):\d{2}$/

function parseHour(raw: string): number {
  const matched = raw.match(TIME_PATTERN)
  if (matched === null) {
    throw new Error(`예상치 못한 시각 형식: ${raw}`)
  }
  return Number(matched[1])
}

function toForecast(raw: z.infer<typeof forecastSchema>): Forecast {
  return {
    time: raw.FCST_TIME,
    hour: parseHour(raw.FCST_TIME),
    congestion: raw.FCST_CONGEST_LVL,
    populationMin: raw.FCST_PPLTN_MIN,
    populationMax: raw.FCST_PPLTN_MAX,
  }
}

export function parseCitydataResponse(payload: unknown): AreaSnapshot {
  const parsed = responseSchema.parse(payload)
  const area = parsed['SeoulRtd.citydata_ppltn'][0]

  return {
    code: area.AREA_CD,
    name: area.AREA_NM,
    congestion: area.AREA_CONGEST_LVL,
    message: area.AREA_CONGEST_MSG,
    populationMin: area.AREA_PPLTN_MIN,
    populationMax: area.AREA_PPLTN_MAX,
    observedAt: area.PPLTN_TIME,
    forecasts: (area.FCST_PPLTN ?? []).map(toForecast),
  }
}
