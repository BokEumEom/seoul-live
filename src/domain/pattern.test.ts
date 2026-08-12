import { describe, expect, it } from 'vitest'
import {
  bucketLabel,
  cellLevel,
  observationSlot,
  observationTotal,
  PATTERN_BUCKETS,
  recordObservation,
  type WeekPattern,
} from './pattern'

const EMPTY: WeekPattern = {}

describe('observationSlot', () => {
  // 서울 API의 시각은 ISO가 아니다(`"2026-08-03 14:35"`, 타임존 없음).
  // `new Date(문자열)`에 맡기면 형식 해석이 엔진마다 달라, 자릿수를 직접 읽는다.
  it('요일과 3시간 버킷을 뽑는다', () => {
    // 2026-08-03은 월요일 → getDay() 1
    expect(observationSlot('2026-08-03 14:35')).toEqual({ day: 1, bucket: 4 })
  })

  it('자정과 23시가 양 끝 버킷에 들어간다', () => {
    expect(observationSlot('2026-08-03 00:00')?.bucket).toBe(0)
    expect(observationSlot('2026-08-03 23:59')?.bucket).toBe(PATTERN_BUCKETS - 1)
  })

  it('일요일은 0이다', () => {
    // 2026-08-09는 일요일
    expect(observationSlot('2026-08-09 09:00')?.day).toBe(0)
  })

  // 못 읽은 시각으로 칸을 채우면 엉뚱한 요일에 관측이 쌓인다. 버리는 편이 낫다.
  it('형식이 다르면 null이다', () => {
    expect(observationSlot('')).toBeNull()
    expect(observationSlot('2026-08-03T14:35:00Z')).toBeNull()
    expect(observationSlot('어제 오후')).toBeNull()
  })

  it('달력에 없는 날짜는 null이다', () => {
    expect(observationSlot('2026-02-30 10:00')).toBeNull()
    expect(observationSlot('2026-13-01 10:00')).toBeNull()
    expect(observationSlot('2026-08-03 25:00')).toBeNull()
  })
})

describe('recordObservation', () => {
  it('빈 패턴에 한 칸을 만든다', () => {
    const next = recordObservation(EMPTY, { day: 1, bucket: 4 }, '보통')
    expect(cellLevel(next, 1, 4)).toBe('보통')
    expect(observationTotal(next)).toBe(1)
  })

  it('입력을 변경하지 않는다', () => {
    const next = recordObservation(EMPTY, { day: 1, bucket: 4 }, '보통')
    expect(EMPTY).toEqual({})
    expect(next).not.toBe(EMPTY)
  })

  // 같은 칸을 여러 번 보면 평균이 그 칸의 패턴이다. 마지막 값으로 덮으면
  // 한 번 붐빈 날이 그 시간대를 영영 붐비는 곳으로 만든다.
  it('같은 칸의 관측을 평균낸다', () => {
    let pattern = recordObservation(EMPTY, { day: 2, bucket: 5 }, '여유')
    pattern = recordObservation(pattern, { day: 2, bucket: 5 }, '붐빔')
    // 랭크 0과 3의 평균 1.5 → 반올림 2 → '약간 붐빔'
    expect(cellLevel(pattern, 2, 5)).toBe('약간 붐빔')
    expect(observationTotal(pattern)).toBe(2)
  })

  it('칸끼리 섞이지 않는다', () => {
    let pattern = recordObservation(EMPTY, { day: 1, bucket: 0 }, '붐빔')
    pattern = recordObservation(pattern, { day: 1, bucket: 1 }, '여유')
    expect(cellLevel(pattern, 1, 0)).toBe('붐빔')
    expect(cellLevel(pattern, 1, 1)).toBe('여유')
  })
})

describe('cellLevel', () => {
  // **안 본 칸을 「여유」로 떨어뜨리면 안 된다.** 관측이 없는 것과 한산한 것은
  // 정반대의 정보인데, 갓 시작한 사용자에게는 화면 전체가 한산해 보인다.
  it('관측이 없는 칸은 null이다', () => {
    expect(cellLevel(EMPTY, 3, 3)).toBeNull()
  })

  it('범위 밖 좌표는 null이다', () => {
    const pattern = recordObservation(EMPTY, { day: 1, bucket: 4 }, '보통')
    expect(cellLevel(pattern, 7, 4)).toBeNull()
    expect(cellLevel(pattern, 1, PATTERN_BUCKETS)).toBeNull()
  })
})

describe('bucketLabel', () => {
  it('버킷이 덮는 시간대를 적는다', () => {
    expect(bucketLabel(0)).toBe('0시')
    expect(bucketLabel(4)).toBe('12시')
    expect(bucketLabel(PATTERN_BUCKETS - 1)).toBe('21시')
  })
})
