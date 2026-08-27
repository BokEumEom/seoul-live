import { describe, expect, it } from 'vitest'
import {
  makeAccident,
  makeBikeStation,
  makeCityInfo,
  makeCulturalEvent,
  makeParkingLot,
  makeWeather,
} from '../test/cityInfo'
import {
  airGradeTone,
  formatForecastTemperature,
  formatTemperature,
  forecastHour,
  groupSubwayArrivals,
  hasAnyCityInfo,
  isActiveWarning,
  isBusCallFailure,
  parkingAddFee,
  parkingBaseFee,
  parkingTone,
  ridershipFlow,
  roadIndexTone,
  sortParkingByAvailable,
  uvGradeTone,
  WIND_DIRECTION_LABELS,
  windDirectionLabel,
  type CityInfo,
  type SubwayArrival,
  type ParkingLot,
} from './cityInfo'
import type { SubwayFacility } from './subwayFacility'

function lot(name: string, available: number | null, capacity: number | null): ParkingLot {
  return makeParkingLot({ name, available, capacity, liveAvailable: true })
}

function station(name: string, bikes: number | null) {
  return makeBikeStation({ name, bikes, racks: 10 })
}

const EMPTY: CityInfo = makeCityInfo({
  areaName: '광화문·덕수궁',
  areaCode: 'POI009',
  freshness: null,
  weather: null,
  roadTraffic: null,
  accidents: [],
  parking: [],
  bikes: [],
  events: [],
  alerts: [],
  subway: [],
})

describe('airGradeTone', () => {
  it('통합대기환경등급 네 단계를 혼잡도와 같은 톤으로 옮긴다', () => {
    expect(airGradeTone('좋음')).toBe('calm')
    expect(airGradeTone('보통')).toBe('normal')
    expect(airGradeTone('나쁨')).toBe('busy')
    expect(airGradeTone('매우나쁨')).toBe('crowded')
  })

  it('앞뒤 공백을 무시한다', () => {
    expect(airGradeTone(' 좋음 ')).toBe('calm')
  })

  // 서울 API의 등급 문자열이 늘어나거나 빈 값이 오는 경우가 실제로 있다.
  // 임의로 'normal'로 떨어뜨리면 "보통"이라고 단정하는 셈이라 null을 준다.
  it('모르는 등급은 null이다', () => {
    expect(airGradeTone('최악')).toBeNull()
    expect(airGradeTone('')).toBeNull()
  })
})

describe('roadIndexTone', () => {
  // **`normal`이 없는 것이 이 표의 성질이다.** 도로 지표에는 중립에 해당하는
  // 값이 없다 — `서행`은 이미 「막히기 시작했다」라서 `normal`(보통)로 적으면
  // 실제보다 낫게 말하게 된다. 셋을 한꺼번에 세는 이유는 하나만 보면 표를
  // 통째로 지우고 그 하나만 남겨도 통과해서다.
  it('아는 세 값을 톤으로 옮긴다', () => {
    expect(roadIndexTone('원활')).toBe('calm')
    expect(roadIndexTone('서행')).toBe('busy')
    expect(roadIndexTone('정체')).toBe('crowded')
  })

  it('앞뒤 공백을 무시한다', () => {
    expect(roadIndexTone(' 정체 ')).toBe('crowded')
  })

  // **이 단언이 색을 붙이기로 한 근거의 전부다.** 명세에 값 목록이 없다는
  // 사실은 그대로이고(`seoul_realdata.md`), 미룰 때 걱정한 것은 「처음 보는
  // 값에 **틀린 색**이 붙는 것」이었다. `null`이면 색이 안 붙을 뿐 틀리지
  // 않는다 — 이 줄이 죽으면 그 걱정이 되살아난다.
  it('모르는 값은 null이다', () => {
    expect(roadIndexTone('일시정지')).toBeNull()
    expect(roadIndexTone('')).toBeNull()
  })
})

