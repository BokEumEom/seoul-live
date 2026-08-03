import { describe, expect, it } from 'vitest'
import { parseCitydataResponse } from './schema'

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

describe('parseCitydataResponse', () => {
  it('정상 응답을 도메인 모델로 바꾼다', () => {
    const snapshot = parseCitydataResponse(VALID)
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
    const snapshot = parseCitydataResponse(VALID)
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
    expect(parseCitydataResponse(midnight).forecasts[0].hour).toBe(0)
  })

  it('예측 시각 형식이 다르면 던진다', () => {
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
    expect(() => parseCitydataResponse(badTime)).toThrow()
  })

  it('예측이 없어도 빈 배열로 처리한다', () => {
    const withoutForecast = {
      'SeoulRtd.citydata_ppltn': [
        { ...VALID['SeoulRtd.citydata_ppltn'][0], FCST_YN: 'N', FCST_PPLTN: null },
      ],
    }
    expect(parseCitydataResponse(withoutForecast).forecasts).toEqual([])
  })

  it('모르는 혼잡도 값이 오면 던진다', () => {
    const badLevel = {
      'SeoulRtd.citydata_ppltn': [
        { ...VALID['SeoulRtd.citydata_ppltn'][0], AREA_CONGEST_LVL: '초혼잡' },
      ],
    }
    expect(() => parseCitydataResponse(badLevel)).toThrow()
  })

  it('숫자가 아닌 인구값이 오면 던진다', () => {
    const badNumber = {
      'SeoulRtd.citydata_ppltn': [
        { ...VALID['SeoulRtd.citydata_ppltn'][0], AREA_PPLTN_MIN: '알수없음' },
      ],
    }
    expect(() => parseCitydataResponse(badNumber)).toThrow()
  })

  it('빈 배열이면 던진다', () => {
    expect(() => parseCitydataResponse({ 'SeoulRtd.citydata_ppltn': [] })).toThrow()
  })

  it('형태가 아예 다르면 던진다', () => {
    expect(() => parseCitydataResponse({ RESULT: { CODE: 'ERROR-500' } })).toThrow()
  })
})
