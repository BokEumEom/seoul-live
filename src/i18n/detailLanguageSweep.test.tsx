import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UseQueryResult } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AreaDetailScreen } from '../components/detail/AreaDetailScreen'
import type { CityInfo } from '../domain/cityInfo'
import { DETAIL_TABS } from '../domain/detailTabs'
import type { AreaCongestion, AreaSnapshot } from '../domain/types'
import { reset as resetFavorites } from '../hooks/favoritesStore'
import { reset as resetLanguage, setLanguage } from '../hooks/languageStore'
import {
  makeAccident,
  makeBikeStation,
  makeCityInfo,
  makeCulturalEvent,
  makeHourlyForecast,
  makeParkingLot,
  makeWeather,
} from '../test/cityInfo'

// **왜 별도 파일인가.** 상세 화면을 세우려면 조회 훅 넷과 저장소 둘을 목업해야
// 하는데, `vi.mock`은 파일 단위라 `languageSwitch.test.tsx`에 넣으면 거기서
// 잎 컴포넌트만 그리는 검사들까지 그 목업을 뒤집어쓴다.

vi.mock('../data/queries', () => ({
  useAreaSnapshot: vi.fn(),
  useAreaCongestion: vi.fn(),
  useCityInfo: vi.fn(),
  useCctv: vi.fn(() => ({ data: [], isPending: false, isError: false })),
}))
vi.mock('../app/locationContext', () => ({ useLocation: vi.fn() }))
vi.mock('../platform/weekPattern', () => ({
  loadPattern: vi.fn().mockResolvedValue({ pattern: {}, lastObservedAt: null }),
  savePattern: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../platform/links', () => ({
  shareMessage: vi.fn().mockResolvedValue(undefined),
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
}))

const queries = await import('../data/queries')
const locationContext = await import('../app/locationContext')
const useAreaSnapshot = vi.mocked(queries.useAreaSnapshot)
const useAreaCongestion = vi.mocked(queries.useAreaCongestion)
const useCityInfo = vi.mocked(queries.useCityInfo)
const useLocation = vi.mocked(locationContext.useLocation)

// ── 왜 이 목업이 라틴 문자로만 채워져 있나 ────────────────────────────────
//
// **허용 목록을 뒤집은 것이다.** 영어 화면에 한국어가 남아도 되는 자리가 실제로
// 있다 — 서울 API의 자유 문장(`MSG_CN`·`ROAD_MSG`·`PCP_MSG`·`AIR_MSG`)과
// 고유명사(주차장·대여소·행사·지하철역 이름)다. 그것들을 목록으로 적어 빼면
// 목록이 곧 낡고, **빠뜨린 진짜 결함까지 함께 눈감아 준다.**
//
// 그래서 반대로 한다: **못 옮기는 자리에는 애초에 한국어를 안 넣는다.** 그러면
// DOM에 남은 한글은 정의상 「옮겼어야 하는데 안 옮긴 것」뿐이라, 허용 목록 없이
// 0개를 단언할 수 있다.
//
// 대신 갈래 값(`DST_SE_NM`·`ACDNT_TYPE`·`SUB_DIR` 등)은 **한국어 그대로** 둔다.
// 서울 API가 그렇게 주고, 그게 이 검사가 보려는 것이다.
const SNAPSHOT: AreaSnapshot = {
  code: 'POI001',
  name: '광화문·덕수궁',
  congestion: '약간 붐빔',
  message: 'Somewhat busy right now.',
  populationMin: 30_000,
  populationMax: 32_000,
  observedAt: '2026-08-21 15:00',
  observedAtLabel: '15:00',
  forecasts: [
    {
      time: '2026-08-21 16:00',
      hour: 16,
      congestion: '붐빔',
      populationMin: 40_000,
      populationMax: 42_000,
    },
  ],
  forecastProvided: null,
  composition: {
    maleRate: 48,
    femaleRate: 52,
    nonResidentRate: 71,
    residentRate: 29,
    ageRates: [3, 8, 31, 22, 14, 11, 6, 4],
  },
  replaced: null,
}