describe('parkingTone', () => {
  it('여유 면수 비율로 네 단계를 나눈다', () => {
    expect(parkingTone(50, 100)).toBe('calm')
    expect(parkingTone(15, 100)).toBe('normal')
    expect(parkingTone(5, 100)).toBe('busy')
    expect(parkingTone(0, 100)).toBe('crowded')
  })

  it('경계값은 넉넉한 쪽으로 붙인다', () => {
    expect(parkingTone(30, 100)).toBe('calm')
    expect(parkingTone(29, 100)).toBe('normal')
    expect(parkingTone(10, 100)).toBe('normal')
    expect(parkingTone(9, 100)).toBe('busy')
  })

  // 수용 면수가 0이면 비율 자체가 정의되지 않는다(0으로 나눔). 값이 없는 것과
  // "만차"는 다르므로 null로 구분한다 — 화면이 배지를 아예 그리지 않는다.
  it('수용 면수를 모르거나 0이면 null이다', () => {
    expect(parkingTone(0, 0)).toBeNull()
    expect(parkingTone(5, null)).toBeNull()
    expect(parkingTone(null, 100)).toBeNull()
  })

  it('여유가 수용보다 크게 와도 calm으로만 본다', () => {
    expect(parkingTone(120, 100)).toBe('calm')
  })
})

describe('sortParkingByAvailable', () => {
  it('여유 면수가 많은 순으로 내려준다', () => {
    const sorted = sortParkingByAvailable([lot('A', 3, 10), lot('B', 30, 100), lot('C', 8, 20)])
    expect(sorted.map((entry) => entry.name)).toEqual(['B', 'C', 'A'])
  })

  // 원소를 넷 이상 섞는다. 둘뿐이면 엔진이 비교 함수를 한 방향으로만 호출해서
  // "왼쪽이 null일 때"의 가지가 아예 실행되지 않는다 — 실제로 그 가지를 뒤집어도
  // 통과하는 테스트였다.
  it('여유 면수를 모르는 주차장은 값이 0인 곳보다도 뒤로 보낸다', () => {
    const sorted = sortParkingByAvailable([
      lot('모름1', null, 100),
      lot('다섯', 5, 100),
      lot('모름2', null, 100),
      lot('영', 0, 100),
      lot('아홉', 9, 100),
    ])
    expect(sorted.map((entry) => entry.name)).toEqual([
      '아홉',
      '다섯',
      '영',
      '모름1',
      '모름2',
    ])
  })

  it('limit을 주면 그만큼만 돌려준다', () => {
    const sorted = sortParkingByAvailable([lot('A', 1, 10), lot('B', 2, 10), lot('C', 3, 10)], 2)
    expect(sorted.map((entry) => entry.name)).toEqual(['C', 'B'])
  })

  it('입력 배열을 제자리에서 정렬하지 않는다', () => {
    const input = [lot('A', 1, 10), lot('B', 9, 10)]
    sortParkingByAvailable(input)
    expect(input.map((entry) => entry.name)).toEqual(['A', 'B'])
  })
})

describe('formatTemperature', () => {
  it('소수 한 자리까지 붙여 섭씨로 쓴다', () => {
    expect(formatTemperature(23)).toBe('23.0°')
    expect(formatTemperature(23.46)).toBe('23.5°')
    expect(formatTemperature(-3.21)).toBe('-3.2°')
  })

  it('값이 없으면 빗금이 아니라 물음표 없는 대시를 쓴다', () => {
    expect(formatTemperature(null)).toBe('—')
  })
})

describe('hasAnyCityInfo', () => {
  it('모든 섹션이 비어 있으면 false다', () => {
    expect(hasAnyCityInfo(EMPTY)).toBe(false)
  })

  it('섹션이 하나라도 차 있으면 true다', () => {
    expect(hasAnyCityInfo({ ...EMPTY, parking: [lot('A', 1, 10)] })).toBe(true)
    expect(hasAnyCityInfo({ ...EMPTY, bikes: [station('A', 1)] })).toBe(true)
    expect(
      hasAnyCityInfo({
        ...EMPTY,
        events: [makeCulturalEvent({ name: '전시' })],
      }),
    ).toBe(true)
    expect(
      hasAnyCityInfo({
        ...EMPTY,
        alerts: [{ category: '호우', step: '', message: '', createdAt: '' }],
      }),
    ).toBe(true)
    expect(
      hasAnyCityInfo({
        ...EMPTY,
        roadTraffic: { index: '서행', speed: null, message: '', updatedAt: '' },
      }),
    ).toBe(true)
    expect(
      hasAnyCityInfo({
        ...EMPTY,
        accidents: [
          makeAccident({ info: '차로 통제' }),
        ],
      }),
    ).toBe(true)
  })

  // 날씨는 객체 하나라 배열 길이로 판정할 수 없다. 따로 확인한다.
  it('날씨만 있어도 true다', () => {
    expect(
      hasAnyCityInfo({
        ...EMPTY,
        weather: makeWeather({ temperature: 23 }),
      }),
    ).toBe(true)
  })
})

