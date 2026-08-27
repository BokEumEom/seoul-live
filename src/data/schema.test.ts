import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { AreaNameMismatchError, parseBulkEnvelope, parseCitydataResponse, SeoulApiError } from './schema'

const VALID = {
  'SeoulRtd.citydata_ppltn': [
    {
      AREA_NM: '광화문·덕수궁',
      AREA_CD: 'POI009',
      AREA_CONGEST_LVL: '보통',
      AREA_CONGEST_MSG: '크게 붐비지는 않아요.',
      AREA_PPLTN_MIN: '42000',
      AREA_PPLTN_MAX: '44000',
      PPLTN_TIME: '2026-08-03 14:35',
      FCST_YN: 'Y',
      FCST_PPLTN: [
        {
          FCST_TIME: '2026-08-03 16:00',
          FCST_CONGEST_LVL: '약간 붐빔',
          FCST_PPLTN_MIN: '42000',
          FCST_PPLTN_MAX: '44000',
        },
      ],
    },
  ],
}

const NAME = '광화문·덕수궁'

describe('parseCitydataResponse', () => {
  it('정상 응답을 도메인 모델로 바꾼다', () => {
    const snapshot = parseCitydataResponse(VALID, NAME)
    expect(snapshot.name).toBe('광화문·덕수궁')
    expect(snapshot.code).toBe('POI009')
    expect(snapshot.congestion).toBe('보통')
    expect(snapshot.populationMin).toBe(42000)
    expect(snapshot.populationMax).toBe(44000)
    expect(snapshot.observedAt).toBe('2026-08-03 14:35')
    expect(snapshot.forecasts).toHaveLength(1)
    expect(snapshot.forecasts[0].congestion).toBe('약간 붐빔')
    expect(snapshot.forecasts[0].populationMin).toBe(42000)
  })

  it('예측 시각에서 hour를 뽑는다', () => {
    const snapshot = parseCitydataResponse(VALID, NAME)
    expect(snapshot.forecasts[0].hour).toBe(16)
    expect(snapshot.forecasts[0].time).toBe('2026-08-03 16:00')
  })

  it('자정 예측도 0시로 읽는다', () => {
    const midnight = {
      'SeoulRtd.citydata_ppltn': [
        {
          ...VALID['SeoulRtd.citydata_ppltn'][0],
          FCST_PPLTN: [
            {
              FCST_TIME: '2026-08-04 00:00',
              FCST_CONGEST_LVL: '여유',
              FCST_PPLTN_MIN: '100',
              FCST_PPLTN_MAX: '200',
            },
          ],
        },
      ],
    }
    expect(parseCitydataResponse(midnight, NAME).forecasts[0].hour).toBe(0)
  })

  it('예측 시각 형식이 다르면 ZodError를 던진다', () => {
    const badTime = {
      'SeoulRtd.citydata_ppltn': [
        {
          ...VALID['SeoulRtd.citydata_ppltn'][0],
          FCST_PPLTN: [
            {
              FCST_TIME: '2026/08/04 16:00',
              FCST_CONGEST_LVL: '여유',
              FCST_PPLTN_MIN: '100',
              FCST_PPLTN_MAX: '200',
            },
          ],
        },
      ],
    }
    expect(() => parseCitydataResponse(badTime, NAME)).toThrow(z.ZodError)
  })

  it('시(hour)가 0~23 범위를 벗어나면 ZodError를 던진다', () => {
    const badHour = {
      'SeoulRtd.citydata_ppltn': [
        {
          ...VALID['SeoulRtd.citydata_ppltn'][0],
          FCST_PPLTN: [
            {
              FCST_TIME: '2026-08-04 99:99',
              FCST_CONGEST_LVL: '여유',
              FCST_PPLTN_MIN: '100',
              FCST_PPLTN_MAX: '200',
            },
          ],
        },
      ],
    }
    expect(() => parseCitydataResponse(badHour, NAME)).toThrow(z.ZodError)
  })

  it('예측이 없어도 빈 배열로 처리한다', () => {
    const withoutForecast = {
      'SeoulRtd.citydata_ppltn': [
        { ...VALID['SeoulRtd.citydata_ppltn'][0], FCST_YN: 'N', FCST_PPLTN: null },
      ],
    }
    expect(parseCitydataResponse(withoutForecast, NAME).forecasts).toEqual([])
  })

  it('모르는 혼잡도 값이 오면 ZodError를 던진다', () => {
    const badLevel = {
      'SeoulRtd.citydata_ppltn': [
        { ...VALID['SeoulRtd.citydata_ppltn'][0], AREA_CONGEST_LVL: '초혼잡' },
      ],
    }
    expect(() => parseCitydataResponse(badLevel, NAME)).toThrow(z.ZodError)
  })

  it('숫자가 아닌 인구값이 오면 ZodError를 던진다', () => {
    const badNumber = {
      'SeoulRtd.citydata_ppltn': [
        { ...VALID['SeoulRtd.citydata_ppltn'][0], AREA_PPLTN_MIN: '알수없음' },
      ],
    }
    expect(() => parseCitydataResponse(badNumber, NAME)).toThrow(z.ZodError)
  })

  it('빈 문자열 인구값은 0으로 통과시키지 않고 ZodError를 던진다', () => {
    const emptyNumber = {
      'SeoulRtd.citydata_ppltn': [{ ...VALID['SeoulRtd.citydata_ppltn'][0], AREA_PPLTN_MIN: '' }],
    }
    expect(() => parseCitydataResponse(emptyNumber, NAME)).toThrow(z.ZodError)
  })

  it('음수·소수·16진수·지수 인구값은 ZodError를 던진다', () => {
    for (const bad of ['-500', '42000.5', '0x1f', '1e5']) {
      const badNumber = {
        'SeoulRtd.citydata_ppltn': [
          { ...VALID['SeoulRtd.citydata_ppltn'][0], AREA_PPLTN_MIN: bad },
        ],
      }
      expect(() => parseCitydataResponse(badNumber, NAME)).toThrow(z.ZodError)
    }
  })

  it('최소 인구가 최대 인구보다 크면 ZodError를 던진다', () => {
    const inverted = {
      'SeoulRtd.citydata_ppltn': [
        {
          ...VALID['SeoulRtd.citydata_ppltn'][0],
          AREA_PPLTN_MIN: '50000',
          AREA_PPLTN_MAX: '40000',
        },
      ],
    }
    expect(() => parseCitydataResponse(inverted, NAME)).toThrow(z.ZodError)
  })

  it('빈 배열이면 ZodError를 던진다', () => {
    expect(() => parseCitydataResponse({ 'SeoulRtd.citydata_ppltn': [] }, NAME)).toThrow(
      z.ZodError,
    )
  })

  it('형태가 아예 다르면 ZodError를 던진다', () => {
    // 'RESULT.CODE'/'RESULT.MESSAGE' 키가 아니므로 SeoulApiError 봉투로도 인식되지
    // 않고, 일반 ZodError로 떨어진다.
    expect(() => parseCitydataResponse({ RESULT: { CODE: 'ERROR-500' } }, NAME)).toThrow(
      z.ZodError,
    )
  })

  it('마지막 업데이트 시각을 "HH:MM" 라벨로도 노출한다', () => {
    const snapshot = parseCitydataResponse(VALID, NAME)
    expect(snapshot.observedAtLabel).toBe('14:35')
  })

  it('요청한 명소와 응답 명소가 다르면 AreaNameMismatchError를 던진다', () => {
    // sample 인증키는 지역명과 무관하게 항상 광화문·덕수궁을 돌려준다 — 이 시나리오를 재현한다.
    expect(() => parseCitydataResponse(VALID, '강남역')).toThrow(AreaNameMismatchError)
    try {
      parseCitydataResponse(VALID, '강남역')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(AreaNameMismatchError)
      const mismatch = error as AreaNameMismatchError
      expect(mismatch.requested).toBe('강남역')
      expect(mismatch.received).toEqual(['광화문·덕수궁'])
    }
  })

  it('인구 구성이 깨져 있어도 혼잡도는 살아남는다', () => {
    // 부가 정보 때문에 본체를 잃지 않는다.
    const payload = {
      'SeoulRtd.citydata_ppltn': [
        {
          AREA_NM: '강남역',
          AREA_CD: 'POI014',
          AREA_CONGEST_LVL: '붐빔',
          AREA_CONGEST_MSG: '붐벼요',
          AREA_PPLTN_MIN: '74000',
          AREA_PPLTN_MAX: '76000',
          PPLTN_TIME: '2026-08-10 11:00',
          MALE_PPLTN_RATE: { 이상한: '모양' },
          PPLTN_RATE_20: [1, 2, 3],
        },
      ],
    }

    const snapshot = parseCitydataResponse(payload, '강남역')
    expect(snapshot.congestion).toBe('붐빔')
    expect(snapshot.populationMax).toBe(76_000)
    expect(snapshot.composition?.maleRate).toBe(0)
  })

  it('인구 구성 필드가 아예 없으면 composition이 null이다', () => {
    const payload = {
      'SeoulRtd.citydata_ppltn': [
        {
          AREA_NM: '강남역',
          AREA_CD: 'POI014',
          AREA_CONGEST_LVL: '여유',
          AREA_CONGEST_MSG: '한산해요',
          AREA_PPLTN_MIN: '1000',
          AREA_PPLTN_MAX: '2000',
          PPLTN_TIME: '2026-08-10 11:00',
        },
      ],
    }

    expect(parseCitydataResponse(payload, '강남역').composition).toBeNull()
  })

  it('서울 API의 RESULT 에러 봉투를 SeoulApiError로 바꾼다', () => {
    const errorEnvelope = {
      RESULT: { 'RESULT.CODE': 'INFO-200', 'RESULT.MESSAGE': '해당하는 데이터가 없습니다.' },
    }
    expect(() => parseCitydataResponse(errorEnvelope, NAME)).toThrow(SeoulApiError)
    try {
      parseCitydataResponse(errorEnvelope, NAME)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(SeoulApiError)
      const apiError = error as SeoulApiError
      expect(apiError.code).toBe('INFO-200')
      expect(apiError.message).toContain('해당하는 데이터가 없습니다.')
    }
  })
})

