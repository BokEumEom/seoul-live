import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseCityInfoResponse } from './cityInfoSchema'
import { AreaNameMismatchError, SeoulApiError } from './schema'

const AREA = '광화문·덕수궁'

function payload(cityData: Record<string, unknown>): unknown {
  return {
    RESULT: { 'RESULT.CODE': 'INFO-000', 'RESULT.MESSAGE': '정상 처리되었습니다' },
    CITYDATA: { AREA_NM: AREA, AREA_CD: 'POI009', ...cityData },
  }
}

describe('parseCityInfoResponse — 봉투', () => {
  it('장소명과 코드를 옮긴다', () => {
    const info = parseCityInfoResponse(payload({}), AREA)
    expect(info.areaName).toBe(AREA)
    expect(info.areaCode).toBe('POI009')
  })

  it('요청한 장소와 응답의 장소가 다르면 AreaNameMismatchError를 던진다', () => {
    expect(() => parseCityInfoResponse(payload({}), '강남역')).toThrow(AreaNameMismatchError)
  })

  it('RESULT 봉투로 온 에러는 코드와 함께 보존한다', () => {
    const error = {
      RESULT: { 'RESULT.CODE': 'INFO-200', 'RESULT.MESSAGE': '해당하는 데이터가 없습니다.' },
    }
    expect(() => parseCityInfoResponse(error, AREA)).toThrow(SeoulApiError)
    try {
      parseCityInfoResponse(error, AREA)
    } catch (thrown) {
      expect((thrown as SeoulApiError).code).toBe('INFO-200')
    }
  })

  it('CITYDATA가 없으면 ZodError를 던진다', () => {
    expect(() => parseCityInfoResponse({ 잘못된: '모양' }, AREA)).toThrow(z.ZodError)
    expect(() => parseCityInfoResponse(null, AREA)).toThrow(z.ZodError)
  })
})

describe('parseCityInfoResponse — 날씨', () => {
  const weather = {
    TEMP: '28.4',
    MAX_TEMP: '31.0',
    MIN_TEMP: '24.2',
    PCP_MSG: '비 소식은 없어요.',
    PM10: '35',
    PM10_INDEX: '보통',
    PM25: '18',
    PM25_INDEX: '좋음',
    AIR_IDX: '보통',
    AIR_MSG: '외출 시 특별한 주의가 필요하지 않아요.',
    WEATHER_TIME: '2026-08-07 10:00',
  }

  it('배열로 온 날씨의 첫 항목을 읽는다', () => {
    const info = parseCityInfoResponse(payload({ WEATHER_STTS: [weather] }), AREA)
    expect(info.weather).toEqual({
      temperature: 28.4,
      maxTemperature: 31,
      minTemperature: 24.2,
      precipitationMessage: '비 소식은 없어요.',
      pm10: 35,
      pm10Grade: '보통',
      pm25: 18,
      pm25Grade: '좋음',
      airGrade: '보통',
      airMessage: '외출 시 특별한 주의가 필요하지 않아요.',
      updatedAt: '2026-08-07 10:00',
    })
  })

  // 서울 API의 하위 항목은 배열로 오는 것이 원칙이지만, 항목이 하나뿐인 섹션은
  // 객체 하나로 오는 사례가 보고돼 있다. 어느 쪽이 와도 화면이 비지 않게 한다.
  it('객체 하나로 온 날씨도 읽는다', () => {
    const info = parseCityInfoResponse(payload({ WEATHER_STTS: weather }), AREA)
    expect(info.weather?.temperature).toBe(28.4)
  })

  it('날씨 섹션이 없으면 null이다', () => {
    expect(parseCityInfoResponse(payload({}), AREA).weather).toBeNull()
    expect(parseCityInfoResponse(payload({ WEATHER_STTS: [] }), AREA).weather).toBeNull()
  })

  // Number('')은 0이다. 빈 값을 0으로 읽으면 "기온 0도", "미세먼지 0"이 화면에 뜬다.
  it('빈 값과 숫자가 아닌 값은 null로 읽는다', () => {
    const info = parseCityInfoResponse(
      payload({ WEATHER_STTS: [{ ...weather, TEMP: '', PM10: '-', PM25: '점검중' }] }),
      AREA,
    )
    expect(info.weather?.temperature).toBeNull()
    expect(info.weather?.pm10).toBeNull()
    expect(info.weather?.pm25).toBeNull()
  })

  it('음수 기온을 읽는다', () => {
    const info = parseCityInfoResponse(
      payload({ WEATHER_STTS: [{ ...weather, TEMP: '-5.3' }] }),
      AREA,
    )
    expect(info.weather?.temperature).toBe(-5.3)
  })

  it('문자열 대신 숫자가 와도 읽는다', () => {
    const info = parseCityInfoResponse(payload({ WEATHER_STTS: [{ TEMP: 28.4 }] }), AREA)
    expect(info.weather?.temperature).toBe(28.4)
  })
})

