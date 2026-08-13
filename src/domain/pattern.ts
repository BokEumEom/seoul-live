import { congestionRank } from './congestion'
import { CONGESTION_LEVELS, type CongestionLevel } from './types'

// 요일×시간 패턴. **서울 API는 과거를 주지 않는다** — 요청 인자가 KEY·TYPE·
// SERVICE·START_INDEX·END_INDEX·AREA_NM 여섯뿐이고 날짜 인자가 없다. 그래서
// 이 패턴은 조회하는 것이 아니라 **사용자가 상세를 볼 때마다 한 칸씩 쌓는
// 것**이다. 칸이 천천히 차는 것은 결함이 아니라 이 구조의 정직한 모습이고,
// 화면이 그걸 숨기지 않는다. 서버 수집 파이프라인이 생기면 출처만 갈아끼우면
// 되도록 도메인은 관측이 어디서 왔는지 모른다. 근거는 PLAN.md 4차.

/** 한 칸이 덮는 시간. 24를 나누어떨어지고, 좁은 시트에 8칸이 들어간다. */
export const PATTERN_BUCKET_HOURS = 3
export const PATTERN_BUCKETS = 24 / PATTERN_BUCKET_HOURS
/** `Date.getDay()`와 같은 축이다 — 0이 일요일. 표시 순서는 화면이 정한다. */
export const PATTERN_DAYS = 7

export interface PatternSlot {
  readonly day: number
  readonly bucket: number
}

/**
 * 한 칸에 쌓인 것. 평균을 내려면 합과 횟수가 둘 다 필요하다 — 마지막 값으로
 * 덮으면 한 번 붐빈 날이 그 시간대를 영영 붐비는 곳으로 만든다.
 */
export interface PatternCell {
  readonly rankSum: number
  readonly count: number
}

/** 칸이 드물게 차므로 56칸 배열이 아니라 **본 칸만** 담는다. 저장 크기가 곧 값이다. */
export type WeekPattern = Readonly<Record<string, PatternCell>>

function key(day: number, bucket: number): string {
  return `${String(day)}-${String(bucket)}`
}

function inRange(day: number, bucket: number): boolean {
  return (
    Number.isInteger(day) &&
    Number.isInteger(bucket) &&
    day >= 0 &&
    day < PATTERN_DAYS &&
    bucket >= 0 &&
    bucket < PATTERN_BUCKETS
  )
}

// 서울 API의 시각은 `"2026-08-03 14:35"`다 — ISO가 아니고 타임존도 없다.
// `new Date(문자열)`에 맡기지 않는 이유는 이 형식의 해석이 명세되지 않아
// 엔진마다 갈리기 때문이다. 자릿수를 직접 읽고 `Date`에는 **숫자만** 넘긴다.
const OBSERVED_AT_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/

export function observationSlot(observedAt: string): PatternSlot | null {
  const matched = observedAt.trim().match(OBSERVED_AT_PATTERN)
  if (matched === null) {
    return null
  }
  const [, year, month, day, hour] = matched.map(Number)
  if (hour > 23) {
    return null
  }
  const date = new Date(year, month - 1, day)
  // 2월 30일 같은 날짜는 `Date`가 조용히 3월로 넘긴다. 되돌려 대조해야 잡힌다 —
  // 안 잡으면 엉뚱한 요일 칸에 관측이 쌓인다.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return { day: date.getDay(), bucket: Math.floor(hour / PATTERN_BUCKET_HOURS) }
}

export function recordObservation(
  pattern: WeekPattern,
  slot: PatternSlot,
  level: CongestionLevel,
): WeekPattern {
  if (!inRange(slot.day, slot.bucket)) {
    return pattern
  }
  const at = key(slot.day, slot.bucket)
  const previous = pattern[at] ?? { rankSum: 0, count: 0 }
  return {
    ...pattern,
    [at]: {
      rankSum: previous.rankSum + congestionRank(level),
      count: previous.count + 1,
    },
  }
}