describe('forecastHour', () => {
  // FCST_DT의 형식은 공식 명세에 없다 — 출력명(「예보시간」)만 있고 예시가
  // 없다. 그래서 아는 모양이면 시각을 뽑고, 모르는 모양이면 `null`이다.
  // 짐작으로 자르면 처음 보는 형식에서 엉뚱한 두 자리가 「14시」로 둔갑한다.
  //
  // **숫자를 돌려주지 글자를 짓지 않는다.** 예전에는 「14시」를 만들었고
  // 그래서 영어 화면에서 그 줄만 한국어로 남았다 — 도메인은 언어를 모른다.
  it('붙여 쓴 12자리에서 시각을 뽑는다', () => {
    expect(forecastHour('202608131400')).toBe(14)
  })

  it('구분자가 있는 형식에서 시각을 뽑는다', () => {
    expect(forecastHour('2026-08-13 14:00')).toBe(14)
    expect(forecastHour('2026-08-13T14:00:00')).toBe(14)
  })

  it('앞자리 0을 떼고 읽는다', () => {
    // 숫자라 앞자리 0이 있을 수 없다. 「09」를 문자열로 남기던 시절의 규칙이
    // 타입으로 옮겨온 자리다.
    expect(forecastHour('202608130900')).toBe(9)
    expect(forecastHour('2026-08-13 09:00')).toBe(9)
  })

  it('자정은 0시다', () => {
    // Number('00')이 0이라 falsy 검사로 짜면 이 칸이 조용히 원문으로 떨어진다.
    expect(forecastHour('202608130000')).toBe(0)
  })

  it('모르는 형식은 뽑지 않는다', () => {
    // 화면이 이 `null`을 보고 원문을 그대로 적는다(`HourlyWeather`).
    expect(forecastHour('예보 없음')).toBeNull()
    expect(forecastHour('')).toBeNull()
  })

  it('시각 범위를 벗어나면 뽑지 않는다', () => {
    // 25는 시각이 아니다. 뽑아서 「25시」로 적으면 없는 시각을 단정한다.
    expect(forecastHour('202608132500')).toBeNull()
    expect(forecastHour('2026-08-13 99:00')).toBeNull()
  })
})

describe('formatForecastTemperature', () => {
  it('소수점을 반올림해 없앤다', () => {
    // 카드 상단의 현재 기온은 0.1도까지 적지만(formatTemperature) 예보 칸은
    // 폭이 좁아 「31.0°」가 타일을 넘친다.
    expect(formatForecastTemperature(31.4)).toBe('31°')
    expect(formatForecastTemperature(30.6)).toBe('31°')
  })

  it('영하도 읽는다', () => {
    expect(formatForecastTemperature(-3.2)).toBe('-3°')
  })

  it('값이 없으면 현재 기온과 같은 대시를 쓴다', () => {
    expect(formatForecastTemperature(null)).toBe('—')
  })

  it('0도를 값 없음으로 뭉개지 않는다', () => {
    // falsy 검사로 짜면 0도가 대시가 된다.
    expect(formatForecastTemperature(0)).toBe('0°')
  })
})