describe('parseCityInfoResponse — 주차장', () => {
  it('이름·수용·여유 면수와 실시간 제공 여부를 읽는다', () => {
    const info = parseCityInfoResponse(
      payload({
        PRK_STTS: [
          { PRK_NM: '세종로 공영주차장', CPCTY: '300', CUR_PRK_CNT: '42', CUR_PRK_YN: 'Y', PAY_YN: 'Y' },
          { PRK_NM: '실시간 없음', CPCTY: '120', CUR_PRK_CNT: '', CUR_PRK_YN: 'N', PAY_YN: 'N' },
        ],
      }),
      AREA,
    )
    expect(info.parking).toEqual([
      {
        name: '세종로 공영주차장',
        capacity: 300,
        available: 42,
        liveAvailable: true,
        paid: true,
      },
      {
        name: '실시간 없음',
        capacity: 120,
        available: null,
        liveAvailable: false,
        paid: false,
      },
    ])
  })

  // PAY_YN이 'Y'/'N'으로 오는지 '유료'/'무료'로 오는지 실제 응답으로 확정하지
  // 못했다(명세는 "유무료 여부"라고만 적혀 있다). 양쪽을 다 받는다.
  it('유무료가 한글로 와도 읽는다', () => {
    const info = parseCityInfoResponse(
      payload({
        PRK_STTS: [
          { PRK_NM: '유료', PAY_YN: '유료' },
          { PRK_NM: '무료', PAY_YN: '무료' },
          { PRK_NM: '모름', PAY_YN: '' },
        ],
      }),
      AREA,
    )
    expect(info.parking.map((entry) => entry.paid)).toEqual([true, false, null])
  })

  it('이름이 없는 항목은 버린다', () => {
    const info = parseCityInfoResponse(
      payload({ PRK_STTS: [{ CPCTY: '100' }, { PRK_NM: '  ' }, { PRK_NM: '정상' }] }),
      AREA,
    )
    expect(info.parking.map((entry) => entry.name)).toEqual(['정상'])
  })

  it('섹션이 없으면 빈 배열이다', () => {
    expect(parseCityInfoResponse(payload({}), AREA).parking).toEqual([])
  })

  it('배열 안에 객체가 아닌 값이 섞여도 나머지를 살린다', () => {
    const info = parseCityInfoResponse(
      payload({ PRK_STTS: ['문자열', null, { PRK_NM: '정상' }] }),
      AREA,
    )
    expect(info.parking.map((entry) => entry.name)).toEqual(['정상'])
  })
})

describe('parseCityInfoResponse — 따릉이', () => {
  it('대여소명과 거치 대수를 읽는다', () => {
    const info = parseCityInfoResponse(
      payload({
        SBIKE_STTS: [{ SBIKE_SPOT_NM: '광화문역 3번출구', SBIKE_PARKING_CNT: '7', SBIKE_RACK_CNT: '15' }],
      }),
      AREA,
    )
    expect(info.bikes).toEqual([{ name: '광화문역 3번출구', bikes: 7, racks: 15 }])
  })

  it('이름이 없는 항목은 버린다', () => {
    const info = parseCityInfoResponse(
      payload({ SBIKE_STTS: [{ SBIKE_PARKING_CNT: '3' }] }),
      AREA,
    )
    expect(info.bikes).toEqual([])
  })
})