/**
 * 그 칸의 평균 혼잡도. **관측이 없으면 `null`이고 「여유」가 아니다** — 안 본
 * 것과 한산한 것은 정반대의 정보인데, 0으로 떨어뜨리면 갓 시작한 사용자에게
 * 화면 전체가 한산해 보인다.
 */
export function cellLevel(
  pattern: WeekPattern,
  day: number,
  bucket: number,
): CongestionLevel | null {
  if (!inRange(day, bucket)) {
    return null
  }
  const cell = pattern[key(day, bucket)]
  if (cell === undefined || cell.count === 0) {
    return null
  }
  return CONGESTION_LEVELS[Math.round(cell.rankSum / cell.count)] ?? null
}

export type UsualDelta = 'busier' | 'similar' | 'calmer'

export interface UsualComparison {
  readonly delta: UsualDelta
  /** 비교에 쓴 **과거** 관측 수. 지금 것은 빠져 있다 */
  readonly samples: number
}

/**
 * 비교를 시작하는 최소 과거 관측 수.
 *
 * 한두 번 본 것으로 「평소보다 붐벼요」를 말하면 근거 없는 단정이 된다. 셋은
 * 자신 있게 말할 만한 수가 아니라 **말하지 않을 선**을 그은 것이다 — 서버
 * 수집이 붙어 표본이 늘면 올릴 자리다.
 */
const MIN_SAMPLES = 3

/**
 * 한 단계 차이의 절반. 랭크가 0~3인 정수축이라 0.5면 「이웃 칸으로 넘어갔나」다.
 * 이보다 작은 흔들림을 「평소보다」라고 부르면 매번 다른 말을 하게 된다.
 */
const DELTA_THRESHOLD = 0.5

/**
 * 지금 혼잡도를 **같은 요일·같은 시간대의 과거 평균**과 견준다.
 * detail_page.png의 「평소보다 붐빔」 한 줄이다.
 *
 * **지금 관측을 평균에서 뺀다.** 이 함수가 받는 패턴에는 `useWeekPattern`이 방금
 * 넣은 지금 값이 이미 들어 있어서, 빼지 않으면 자기 자신과 비교하게 되고 관측이
 * 적을수록 무엇을 넣어도 「비슷」으로 눌린다.
 *
 * 과거가 `MIN_SAMPLES`에 못 미치면 `null`이다 — 화면은 그때 수치 대신
 * 「아직 비교할 기록이 부족해요」를 적는다. 「평소와 비슷」으로 떨어뜨리지 않는
 * 이유는 `cellLevel`이 관측 없는 칸을 「여유」로 만들지 않는 것과 같다.
 */
export function compareWithUsual(
  pattern: WeekPattern,
  slot: PatternSlot,
  current: CongestionLevel,
): UsualComparison | null {
  if (!inRange(slot.day, slot.bucket)) {
    return null
  }
  const cell = pattern[key(slot.day, slot.bucket)]
  if (cell === undefined) {
    return null
  }

  const currentRank = congestionRank(current)
  const samples = cell.count - 1
  if (samples < MIN_SAMPLES) {
    return null
  }

  const usualRank = (cell.rankSum - currentRank) / samples
  const difference = currentRank - usualRank

  if (difference >= DELTA_THRESHOLD) {
    return { delta: 'busier', samples }
  }
  return {
    delta: difference <= -DELTA_THRESHOLD ? 'calmer' : 'similar',
    samples,
  }
}

/** 지금까지 쌓인 관측 수. 화면이 「얼마나 믿을 만한가」를 말하는 근거다. */
export function observationTotal(pattern: WeekPattern): number {
  return Object.values(pattern).reduce((sum, cell) => sum + cell.count, 0)
}

/** 56칸 중 한 번이라도 본 칸의 수. */
export function filledCells(pattern: WeekPattern): number {
  return Object.values(pattern).filter((cell) => cell.count > 0).length
}

export function bucketLabel(bucket: number): string {
  return `${String(bucket * PATTERN_BUCKET_HOURS)}시`
}