describe('groupSubwayArrivals', () => {
  function arrival(
    station: string,
    line: string,
    direction = '',
    message = '',
  ): SubwayArrival {
    return { station, line, direction, terminal: '', message }
  }

  it('같은 역·같은 호선의 열차를 한 묶음으로 만든다', () => {
    const groups = groupSubwayArrivals(
      [arrival('강남', '2호선', '성수행'), arrival('강남', '2호선', '성수행')],
      [],
    )

    expect(groups).toHaveLength(1)
    expect(groups[0].station).toBe('강남')
    expect(groups[0].line).toBe('2호선')
    expect(groups[0].arrivals).toHaveLength(2)
  })

  it('같은 역이라도 호선이 다르면 나눈다', () => {
    // 강남역에는 2호선과 신분당선이 함께 온다. 역명만으로 묶으면 서로 다른
    // 노선의 열차가 한 덩어리로 보인다(detail_page.png).
    const groups = groupSubwayArrivals(
      [arrival('강남', '2호선'), arrival('강남', '신분당선')],
      [],
    )

    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.line)).toEqual(['2호선', '신분당선'])
  })

  it('호선이 같아도 역이 다르면 나눈다', () => {
    const groups = groupSubwayArrivals(
      [arrival('신논현', '신분당선'), arrival('강남', '신분당선')],
      [],
    )

    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.station)).toEqual(['신논현', '강남'])
  })

  it('묶음의 순서는 처음 나온 차례를 따른다', () => {
    const groups = groupSubwayArrivals(
      [
        arrival('신논현', '9호선'),
        arrival('강남', '2호선'),
        arrival('신논현', '9호선'),
      ],
      [],
    )

    expect(groups.map((group) => group.station)).toEqual(['신논현', '강남'])
  })

  it('묶음 안의 순서도 응답 그대로 둔다', () => {
    // 도착 시각으로 다시 정렬하지 않는다 — message가 「4분 20초 후」일 수도
    // 「전역 출발」일 수도 있어 둘을 한 축에 세울 방법이 없다. detail_page.png의
    // 강남 2호선도 4분·8분·2분 순으로, 시각순이 아니라 응답순이다.
    const groups = groupSubwayArrivals(
      [
        arrival('강남', '2호선', '성수행', '4분 20초 후'),
        arrival('강남', '2호선', '성수행', '8분 50초 후'),
        arrival('강남', '2호선', '성수행', '2분 20초 후'),
      ],
      [],
    )

    expect(groups[0].arrivals.map((entry) => entry.message)).toEqual([
      '4분 20초 후',
      '8분 50초 후',
      '2분 20초 후',
    ])
  })

  it('입력 배열을 건드리지 않는다', () => {
    const input = [arrival('강남', '2호선'), arrival('신논현', '9호선')]
    groupSubwayArrivals(input, [])
    expect(input.map((entry) => entry.station)).toEqual(['강남', '신논현'])
  })

  it('빈 목록은 빈 묶음이다', () => {
    expect(groupSubwayArrivals([], [])).toEqual([])
  })

  describe('승강기 잇기', () => {
    const lift: SubwayFacility = {
      kind: 'EV',
      section: 'B2-B4',
      position: '서대문 방면1-1',
      status: '사용가능',
    }

    it('역·호선이 맞는 승강기를 묶음에 얹는다', () => {
      const groups = groupSubwayArrivals(
        [arrival('광화문', '5호선')],
        [{ station: '광화문', line: '5호선', facilities: [lift] }],
      )

      expect(groups[0].facilities).toEqual([lift])
    })

    /**
     * **같은 역이라도 호선마다 갈린다.** 실호출에서 신당 6호선은 22건인데
     * 신당 2호선은 0건이었다(2026-08-27). 역명만으로 이으면 2호선 승강장에
     * 6호선의 승강기 스물둘이 붙는다.
     */
    it('역명이 같아도 호선이 다르면 안 얹는다', () => {
      const groups = groupSubwayArrivals(
        [arrival('신당', '2호선'), arrival('신당', '6호선')],
        [{ station: '신당', line: '6호선', facilities: [lift] }],
      )

      expect(groups[0].facilities).toEqual([])
      expect(groups[1].facilities).toEqual([lift])
    })

    it('승강기를 안 준 역은 빈 목록이다', () => {
      const groups = groupSubwayArrivals([arrival('강남', '2호선')], [])

      expect(groups[0].facilities).toEqual([])
    })
  })
})

describe('hasAnyCityInfo — 지하철', () => {
  // 새 섹션을 더할 때 hasAnyCityInfo도 같이 고쳐야 한다. 빠뜨리면 지하철만
  // 있는 명소가 「정보 없음」으로 뜨는데 화면에는 지하철이 그려져 있다.
  it('지하철 도착만 있어도 true다', () => {
    expect(
      hasAnyCityInfo({
        ...EMPTY,
        subway: [
          {
            station: '강남',
            line: '2호선',
            direction: '성수행',
            terminal: '',
            message: '4분 20초 후',
          },
        ],
      }),
    ).toBe(true)
  })
})