describe('parseCityInfoResponse — 문화행사', () => {
  const event = {
    EVENT_NM: '서울무용축제',
    EVENT_PERIOD: '2026-08-01~2026-08-15',
    EVENT_PLACE: '세종문화회관',
    PAY_YN: '무료',
    URL: 'https://culture.seoul.go.kr/1',
  }

  it('행사명·기간·장소·무료 여부·링크를 읽는다', () => {
    const info = parseCityInfoResponse(payload({ CULTURALEVENTINFO: [event] }), AREA)
    expect(info.events).toEqual([
      {
        name: '서울무용축제',
        period: '2026-08-01~2026-08-15',
        place: '세종문화회관',
        free: true,
        url: 'https://culture.seoul.go.kr/1',
      },
    ])
  })

  // 명세의 출력명은 CULTURALEVENTINFO지만 응답 JSON의 키가 EVENT_STTS라는
  // 보고가 있다. 인증키가 없어 실제 응답으로 확정하지 못했으므로 둘 다 받는다.
  it('EVENT_STTS 키로 와도 읽는다', () => {
    const info = parseCityInfoResponse(payload({ EVENT_STTS: [event] }), AREA)
    expect(info.events.map((entry) => entry.name)).toEqual(['서울무용축제'])
  })

  it('유료 행사는 free가 false다', () => {
    const info = parseCityInfoResponse(
      payload({ CULTURALEVENTINFO: [{ ...event, PAY_YN: '유료' }] }),
      AREA,
    )
    expect(info.events[0].free).toBe(false)
  })

  it('http가 아닌 링크는 버린다', () => {
    const info = parseCityInfoResponse(
      payload({ CULTURALEVENTINFO: [{ ...event, URL: 'javascript:alert(1)' }] }),
      AREA,
    )
    expect(info.events[0].url).toBe('')
  })
})

describe('parseCityInfoResponse — 재난문자', () => {
  it('구분·단계·내용·시각을 읽는다', () => {
    const info = parseCityInfoResponse(
      payload({
        LIVE_DST_MESSAGE: [
          {
            DST_SE_NM: '호우',
            EMRG_STEP_NM: '경보',
            MSG_CN: '하천 범람 위험. 저지대 주민은 대피하세요.',
            CRT_DT: '2026-08-07 09:12',
          },
        ],
      }),
      AREA,
    )
    expect(info.alerts).toEqual([
      {
        category: '호우',
        step: '경보',
        message: '하천 범람 위험. 저지대 주민은 대피하세요.',
        createdAt: '2026-08-07 09:12',
      },
    ])
  })

  it('내용이 없는 항목은 버린다', () => {
    const info = parseCityInfoResponse(
      payload({ LIVE_DST_MESSAGE: [{ DST_SE_NM: '호우', MSG_CN: '' }] }),
      AREA,
    )
    expect(info.alerts).toEqual([])
  })
})