describe('parseCitydataResponse — REPLACE_YN', () => {
  function withReplace(value: unknown): unknown {
    const [area] = VALID['SeoulRtd.citydata_ppltn']
    return { 'SeoulRtd.citydata_ppltn': [{ ...area, REPLACE_YN: value }] }
  }

  it("'Y'면 대체값으로 읽는다", () => {
    expect(parseCitydataResponse(withReplace('Y'), NAME).replaced).toBe(true)
  })

  it("'N'이면 실측으로 읽는다", () => {
    expect(parseCitydataResponse(withReplace('N'), NAME).replaced).toBe(false)
  })

  it('소문자로 와도 같게 읽는다', () => {
    expect(parseCitydataResponse(withReplace('y'), NAME).replaced).toBe(true)
    expect(parseCitydataResponse(withReplace('n'), NAME).replaced).toBe(false)
  })

  // 안 다듬으면 `' Y '`가 조용히 「모름」이 되어 **대체값인데 안내가 안 뜬다.**
  // 이 API는 숫자도 문자열로 오고 명세를 느슨하게 지키는 쪽이라, 같은 응답을
  // 읽는 `cityInfoSchema.text()`도 같은 이유로 다듬는다.
  it('앞뒤 공백이 있어도 같게 읽는다', () => {
    expect(parseCitydataResponse(withReplace(' Y '), NAME).replaced).toBe(true)
    expect(parseCitydataResponse(withReplace('\tN\n'), NAME).replaced).toBe(false)
  })

  // **모름과 실측을 같은 값으로 묶지 않는다.** 화면에서는 지금 둘 다 아무것도
  // 안 그리지만, false는 "서울 API가 실측이라고 했다"는 주장이고 null은 "말해
  // 주지 않았다"이다. 묶어두면 나중에 「실측 확인됨」을 표시하려는 순간 필드가
  // 안 오는 날에도 실측이라고 단언하게 된다. 주차장의 `paid`와 같은 규칙이다.
  it('필드가 없으면 실측이 아니라 모름(null)이다', () => {
    expect(parseCitydataResponse(VALID, NAME).replaced).toBeNull()
  })

  it('아는 값이 아니면 모름(null)이다', () => {
    expect(parseCitydataResponse(withReplace(''), NAME).replaced).toBeNull()
    expect(parseCitydataResponse(withReplace('대체'), NAME).replaced).toBeNull()
    expect(parseCitydataResponse(withReplace(1), NAME).replaced).toBeNull()
  })

  // 혼잡도는 값이 곧 화면의 존재 이유라 엄격하게 파싱한다. 이 필드는 그 값에
  // **대한 메모**라 이상하게 와도 혼잡도를 날리면 안 된다.
  it('값이 이상해도 혼잡도는 그대로 산다', () => {
    const snapshot = parseCitydataResponse(withReplace({ 잘못된: '모양' }), NAME)
    expect(snapshot.congestion).toBe('보통')
    expect(snapshot.replaced).toBeNull()
  })
})

