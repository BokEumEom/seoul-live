import { describe, expect, it } from 'vitest'
import type { CongestionLevel } from './types'
import {
  bucketLabel,
  cellLevel,
  compareWithUsual,
  observationSlot,
  observationTotal,
  PATTERN_BUCKETS,
  recordObservation,
  type PatternSlot,
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

  // 「여유 다음 붐빔」은 누적이든 덮어쓰기든 합이 3이라 구분되지 않는다.
  // 같은 값을 두 번 보면 갈린다 — 누적은 6/2=3(붐빔), 덮어쓰기는 3/2=1.5(약간 붐빔).
  it('같은 값을 두 번 봐도 그 값이 그대로다', () => {
    let pattern = recordObservation({}, { day: 3, bucket: 2 }, '붐빔')
    pattern = recordObservation(pattern, { day: 3, bucket: 2 }, '붐빔')
    expect(cellLevel(pattern, 3, 2)).toBe('붐빔')
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

  // 없는 좌표는 보통 맵에도 없어서 조회만으로도 null이 된다. 저장소가 망가져
  // **그 키가 실제로 들어 있는 경우**라야 좌표 검사가 하는 일이 드러난다.
  it('범위 밖 키가 저장돼 있어도 답하지 않는다', () => {
    expect(cellLevel({ '7-4': { rankSum: 3, count: 1 } }, 7, 4)).toBeNull()
  })
})

describe('bucketLabel', () => {
  it('버킷이 덮는 시간대를 적는다', () => {
    expect(bucketLabel(0)).toBe('0시')
    expect(bucketLabel(4)).toBe('12시')
    expect(bucketLabel(PATTERN_BUCKETS - 1)).toBe('21시')
  })
})

describe('compareWithUsual', () => {
  const SLOT: PatternSlot = { day: 3, bucket: 4 }

  /** 지금 관측까지 이미 쌓인 칸을 만든다 — 화면이 받는 패턴이 그 모양이다. */
  function patternOf(levels: readonly CongestionLevel[]): WeekPattern {
    return levels.reduce(
      (pattern, level) => recordObservation(pattern, SLOT, level),
      {} as WeekPattern,
    )
  }

  it('과거 평균보다 붐비면 busier다', () => {
    // 과거 셋이 여유(0)인데 지금이 붐빔(3)이다.
    const pattern = patternOf(['여유', '여유', '여유', '붐빔'])
    expect(compareWithUsual(pattern, SLOT, '붐빔')?.delta).toBe('busier')
  })

  it('과거 평균보다 한산하면 calmer다', () => {
    const pattern = patternOf(['붐빔', '붐빔', '붐빔', '여유'])
    expect(compareWithUsual(pattern, SLOT, '여유')?.delta).toBe('calmer')
  })

  it('과거 평균과 비슷하면 similar다', () => {
    const pattern = patternOf(['보통', '보통', '보통', '보통'])
    expect(compareWithUsual(pattern, SLOT, '보통')?.delta).toBe('similar')
  })

  // 이 카드가 받는 패턴에는 **지금 관측이 이미 들어 있다**. 빼지 않으면 자기
  // 자신과 비교하게 되고, 관측이 적을수록 무엇을 넣어도 「비슷」으로 눌린다.
  //
  // 소재를 판정이 갈리는 값으로 고른다. 표본 수(samples)만 세면 뺄셈을 없애도
  // 그 값은 그대로라 무엇을 해도 통과하는 테스트가 된다 — 실제로 그랬다.
  // 과거 넷의 랭크 합이 6(보통·보통·약간 붐빔·약간 붐빔)이고 지금이 약간 붐빔(2)일 때:
  //   지금 것을 빼면  평균 6/4 = 1.5,  차이 0.5 → 경계에 걸려 busier
  //   빼지 않으면     평균 8/5 = 1.6,  차이 0.4 → 문턱 아래라 similar
  it('지금 관측을 평균에서 빼고 비교한다', () => {
    const pattern = patternOf(['보통', '보통', '약간 붐빔', '약간 붐빔', '약간 붐빔'])
    const usual = compareWithUsual(pattern, SLOT, '약간 붐빔')
    expect(usual?.delta).toBe('busier')
    expect(usual?.samples).toBe(4)
  })

  it('과거 관측이 모자라면 아무 말도 하지 않는다', () => {
    // 한두 번 본 것으로 「평소보다」를 말하면 근거 없는 단정이 된다.
    expect(compareWithUsual(patternOf(['붐빔']), SLOT, '붐빔')).toBeNull()
    expect(compareWithUsual(patternOf(['여유', '붐빔']), SLOT, '붐빔')).toBeNull()
    expect(compareWithUsual(patternOf(['여유', '여유', '붐빔']), SLOT, '붐빔')).toBeNull()
  })

  it('그 칸을 한 번도 안 봤으면 null이다', () => {
    expect(compareWithUsual({}, SLOT, '붐빔')).toBeNull()
  })

  it('다른 칸의 관측은 끌어오지 않는다', () => {
    // 같은 시간대라도 요일이 다르면 다른 이야기다.
    const other = [0, 1, 2, 3].reduce<WeekPattern>(
      (pattern, _, index) =>
        recordObservation(pattern, { day: 1, bucket: 4 }, index === 3 ? '붐빔' : '여유'),
      {},
    )
    expect(compareWithUsual(other, SLOT, '붐빔')).toBeNull()
  })

  it('칸 범위를 벗어나면 null이다', () => {
    expect(compareWithUsual(patternOf(['여유']), { day: 9, bucket: 0 }, '붐빔')).toBeNull()
  })
})