describe('uvGradeTone', () => {
  // 기상청 5단계를 네 톤에 얹는다. 다섯을 한꺼번에 세는 이유는 `roadIndexTone`과
  // 같다 — 하나만 보면 표를 통째로 지우고 그 하나만 남겨도 통과한다.
  it('다섯 단계를 톤으로 옮긴다', () => {
    expect(uvGradeTone('낮음')).toBe('calm')
    expect(uvGradeTone('보통')).toBe('normal')
    expect(uvGradeTone('높음')).toBe('busy')
    expect(uvGradeTone('매우높음')).toBe('crowded')
    expect(uvGradeTone('위험')).toBe('crowded')
  })

  it('앞뒤 공백을 무시한다', () => {
    expect(uvGradeTone(' 높음 ')).toBe('busy')
  })

  it('모르는 단계는 null이다', () => {
    expect(uvGradeTone('아주높음')).toBeNull()
    expect(uvGradeTone('')).toBeNull()
  })
})

describe('windDirectionLabel', () => {
  it('16방위 약자를 한국어 이름으로 옮긴다', () => {
    expect(windDirectionLabel('SSE')).toBe('남남동')
    expect(windDirectionLabel('N')).toBe('북')
    expect(windDirectionLabel('WNW')).toBe('서북서')
  })

  it('소문자와 공백을 받아준다', () => {
    expect(windDirectionLabel(' sse ')).toBe('남남동')
  })

  // **지어내지 않는다.** 모르는 약자에 아무 방위나 붙이면 화면이 틀린 방향을
  // 단정하는데, 그건 테스트로 못 잡는다. 원문을 그대로 쓰게 null을 준다.
  it('모르는 약자는 null이다', () => {
    expect(windDirectionLabel('SSSE')).toBeNull()
    expect(windDirectionLabel('')).toBeNull()
  })

  it('사전이 보는 목록과 표가 같다', () => {
    // `i18n.test.ts`가 이 배열로 사전 완결성을 센다. 표에서 뽑히지 않고 손으로
    // 적히면 방위가 하나 늘 때 조용히 낡는다.
    expect(WIND_DIRECTION_LABELS).toHaveLength(16)
    expect(WIND_DIRECTION_LABELS).toContain('남남동')
  })
})

describe('isActiveWarning', () => {
  const warning = {
    kind: '폭염',
    level: '주의보',
    announcedAt: '202608231100',
    command: '발표',
    cancelState: '정상',
    message: '',
  }

  it('발효 중인 특보는 유효하다', () => {
    expect(isActiveWarning(warning)).toBe(true)
  })

  it('해제·취소된 특보는 걷어낸다', () => {
    expect(isActiveWarning({ ...warning, command: '해제' })).toBe(false)
    expect(isActiveWarning({ ...warning, cancelState: '취소' })).toBe(false)
  })

  // **이 저장소의 기본과 반대 방향이라 따로 잠근다.** 다른 자리들은 아는 모양이
  // 맞을 때만 옮기고 아니면 흘려보내는데(`i18n/subway.ts`), 여기서는 모르는
  // 값을 **유효한 쪽**으로 읽는다 — 살아 있는 폭염경보를 숨기는 대가가
  // 해제된 특보를 띄우는 대가보다 훨씬 크기 때문이다.
  it('처음 보는 값은 유효한 쪽으로 읽는다', () => {
    expect(isActiveWarning({ ...warning, command: '연장' })).toBe(true)
    expect(isActiveWarning({ ...warning, cancelState: '' })).toBe(true)
    expect(isActiveWarning({ ...warning, command: '', cancelState: '대체' })).toBe(true)
  })

  it('앞뒤 공백이 붙어 와도 해제를 알아본다', () => {
    expect(isActiveWarning({ ...warning, command: ' 해제 ' })).toBe(false)
  })
})

describe('parkingBaseFee', () => {
  const fee = { baseFee: 2000, baseMinutes: 30, addFee: 1000, addMinutes: 10 }

  it('기본요금이 있으면 시간과 금액을 준다', () => {
    expect(parkingBaseFee(fee)).toEqual({ kind: 'paid', minutes: 30, won: 2000 })
  })

  // **이 갈래가 이 함수의 존재 이유다.** 실호출에 `PAY_YN: 'Y'`인데
  // `RATES: '0'`인 주차장이 셋 있었다(2026-08-25). 「30분 0원」이라고 적으면
  // 공짜 주차장으로 읽히는데, 실제로는 「30분까지 무료, 이후 과금」이다.
  it('기본요금 0원은 「그 시간 동안 무료」다', () => {
    expect(parkingBaseFee({ ...fee, baseFee: 0 })).toEqual({ kind: 'freeFor', minutes: 30 })
  })

  // 「0분에 2,000원」은 뜻이 없는 문장이다. 무료 주차장이 네 값을 전부 0으로
  // 보내는데, 단위시간을 안 보면 그것들이 「0분 무료」로 새어 나온다.
  it('단위시간이 없거나 0이면 아무 말도 안 한다', () => {
    expect(parkingBaseFee({ ...fee, baseMinutes: 0 })).toBeNull()
    expect(parkingBaseFee({ ...fee, baseMinutes: null })).toBeNull()
  })

  it('기본요금을 못 읽으면 아무 말도 안 한다', () => {
    expect(parkingBaseFee({ ...fee, baseFee: null })).toBeNull()
    expect(parkingBaseFee(null)).toBeNull()
  })
})