const CITY_INFO: CityInfo = makeCityInfo({
  areaName: '광화문·덕수궁',
  areaCode: 'POI001',
  freshness: { ageSeconds: 180, receivedAt: 1_755_000_000_000 },
  weather: makeWeather({
    temperature: 29,
    maxTemperature: 32,
    minTemperature: 24,
    humidity: 70,
    // 갈래 값이라 옮겨야 하는 것들이다. 자유 문장(`uvMessage`)만 라틴 문자다.
    windDirection: 'SSE',
    windSpeed: 2.8,
    sunrise: '05:43',
    sunset: '19:31',
    uvIndex: 1,
    uvGrade: '낮음',
    uvMessage: 'Wear sunscreen if you are sensitive to sunlight.',
    hourly: [
      makeHourlyForecast({
        time: '202608211600',
        temperature: 30,
        rainChance: 20,
        sky: 'Cloudy',
        precipitationType: 'None',
        // 강수량은 숫자다 — 옮길 것이 없지만 채워야 그 자리가 렌더된다.
        precipitation: 2,
      }),
    ],
    precipitationMessage: 'Rain is coming. Bring an umbrella.',
    pm10: 31,
    pm25: 18,
    pm10Grade: '보통',
    pm25Grade: '좋음',
    airGrade: '보통',
    airIndexValue: 33,
    airIndexMain: '',
    airMessage: 'No special precautions needed.',
    warnings: [
      {
        kind: '폭염',
        level: '주의보',
        announcedAt: '202608231100',
        command: '발표',
        cancelState: '정상',
        message: 'Stay indoors during the hottest hours.',
      },
    ],
    updatedAt: '2026-08-21 15:00',
  }),
  roadTraffic: {
    index: '정체',
    speed: 12,
    message: 'Two-car collision; one lane closed.',
    updatedAt: '2026-08-21 15:00',
  },
  accidents: [
    // **이 한 건만 한국어 원문이다.** 나머지 자유 문장과 달리 서울이 영어를
    // 함께 주는 자리라(`ACDNT_ENG_INFO`) 위의 「못 옮기는 자리에는 한국어를
    // 안 넣는다」가 뒤집힌다 — 여기에 한국어를 **넣어야** 영어가 실제로
    // 골라지는지가 검사된다. `apiText`가 죽으면 이 줄이 한글로 남아 스윕이
    // 잡는다.
    makeAccident({
      info: '세종대로 사거리 2개 차로 통제',
      infoEn: 'Two lanes closed at Sejong-daero intersection',
      type: '교통사고',
      detailType: '차대차',
      occurredAt: '2026-08-21 14:30',
      expectedClearAt: '2026-08-21 16:00',
      coords: { lat: 37.5715, lng: 126.9769 },
    }),
    // 실호출 응답에서 본 조합. 목업이 그리는 것과 다른 값이라 함께 넣는다.
    // **이쪽은 영어가 안 온 경우다** — 원문으로 떨어지므로 라틴 문자여야 한다.
    makeAccident({
      info: 'Road repair in progress',
      type: '공사',
      detailType: '도로보수',
      occurredAt: '2026-08-21 09:00',
      expectedClearAt: '2026-08-21 18:00',
    }),
  ],
  accidentsUpdatedAt: '2026-08-21 15:00',
  parking: [
    makeParkingLot({
      name: 'Gwanghwamun Public Parking',
      // 주소는 고유명사라 영어 화면에도 원문이 남는 자리다. 라틴 문자로 둬야
      // 스윕이 「옮겼어야 하는데 안 옮긴 것」만 세게 된다.
      address: '14 Cheonggyecheon-ro, Jung-gu',
      coords: { lat: 37.57, lng: 126.977 },
      capacity: 100,
      available: 45,
      liveAvailable: true,
      paid: true,
      // 「30분까지 무료, 이후 10분당 1,000원」. 실호출에 있던 갈래다.
      fee: { baseFee: 0, baseMinutes: 30, addFee: 1000, addMinutes: 10 },
    }),
  ],
  bikes: [
    makeBikeStation({
      name: 'Gwanghwamun Stn. Exit 3',
      id: 'ST-126',
      coords: { lat: 37.571, lng: 126.976 },
      bikes: 7,
      racks: 20,
      // 거치대보다 자전거가 많은 곳. 「반납 자리 없음」 줄을 렌더시켜
      // 그 문구가 옮겨졌는지 함께 본다.
      dockRate: 130,
    }),
  ],
  events: [
    makeCulturalEvent({
      name: 'Seoul Biennale of Architecture',
      period: '2026-08-01~2026-10-31',
      place: 'Songhyeon Green Plaza',
      free: true,
      url: 'https://example.com',
      coords: { lat: 37.5772, lng: 126.9807 },
      // 그림에는 옮길 글자가 없다. 채우는 이유는 `alt`와 지도 버튼이 함께
      // 렌더되는 모양을 스윕에 태우기 위해서다.
      thumbnail: 'https://example.com/poster.jpg',
    }),
  ],
  alerts: [
    {
      category: '호우',
      step: '주의보',
      message: '[Seoul] Heavy rain advisory in effect.',
      createdAt: '2026-08-21 13:00',
    },
  ],
  // 승하차·정류소도 스윕에 태운다. 정류소 이름은 고유명사라 라틴 문자로 둔다.
  subwayRidership: {
    total: { boardingMin: 10400, boardingMax: 10500, alightingMin: 87100, alightingMax: 87200 },
    last30Minutes: { boardingMin: null, boardingMax: null, alightingMin: null, alightingMax: null },
    last10Minutes: { boardingMin: 550, boardingMax: 600, alightingMin: 900, alightingMax: 950 },
    last5Minutes: { boardingMin: null, boardingMax: null, alightingMin: null, alightingMax: null },
    stopCount: 4,
    stopCountAt: '20260825',
  },
  busStops: [
    { name: 'Gwanghwamun Stn.', arsId: '1009', id: 'B1', coords: { lat: 37.57, lng: 126.977 } },
  ],
  busRidership: {
    total: { boardingMin: 6000, boardingMax: 6100, alightingMin: 13300, alightingMax: 13400 },
    last30Minutes: { boardingMin: null, boardingMax: null, alightingMin: null, alightingMax: null },
    last10Minutes: { boardingMin: 150, boardingMax: 200, alightingMin: 200, alightingMax: 250 },
    last5Minutes: { boardingMin: null, boardingMax: null, alightingMin: null, alightingMax: null },
    stopCount: 41,
    stopCountAt: '20260825',
  },
  // 자유 문장이라 옮기지 않는 자리다. 실패 갈래를 태워 두면 그 문장이 영어
  // 화면에 한국어로 뜨는 것이 **결함이 아님**을 스윕이 헷갈리지 않는다.
  busResultMessage: 'Service under maintenance.',
  // 충전소: 이름·주소·제한 사유는 고유명사와 자유 문장이라 라틴 문자로 둔다.
  // 상태·타입·시설 종류는 **한국어 그대로** — 옮겨야 하는 갈래 값이다.
  chargers: [
    {
      name: 'NIA Building',
      id: 'HM110247',
      address: '14 Cheonggyecheon-ro, Jung-gu',
      coords: { lat: 37.5687892, lng: 126.9788175 },
      useTime: 'Open 24 hours',
      parkingPaid: true,
      limited: true,
      limitDetail: 'Residents only.',
      kind: '아파트',
      chargers: [
        {
          id: '02',
          type: 'DC차데모+AC3상+DC콤보',
          status: '사용가능',
          outputKw: 100,
          method: '단독',
          statusAt: '2026-08-25 08:56',
          lastStartAt: '',
          lastEndAt: '',
          chargingSince: '',
        },
      ],
    },
  ],
  // 상권 갈래 값은 **한국어 그대로** 둔다 — 옮겨야 하는 값이라 스윕이 잡아야 한다.
  commerce: {
    level: '바쁜',
    paymentCount: 168,
    paymentMin: 390_000_000,
    paymentMax: 400_000_000,
    categories: [
      {
        major: '음식·음료',
        minor: '한식',
        level: '한산한',
        paymentCount: 57,
        paymentMin: 1_300_000,
        paymentMax: 1_400_000,
        storeCount: 374,
        storeCountAt: '202607',
      },
    ],
    maleRate: 41.4,
    femaleRate: 58.6,
    ageRates: [0, 10.4, 12.8, 26.2, 26.8, 23.8],
    personalRate: 79.4,
    corporationRate: 20.6,
    updatedAt: '20260825 1120',
  },
  subway: [
    {
      station: 'Gwanghwamun',
      line: '5호선',
      direction: '상행',
      terminal: 'Banghwa',
      message: '전역 출발',
    },
    {
      station: 'City Hall',
      line: '2호선',
      direction: '하행',
      terminal: 'Seongsu',
      message: '4분 30초 후 (Euljiro 1-ga)',
    },
  ],
})

