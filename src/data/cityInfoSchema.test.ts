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
    // **빌더가 아니라 리터럴을 그대로 둔다.** `makeWeather()`로 채우면 이 단언이
    // 「파서와 빌더가 같은 기본값을 쓴다」가 되어, 파서가 필드를 통째로 빠뜨려도
    // 통과한다. 여기는 **파서가 무엇을 만드는지**를 재는 자리다.
    //
    // 이 목업에는 FCST24HOURS·NEWS_LIST와 확장 필드가 없다. 없는 것이 정상이고,
    // 그때 무엇이 되는지(`null`·`''`·`[]`)를 함께 잠근다.
    expect(info.weather).toEqual({
      temperature: 28.4,
      maxTemperature: 31,
      minTemperature: 24.2,
      humidity: null,
      windDirection: '',
      windSpeed: null,
      sunrise: '',
      sunset: '',
      uvIndex: null,
      uvGrade: '',
      uvMessage: '',
      hourly: [],
      precipitationMessage: '비 소식은 없어요.',
      pm10: 35,
      pm10Grade: '보통',
      pm25: 18,
      pm25Grade: '좋음',
      airGrade: '보통',
      airIndexValue: null,
      airIndexMain: '',
      airMessage: '외출 시 특별한 주의가 필요하지 않아요.',
      warnings: [],
      precipitation: null,
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

describe('parseCityInfoResponse — 상권', () => {
  // **섹션이 왔는데 값이 없으면 `null`이다.** 빈 껍데기를 돌려주면 상권 탭이
  // `!== null`로 판정해 제목만 있는 빈 화면을 그린다 — 2026-08-25 변이
  // 실험에서 이 갈래를 지워도 통과했다.
  it('값이 하나도 없는 섹션은 null이다', () => {
    const info = parseCityInfoResponse(
      payload({ LIVE_CMRCL_STTS: { AREA_CMRCL_LVL: '', CMRCL_TIME: '20260825 1120' } }),
      AREA,
    )

    expect(info.commerce).toBeNull()
  })

  it('섹션이 아예 없으면 null이다', () => {
    // 실호출에서 여의도한강공원이 이 상태였다(2026-08-25).
    expect(parseCityInfoResponse(payload({}), AREA).commerce).toBeNull()
  })

  it('값이 하나라도 있으면 읽는다', () => {
    const info = parseCityInfoResponse(
      payload({ LIVE_CMRCL_STTS: { AREA_CMRCL_LVL: '바쁜' } }),
      AREA,
    )

    expect(info.commerce?.level).toBe('바쁜')
    expect(info.commerce?.ageRates).toEqual([0, 0, 0, 0, 0, 0])
  })
})

describe('parseCityInfoResponse — 승하차 인원', () => {
  // **섹션이 없으면 `null`이지 빈 껍데기가 아니다.** 값이 하나도 없는 객체를
  // 돌려주면 화면이 「승하차 정보 있음」으로 읽어 빈 절을 그린다 — 교통 탭의
  // `has`가 `!== null`로 판정하기 때문이다.
  //
  // 2026-08-25 변이 실험에서 이 갈래를 지워도 스위트가 통과했다.
  it('섹션이 없으면 null이다', () => {
    const info = parseCityInfoResponse(payload({}), AREA)

    expect(info.subwayRidership).toBeNull()
    expect(info.busRidership).toBeNull()
  })

  it('값이 하나도 없는 섹션이 와도 null이다', () => {
    const info = parseCityInfoResponse(
      payload({ LIVE_SUB_PPLTN: { SUB_ACML_GTON_PPLTN_MIN: '' } }),
      AREA,
    )

    expect(info.subwayRidership).toBeNull()
  })

  it('개수만 와도 섹션으로 친다', () => {
    // 승하차를 못 셌어도 「이 명소 안 역 4곳」은 그 자체로 답이다.
    const info = parseCityInfoResponse(payload({ LIVE_SUB_PPLTN: { SUB_STN_CNT: '4' } }), AREA)

    expect(info.subwayRidership?.stopCount).toBe(4)
  })

  // **조립해 읽는 키 서른여섯 개가 제자리에 담긴다.**
  //
  // 파서가 `` `${prefix}_${span}_GTON_PPLTN_MIN` ``으로 이름을 짜기 때문에
  // 전체 이름이 소스에 한 번도 안 나온다. 그래서
  // `scripts/format-citydata-spec.mjs`의 구현 집계기가 이 서른여섯을 못 세고,
  // 스크립트는 목록을 손으로 들고 있다 — **그 목록이 낡지 않게 지키는 것이
  // 이 테스트다.** 여기가 죽으면 저 목록도 거짓이 된 것이다.
  //
  // 값을 전부 다르게 넣는 것이 요점이다. 같은 값을 쓰면 열여섯 칸이 서로
  // 뒤바뀌어도 통과한다.
  it('조립해 읽는 키 서른여섯 개가 제자리에 담긴다', () => {
    const SPANS = {
      total: 'ACML',
      last30Minutes: '30WTHN',
      last10Minutes: '10WTHN',
      last5Minutes: '5WTHN',
    } as const
    const SIDES = { boarding: 'GTON', alighting: 'GTOFF' } as const
    const BOUNDS = { Min: 'MIN', Max: 'MAX' } as const

    let next = 1
    const expected = new Map<string, number>()
    const row: Record<string, string> = {}
    for (const span of Object.values(SPANS)) {
      for (const side of Object.values(SIDES)) {
        for (const bound of Object.values(BOUNDS)) {
          const key = `SUB_${span}_${side}_PPLTN_${bound}`
          row[key] = String(next)
          expected.set(key, next)
          next += 1
        }
      }
    }
    row.SUB_STN_CNT = '99'
    row.SUB_STN_TIME = '20260825'

    const info = parseCityInfoResponse(payload({ LIVE_SUB_PPLTN: row }), AREA)
    const ridership = info.subwayRidership

    for (const [field, span] of Object.entries(SPANS)) {
      for (const [prop, side] of Object.entries(SIDES)) {
        for (const [suffix, bound] of Object.entries(BOUNDS)) {
          const key = `SUB_${span}_${side}_PPLTN_${bound}`
          const window = ridership?.[field as keyof typeof SPANS]
          expect(window?.[`${prop}${suffix}` as 'boardingMin']).toBe(expected.get(key))
        }
      }
    }
    expect(ridership?.stopCount).toBe(99)
    expect(ridership?.stopCountAt).toBe('20260825')
  })

  // 접두어만 다른 두 섹션을 같은 코드가 읽는다. 접두어를 잘못 넘기면 한쪽이
  // 통째로 빈다 — 여기서 서로의 값을 안 훔치는지 본다.
  it('지하철과 버스가 서로의 값을 안 읽는다', () => {
    const info = parseCityInfoResponse(
      payload({
        LIVE_SUB_PPLTN: { SUB_10WTHN_GTON_PPLTN_MIN: '550' },
        LIVE_BUS_PPLTN: { BUS_10WTHN_GTON_PPLTN_MIN: '150' },
      }),
      AREA,
    )

    expect(info.subwayRidership?.last10Minutes.boardingMin).toBe(550)
    expect(info.busRidership?.last10Minutes.boardingMin).toBe(150)
  })
})

describe('parseCityInfoResponse — 주차장', () => {
  // **도로명이 있으면 도로명이다.** 실호출 33곳 중 도로명이 있는 곳은 하나뿐이라
  // 픽스처만으로는 이 우선순위가 한 번도 안 밟힌다 — 지번만 읽게 바꿔도 통과했다
  // (2026-08-25 변이 실험). 그래서 둘 다 있는 행을 여기서 따로 만든다.
  it('도로명주소가 있으면 지번보다 먼저 쓴다', () => {
    const info = parseCityInfoResponse(
      payload({
        PRK_STTS: [
          { PRK_NM: '둘 다', ROAD_ADDR: '중구 청계천로 14', ADDRESS: '중구 북창동 18-9' },
          { PRK_NM: '지번만', ROAD_ADDR: '', ADDRESS: '중구 북창동 35-0' },
        ],
      }),
      AREA,
    )
    expect(info.parking.map((lot) => lot.address)).toEqual([
      '중구 청계천로 14',
      '중구 북창동 35-0',
    ])
  })

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
    // **리터럴을 그대로 둔다.** `makeParkingLot()`으로 채우면 이 단언이 「파서와
    // 빌더가 같은 기본값을 쓴다」가 되어 파서가 필드를 통째로 빠뜨려도 통과한다.
    // 요금·주소·코드가 없는 응답에서 무엇이 되는지도 여기서 함께 잠근다.
    expect(info.parking).toEqual([
      {
        name: '세종로 공영주차장',
        code: '',
        address: '',
        coords: null,
        capacity: 300,
        available: 42,
        liveAvailable: true,
        liveCountAt: '',
        paid: true,
        fee: null,
      },
      {
        name: '실시간 없음',
        code: '',
        address: '',
        coords: null,
        capacity: 120,
        available: null,
        liveAvailable: false,
        liveCountAt: '',
        paid: false,
        fee: null,
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
        SBIKE_STTS: [
          {
            SBIKE_SPOT_NM: '광화문역 3번출구',
            SBIKE_SPOT_ID: 'ST-126',
            SBIKE_PARKING_CNT: '7',
            SBIKE_RACK_CNT: '15',
            SBIKE_SHARED: '47',
          },
        ],
      }),
      AREA,
    )
    expect(info.bikes).toEqual([
      {
        name: '광화문역 3번출구',
        id: 'ST-126',
        coords: null,
        bikes: 7,
        racks: 15,
        dockRate: 47,
      },
    ])
  })

  // **거치율은 100을 넘는다** — 실호출 227곳 중 61곳이 그랬고 최댓값이 450이었다.
  // 백분율이라고 100에서 자르면 「반납 자리 없음」 판정이 통째로 사라진다.
  it('거치율이 100을 넘어도 그대로 읽는다', () => {
    const info = parseCityInfoResponse(
      payload({
        SBIKE_STTS: [
          { SBIKE_SPOT_NM: '가득 찬 대여소', SBIKE_SHARED: '450', SBIKE_RACK_CNT: '2' },
        ],
      }),
      AREA,
    )
    expect(info.bikes[0].dockRate).toBe(450)
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
        coords: null,
        thumbnail: '',
      },
    ])
  })

  // 명세의 출력명은 CULTURALEVENTINFO인데 **응답 JSON의 키는 EVENT_STTS다** —
  // 2026-08-25 실호출 35곳 전부 후자였고 `CULTURALEVENTINFO`는 한 번도 안 왔다.
  // 그래도 둘 다 받는 채로 둔다: 명세가 그 이름을 적고 있으니 언젠가 바뀔 수 있고,
  // 후보를 하나 더 두는 값이 목록 하나 도는 것뿐이다.
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

  // **그대로 `<img src>`에 들어간다.** `URL`과 같은 가드를 통과시키는 이유가
  // 둘이다: `javascript:`가 걸러지는 것, 그리고 상대 경로가 오면 우리 도메인의
  // 엉뚱한 자리를 가리키게 되는 것도 여기서 막힌다.
  it('http가 아닌 그림 주소는 버린다', () => {
    for (const bad of ['javascript:alert(1)', '/cmmn/file/1', 'data:image/png;base64,AAA']) {
      const info = parseCityInfoResponse(
        payload({ CULTURALEVENTINFO: [{ ...event, THUMBNAIL: bad }] }),
        AREA,
      )
      expect(info.events[0].thumbnail).toBe('')
    }
  })

  it('https 그림 주소는 그대로 읽는다', () => {
    const info = parseCityInfoResponse(
      payload({
        CULTURALEVENTINFO: [
          { ...event, THUMBNAIL: 'https://culture.seoul.go.kr/cmmn/file/1' },
        ],
      }),
      AREA,
    )
    expect(info.events[0].thumbnail).toBe('https://culture.seoul.go.kr/cmmn/file/1')
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

describe('parseCityInfoResponse — 도로 구간', () => {
  const SEGMENT = {
    LINK_ID: '1220019401',
    ROAD_NM: '역삼로',
    START_ND_NM: '역삼동 858-14',
    END_ND_NM: '역삼초등학교',
    START_ND_XY: '127.0309432021188627_37.4933967723260864',
    END_ND_XY: '127.0316663031210709_37.4936126134126368',
    DIST: '68.0',
    SPD: 9,
    IDX: '정체',
    XYLIST:
      '127.0316663031210709_37.4936126134126368|127.0309432021188627_37.4933967723260864',
  }

  function withSegments(segments: readonly unknown[]): unknown {
    return payload({
      ROAD_TRAFFIC_STTS: {
        AVG_ROAD_DATA: { ROAD_TRAFFIC_IDX: '정체', ROAD_MSG: '오래 걸려요.' },
        ROAD_TRAFFIC_STTS: segments,
      },
    })
  }

  it('구간 필드를 옮긴다', () => {
    const info = parseCityInfoResponse(withSegments([SEGMENT]), AREA)

    expect(info.roadSegments).toEqual([
      {
        linkId: '1220019401',
        roadName: '역삼로',
        startName: '역삼동 858-14',
        endName: '역삼초등학교',
        meters: 68,
        speed: 9,
        index: '정체',
        path: [
          { lat: 37.4936126134126368, lng: 127.0316663031210709 },
          { lat: 37.4933967723260864, lng: 127.0309432021188627 },
        ],
        startCoords: { lat: 37.4933967723260864, lng: 127.0309432021188627 },
        endCoords: { lat: 37.4936126134126368, lng: 127.0316663031210709 },
      },
    ])
  })

  // **껍데기와 이름이 같다.** 바깥 `ROAD_TRAFFIC_STTS` 안에 같은 이름의 배열이
  // 또 있다. 한 겹 못 들어가면 구간이 통째로 안 잡히는데, 요약은
  // `AVG_ROAD_DATA`에서 멀쩡히 나오므로 **화면은 정상으로 보인다.**
  it('요약과 구간을 한 응답에서 함께 읽는다', () => {
    const info = parseCityInfoResponse(withSegments([SEGMENT]), AREA)

    expect(info.roadTraffic?.index).toBe('정체')
    expect(info.roadSegments).toHaveLength(1)
  })

  it('구간이 없어도 요약은 살아 있다', () => {
    const info = parseCityInfoResponse(withSegments([]), AREA)

    expect(info.roadTraffic?.index).toBe('정체')
    expect(info.roadSegments).toEqual([])
  })

  // `LINK_ID`가 이 항목의 본체다 — 없으면 어느 구간인지 말할 수 없고 목록의
  // 키도 없다. 주차장의 이름, 재난문자의 내용과 같은 규칙이다.
  it('LINK_ID가 없는 행은 버린다', () => {
    const info = parseCityInfoResponse(
      withSegments([{ ...SEGMENT, LINK_ID: '' }, SEGMENT]),
      AREA,
    )

    expect(info.roadSegments.map((entry) => entry.linkId)).toEqual(['1220019401'])
  })

  // **밑줄 앞이 경도다.** 키 이름이 아예 없어서 순서가 유일한 단서다 —
  // 뒤집으면 위도 127이 되고 `coordsOrNull`의 가드가 통째로 버린다.
  it('좌표는 밑줄 앞이 경도다', () => {
    const info = parseCityInfoResponse(withSegments([SEGMENT]), AREA)
    const [segment] = info.roadSegments

    expect(segment.startCoords?.lat).toBeGreaterThan(37)
    expect(segment.startCoords?.lat).toBeLessThan(38)
    expect(segment.startCoords?.lng).toBeGreaterThan(126)
    expect(segment.startCoords?.lng).toBeLessThan(128)
  })

  it('좌표 모양이 아니면 null이다', () => {
    const info = parseCityInfoResponse(
      withSegments([{ ...SEGMENT, START_ND_XY: '127.03,37.49', END_ND_XY: '' }]),
      AREA,
    )

    expect(info.roadSegments[0].startCoords).toBeNull()
    expect(info.roadSegments[0].endCoords).toBeNull()
  })

  // 한 점이 깨졌다고 선을 통째로 잃을 이유가 없다.
  it('보간점 하나가 깨져도 나머지를 남긴다', () => {
    const info = parseCityInfoResponse(
      withSegments([{ ...SEGMENT, XYLIST: '127.03_37.49|엉망|127.04_37.50' }]),
      AREA,
    )

    expect(info.roadSegments[0].path).toEqual([
      { lat: 37.49, lng: 127.03 },
      { lat: 37.5, lng: 127.04 },
    ])
  })

  // **`DIST`는 문자열이고 `SPD`는 숫자다.** 같은 행에서 형이 갈린다 —
  // 실호출 1,893건 전부 그랬다.
  it('문자열 거리와 숫자 속도를 둘 다 읽는다', () => {
    const info = parseCityInfoResponse(withSegments([SEGMENT]), AREA)

    expect(info.roadSegments[0].meters).toBe(68)
    expect(info.roadSegments[0].speed).toBe(9)
  })
})

describe('parseCityInfoResponse — 사고통제', () => {
  it('통제 항목을 옮긴다', () => {
    const info = parseCityInfoResponse(
      payload({
        ACDNT_CNTRL_STTS: [
          {
            ACDNT_INFO: '세종대로 사거리 2개 차로 통제',
            // **명세에 없는 필드다** — 2026-08-25 실호출에서 확인했다.
            ACDNT_ENG_INFO: 'Two lanes closed at Sejong-daero intersection',
            ACDNT_TYPE: '교통사고',
            ACDNT_DTYPE: '차대차',
            ACDNT_OCCR_DT: '2026-08-07 08:40',
            EXP_CLR_DT: '2026-08-07 10:00',
            ACDNT_X: 126.9769,
            ACDNT_Y: 37.5715,
            ACDNT_TIME: '2026-08-07 08:45',
          },
        ],
      }),
      AREA,
    )
    expect(info.accidents).toEqual([
      {
        info: '세종대로 사거리 2개 차로 통제',
        infoEn: 'Two lanes closed at Sejong-daero intersection',
        type: '교통사고',
        detailType: '차대차',
        occurredAt: '2026-08-07 08:40',
        expectedClearAt: '2026-08-07 10:00',
        coords: { lat: 37.5715, lng: 126.9769 },
      },
    ])
    // 갱신 시각은 건이 아니라 절의 값이다 — 첫 행에서 읽는다.
    expect(info.accidentsUpdatedAt).toBe('2026-08-07 08:45')
  })

  // **X가 경도이고 Y가 위도다.** 따릉이에서 이미 한 번 뒤집힌 자리라 절마다
  // 잠근다 — 뒤집으면 위도 126이 되고 `coordsOrNull`이 통째로 버린다.
  it('축을 뒤집어 읽지 않는다', () => {
    const info = parseCityInfoResponse(
      payload({
        ACDNT_CNTRL_STTS: [{ ACDNT_INFO: '통제', ACDNT_X: 126.98, ACDNT_Y: 37.56 }],
      }),
      AREA,
    )
    expect(info.accidents[0].coords).toEqual({ lat: 37.56, lng: 126.98 })
  })

  it('통제가 없으면 갱신 시각도 비어 있다', () => {
    const info = parseCityInfoResponse(payload({}), AREA)
    expect(info.accidentsUpdatedAt).toBe('')
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
        precipitation: null,
      },
      {
        time: '202608131500',
        temperature: 30.5,
        rainChance: 20,
        sky: '구름많음',
        precipitationType: '',
        precipitation: null,
      },
    ])
  })

  // **같은 이름이 날씨(명세 176)와 예보(203) 양쪽에 있다.** 컨테이너를 안 타고
  // 평평하게 훑으면 바깥 날씨의 값이 스물넉 칸에 전부 복사된다 — 이 저장소가
  // 도로소통·지하철에서 이미 밟은 함정이라 절마다 잠근다.
  it('강수량은 예보 칸의 것을 읽는다', () => {
    const info = parseCityInfoResponse(
      payload({
        WEATHER_STTS: [
          {
            TEMP: '28.4',
            // 바깥은 안 온다(실호출 35곳 전부 이 값이었다).
            PRECIPITATION: '-',
            FCST24HOURS: [
              { FCST_DT: '202608131400', PRECIPITATION: '2.0' },
              { FCST_DT: '202608131500', PRECIPITATION: '-' },
            ],
          },
        ],
      }),
      AREA,
    )
    expect(info.weather?.precipitation).toBeNull()
    expect(info.weather?.hourly.map((entry) => entry.precipitation)).toEqual([2, null])
  })

  // 비 오는 날의 바깥 값이다. **표본에서 한 번도 못 봤다** — 2026-08-25 실호출
  // 35곳 전부 `-`였다. 형식은 예보 쪽에서 확인한 mm 단위 소수를 따른다.
  it('지금 내리는 강수량도 읽는다', () => {
    const info = parseCityInfoResponse(
      payload({ WEATHER_STTS: [{ TEMP: '19.2', PRECIPITATION: '2.5' }] }),
      AREA,
    )
    expect(info.weather?.precipitation).toBe(2.5)
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

  /**
   * **호선은 역이 말한 것을 쓴다**(2026-08-27에 뒤집었다).
   *
   * 예전에는 열차의 `SUB_LINE`이 먼저였고, 그 자리에 「무엇이 채워지는지 모른다,
   * 실호출로 확인하라」는 주석이 달려 있었다. 34역을 실제로 찍어 보니 **샛강
   * (신림선)의 열차 셋이 전부 `SUB_LINE: '4호선'`으로 온다** — 종착역이
   * 관악산이라 신림선이 맞다. 열차를 믿으면 그 역이 4호선 하늘색 배지를 단다.
   */
  it('역과 열차의 호선이 다르면 역을 믿는다', () => {
    const info = parseCityInfoResponse(
      withTrains([{ SUB_LINE: '4호선', SUB_TERMINAL: '관악산', SUB_ARMG1: '샛강 출발' }], {
        SUB_STN_NM: '샛강',
        SUB_STN_LINE: '신림선',
      }),
      AREA,
    )
    expect(info.subway[0].line).toBe('신림선')
  })

  it('역의 호선이 숫자면 「호선」을 붙인다', () => {
    // 바깥 SUB_STN_LINE은 「3」처럼 숫자만 온다. 그대로 쓰면 「경복궁 3」이 된다.
    const info = parseCityInfoResponse(
      withTrains([{ SUB_LINE: '3호선', SUB_ARMG1: '도착' }]),
      AREA,
    )
    expect(info.subway[0].line).toBe('3호선')
  })

  // 숫자일 때만 붙인다. 무턱대고 붙이면 「경의중앙호선」이라는 없는 노선이 생긴다.
  it('역의 호선이 이름이면 그대로 쓴다', () => {
    const info = parseCityInfoResponse(
      withTrains([{ SUB_ARMG1: '도착' }], {
        SUB_STN_NM: '홍대입구',
        SUB_STN_LINE: '경의중앙',
      }),
      AREA,
    )
    expect(info.subway[0].line).toBe('경의중앙')
  })

  it('역이 호선을 안 주면 열차 쪽을 쓴다', () => {
    const info = parseCityInfoResponse(
      withTrains([{ SUB_LINE: '3호선', SUB_ARMG1: '도착' }], { SUB_STN_LINE: '' }),
      AREA,
    )
    expect(info.subway[0].line).toBe('3호선')
  })

  /**
   * **`SUB_ROUTE_NM`은 호선 후보가 아니다.** 명세의 이름이 「지하철노선명」이라
   * 예전에는 후보 셋 중 하나로 뒀는데, 실호출 값은 「샛강행 - 샛강방면」처럼
   * 행선지와 방면이다. 후보로 두면 호선 자리에 행선지가 들어앉는다.
   */
  it('노선명을 호선으로 쓰지 않는다', () => {
    const info = parseCityInfoResponse(
      withTrains([{ SUB_ROUTE_NM: '샛강행 - 샛강방면', SUB_ARMG1: '도착' }], {
        SUB_STN_LINE: '',
      }),
      AREA,
    )
    expect(info.subway[0].line).toBe('')
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

  describe('승강기(SUB_FACIINFO)', () => {
    const ELEVATOR = {
      ELVTR_NM: '승강기)엘리베이터-광화문 내부2',
      OPR_SEC: 'B2-B4',
      INSTL_PSTN: '서대문 방면1-1',
      USE_YN: '사용가능',
      ELVTR_SE: 'EV',
    }

    it('역별로 읽는다', () => {
      const info = parseCityInfoResponse(
        withTrains([{ SUB_ARMG1: '도착' }], { SUB_FACIINFO: [ELEVATOR] }),
        AREA,
      )

      expect(info.subwayFacilities).toEqual([
        {
          station: '경복궁',
          line: '3호선',
          facilities: [
            { kind: 'EV', section: 'B2-B4', position: '서대문 방면1-1', status: '사용가능' },
          ],
        },
      ])
    })

    /**
     * **명세가 키 이름을 틀렸다.** 출력명 표(80행)는 `SUB_FACINFO`인데 실응답은
     * `SUB_FACIINFO`(I가 하나 더)다. 문화행사가 `CULTURALEVENTINFO`가 아니라
     * `EVENT_STTS`로 왔을 때와 같은 자리라, 같은 처방으로 둘 다 받는다.
     */
    it('명세의 이름으로 와도 읽는다', () => {
      const info = parseCityInfoResponse(
        withTrains([{ SUB_ARMG1: '도착' }], { SUB_FACINFO: [ELEVATOR] }),
        AREA,
      )

      expect(info.subwayFacilities[0].facilities).toHaveLength(1)
    })

    it('처음 보는 갈래 코드는 비운다', () => {
      const info = parseCityInfoResponse(
        withTrains([{ SUB_ARMG1: '도착' }], {
          SUB_FACIINFO: [{ ...ELEVATOR, ELVTR_SE: 'XX' }],
        }),
        AREA,
      )

      expect(info.subwayFacilities[0].facilities[0].kind).toBeNull()
    })

    it('처음 보는 상태는 비운다', () => {
      const info = parseCityInfoResponse(
        withTrains([{ SUB_ARMG1: '도착' }], {
          SUB_FACIINFO: [{ ...ELEVATOR, USE_YN: '점검예정' }],
        }),
        AREA,
      )

      expect(info.subwayFacilities[0].facilities[0].status).toBeNull()
    })

    // 실호출 44역 중 31역이 이 배열을 안 준다. 빈 자리를 남기면 「승강기가 없는
    // 역」 31개가 목록에 생기는데, 없는 게 아니라 안 주는 것이다.
    it('승강기가 없는 역은 자리를 안 만든다', () => {
      const info = parseCityInfoResponse(
        withTrains([{ SUB_ARMG1: '도착' }], { SUB_FACIINFO: [] }),
        AREA,
      )

      expect(info.subwayFacilities).toEqual([])
    })

    /**
     * **호선 키가 도착 목록의 것과 같아야 한다.** 화면이 이 둘을 역·호선으로
     * 이어 붙이는데, 한쪽만 「호선」을 붙이거나 한쪽만 열차를 보면 승강기가
     * 영영 안 그려진다. 잇는 자리가 아니라 만드는 자리에서 잠근다.
     */
    it('호선 키가 도착 목록의 것과 같다', () => {
      const info = parseCityInfoResponse(
        withTrains([{ SUB_LINE: '4호선', SUB_ARMG1: '도착' }], {
          SUB_STN_NM: '샛강',
          SUB_STN_LINE: '신림선',
          SUB_FACIINFO: [ELEVATOR],
        }),
        AREA,
      )

      expect(info.subwayFacilities[0].line).toBe(info.subway[0].line)
      expect(info.subwayFacilities[0].station).toBe(info.subway[0].station)
    })
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

  it('역의 숫자에 「호선」을 붙인다', () => {
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