describe('parseCityInfoResponse — 도로소통', () => {
  it('요약 네 값을 옮긴다', () => {
    const info = parseCityInfoResponse(
      payload({
        ROAD_TRAFFIC_STTS: [
          {
            ROAD_TRAFFIC_IDX: '서행',
            ROAD_TRAFFIC_SPD: '18.4',
            ROAD_MSG: '광화문 일대가 서행하고 있어요.',
            ROAD_TRAFFIC_TIME: '2026-08-07 09:00',
          },
        ],
      }),
      AREA,
    )
    expect(info.roadTraffic).toEqual({
      index: '서행',
      speed: 18.4,
      message: '광화문 일대가 서행하고 있어요.',
      updatedAt: '2026-08-07 09:00',
    })
  })

  // 값 목록을 모르는 필드라 아는 값으로 좁히지 않는다. 명세에 없는 문자열이
  // 와도 그대로 실려야 한다 — 걸러내면 화면에서 도로소통이 통째로 사라진다.
  it('처음 보는 지표 문자열도 그대로 싣는다', () => {
    const info = parseCityInfoResponse(
      payload({ ROAD_TRAFFIC_STTS: [{ ROAD_TRAFFIC_IDX: '매우혼잡' }] }),
      AREA,
    )
    expect(info.roadTraffic?.index).toBe('매우혼잡')
  })

  it('속도가 숫자가 아니면 null로 떨어뜨린다', () => {
    const info = parseCityInfoResponse(
      payload({ ROAD_TRAFFIC_STTS: [{ ROAD_TRAFFIC_IDX: '원활', ROAD_TRAFFIC_SPD: '-' }] }),
      AREA,
    )
    expect(info.roadTraffic?.speed).toBeNull()
  })

  // 섹션이 아예 없는 것과 빈 배열로 오는 것을 같게 다룬다. 둘 다 보여줄 게 없다.
  it('섹션이 없거나 비어 있으면 null이다', () => {
    expect(parseCityInfoResponse(payload({}), AREA).roadTraffic).toBeNull()
    expect(parseCityInfoResponse(payload({ ROAD_TRAFFIC_STTS: [] }), AREA).roadTraffic).toBeNull()
  })

  // 가드가 두 항의 **곱**이라는 것을 잠근다. 한쪽만 봐도 「모두 비면 null」은
  // 통과하므로, 각 항이 혼자 살아 있는 경우를 따로 세워야 한 항을 지웠을 때
  // 죽는다. 안 그러면 메시지만 오는 명소에서 도로소통이 통째로 사라진다.
  it('지표가 없고 안내 문구만 있어도 항목을 만든다', () => {
    const info = parseCityInfoResponse(
      payload({ ROAD_TRAFFIC_STTS: [{ ROAD_MSG: '사고로 정체 중이에요.' }] }),
      AREA,
    )
    expect(info.roadTraffic?.message).toBe('사고로 정체 중이에요.')
    expect(info.roadTraffic?.index).toBe('')
  })

  it('안내 문구가 없고 지표만 있어도 항목을 만든다', () => {
    const info = parseCityInfoResponse(
      payload({ ROAD_TRAFFIC_STTS: [{ ROAD_TRAFFIC_IDX: '원활' }] }),
      AREA,
    )
    expect(info.roadTraffic?.index).toBe('원활')
  })

  // 지표도 메시지도 없으면 카드가 빈 채로 뜬다. 주차장의 이름, 재난문자의
  // 내용과 같은 자리다 — 본체가 없는 항목은 만들지 않는다.
  it('지표와 메시지가 모두 비면 null이다', () => {
    const info = parseCityInfoResponse(
      payload({ ROAD_TRAFFIC_STTS: [{ ROAD_TRAFFIC_SPD: '20' }] }),
      AREA,
    )
    expect(info.roadTraffic).toBeNull()
  })
})

describe('parseCityInfoResponse — 사고통제', () => {
  it('통제 항목을 옮긴다', () => {
    const info = parseCityInfoResponse(
      payload({
        ACDNT_CNTRL_STTS: [
          {
            ACDNT_INFO: '세종대로 사거리 2개 차로 통제',
            ACDNT_TYPE: '교통사고',
            ACDNT_DTYPE: '차대차',
            ACDNT_OCCR_DT: '2026-08-07 08:40',
            EXP_CLR_DT: '2026-08-07 10:00',
          },
        ],
      }),
      AREA,
    )
    expect(info.accidents).toEqual([
      {
        info: '세종대로 사거리 2개 차로 통제',
        type: '교통사고',
        detailType: '차대차',
        occurredAt: '2026-08-07 08:40',
        expectedClearAt: '2026-08-07 10:00',
      },
    ])
  })

  it('내용이 없는 항목은 버린다', () => {
    const info = parseCityInfoResponse(
      payload({ ACDNT_CNTRL_STTS: [{ ACDNT_TYPE: '교통사고', ACDNT_INFO: '' }] }),
      AREA,
    )
    expect(info.accidents).toEqual([])
  })

  it('섹션이 없으면 빈 배열이다', () => {
    expect(parseCityInfoResponse(payload({}), AREA).accidents).toEqual([])
  })
})