describe('parseCitydataResponse — FCST_YN', () => {
  function withForecastFlag(value: unknown): unknown {
    const [area] = VALID['SeoulRtd.citydata_ppltn']
    return { 'SeoulRtd.citydata_ppltn': [{ ...area, FCST_YN: value }] }
  }

  // **「예보가 비는 두 이유」를 가른다** — 서울이 이 명소는 예측을 안 주는 것과,
  // 지금 예보가 안 온 것은 사용자에게 다른 말이다. 앞쪽은 기다려도 안 온다.
  it("'N'이면 예측을 안 주는 명소다", () => {
    expect(parseCitydataResponse(withForecastFlag('N'), NAME).forecastProvided).toBe(false)
  })

  it("'Y'면 준다", () => {
    expect(parseCitydataResponse(withForecastFlag('Y'), NAME).forecastProvided).toBe(true)
  })

  // `Y`가 아닌 것을 「안 준다」로 읽으면, 처음 보는 값이 왔을 때 없는 사실을
  // 단정하게 된다. `REPLACE_YN`과 같은 규칙이라 같은 함수를 쓴다.
  it('처음 보는 값이면 모른다', () => {
    expect(parseCitydataResponse(withForecastFlag('예'), NAME).forecastProvided).toBeNull()
    expect(parseCitydataResponse(withForecastFlag(1), NAME).forecastProvided).toBeNull()
  })

  it('필드가 아예 없어도 죽지 않는다', () => {
    const [area] = VALID['SeoulRtd.citydata_ppltn']
    const withoutFlag: Record<string, unknown> = { ...area }
    delete withoutFlag.FCST_YN
    expect(
      parseCitydataResponse({ 'SeoulRtd.citydata_ppltn': [withoutFlag] }, NAME)
        .forecastProvided,
    ).toBeNull()
  })
})