function ok<T>(data: T): UseQueryResult<T> {
  return { data, isPending: false, isError: false } as UseQueryResult<T>
}

beforeEach(() => {
  resetFavorites()
  resetLanguage()
  localStorage.clear()
  vi.clearAllMocks()
  useAreaSnapshot.mockReturnValue(ok(SNAPSHOT))
  useAreaCongestion.mockReturnValue(ok<readonly AreaCongestion[]>([]))
  useCityInfo.mockReturnValue(ok(CITY_INFO))
  useLocation.mockReturnValue({
    coords: { lat: 37.5, lng: 127.0 },
    status: 'granted',
    retry: vi.fn(),
  } as unknown as ReturnType<typeof locationContext.useLocation>)
})

afterEach(() => {
  resetLanguage()
})

/**
 * DOM에 남은 한글. 텍스트 노드와 **읽히는 속성**을 함께 본다.
 *
 * 속성까지 보는 이유는 `PopulationCard`에서 겪은 것과 같다 — 눈에 보이는 줄만
 * 감싸면 `aria-label`이 조용히 한국어로 남는데, 화면을 봐서는 알 수 없다.
 */
function hangulIn(root: HTMLElement): readonly string[] {
  const found = new Set<string>()

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = (node.textContent ?? '').trim()
    if (/[가-힣]/.test(text)) {
      found.add(text)
    }
  }

  for (const element of root.querySelectorAll('[aria-label],[title],[alt]')) {
    for (const attribute of ['aria-label', 'title', 'alt']) {
      const value = element.getAttribute(attribute)
      if (value !== null && /[가-힣]/.test(value)) {
        found.add(`@${attribute}: ${value}`)
      }
    }
  }

  return [...found]
}

