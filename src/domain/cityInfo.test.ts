import { describe, expect, it } from 'vitest'
import {
  airGradeTone,
  formatForecastTemperature,
  formatTemperature,
  forecastHour,
  groupSubwayArrivals,
  hasAnyCityInfo,
  parkingTone,
  sortBikesByStock,
  sortParkingByAvailable,
  type BikeStation,
  type CityInfo,
  type SubwayArrival,
  type ParkingLot,
} from './cityInfo'

function lot(name: string, available: number | null, capacity: number | null): ParkingLot {
  return { name, coords: null, available, capacity, liveAvailable: true, paid: null }
}

function station(name: string, bikes: number | null): BikeStation {
  return { name, coords: null, bikes, racks: 10 }
}

const EMPTY: CityInfo = {
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
}

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

describe('sortBikesByStock', () => {
  it('남은 자전거가 많은 순으로 내려준다', () => {
    const sorted = sortBikesByStock([station('A', 2), station('B', 7), station('C', 5)])
    expect(sorted.map((entry) => entry.name)).toEqual(['B', 'C', 'A'])
  })

  it('대수를 모르는 대여소는 0대인 곳보다도 뒤로 보낸다', () => {
    const sorted = sortBikesByStock([
      station('모름1', null),
      station('셋', 3),
      station('모름2', null),
      station('영', 0),
      station('여덟', 8),
    ])
    expect(sorted.map((entry) => entry.name)).toEqual([
      '여덟',
      '셋',
      '영',
      '모름1',
      '모름2',
    ])
  })

  it('입력 배열을 제자리에서 정렬하지 않는다', () => {
    const input = [station('A', 1), station('B', 9)]
    sortBikesByStock(input)
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
        events: [{ name: '전시', period: '', place: '', free: null, url: '' }],
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
          { info: '차로 통제', type: '', detailType: '', occurredAt: '', expectedClearAt: '' },
        ],
      }),
    ).toBe(true)
  })

  // 날씨는 객체 하나라 배열 길이로 판정할 수 없다. 따로 확인한다.
  it('날씨만 있어도 true다', () => {
    expect(
      hasAnyCityInfo({
        ...EMPTY,
        weather: {
          temperature: 23,
          maxTemperature: null,
          minTemperature: null,
          hourly: [],
          precipitationMessage: '',
          pm10: null,
          pm10Grade: '',
          pm25: null,
          pm25Grade: '',
          airGrade: '',
          airMessage: '',
          updatedAt: '',
        },
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
    const groups = groupSubwayArrivals([
      arrival('강남', '2호선', '성수행'),
      arrival('강남', '2호선', '성수행'),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].station).toBe('강남')
    expect(groups[0].line).toBe('2호선')
    expect(groups[0].arrivals).toHaveLength(2)
  })

  it('같은 역이라도 호선이 다르면 나눈다', () => {
    // 강남역에는 2호선과 신분당선이 함께 온다. 역명만으로 묶으면 서로 다른
    // 노선의 열차가 한 덩어리로 보인다(detail_page.png).
    const groups = groupSubwayArrivals([
      arrival('강남', '2호선'),
      arrival('강남', '신분당선'),
    ])

    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.line)).toEqual(['2호선', '신분당선'])
  })

  it('호선이 같아도 역이 다르면 나눈다', () => {
    const groups = groupSubwayArrivals([
      arrival('신논현', '신분당선'),
      arrival('강남', '신분당선'),
    ])

    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.station)).toEqual(['신논현', '강남'])
  })

  it('묶음의 순서는 처음 나온 차례를 따른다', () => {
    const groups = groupSubwayArrivals([
      arrival('신논현', '9호선'),
      arrival('강남', '2호선'),
      arrival('신논현', '9호선'),
    ])

    expect(groups.map((group) => group.station)).toEqual(['신논현', '강남'])
  })

  it('묶음 안의 순서도 응답 그대로 둔다', () => {
    // 도착 시각으로 다시 정렬하지 않는다 — message가 「4분 20초 후」일 수도
    // 「전역 출발」일 수도 있어 둘을 한 축에 세울 방법이 없다. detail_page.png의
    // 강남 2호선도 4분·8분·2분 순으로, 시각순이 아니라 응답순이다.
    const groups = groupSubwayArrivals([
      arrival('강남', '2호선', '성수행', '4분 20초 후'),
      arrival('강남', '2호선', '성수행', '8분 50초 후'),
      arrival('강남', '2호선', '성수행', '2분 20초 후'),
    ])

    expect(groups[0].arrivals.map((entry) => entry.message)).toEqual([
      '4분 20초 후',
      '8분 50초 후',
      '2분 20초 후',
    ])
  })

  it('입력 배열을 건드리지 않는다', () => {
    const input = [arrival('강남', '2호선'), arrival('신논현', '9호선')]
    groupSubwayArrivals(input)
    expect(input.map((entry) => entry.station)).toEqual(['강남', '신논현'])
  })

  it('빈 목록은 빈 묶음이다', () => {
    expect(groupSubwayArrivals([])).toEqual([])
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