describe('parseBulkEnvelope', () => {
  it('이름을 키로 하는 정상 봉투를 그대로 돌려준다', () => {
    const envelope = { results: { 강남역: VALID, 경복궁: null } }
    expect(parseBulkEnvelope(envelope)).toEqual({ 강남역: VALID, 경복궁: null })
  })

  it('빈 results도 허용한다', () => {
    expect(parseBulkEnvelope({ results: {} })).toEqual({})
  })

  it('results 키가 없으면 ZodError를 던진다', () => {
    expect(() => parseBulkEnvelope({})).toThrow(z.ZodError)
  })

  it('payload가 null이면 TypeError가 아니라 ZodError를 던진다', () => {
    // 이게 I6의 핵심이다 — 캐스트만 쓰면 `payload.results`에서 원본 TypeError가
    // 나서 사용자에게 번역되지 않은 메시지가 샐 수 있었다.
    expect(() => parseBulkEnvelope(null)).toThrow(z.ZodError)
  })

  it('results가 객체가 아니면 ZodError를 던진다', () => {
    expect(() => parseBulkEnvelope({ results: [VALID] })).toThrow(z.ZodError)
  })
})

describe('citydata 봉투', () => {
  it('CITYDATA.LIVE_PPLTN_STTS에서도 같은 스냅샷을 만든다', () => {
    // 2026-08-27 실호출 대조: 두 서비스의 행이 완전히 같다(스펙 참고).
    const rows = VALID['SeoulRtd.citydata_ppltn']
    const fromLegacy = parseCitydataResponse({ 'SeoulRtd.citydata_ppltn': rows }, NAME)
    const fromCitydata = parseCitydataResponse({ CITYDATA: { LIVE_PPLTN_STTS: rows } }, NAME)
    expect(fromCitydata).toEqual(fromLegacy)
  })
})