describe('parkingAddFee', () => {
  const fee = { baseFee: 2000, baseMinutes: 30, addFee: 1000, addMinutes: 10 }

  it('추가요금을 시간과 금액으로 준다', () => {
    expect(parkingAddFee(fee)).toEqual({ minutes: 10, won: 1000 })
  })

  // 무료 주차장이 네 값을 전부 0으로 보낸다. 「10분당 0원」은 정보가 아니다.
  it('0원이면 안 적는다', () => {
    expect(parkingAddFee({ ...fee, addFee: 0 })).toBeNull()
  })

  it('단위시간이 없거나 0이면 안 적는다', () => {
    expect(parkingAddFee({ ...fee, addMinutes: 0 })).toBeNull()
    expect(parkingAddFee({ ...fee, addMinutes: null })).toBeNull()
    expect(parkingAddFee(null)).toBeNull()
  })
})

describe('ridershipFlow', () => {
  const span = {
    boardingMin: 550,
    boardingMax: 600,
    alightingMin: 900,
    alightingMax: 950,
  }

  it('하차 구간이 승차보다 통째로 위면 모이는 중이다', () => {
    // 실호출 광화문 10분 창의 값이다(2026-08-25).
    expect(ridershipFlow(span)).toBe('arriving')
  })

  it('승차 구간이 하차보다 통째로 위면 빠지는 중이다', () => {
    expect(
      ridershipFlow({ ...span, boardingMin: 900, boardingMax: 950, alightingMin: 550, alightingMax: 600 }),
    ).toBe('leaving')
  })

  // **문턱을 지어내지 않는다.** 두 구간이 겹치면 서울 API 스스로가 우열을
  // 단정하지 못한 것이라 우리도 단정하지 않는다 — 「20% 이상 차이」 같은
  // 임의의 숫자를 만들면 그 숫자를 지킬 근거가 어디에도 없다.
  it('구간이 겹치면 아무 말도 안 한다', () => {
    expect(
      ridershipFlow({ boardingMin: 550, boardingMax: 600, alightingMin: 580, alightingMax: 640 }),
    ).toBeNull()
  })

  it('맞닿기만 해도 단정하지 않는다', () => {
    // 승차 최대 600, 하차 최소 600. 실제 값이 둘 다 600일 수 있다.
    expect(
      ridershipFlow({ boardingMin: 550, boardingMax: 600, alightingMin: 600, alightingMax: 650 }),
    ).toBeNull()
  })

  it('네 값 중 하나라도 없으면 아무 말도 안 한다', () => {
    expect(ridershipFlow({ ...span, boardingMin: null })).toBeNull()
    expect(ridershipFlow({ ...span, alightingMax: null })).toBeNull()
  })
})

describe('isBusCallFailure', () => {
  it('아는 성공 문구는 실패가 아니다', () => {
    expect(isBusCallFailure('정상 호출되었습니다.')).toBe(false)
    expect(isBusCallFailure('  정상 호출되었습니다.  ')).toBe(false)
  })

  // **빈 메시지는 실패가 아니다.** 섹션 자체가 안 온 것이고, 그때 화면은 절을
  // 아예 안 그린다 — 여기서 true를 주면 빈 안내가 뜬다.
  it('빈 메시지는 실패가 아니다', () => {
    expect(isBusCallFailure('')).toBe(false)
    expect(isBusCallFailure('   ')).toBe(false)
  })

  it('모르는 문구는 실패로 읽는다', () => {
    expect(isBusCallFailure('서비스 점검 중입니다.')).toBe(true)
  })
})