// **정적 검사 셋이 전부 초록인 채로 새어 나갔다**(2026-08-21 사용자 지적:
// 「상세 페이지 영어 지원이 완벽하게 전환되지 않는다」). 새던 값은 전부
// **런타임에 오는 것**이라 소스를 훑어서는 못 센다 — `translatedKeys()`는
// 리터럴만 보고, `dynamicKeys()`는 「쓴다」고 선언만 한다.
//
// 여기서는 실제로 그려서 남은 글자를 센다. 탭마다 따로 세는 이유는 **탭 밖의
// 값이 DOM에 아예 없어서**다 — 한 번만 세면 여섯 탭이 통째로 사각지대가 된다.
describe('영어 상세 화면에 옮기지 않은 한국어가 없다', () => {
  it.each(DETAIL_TABS.map((tab, index) => [index, tab.label] as const))(
    '탭 %i(%s)',
    async (index) => {
      setLanguage('en')
      const { container } = render(
        <AreaDetailScreen
          areaName="광화문·덕수궁"
          onBack={() => undefined}
          onSelectArea={() => undefined}
          onShowOnMap={() => undefined}
        />,
      )

      await userEvent.click(screen.getAllByRole('tab')[index])

      expect(hangulIn(container)).toEqual([])
    },
  )

  // 위가 빈 화면을 보며 조용히 통과하는 것을 막는다. 한국어 화면에서는 같은
  // 자리들이 한글로 그려져야 한다 — 그래야 「셀 것이 있는데 0개」임이 선다.
  it('한국어 화면에서는 같은 자리가 한글로 그려진다', async () => {
    const { container } = render(
      <AreaDetailScreen
        areaName="광화문·덕수궁"
        onBack={() => undefined}
        onSelectArea={() => undefined}
        onShowOnMap={() => undefined}
      />,
    )

    await userEvent.click(screen.getAllByRole('tab')[0])

    expect(hangulIn(container).length).toBeGreaterThan(5)
  })
})
