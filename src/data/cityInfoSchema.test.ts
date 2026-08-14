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
      // 이 목업에는 FCST24HOURS가 없다. 예보가 없는 것은 정상이라 빈 배열이다.
      hourly: [],
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
        coords: null,
        capacity: 300,
        available: 42,
        liveAvailable: true,
        paid: true,
      },
      {
        name: '실시간 없음',
        coords: null,
        capacity: 120,
        available: null,
        liveAvailable: false,
        paid: false,
      },
    ])
  })

  it('좌표를 읽는다', () => {
    // 실응답(docs/fixtures/citydata-광화문덕수궁.json)에서 확인한 필드다.
    // 문자열로 오고 이름은 LAT/LNG 그대로다 — 따릉이와 다르다.
    const info = parseCityInfoResponse(
      payload({
        PRK_STTS: [{ PRK_NM: '백영북창빌딩', LAT: '37.564441', LNG: '126.977556' }],
      }),
      AREA,
    )
    expect(info.parking[0].coords).toEqual({ lat: 37.564441, lng: 126.977556 })
  })

  it('좌표가 없거나 비면 모른다고 한다', () => {
    // 실응답에도 빈 문자열로 오는 행이 있다. 좌표 없는 주차장에
    // 「지도에서 보기」를 띄우면 눌러도 아무 일이 안 일어난다.
    const info = parseCityInfoResponse(
      payload({
        PRK_STTS: [
          { PRK_NM: '빈값', LAT: '', LNG: '' },
          { PRK_NM: '없음' },
          { PRK_NM: '영점', LAT: '0', LNG: '0' },
        ],
      }),
      AREA,
    )
    expect(info.parking.map((lot) => lot.coords)).toEqual([null, null, null])
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
    expect(info.bikes).toEqual([
      { name: '광화문역 3번출구', coords: null, bikes: 7, racks: 15 },
    ])
  })

  it('X가 경도이고 Y가 위도다', () => {
    // **이 테스트가 축이 뒤집히는 것을 막는다.** 이름만 보면 X를 위도로
    // 읽기 쉬운데, 실응답은 SBIKE_X 126.977 / SBIKE_Y 37.569다
    // (docs/fixtures/citydata-광화문덕수궁.json). 뒤집으면 지도가 서울이
    // 아니라 중국 어딘가로 간다.
    //
    // 값이 문자열이 아니라 **숫자로** 오는 것도 실응답에서 확인한 사실이다.
    const info = parseCityInfoResponse(
      payload({
        SBIKE_STTS: [
          { SBIKE_SPOT_NM: '광화문역 5번출구', SBIKE_X: 126.97756958, SBIKE_Y: 37.56989288 },
        ],
      }),
      AREA,
    )

    expect(info.bikes[0].coords).toEqual({ lat: 37.56989288, lng: 126.97756958 })
  })

  it('위경도 범위를 벗어난 좌표는 버린다', () => {
    // 축이 뒤집혀 오면 위도가 126이 된다 — 지구에 없는 값이라 여기서 걸린다.
    // 조용히 통과시키면 지도가 엉뚱한 데로 날아가고 원인을 찾기 어렵다.
    const info = parseCityInfoResponse(
      payload({
        SBIKE_STTS: [{ SBIKE_SPOT_NM: '뒤집힘', SBIKE_X: 37.5, SBIKE_Y: 126.9 }],
      }),
      AREA,
    )

    expect(info.bikes[0].coords).toBeNull()
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

describe('parseCityInfoResponse — 시간대별 예보', () => {
  // 명세 200~206행: FCST24HOURS > FCST_DT·TEMP·PRECIPITATION·PRECPT_TYPE·
  // RAIN_CHANCE·SKY_STTS. WEATHER_STTS 안에 중첩된 배열이다.
  function weatherWith(hourly: unknown): unknown {
    return payload({ WEATHER_STTS: [{ TEMP: '28.4', FCST24HOURS: hourly }] })
  }

  it('예보 칸을 순서대로 읽는다', () => {
    const info = parseCityInfoResponse(
      weatherWith([
        { FCST_DT: '202608131400', TEMP: '31', RAIN_CHANCE: '0', SKY_STTS: '맑음' },
        { FCST_DT: '202608131500', TEMP: '30.5', RAIN_CHANCE: '20', SKY_STTS: '구름많음' },
      ]),
      AREA,
    )

    expect(info.weather?.hourly).toEqual([
      {
        time: '202608131400',
        temperature: 31,
        rainChance: 0,
        sky: '맑음',
        precipitationType: '',
      },
      {
        time: '202608131500',
        temperature: 30.5,
        rainChance: 20,
        sky: '구름많음',
        precipitationType: '',
      },
    ])
  })

  it('강수형태도 읽는다', () => {
    const info = parseCityInfoResponse(
      weatherWith([{ FCST_DT: '202608131400', PRECPT_TYPE: '비' }]),
      AREA,
    )
    expect(info.weather?.hourly[0].precipitationType).toBe('비')
  })

  it('예보시간이 없는 칸은 버린다', () => {
    // 시각이 이 항목의 본체다. 시각 없이 「31°」만 있는 칸은 언제의 기온인지
    // 알려주지 못하고 자리만 차지한다 — 주차장의 이름, 재난문자의 내용과 같은 규칙.
    const info = parseCityInfoResponse(
      weatherWith([
        { TEMP: '31' },
        { FCST_DT: '202608131500', TEMP: '30' },
      ]),
      AREA,
    )
    expect(info.weather?.hourly).toHaveLength(1)
    expect(info.weather?.hourly[0].time).toBe('202608131500')
  })

  it('항목이 하나면 객체로 와도 읽는다', () => {
    // 서울 API의 하위 섹션은 항목이 하나일 때 객체로 오는 사례가 있다.
    const info = parseCityInfoResponse(
      weatherWith({ FCST_DT: '202608131400', TEMP: '31' }),
      AREA,
    )
    expect(info.weather?.hourly).toHaveLength(1)
  })

  it('예보가 없으면 빈 배열이고 날씨는 그대로 남는다', () => {
    // 부가 정보 하나가 없다고 현재 기온까지 잃으면 안 된다.
    const info = parseCityInfoResponse(payload({ WEATHER_STTS: [{ TEMP: '28.4' }] }), AREA)
    expect(info.weather?.hourly).toEqual([])
    expect(info.weather?.temperature).toBe(28.4)
  })

  it('읽지 못한 숫자는 0이 아니라 null이다', () => {
    // Number('')이 0이라 「강수확률 0%」로 보이면 안 된다.
    const info = parseCityInfoResponse(
      weatherWith([{ FCST_DT: '202608131400', TEMP: '-', RAIN_CHANCE: '' }]),
      AREA,
    )
    expect(info.weather?.hourly[0].temperature).toBeNull()
    expect(info.weather?.hourly[0].rainChance).toBeNull()
  })
})

describe('parseCityInfoResponse — 지하철 실시간 도착', () => {
  // 구조는 아래 「실제 응답 구조」 블록이 잠근다. 여기는 값을 고르는 규칙만 본다.
  function withTrains(trains: readonly unknown[], stationOverrides = {}) {
    return payload({
      SUB_STTS: [
        { SUB_STN_NM: '경복궁', SUB_STN_LINE: '3', ...stationOverrides, SUB_DETAIL: trains },
      ],
    })
  }

  it('호선은 열차 쪽을 먼저 쓴다', () => {
    // 열차 쪽 SUB_LINE이 「3호선」이고 역 쪽 SUB_STN_LINE은 「3」이다.
    const info = parseCityInfoResponse(
      withTrains([{ SUB_LINE: '3호선', SUB_ARMG1: '도착' }]),
      AREA,
    )
    expect(info.subway[0].line).toBe('3호선')
  })

  it('열차 쪽 호선이 없으면 노선명을 본다', () => {
    const info = parseCityInfoResponse(
      withTrains([{ SUB_ROUTE_NM: '신분당선', SUB_ARMG1: '도착' }]),
      AREA,
    )
    expect(info.subway[0].line).toBe('신분당선')
  })

  it('방면은 종착역에 「행」을 붙여 만든다', () => {
    // SUB_DIR은 「상행」·「하행」이라 어디로 가는지를 말해주지 않는다.
    const info = parseCityInfoResponse(
      withTrains([{ SUB_DIR: '상행', SUB_TERMINAL: '대화', SUB_ARMG1: '전역 출발' }]),
      AREA,
    )
    expect(info.subway[0].direction).toBe('대화행')
  })

  it('종착역이 없으면 노선명의 앞머리를 쓴다', () => {
    const info = parseCityInfoResponse(
      withTrains([{ SUB_ROUTE_NM: '대화행 - 독립문방면', SUB_ARMG1: '도착' }]),
      AREA,
    )
    expect(info.subway[0].direction).toBe('대화행')
  })

  it('도착 메세지는 원문 그대로 둔다', () => {
    // 괄호까지 포함해 온다. 우리가 덧붙이거나 잘라내지 않는다.
    const info = parseCityInfoResponse(
      withTrains([{ SUB_ARMG1: '9분 후 (동대입구)', SUB_ARMG2: '동대입구' }]),
      AREA,
    )
    expect(info.subway[0].message).toBe('9분 후 (동대입구)')
  })

  it('역명이 없으면 그 역의 열차를 통째로 버린다', () => {
    // 어느 역인지 모르면 「4분 20초 후」는 쓸모가 없다.
    const info = parseCityInfoResponse(
      payload({
        SUB_STTS: [
          { SUB_STN_LINE: '3', SUB_DETAIL: [{ SUB_ARMG1: '도착' }] },
          { SUB_STN_NM: '시청', SUB_STN_LINE: '1', SUB_DETAIL: [{ SUB_ARMG1: '도착' }] },
        ],
      }),
      AREA,
    )
    expect(info.subway).toHaveLength(1)
    expect(info.subway[0].station).toBe('시청')
  })

  it('지하철 정보가 없으면 빈 배열이다', () => {
    expect(parseCityInfoResponse(payload({}), AREA).subway).toEqual([])
  })
})

describe('parseCityInfoResponse — 실제 응답 구조 (2026-08-13 실측)', () => {
  it('도로소통은 AVG_ROAD_DATA 안에 있다', () => {
    // 바깥 ROAD_TRAFFIC_STTS에는 AVG_ROAD_DATA와 구간 배열뿐이고 지표가 없다.
    // 바깥에서 읽으면 실데이터에서 도로소통 카드가 통째로 사라진다.
    const info = parseCityInfoResponse(
      payload({
        ROAD_TRAFFIC_STTS: {
          AVG_ROAD_DATA: {
            ROAD_MSG: '해당 장소로 이동·진입시 시간이 오래 걸릴 수 있어요.',
            ROAD_TRAFFIC_IDX: '정체',
            ROAD_TRAFFIC_SPD: 12,
            ROAD_TRAFFIC_TIME: '2026-08-13 14:00',
          },
          ROAD_TRAFFIC_STTS: [{ LINK_ID: '1', SPD: 20 }],
        },
      }),
      AREA,
    )

    expect(info.roadTraffic).toEqual({
      index: '정체',
      message: '해당 장소로 이동·진입시 시간이 오래 걸릴 수 있어요.',
      speed: 12,
      updatedAt: '2026-08-13 14:00',
    })
  })

  it('속도가 숫자로 와도 읽는다', () => {
    // 실제 응답의 ROAD_TRAFFIC_SPD는 문자열이 아니라 number다.
    const info = parseCityInfoResponse(
      payload({
        ROAD_TRAFFIC_STTS: { AVG_ROAD_DATA: { ROAD_TRAFFIC_IDX: '원활', ROAD_TRAFFIC_SPD: 34.5 } },
      }),
      AREA,
    )
    expect(info.roadTraffic?.speed).toBe(34.5)
  })

  it('지하철 열차는 SUB_DETAIL 안에 있고 역 정보는 바깥에 있다', () => {
    const info = parseCityInfoResponse(
      payload({
        SUB_STTS: [
          {
            SUB_STN_NM: '경복궁',
            SUB_STN_LINE: '3',
            SUB_DETAIL: [
              {
                SUB_LINE: '3호선',
                SUB_ROUTE_NM: '대화행 - 독립문방면',
                SUB_DIR: '상행',
                SUB_TERMINAL: '대화',
                SUB_ARVTIME: '120',
                SUB_ARMG1: '전역 출발',
                SUB_ARMG2: '안국',
              },
            ],
          },
        ],
      }),
      AREA,
    )

    expect(info.subway).toHaveLength(1)
    expect(info.subway[0]).toEqual({
      station: '경복궁',
      line: '3호선',
      direction: '대화행',
      terminal: '대화',
      message: '전역 출발',
    })
  })

  it('한 역의 열차를 모두 편다', () => {
    const info = parseCityInfoResponse(
      payload({
        SUB_STTS: [
          {
            SUB_STN_NM: '시청',
            SUB_STN_LINE: '1',
            SUB_DETAIL: [
              { SUB_LINE: '1호선', SUB_TERMINAL: '소요산', SUB_ARMG1: '3분 후' },
              { SUB_LINE: '1호선', SUB_TERMINAL: '인천', SUB_ARMG1: '5분 후' },
            ],
          },
        ],
      }),
      AREA,
    )

    expect(info.subway.map((entry) => entry.message)).toEqual(['3분 후', '5분 후'])
    expect(info.subway.every((entry) => entry.station === '시청')).toBe(true)
  })

  it('호선이 SUB_DETAIL에 없으면 역의 숫자에 「호선」을 붙인다', () => {
    // 바깥 SUB_STN_LINE은 "3"처럼 숫자만 온다. 그대로 쓰면 「경복궁 3」이 된다.
    const info = parseCityInfoResponse(
      payload({
        SUB_STTS: [
          { SUB_STN_NM: '광화문', SUB_STN_LINE: '5', SUB_DETAIL: [{ SUB_ARMG1: '도착' }] },
        ],
      }),
      AREA,
    )

    expect(info.subway[0].line).toBe('5호선')
  })

  it('열차가 없는 역은 버린다', () => {
    // 역 이름만 남으면 화면에 제목만 있고 아래가 빈 묶음이 생긴다.
    const info = parseCityInfoResponse(
      payload({
        SUB_STTS: [
          { SUB_STN_NM: '경복궁', SUB_STN_LINE: '3', SUB_DETAIL: [] },
          { SUB_STN_NM: '시청', SUB_STN_LINE: '1', SUB_DETAIL: [{ SUB_ARMG1: '도착' }] },
        ],
      }),
      AREA,
    )

    expect(info.subway).toHaveLength(1)
    expect(info.subway[0].station).toBe('시청')
  })

  it('행사는 EVENT_STTS로 온다', () => {
    // 명세는 CULTURALEVENTINFO라고 적었지만 실제 키는 EVENT_STTS다.
    const info = parseCityInfoResponse(
      payload({ EVENT_STTS: [{ EVENT_NM: '2026 청춘만발', PAY_YN: null }] }),
      AREA,
    )
    expect(info.events).toHaveLength(1)
    // PAY_YN이 null로 온다 — 유무료를 모르는 것이지 무료가 아니다.
    expect(info.events[0].free).toBeNull()
  })
})
