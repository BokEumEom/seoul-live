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
import { makeWeather } from '../test/cityInfo'

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
  composition: {
    maleRate: 48,
    femaleRate: 52,
    nonResidentRate: 71,
    ageRates: [3, 8, 31, 22, 14, 11, 6, 4],
  },
  replaced: null,
}

const CITY_INFO: CityInfo = {
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
      {
        time: '202608211600',
        temperature: 30,
        rainChance: 20,
        sky: 'Cloudy',
        precipitationType: 'None',
      },
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
    {
      info: 'Two-car collision on Sejong-daero',
      type: '교통사고',
      detailType: '차대차',
      occurredAt: '2026-08-21 14:30',
      expectedClearAt: '2026-08-21 16:00',
    },
    // 실호출 응답에서 본 조합. 목업이 그리는 것과 다른 값이라 함께 넣는다.
    {
      info: 'Road repair in progress',
      type: '공사',
      detailType: '도로보수',
      occurredAt: '2026-08-21 09:00',
      expectedClearAt: '2026-08-21 18:00',
    },
  ],
  parking: [
    {
      name: 'Gwanghwamun Public Parking',
      coords: { lat: 37.57, lng: 126.977 },
      capacity: 100,
      available: 45,
      liveAvailable: true,
      paid: true,
    },
  ],
  bikes: [
    {
      name: 'Gwanghwamun Stn. Exit 3',
      coords: { lat: 37.571, lng: 126.976 },
      bikes: 7,
      racks: 20,
    },
  ],
  events: [
    {
      name: 'Seoul Biennale of Architecture',
      period: '2026-08-01~2026-10-31',
      place: 'Songhyeon Green Plaza',
      free: true,
      url: 'https://example.com',
    },
  ],
  alerts: [
    {
      category: '호우',
      step: '주의보',
      message: '[Seoul] Heavy rain advisory in effect.',
      createdAt: '2026-08-21 13:00',
    },
  ],
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
}

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
