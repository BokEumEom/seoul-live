import type {
  CityInfo,
  ParkingLot,
  Ridership,
  RidershipWindow,
  Weather,
} from '../domain/cityInfo'

// 테스트가 쓰는 `CityInfo` 조각 빌더.
//
// **왜 빌더인가.** `Weather`에 필드 열한 개를 더했더니(2026-08-25, 습도·풍향·
// 풍속·일출·일몰·자외선 셋·통합대기지수 둘·기상특보) 서로 상관없는 테스트
// 파일 셋이 한꺼번에 컴파일이 막혔다. `seoul_realdata.md`의 미구현 158개를
// 붙이는 동안 이 일이 단계마다 되풀이된다.
//
// **기본값은 「없음」이다.** 0이나 빈 문자열이 아니라 `null`·`''`·`[]`로 둔다 —
// 서울 API가 실제로 그렇게 주고, 테스트가 **자기가 보려는 필드만** 채우면
// 나머지가 화면에서 사라지는지도 함께 확인된다.
//
// 여기에 「그럴듯한」 기본값을 넣지 마라. 기온 20도 같은 것을 채우면 온도를
// 안 채운 테스트가 온도 칸을 조용히 통과시킨다.

export function makeWeather(overrides: Partial<Weather> = {}): Weather {
  return {
    temperature: null,
    maxTemperature: null,
    minTemperature: null,
    humidity: null,
    windDirection: '',
    windSpeed: null,
    sunrise: '',
    sunset: '',
    uvIndex: null,
    uvGrade: '',
    uvMessage: '',
    hourly: [],
    precipitationMessage: '',
    pm10: null,
    pm10Grade: '',
    pm25: null,
    pm25Grade: '',
    airGrade: '',
    airIndexValue: null,
    airIndexMain: '',
    airMessage: '',
    warnings: [],
    updatedAt: '',
    ...overrides,
  }
}

export function makeParkingLot(overrides: Partial<ParkingLot> = {}): ParkingLot {
  return {
    name: '',
    code: '',
    address: '',
    coords: null,
    capacity: null,
    available: null,
    liveAvailable: false,
    liveCountAt: '',
    paid: null,
    fee: null,
    ...overrides,
  }
}

export function makeCityInfo(overrides: Partial<CityInfo> = {}): CityInfo {
  return {
    areaName: '',
    areaCode: '',
    freshness: null,
    weather: null,
    roadTraffic: null,
    accidents: [],
    parking: [],
    bikes: [],
    events: [],
    alerts: [],
    subway: [],
    subwayRidership: null,
    busStops: [],
    busRidership: null,
    busResultMessage: '',
    commerce: null,
    ...overrides,
  }
}

/** 승하차 한 시간창. 기본은 「하나도 못 읽음」이다. */
export function makeRidershipWindow(
  overrides: Partial<RidershipWindow> = {},
): RidershipWindow {
  return {
    boardingMin: null,
    boardingMax: null,
    alightingMin: null,
    alightingMax: null,
    ...overrides,
  }
}

export function makeRidership(overrides: Partial<Ridership> = {}): Ridership {
  return {
    total: makeRidershipWindow(),
    last30Minutes: makeRidershipWindow(),
    last10Minutes: makeRidershipWindow(),
    last5Minutes: makeRidershipWindow(),
    stopCount: null,
    stopCountAt: '',
    ...overrides,
  }
}
