import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UseQueryResult } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CityInfo } from '../../domain/cityInfo'
import { DETAIL_TABS } from '../../domain/detailTabs'
import type { AreaCongestion, AreaSnapshot } from '../../domain/types'
import { reset } from '../../hooks/favoritesStore'
import {
  makeAccident,
  makeBikeStation,
  makeCityInfo,
  makeCulturalEvent,
  makeParkingLot,
  makeRoadSegment,
  makeWeather,
} from '../../test/cityInfo'
import { findAreaByName } from '../../data/areas'
import { TONE_TEXT_CLASS } from '../common/toneClass'
import { AreaDetailScreen } from './AreaDetailScreen'

vi.mock('../../data/queries', () => ({
  useAreaSnapshot: vi.fn(),
  useAreaCongestion: vi.fn(),
  useCityInfo: vi.fn(),
  // CCTV는 이 파일이 볼 것이 아니다(CctvSection.test.tsx의 몫). 다만 목록을
  // 안 주면 조회 중으로 남아 절이 안 그려지므로, 여기서는 「없는 명소」로 둔다 —
  // 121곳 중 상당수가 실제로 그 상태다.
  useCctv: vi.fn(() => ({ data: [], isPending: false, isError: false })),
  // 인파 변화는 SeoulRtd에서 오는 부가 정보다. 기본값을 「읽힌 값」으로 두는
  // 이유는 그게 정상 화면이기 때문이다 — 실호출 10곳이 전부 세 칸을 다 줬다.
  usePopulationTrend: vi.fn(() => ({
    data: {
      lastHour: { direction: 'up', percent: 7 },
      lastThreeHours: { direction: 'up', percent: 30.1 },
      lastMonth: { direction: 'down', percent: 15.3 },
    },
    isPending: false,
    isError: false,
  })),
}))
vi.mock('../../app/locationContext', () => ({ useLocation: vi.fn() }))
// 요일×시간 패턴의 저장소는 여기서 볼 것이 아니다. 목업하지 않으면 비동기
// 읽기가 테스트가 끝난 뒤 상태를 바꿔 act() 경고가 뜨고, 상세 테스트가
// 토스 Storage 브리지 구현에 묶인다. 쌓기 자체는 useWeekPattern이 잠근다.
vi.mock('../../platform/weekPattern', () => ({
  loadPattern: vi.fn().mockResolvedValue({ pattern: {}, lastObservedAt: null }),
  savePattern: vi.fn().mockResolvedValue(undefined),
}))
// 공유 버튼이 **무엇을 보내는가**가 검증 대상이다. 실제 `shareMessage`는
// 브리지가 없으면 클립보드로 떨어지는데, jsdom에 `navigator.clipboard`가 없어
// 조용히 아무 일도 안 일어난다 — 그 상태로는 문구가 비어도 통과한다.
vi.mock('../../platform/links', () => ({
  shareMessage: vi.fn().mockResolvedValue(undefined),
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
}))

const queries = await import('../../data/queries')
const locationContext = await import('../../app/locationContext')
const links = await import('../../platform/links')
const shareMessage = vi.mocked(links.shareMessage)
const useAreaSnapshot = vi.mocked(queries.useAreaSnapshot)
const useAreaCongestion = vi.mocked(queries.useAreaCongestion)
const useCityInfo = vi.mocked(queries.useCityInfo)
const usePopulationTrend = vi.mocked(queries.usePopulationTrend)
const useLocation = vi.mocked(locationContext.useLocation)

const SNAPSHOT: AreaSnapshot = {
  code: 'POI014',
  name: '강남역',
  congestion: '약간 붐빔',
  message: '조금 붐벼요.',
  populationMin: 74_000,
  populationMax: 76_000,
  observedAt: '2026-08-07 11:00',
  observedAtLabel: '11:00',
  forecasts: [],
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

const EMPTY_CITY_INFO: CityInfo = makeCityInfo({
  areaName: '강남역',
  areaCode: 'POI014',
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

const PARKING_LOT = makeParkingLot({
  name: '주차장',
  capacity: 100,
  available: 45,
  liveAvailable: true,
})

function ok<T>(data: T): UseQueryResult<T> {
  return { data, isPending: false, isError: false } as UseQueryResult<T>
}
function failed<T>(): UseQueryResult<T> {
  return { data: undefined, isPending: false, isError: true } as UseQueryResult<T>
}

beforeEach(() => {
  reset()
  localStorage.clear()
  vi.clearAllMocks()
  useAreaSnapshot.mockReturnValue(ok(SNAPSHOT))
  useAreaCongestion.mockReturnValue(ok<readonly AreaCongestion[]>([]))
  useCityInfo.mockReturnValue(ok(EMPTY_CITY_INFO))
  // **여기서 다시 세워야 한다.** `clearAllMocks`는 호출 기록만 지우고
  // `mockReturnValue`는 남긴다 — 한 테스트가 「못 받은 인파 변화」를 넣으면
  // 그 값이 뒤 테스트로 새어 그쪽에서는 절이 조용히 사라진다.
  usePopulationTrend.mockReturnValue(
    ok({
      lastHour: { direction: 'up', percent: 7 },
      lastThreeHours: { direction: 'up', percent: 30.1 },
      lastMonth: { direction: 'down', percent: 15.3 },
    } as const),
  )
  standAt(null)
})

function standAt(coords: { lat: number; lng: number } | null) {
  useLocation.mockReturnValue({
    coords,
    status: coords === null ? 'unavailable' : 'granted',
    retry: vi.fn(),
  } as unknown as ReturnType<typeof locationContext.useLocation>)
}

/** DOM 순서로 앞서는가. compareDocumentPosition은 비트마스크라 그대로 쓰면
 *  포함 관계에서 뜻이 흐려진다 — 형제 관계만 보는 이 파일에서는 이걸로 충분하다. */
function before(first: Element, second: Element): boolean {
  return Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  )
}

// **좌표를 숫자로 박아 두지 않는다.** 예전에는 강남역이 (37.498, 127.0276)이라고
// 적고 거기서 0.009° 북쪽 같은 값을 손으로 계산했는데, 2026-08-20에 카탈로그
// 좌표를 서울시가 주는 폴리곤 중심으로 갈아 끼우면서 네 테스트가 한꺼번에
// 깨졌다. 재려던 것은 「거리 계산과 표기」이지 강남역이 정확히 어디냐가 아니다.
// 그래서 기준점을 카탈로그에서 읽고, 거기서의 **차이**만 여기서 정한다.
const GANGNAM = findAreaByName('강남역')!

function renderDetail(areaName = '강남역') {
  return render(
    <AreaDetailScreen
      areaName={areaName}
      onBack={() => undefined}
      onSelectArea={() => undefined}
      onShowOnMap={() => undefined}
    />,
  )
}

/** 그 탭으로 옮긴다. 탭 밖의 값은 DOM에 아예 없으므로 먼저 눌러야 한다. */
async function openTab(name: string) {
  await userEvent.click(screen.getByRole('tab', { name }))
}

/**
 * 요약 카드 하나. **이름 조각으로만 집는다.**
 *
 * 카드의 접근성 이름은 라벨·값·캡션이 이어 붙은 것인데, 그 사이에 공백이
 * 들어가는지는 **레이아웃에 달려 있다** — accname 알고리즘은 블록 상자 사이에만
 * 공백을 넣고, 여기 조각들은 flex 자식이라 실제 브라우저에서는 블록이 된다.
 * jsdom에는 레이아웃이 없어 그 판정을 못 하므로 「주차1곳45%…」로 붙어 나온다.
 * 이름 전체를 단언하면 **테스트가 진짜 화면이 아니라 jsdom의 한계를 잠근다.**
 * 라벨 조각으로 집고 값은 카드 안에서 따로 본다.
 */
function summaryCard(label: string | RegExp): HTMLElement {
  return screen.getByRole('button', { name: label })
}

describe('AreaDetailScreen — 셸', () => {
  // 상세가 시트를 벗어나 전체 화면이 되면서, 이름은 스크롤해도 남는 상단 바로
  // 올라갔다. 시트 안에서는 히어로의 h2였는데 내려가면 화면에서 사라졌다.
  it('상단 바가 명소 이름을 이고 있다', () => {
    renderDetail()
    expect(screen.getByRole('heading', { name: '강남역' })).toBeInTheDocument()
  })

  /**
   * **상단 바 패딩과 조작부의 음수 여백은 한 쌍이다.**
   *
   * `ActionButtons`가 `-mr-3`으로 마지막 48px 버튼의 안쪽 12px을 되돌리는데,
   * 그걸 받아줄 패딩이 상단 바에 없어서 12px이 헤더 밖으로 나가 있었다
   * (390px에서 시트 `scrollWidth` 402, 2026-08-27 실측). 그 12px이
   * `overflow-y-auto` 상자를 **가로로도 스크롤 가능**하게 만들어서, 위아래로
   * 미는 손가락이 내용을 좌우로 밀었다 — 사용자가 신고한 결함이다.
   *
   * **두 값이 같아야 상쇄된다.** 한쪽만 고치면 다시 어긋나므로 짝을 잠근다.
   * 두 파일에 흩어져 있어 각자 보면 둘 다 멀쩡해 보인다. jsdom에는 레이아웃이
   * 없어 넘침 자체는 못 재고(`scrollWidth`가 언제나 0이다) 이 짝만 잴 수 있다.
   */
  it('상단 바 패딩이 조작부의 음수 여백과 짝이 맞는다', () => {
    const { container } = renderDetail()
    const header = container.querySelector('header')
    const actions = container.querySelector('header div[class*="-mr-"]')

    const padding = (header?.className ?? '').match(/(?:^|\s)pr-(\S+)/)?.[1]
    const pull = (actions?.className ?? '').match(/(?:^|\s)-mr-(\S+)/)?.[1]

    expect(pull).toBeDefined()
    expect(padding).toBe(pull)
  })

  it('뒤로 버튼이 콜백을 부른다', async () => {
    const onBack = vi.fn()
    render(
      <AreaDetailScreen
        areaName="강남역"
        onBack={onBack}
        onSelectArea={() => undefined}
        onShowOnMap={() => undefined}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '뒤로' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  // **「열리면 포커스가 이 화면으로 온다」가 여기서 없어졌다**(2026-08-21).
  // 상세가 시트 안으로 돌아오면서 포커스를 받는 것은 시트 받침대이고, 그
  // 보호는 `HomeScreen.test.tsx`의 「뷰가 갈려도 포커스가 몸통으로 떨어지지
  // 않는다」가 **실제로 잡고 있다** — 명소를 누른 뒤 `activeElement`가
  // `[data-sheet-content]` 안인지 본다. 지우기 전에 저쪽 단언이 같은 것을
  // 죽이는지 확인했다(AGENTS.md 「테스트를 지울 때」).
  //
  // 대신 여기서는 **시트로 돌아오며 생긴 새 계약**을 잠근다.
  it('스크롤 상자를 스스로 만들지 않는다', () => {
    const { container } = renderDetail()

    // 시트(`data-sheet-content`)가 유일한 스크롤 컨테이너다. 여기서 하나 더
    // 만들면 시트의 「뷰를 갈아 끼울 때 scrollTop을 0으로」가 바깥 상자만
    // 되돌려, 상세가 앞 뷰의 스크롤 자리에서 시작한다.
    //
    // **클래스를 보는 것이 맞는 granularity다.** jsdom에는 레이아웃이 없어
    // 「스크롤된다」를 관측할 방법이 아예 없고(`getComputedStyle`은 0을
    // 돌려준다), 이 계약은 실제로 클래스 한 줄이다. 우회로가 없지는 않지만
    // (`style` 속성 등) 이 저장소에서 스크롤 상자를 만드는 길은 이 유틸리티뿐이다.
    expect(container.querySelectorAll('.overflow-y-auto')).toHaveLength(0)
  })

  it('카탈로그에 없는 명소는 조회하지 않는다', () => {
    renderDetail('부산역')
    expect(useAreaSnapshot).toHaveBeenCalledWith(undefined)
    expect(screen.getByText('명소를 찾을 수 없어요.')).toBeInTheDocument()
  })

  // 액션 행은 명소 카탈로그만 있으면 성립한다. 혼잡도 응답 안에 두면 API가
  // 흔들린 날 저장·길찾기·공유가 통째로 사라진다.
  it('혼잡도가 실패해도 저장과 길찾기는 남는다', () => {
    useAreaSnapshot.mockReturnValue(failed<AreaSnapshot>())
    renderDetail()
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
    // 길찾기 셋이 전부 남아야 한다. 하나만 세면 나머지가 혼잡도 응답에 묶여도
    // 이 테스트가 통과한다.
    expect(screen.getByRole('link', { name: '카카오맵' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '네이버' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '티맵' })).toBeInTheDocument()
  })

  // 시트가 half에서 449px만 보이는데 내용은 5,395px이고 카카오맵 버튼이
  // 5,369px 지점에 있었다(390×844 실측) — 주 CTA가 12화면 아래였다. 전체
  // 화면이 된 지금도 탭 하나가 길 수 있어 계속 붙여 둔다. **붙었는지는 jsdom이
  // 못 잰다**(레이아웃이 없다) — 그 값을 만드는 클래스를 잠근다.
  it('길찾기가 화면 하단에 붙는다', () => {
    renderDetail()
    const bar = screen.getByRole('link', { name: '카카오맵' }).parentElement
      ?.parentElement
    expect(bar).toHaveClass('sticky', 'bottom-0')
    // 배경이 없으면 밑으로 흐르는 글자가 버튼 사이로 비친다.
    expect(bar).toHaveClass('bg-surface-container-lowest')
  })

  // **길찾기는 탭 밖이다.** 날씨를 보다 가기로 마음먹은 사용자가 요약 탭으로
  // 되돌아가야 한다면 탭이 오히려 길을 늘린 셈이 된다.
  it('어느 탭에서도 길찾기가 보인다', async () => {
    renderDetail()
    await openTab('날씨')
    expect(screen.getByRole('link', { name: '카카오맵' })).toBeInTheDocument()
  })

  // **아이콘뿐인 버튼이라 이름이 유일한 설명이다.** 목적지("인스타그램")만
  // 적으면 앱 밖으로 나간다는 사실이 빠진다. href가 실제로 채워져 있어야
  // 브리지가 없는 환경에서도 폴백이 성립한다(`MapLinkButtons`와 같은 규칙).
  it('인스타그램이 그 명소의 해시태그로 열린다', () => {
    renderDetail()
    expect(
      screen.getByRole('link', { name: '인스타그램에서 사진 보기' }),
    ).toHaveAttribute(
      'href',
      'https://www.instagram.com/explore/tags/%EA%B0%95%EB%82%A8%EC%97%AD/',
    )
  })

  // **주소가 없으면 공유가 아니다.** 예전에는 문장 하나만 보냈다 — 받은 사람은
  // 앱을 열 수도, 그 명소로 갈 수도 없었다.
  it('공유하기가 그 명소로 열리는 주소를 함께 보낸다', async () => {
    renderDetail()

    await userEvent.click(screen.getByRole('button', { name: '공유하기' }))

    const message = shareMessage.mock.calls[0]?.[0] ?? ''
    expect(message).toContain('강남역')
    // 인코딩 형태는 `route.test.ts`가 잠근다. 여기서 볼 것은 **명소를 가리키는
    // 쿼리가 실려 나간다**는 것이다 — 앱 주소만 보내면 받은 사람은 목록으로 간다.
    expect(message).toContain('?area=%EA%B0%95%EB%82%A8%EC%97%AD')
  })
})

describe('AreaDetailScreen — 저장', () => {
  // 라벨이 상태를 말하므로 aria-pressed를 겹쳐 쓰지 않는다. 둘 다 쓰면
  // 스크린리더가 "저장됨, 선택됨"처럼 같은 상태를 두 번 읽는다.
  it('저장 상태를 라벨로만 말한다', async () => {
    renderDetail()
    const save = screen.getByRole('button', { name: '저장' })
    expect(save).not.toHaveAttribute('aria-pressed')
    await userEvent.click(save)
    expect(await screen.findByRole('button', { name: '저장됨' })).not.toHaveAttribute(
      'aria-pressed',
    )
  })

  // 라벨 변경은 포커스가 머문 요소에서 스크린리더가 다시 읽지 않는다. 눌리기
  // 전 단서였던 aria-pressed도 없으니, 라이브 리전이 없으면 저장 성공 여부를
  // 알 방법이 사라진다.
  it('저장 결과를 라이브 리전으로 알린다', async () => {
    renderDetail()
    // 마운트 시점에는 비어 있어야 한다. 이미 저장한 곳을 열자마자 "저장됨"이
    // 낭독되면 사용자가 방금 누른 것으로 오해한다.
    expect(screen.getByRole('status')).toBeEmptyDOMElement()

    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(screen.getByRole('status')).toHaveTextContent('강남역 저장됨')

    // 해제도 같은 구멍이다 — 라벨만 바뀌면 아무 소리도 안 난다.
    await userEvent.click(screen.getByRole('button', { name: '저장됨' }))
    expect(screen.getByRole('status')).toHaveTextContent('강남역 저장 해제')
  })
})

describe('AreaDetailScreen — 히어로', () => {
  // 시안(stitch_ui_ux/_2)의 네 줄이다. **등급을 문장으로 말한다** — 전체
  // 화면에서는 제목 줄의 배지가 없어졌으므로 되풀이가 아니라 처음 말하는 것이다.
  it('문장·인원·안내·기준 시각을 한 덩어리로 말한다', () => {
    renderDetail()
    expect(
      screen.getByRole('heading', { name: '지금은 약간 붐벼요' }),
    ).toBeInTheDocument()
    expect(screen.getByText('74,000~76,000명')).toBeInTheDocument()
    expect(screen.getByText('조금 붐벼요.')).toBeInTheDocument()
    expect(screen.getByText('11:00 기준')).toBeInTheDocument()
  })

  // 강남역에서 위도로 0.009° 북쪽이면 이 코드가 쓰는 지구 반지름(6,371km)에서
  // 1,000.75m가 나온다 — formatDistance가 10m 단위로 반올림해 "1.0km",
  // walkingMinutes(시속 4km)가 round(15.01)=15분이다.
  it('카테고리·거리·도보 시간을 한 줄로 보여준다', () => {
    standAt({ lat: GANGNAM.lat + 0.009, lng: GANGNAM.lng })
    renderDetail()
    expect(screen.getByText('역·번화가 · 1.0km · 도보 15분')).toBeInTheDocument()
  })

  // 거리 0은 falsy다. `distanceMeters &&`로 쓰면 명소 위에 서 있을 때 거리와
  // 도보 시간이 통째로 사라진다. walkingMinutes의 하한 1분도 함께 잠긴다.
  it('명소 위에 서 있어도 거리와 도보 시간을 지우지 않는다', () => {
    standAt({ lat: GANGNAM.lat, lng: GANGNAM.lng })
    renderDetail()
    expect(screen.getByText('역·번화가 · 0m · 도보 1분')).toBeInTheDocument()
  })

  // 위도 0.045° 북쪽이면 5,003.8m다 — 도보로 75분. 한 시간을 넘으면 도보
  // 구간만 빠지고 거리는 남는다.
  it('걸어갈 거리가 아니면 도보 시간을 적지 않는다', () => {
    standAt({ lat: GANGNAM.lat + 0.045, lng: GANGNAM.lng })
    renderDetail()
    expect(screen.getByText('역·번화가 · 5.0km')).toBeInTheDocument()
  })

  it('좌표가 없으면 카테고리만 남는다', () => {
    renderDetail()
    expect(screen.getByText('역·번화가')).toBeInTheDocument()
  })

  // **자리를 미리 안 잡는다.** 히어로가 스켈레톤으로 자라면 도착할 때 바로
  // 아래 sticky 탭 줄이 통째로 밀린다.
  it('혼잡도가 오기 전에는 문장 블록이 없다', () => {
    useAreaSnapshot.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    } as UseQueryResult<AreaSnapshot>)
    renderDetail()
    expect(screen.queryByText(/지금은/)).toBeNull()
    // 카탈로그만으로 서는 줄은 그대로 있어야 한다 — 화면이 통째로 비지 않는다.
    expect(screen.getByText('역·번화가')).toBeInTheDocument()
  })
})

describe('AreaDetailScreen — 탭', () => {
  // 겉모습만 탭이고 버튼 일곱 개인 화면은 스크린리더에서 「버튼, 버튼…」으로
  // 읽혀 몇 개 중 몇째인지 알 수 없다.
  it('탭 줄이 진짜 tablist다', () => {
    renderDetail()
    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(
      DETAIL_TABS.map((tab) => tab.label),
    )
  })

  it('요약 탭으로 시작한다', () => {
    renderDetail()
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('요약')
  })

  // 탭 버튼과 패널이 서로를 가리켜야 스크린리더가 「이 패널은 저 탭의 것」을
  // 안다. 양쪽이 문자열을 각자 지으면 조용히 어긋나고 눈으로는 멀쩡하다.
  it('선택된 탭과 패널이 서로를 가리킨다', () => {
    renderDetail()
    const selected = screen.getByRole('tab', { selected: true })
    const panel = screen.getByRole('tabpanel')
    expect(selected.getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.getAttribute('aria-labelledby')).toBe(selected.id)
  })

  it('탭을 누르면 그 패널로 갈린다', async () => {
    renderDetail()
    await openTab('인구')
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('인구')
    expect(
      screen.getByRole('heading', { name: '시간대별 인파' }),
    ).toBeInTheDocument()
  })

  // **Tab 키는 탭 줄을 통째로 지나가고 좌우 화살표가 탭을 고른다**(WAI-ARIA).
  // 이게 없으면 키보드 사용자가 패널로 내려가기 전에 탭을 일곱 번 눌러야 한다.
  it('선택된 탭만 탭 순서에 들어간다', () => {
    renderDetail()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.filter((tab) => tab.getAttribute('tabindex') === '0')).toHaveLength(1)
  })

  it('화살표 키로 옮기면 포커스도 따라간다', async () => {
    renderDetail()
    const summary = screen.getByRole('tab', { name: '요약' })
    summary.focus()
    await userEvent.keyboard('{ArrowRight}')

    const population = screen.getByRole('tab', { name: '인구' })
    expect(population).toHaveFocus()
    expect(population).toHaveAttribute('aria-selected', 'true')
  })

  // 양 끝에서 감는다. 목록이 순환이라는 것이 화살표 조작의 관용이고, 일곱 개를
  // 훑을 때 끝에서 막히면 반대로 되짚어야 한다.
  it('첫 탭에서 왼쪽 화살표를 누르면 마지막으로 감는다', async () => {
    renderDetail()
    screen.getByRole('tab', { name: '요약' }).focus()
    await userEvent.keyboard('{ArrowLeft}')

    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent(
      DETAIL_TABS.at(-1)!.label,
    )
  })
})

describe('AreaDetailScreen — 요약 카드', () => {
  it('값이 있는 것만 카드가 된다', () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        parking: [PARKING_LOT],
        events: [makeCulturalEvent({ name: '행사', period: '', place: '', free: null, url: '' })],
      }),
    )
    renderDetail()

    // 혼잡도·주차·문화행사 셋만 값이 있다. 날씨·대기질·도로·지하철·따릉이는
    // 「—」로 채우지 않고 칸 자체를 안 만든다.
    expect(within(summaryCard(/주차/)).getByText('1곳')).toBeInTheDocument()
    expect(within(summaryCard(/문화행사/)).getByText('1건')).toBeInTheDocument()
    expect(within(summaryCard(/혼잡도/)).getByText('약간 붐빔')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /지하철/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /날씨/ })).not.toBeInTheDocument()
  })

  // 접이식 절과 다른 점이 이것이다: 접힌 절은 「무엇이 있는지」조차 감추지만
  // 카드는 값까지 보여준 뒤 자세히 볼 사람만 넘긴다.
  it('카드를 누르면 그 탭으로 간다', async () => {
    useCityInfo.mockReturnValue(ok({ ...EMPTY_CITY_INFO, parking: [PARKING_LOT] }))
    renderDetail()

    await userEvent.click(summaryCard(/주차/))

    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('주변')
    expect(screen.getByRole('heading', { name: '주차장' })).toBeInTheDocument()
  })

  // 「대여소 3곳」은 거기 자전거가 있는지를 말하지 않는다. 시안의 「18대 /
  // 대여 가능」이 답에 가깝다.
  it('따릉이 카드가 대여소가 아니라 자전거 대수를 센다', () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        bikes: [
          makeBikeStation({ name: '가', coords: null, bikes: 6, racks: 21 }),
          makeBikeStation({ name: '나', coords: null, bikes: 12, racks: 20 }),
        ],
      }),
    )
    renderDetail()
    expect(within(summaryCard(/따릉이/)).getByText('18대')).toBeInTheDocument()
  })

  // 시안(stitch_ui_ux/_2)이 이 값만 파랑으로 둔다. **혼잡도 톤이 아니라
  // primary인 것이 요점이다** — 「지금 빌릴 수 있다」는 좋고 나쁨의 눈금이
  // 아니라 할 수 있는 일이라, 네 톤에 얹으면 「여유」와 같은 뜻으로 읽힌다.
  it('대수를 셀 수 있으면 파랑이고, 못 세면 색이 없다', () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        bikes: [makeBikeStation({ name: '가', coords: null, bikes: 6, racks: 21 })],
      }),
    )
    const { unmount } = renderDetail()
    expect(within(summaryCard(/따릉이/)).getByText('6대')).toHaveClass('text-primary')
    unmount()

    // 대수를 모르면 대여소 수로 떨어진다. 그 숫자는 자전거가 있는지를 말하지
    // 않으므로 강조할 것이 없다 — 여기가 갈리지 않으면 위 단언은 「언제나
    // 파랑」과 구별되지 않는다.
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        bikes: [makeBikeStation({ name: '가', coords: null, bikes: null, racks: 21 })],
      }),
    )
    renderDetail()
    expect(within(summaryCard(/따릉이/)).getByText('1곳')).not.toHaveClass('text-primary')
  })

  // 요약 카드와 교통 탭의 절이 **같은 함수**를 써야 한다. 두 곳이 각자 매핑을
  // 들면 한쪽만 고쳤을 때 같은 도로가 카드에서는 초록이고 절에서는 검정이다.
  it('도로 카드가 지표의 톤을 입는다', () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        roadTraffic: {
          index: '원활',
          speed: 24,
          message: '',
          updatedAt: '2026-08-21 15:00',
        },
      }),
    )
    renderDetail()
    expect(within(summaryCard(/도로/)).getByText('원활')).toHaveClass(
      TONE_TEXT_CLASS.calm,
    )
  })

  // 열차 수를 세면 「12」가 무엇의 12인지 알 수 없다.
  it('지하철 카드가 열차가 아니라 역·호선을 센다', () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        subway: [
          { station: '강남', line: '2호선', direction: '', terminal: '', message: '' },
          { station: '강남', line: '2호선', direction: '', terminal: '', message: '' },
          { station: '강남', line: '신분당선', direction: '', terminal: '', message: '' },
        ],
      }),
    )
    renderDetail()
    expect(within(summaryCard(/지하철/)).getByText('2곳')).toBeInTheDocument()
  })

  it('혼잡도도 도시 정보도 없으면 격자를 만들지 않는다', () => {
    useAreaSnapshot.mockReturnValue(failed<AreaSnapshot>())
    renderDetail()
    expect(screen.queryByRole('button', { name: /혼잡도/ })).not.toBeInTheDocument()
  })

  it('혼잡도가 실패하면 요약 탭이 다시 시도할 길을 준다', () => {
    useAreaSnapshot.mockReturnValue(failed<AreaSnapshot>())
    renderDetail()
    expect(screen.getByText('혼잡도 정보를 가져오지 못했어요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  // 도시 정보가 실패해도 혼잡도 카드는 남는다. 둘은 별개 조회다.
  it('도시 정보가 실패해도 혼잡도는 그대로 남는다', () => {
    useCityInfo.mockReturnValue(failed<CityInfo>())
    renderDetail()
    expect(screen.getByText('74,000~76,000명')).toBeInTheDocument()
    expect(summaryCard(/혼잡도/)).toBeInTheDocument()
  })

  // **재난문자는 탭 뒤에 숨기지 않는다.** 사용자가 찾아 읽는 값이 아니라
  // 지금 당장 알아야 하는 내용이다.
  it('재난문자는 요약 탭에도 뜬다', () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        alerts: [
          {
            category: '호우',
            step: '경보',
            message: '침수 위험 지역 접근을 삼가세요.',
            createdAt: '2026-08-07 10:00',
          },
        ],
      }),
    )
    renderDetail()
    expect(screen.getByRole('alert')).toHaveTextContent(
      '침수 위험 지역 접근을 삼가세요.',
    )
  })
})

describe('AreaDetailScreen — 인구 탭', () => {
  it('평소 대비·인구 구성·시간축·요일 패턴이 한 탭에 온다', async () => {
    renderDetail()
    await openTab('인구')

    // 히어로와 「평소 대비」 줄이 같은 숫자를 적는다 — 시안도 `_2`와 `_3`에
    // 둘 다 적고, 여기서는 그 되풀이가 의도임을 함께 잠근다.
    expect(screen.getAllByText(/74,000~76,000명/)).toHaveLength(2)
    // 시안 `_3`의 성별·연령 카드와 우리가 하나 더 갖는 거주 카드.
    for (const name of ['성별 비율', '연령대별 비율', '거주 비율']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { name: '시간대별 인파' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '요일×시간 패턴' })).toBeInTheDocument()
  })

  /**
   * **탭이 그 명소의 이름으로 조회하는지.** 이름을 안 넘기거나 표시용 이름
   * (`areaDisplayName`)을 넘기면 프록시의 허용 목록에 걸려 400이 오고, 실패가
   * 빈 값으로 흡수되므로 **화면에는 「그냥 절이 없는 것」으로만 보인다** —
   * 눈으로는 정상과 구별되지 않는 자리다.
   *
   * 서울 API 호출 키는 언제나 한국어 원문이다(AGENTS.md 「언어」).
   */
  it('인파 변화를 그 명소의 한국어 이름으로 조회한다', async () => {
    renderDetail('강남역')
    await openTab('인구')

    expect(usePopulationTrend).toHaveBeenCalledWith('강남역')
    expect(screen.getByRole('heading', { name: '인파 변화' })).toBeInTheDocument()
  })

  // 이 절은 문서화되지 않은 상류에서 온다. 못 받았을 때 인구 탭의 나머지가
  // 멀쩡해야 한다 — 공식 API에서 온 값까지 끌고 들어가면 안 된다.
  it('인파 변화를 못 받아도 나머지 인구 탭은 그대로다', async () => {
    usePopulationTrend.mockReturnValue({
      data: {
        lastHour: { direction: null, percent: null },
        lastThreeHours: { direction: null, percent: null },
        lastMonth: { direction: null, percent: null },
      },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof usePopulationTrend>)
    renderDetail()
    await openTab('인구')

    expect(screen.queryByRole('heading', { name: '인파 변화' })).toBeNull()
    expect(screen.getByRole('heading', { name: '성별 비율' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '시간대별 인파' })).toBeInTheDocument()
  })

  it('인구 구성이 시간대별 인파보다 위에 있다', async () => {
    renderDetail()
    await openTab('인구')
    const who = screen.getByRole('heading', { name: '성별 비율' })
    expect(before(who, screen.getByRole('heading', { name: '시간대별 인파' }))).toBe(
      true,
    )
  })

  // **카드 안의 카드가 아니다**(2026-08-25). 시안 `_3`이 성별·연령을 각자
  // 테두리를 가진 카드로 그리는데, 예전처럼 「지금 얼마나 붐비나」 카드 **안**에
  // 있으면 테두리·패딩이 이중이 되어 그 모양을 낼 수가 없다.
  it('인구 구성 카드가 현재 상태 카드 밖에 나란히 선다', async () => {
    useAreaSnapshot.mockReturnValue(ok({ ...SNAPSHOT, replaced: true }))
    renderDetail()
    await openTab('인구')
    const congestion = screen
      .getByRole('heading', { name: '지금 얼마나 붐비나' })
      .closest('section')

    for (const name of ['성별 비율', '연령대별 비율', '거주 비율']) {
      expect(congestion?.contains(screen.getByRole('heading', { name }))).toBe(false)
    }
  })

  it('인구 구성이 없으면 그 카드들만 빠진다', async () => {
    useAreaSnapshot.mockReturnValue(ok({ ...SNAPSHOT, composition: null }))
    renderDetail()
    await openTab('인구')
    for (const name of ['성별 비율', '연령대별 비율', '거주 비율']) {
      expect(screen.queryByRole('heading', { name })).toBeNull()
    }
    expect(screen.getByRole('heading', { name: '시간대별 인파' })).toBeInTheDocument()
  })

  // **히어로가 이미 말한 것을 카드가 또 말하면 안 된다.** 히어로는 탭과 무관하게
  // 늘 위에 있으므로, 안내 문구와 기준 시각이 카드에도 있으면 한 화면에 같은
  // 말이 두 번 적힌다.
  it('안내 문구와 기준 시각을 카드가 되풀이하지 않는다', async () => {
    renderDetail()
    await openTab('인구')
    expect(screen.getAllByText('조금 붐벼요.')).toHaveLength(1)
    expect(screen.queryByText(/마지막 업데이트/)).toBeNull()
  })

  it('혼잡도가 없으면 인구 탭이 그 사실을 말한다', async () => {
    useAreaSnapshot.mockReturnValue(failed<AreaSnapshot>())
    renderDetail()
    await openTab('인구')
    expect(screen.getByText('혼잡도 정보를 아직 받지 못했어요.')).toBeInTheDocument()
  })
})

describe('AreaDetailScreen — 교통 탭', () => {
  it('도로소통이 뜬다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        roadTraffic: {
          index: '서행',
          speed: 18.4,
          message: '강남대로가 서행하고 있어요.',
          updatedAt: '2026-08-07 09:00',
        },
      }),
    )
    renderDetail()
    await openTab('교통')
    expect(screen.getByRole('heading', { name: '도로소통' })).toBeInTheDocument()
    expect(screen.getByText('강남대로가 서행하고 있어요.')).toBeInTheDocument()
  })

  // **잎만 테스트하면 탭에 안 걸려 있어도 초록이다.** 이 저장소에서 여러 번
  // 겪은 자리라 배선을 함께 잠근다.
  it('교통 탭이 도로 구간을 절로 그린다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        roadSegments: [
          makeRoadSegment({
            linkId: '1220019401',
            roadName: '역삼로',
            startName: '역삼동 858-14',
            endName: '역삼초등학교',
            meters: 68,
            speed: 9,
            index: '정체',
          }),
        ],
      }),
    )
    renderDetail()
    await openTab('교통')

    expect(screen.getByRole('heading', { name: '주요 도로 상황' })).toBeInTheDocument()
    expect(screen.getByText('역삼로')).toBeInTheDocument()
    expect(screen.getByText('9km/h')).toBeInTheDocument()
  })

  // 요약(평균)과 구간은 다른 질문의 답이라 절을 나눴다. 한 절에 넣으면 평균
  // 속도 바로 아래 구간별 속도가 붙어 두 숫자가 서로 다툰다.
  it('도로 구간만 있어도 교통 탭이 열린다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        roadSegments: [makeRoadSegment({ linkId: 'a', roadName: '역삼로', index: '정체' })],
      }),
    )
    renderDetail()
    await openTab('교통')

    expect(screen.queryByText(/교통 정보가 없어요/)).toBeNull()
    expect(screen.getByText('역삼로')).toBeInTheDocument()
  })

  // 도로 구간의 「지도에서 보기」는 점이 아니라 **선**을 넘긴다.
  it('도로 구간을 지도로 보낼 때 선을 함께 넘긴다', async () => {
    const onShowOnMap = vi.fn()
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        roadSegments: [
          makeRoadSegment({
            linkId: 'a',
            roadName: '역삼로',
            index: '정체',
            path: [
              { lat: 37.4936, lng: 127.0316 },
              { lat: 37.4933, lng: 127.0309 },
            ],
            startCoords: { lat: 37.4933, lng: 127.0309 },
            endCoords: { lat: 37.4936, lng: 127.0316 },
          }),
        ],
      }),
    )
    render(
      <AreaDetailScreen
        areaName="강남역"
        onBack={() => undefined}
        onSelectArea={() => undefined}
        onShowOnMap={onShowOnMap}
      />,
    )
    await openTab('교통')
    await userEvent.click(screen.getByRole('button', { name: '역삼로 지도에서 보기' }))

    expect(onShowOnMap.mock.calls[0][0].path).toHaveLength(2)
  })

  // 도로소통과 사고통제는 같은 질문의 답이다 — 「지금 차로 갈 만한가」.
  // 2026-08-25에 통제가 절 안에서 **배너로** 나왔다(시안 `_4`) — 평균 속도가
  // 없는 명소에서도 통제는 떠야 하고, 그때 「도로소통」 절만 찾으면 안 뜬다.
  it('사고통제만 있어도 배너가 뜬다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        accidents: [
          makeAccident({
              info: '강남대로 1개 차로 통제',
              type: '교통사고',
              detailType: '',
              occurredAt: '2026-08-07 08:40',
              expectedClearAt: '2026-08-07 10:00',
            }),
        ],
      }),
    )
    renderDetail()
    await openTab('교통')
    expect(screen.getByRole('heading', { name: '차량 통제 알림' })).toBeInTheDocument()
    expect(screen.getByText('강남대로 1개 차로 통제')).toBeInTheDocument()
    // 평균 속도가 없으므로 「도로소통」 절은 아예 없다 — 빈 절을 세우면
    // 제목만 있고 아래가 빈 카드가 남는다.
    expect(screen.queryByRole('heading', { name: '도로소통' })).toBeNull()
  })

  it('지하철 도착은 언제 기준인지 같이 적는다', async () => {
    // 「4분 후 도착」은 상대 시각이라 캐시를 견디지 못한다. 도시정보를 3시간
    // 캐시로 받기로 한 이상(쿼터), 기준을 안 적으면 3시간 전 열차를 지금 오는
    // 것처럼 보여주게 된다.
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        subway: [
          {
            station: '강남',
            line: '2호선',
            direction: '외선',
            terminal: '성수',
            message: '4분 20초 후 (역삼)',
          },
        ],
      }),
    )
    renderDetail()
    await openTab('교통')

    const section = screen
      .getByRole('heading', { name: '지하철 도착' })
      .closest('section') as HTMLElement
    expect(within(section).getByText(/최대 3시간 전 기준/)).toBeInTheDocument()
  })

  // 도로 정보가 하나도 없으면 제목만 있는 빈 절이 남으면 안 된다.
  it('교통 정보가 없으면 그 사실을 말한다', async () => {
    renderDetail()
    await openTab('교통')
    expect(screen.queryByRole('heading', { name: '도로소통' })).not.toBeInTheDocument()
    expect(
      screen.getByText('이 명소에는 지금 제공되는 교통 정보가 없어요.'),
    ).toBeInTheDocument()
  })
})

describe('AreaDetailScreen — 주변 탭', () => {
  it('좌표가 있는 주차장·따릉이는 지도에서 볼 수 있다', async () => {
    // **서울 인파레이더가 그렇게 한다** — 줄 오른쪽 아이콘을 누르면 지도가
    // 그 자리로 간다. 이름만으로는 「1번 대여소」가 어느 쪽인지 알 수 없다.
    const onShowOnMap = vi.fn()
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        bikes: [
          makeBikeStation({ name: '광화문역 5번출구', coords: { lat: 37.5698, lng: 126.9775 }, bikes: 6, racks: 21 }),
        ],
      }),
    )
    render(
      <AreaDetailScreen
        areaName="강남역"
        onBack={() => undefined}
        onSelectArea={() => undefined}
        onShowOnMap={onShowOnMap}
      />,
    )
    await openTab('주변')

    // 아이콘만 있는 버튼이라 이름이 붙어야 한다. 「지도에서 보기」만 적으면
    // 한 화면에 같은 이름의 버튼이 열 개가 되어 구별되지 않는다.
    await userEvent.click(
      screen.getByRole('button', { name: '광화문역 5번출구 지도에서 보기' }),
    )

    expect(onShowOnMap).toHaveBeenCalledWith({
      name: '광화문역 5번출구',
      coords: { lat: 37.5698, lng: 126.9775 },
    })
  })

  it('좌표가 없으면 지도 버튼을 만들지 않는다', async () => {
    // 실응답에도 LAT/LNG가 빈 문자열로 오는 주차장이 있다. 눌러도 아무 일이
    // 안 일어나는 버튼은 고장으로 보인다.
    useCityInfo.mockReturnValue(
      ok({ ...EMPTY_CITY_INFO, parking: [{ ...PARKING_LOT, name: '좌표없음' }] }),
    )
    renderDetail()
    await openTab('주변')
    expect(screen.queryByRole('button', { name: /지도에서 보기/ })).not.toBeInTheDocument()
  })

  it('따릉이·주차장에 명소에서의 거리를 적는다', async () => {
    // 샘플(서울 인파레이더)의 「광화문역 5번출구 120m 19대」다. 이름만 있으면
    // 「5번출구」가 걸어갈 만한 거리인지 알 수 없다.
    //
    // **기준점은 사용자 위치가 아니라 명소 중심이다.** 상세는 지금 있는 곳이
    // 아니라 가려는 곳을 보는 화면이라, 부산에서 강남역을 열어도 뜻이 있어야
    // 한다. 아래는 카탈로그 좌표에서 북쪽 약 220m다.
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        bikes: [
          makeBikeStation({ name: '가까운 대여소', coords: { lat: GANGNAM.lat + 0.00198, lng: GANGNAM.lng }, bikes: 6, racks: 21 }),
        ],
      }),
    )
    renderDetail()
    await openTab('주변')
    expect(screen.getByText(/220m/)).toBeInTheDocument()
  })

  it('둘 다 없으면 그 사실을 말한다', async () => {
    renderDetail()
    await openTab('주변')
    expect(screen.getByText('주변 주차장·따릉이 정보가 없어요.')).toBeInTheDocument()
  })
})

describe('AreaDetailScreen — 날씨·행사·안전 탭', () => {
  it('날씨 탭이 기온과 대기질을 보여준다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        weather: makeWeather({
          temperature: 27,
          maxTemperature: 30,
          minTemperature: 23,
          precipitationMessage: '비 소식은 없어요.',
          pm10: 42,
          pm10Grade: '보통',
          pm25: 18,
          pm25Grade: '좋음',
          airGrade: '좋음',
        }),
      }),
    )
    renderDetail()
    await openTab('날씨')
    expect(screen.getByText('27.0°')).toBeInTheDocument()
    expect(screen.getByText('비 소식은 없어요.')).toBeInTheDocument()
  })

  // **배선을 여기서 잡는다.** `WeatherStats`·`WeatherWarningBanner`는 각자
  // 테스트가 있는데, 2026-08-25 변이 실험에서 **둘을 탭에서 통째로 떼어 내도
  // 스위트가 통과했다** — 잎만 시험하고 붙였는지는 아무도 안 봤다.
  it('날씨 탭이 습도·바람·자외선 격자를 함께 보여준다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        weather: makeWeather({
          temperature: 27,
          humidity: 70,
          windDirection: 'SSE',
          windSpeed: 2.8,
          uvIndex: 7,
          uvGrade: '높음',
          sunrise: '05:43',
          sunset: '19:31',
          airIndexValue: 33,
        }),
      }),
    )
    renderDetail()
    await openTab('날씨')
    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.getByText('2.8m/s')).toBeInTheDocument()
    expect(screen.getByText('05:43 · 19:31')).toBeInTheDocument()
    expect(screen.getByText('통합대기지수 33')).toBeInTheDocument()
  })

  it('날씨 탭이 기상특보를 배너로 이고 있다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        weather: makeWeather({
          temperature: 33,
          warnings: [
            {
              kind: '폭염',
              level: '주의보',
              announcedAt: '2026-08-23 11:00',
              command: '발표',
              cancelState: '정상',
              message: '야외활동은 최대한 자제해주세요.',
            },
          ],
        }),
      }),
    )
    renderDetail()
    await openTab('날씨')
    expect(screen.getByRole('alert')).toHaveTextContent('폭염 주의보')
  })

  // 기상특보(기상청)와 재난문자(행정안전부)는 **다른 출처이고 다른 탭**이다.
  /**
   * **배선을 여기서 잡는다.** `AccidentList`가 거리를 그리는 것은 제 테스트가
   * 보지만, **안전 탭이 명소 좌표를 실제로 넘기는지**는 아무도 안 봤다 —
   * 2026-08-25 변이 실험에서 `origin={null}`로 바꿔도 스위트가 통과했다.
   * 기준점은 명소 중심이지 내 위치가 아니다(`facilityDistance.ts`).
   */
  it('안전 탭이 통제 지점까지의 거리를 적는다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        accidents: [
          makeAccident({
            info: '강남대로 1개 차로 통제',
            // 강남역(37.498856, 127.02814)에서 북쪽으로 대략 500m.
            coords: { lat: 37.503356, lng: 127.02814 },
          }),
        ],
      }),
    )
    renderDetail()
    await openTab('안전')

    expect(screen.getByText(/500m/)).toBeInTheDocument()
  })

  // 특보가 안전 탭으로 새거나 재난문자가 날씨 탭에 뜨면 사용자는 둘을 같은
  // 것으로 읽고, 하나가 비었을 때 「알림이 없다」고 잘못 판단한다.
  it('기상특보는 날씨 탭에만 있고 재난문자는 안전 탭에만 있다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        weather: makeWeather({
          temperature: 33,
          warnings: [
            {
              kind: '폭염',
              level: '주의보',
              announcedAt: '',
              command: '발표',
              cancelState: '정상',
              message: '',
            },
          ],
        }),
        alerts: [
          { category: '호우', step: '경보', message: '하천 접근 금지', createdAt: '' },
        ],
      }),
    )
    renderDetail()

    await openTab('날씨')
    expect(screen.getByText('폭염 주의보')).toBeInTheDocument()
    expect(screen.queryByText('호우 경보')).not.toBeInTheDocument()

    await openTab('안전')
    expect(screen.getByText('호우 경보')).toBeInTheDocument()
    expect(screen.queryByText('폭염 주의보')).not.toBeInTheDocument()
  })

  it('행사 탭이 문화행사를 보여준다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        events: [
          makeCulturalEvent({
            name: '서울 야외도서관',
            period: '8.20~8.24',
            place: '광화문광장',
            free: true,
            url: '',
            thumbnail: 'https://culture.seoul.go.kr/cmmn/file/1',
            coords: { lat: 37.5715, lng: 126.9769 },
          }),
        ],
      }),
    )
    const { container } = renderDetail()
    await openTab('행사')
    expect(screen.getByText('서울 야외도서관')).toBeInTheDocument()
    // **잎만 테스트하면 탭에 안 걸려 있어도 초록이다.** 이 저장소에서 세 번
    // 겪은 자리라 배선을 함께 잠근다 — 그림과 지도 버튼이 탭 안에 있어야 한다.
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://culture.seoul.go.kr/cmmn/file/1',
    )
    expect(screen.getByRole('button', { name: /지도에서 보기/ })).toBeInTheDocument()
  })

  // **탭 안의 버튼이 화면 밖의 지도로 이어지는지까지 본다.** 잎 테스트는
  // 콜백이 불리는 것만 보므로, 패널이 콜백을 안 넘겨도 초록이다.
  it('행사 탭의 지도 버튼이 지도를 그 자리로 옮긴다', async () => {
    const onShowOnMap = vi.fn()
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        events: [
          makeCulturalEvent({
            name: '서울 야외도서관',
            coords: { lat: 37.5715, lng: 126.9769 },
          }),
        ],
      }),
    )
    render(
      <AreaDetailScreen
        areaName="강남역"
        onBack={() => undefined}
        onSelectArea={() => undefined}
        onShowOnMap={onShowOnMap}
      />,
    )
    await openTab('행사')
    await userEvent.click(
      screen.getByRole('button', { name: '서울 야외도서관 지도에서 보기' }),
    )

    expect(onShowOnMap).toHaveBeenCalledWith({
      name: '서울 야외도서관',
      coords: { lat: 37.5715, lng: 126.9769 },
    })
  })

  it('안전 탭이 재난문자와 사고통제를 함께 놓는다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        alerts: [
          {
            category: '호우',
            step: '경보',
            message: '침수 위험 지역 접근을 삼가세요.',
            createdAt: '2026-08-07 10:00',
          },
        ],
        accidents: [
          makeAccident({
              info: '강남대로 1개 차로 통제',
              type: '교통사고',
              detailType: '',
              occurredAt: '2026-08-07 08:40',
              expectedClearAt: '2026-08-07 10:00',
            }),
        ],
      }),
    )
    renderDetail()
    await openTab('안전')
    expect(screen.getByRole('alert')).toHaveTextContent('침수 위험')
    expect(screen.getByRole('heading', { name: '사고·통제' })).toBeInTheDocument()
  })

  // **`ACDNT_TIME`은 건이 아니라 절의 값이다** — 실호출에서 같은 명소의 두 건이
  // 같은 시각이었다. 줄마다 적으면 같은 시각이 목록 길이만큼 반복된다.
  it('사고·통제 절이 언제 기준인지 한 번만 적는다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        accidents: [
          makeAccident({ info: '강남대로 1개 차로 통제' }),
          makeAccident({ info: '테헤란로 갓길 통제' }),
        ],
        accidentsUpdatedAt: '2026-08-07 11:01',
      }),
    )
    renderDetail()
    await openTab('안전')

    expect(screen.getAllByText('기준 2026-08-07 11:01')).toHaveLength(1)
  })

  it('갱신 시각이 없으면 그 줄을 만들지 않는다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        accidents: [makeAccident({ info: '강남대로 1개 차로 통제' })],
      }),
    )
    renderDetail()
    await openTab('안전')

    expect(screen.queryByText(/^기준 /)).toBeNull()
  })

  // 안전 탭의 사고통제도 지도로 이어져야 한다. 교통 탭과 배선이 따로라
  // 한쪽만 넘기는 실수가 난다.
  it('안전 탭의 사고통제도 지도로 보낸다', async () => {
    const onShowOnMap = vi.fn()
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        accidents: [
          makeAccident({
            info: '강남대로 1개 차로 통제',
            coords: { lat: 37.4979, lng: 127.0276 },
          }),
        ],
      }),
    )
    render(
      <AreaDetailScreen
        areaName="강남역"
        onBack={() => undefined}
        onSelectArea={() => undefined}
        onShowOnMap={onShowOnMap}
      />,
    )
    await openTab('안전')
    await userEvent.click(
      screen.getByRole('button', { name: '강남대로 1개 차로 통제 지도에서 보기' }),
    )

    expect(onShowOnMap).toHaveBeenCalledWith({
      name: '강남대로 1개 차로 통제',
      coords: { lat: 37.4979, lng: 127.0276 },
    })
  })

  it('전할 소식이 없으면 안전 탭이 그렇게 말한다', async () => {
    renderDetail()
    await openTab('안전')
    expect(
      screen.getByText('지금 이 근처에 전해진 사고·재난 소식이 없어요.'),
    ).toBeInTheDocument()
  })
})

// 도시정보는 하루 1,000회 한도 때문에 프록시가 최대 3시간 캐시한다. 그래서
// 「잔여 568면」이 한참 전 값일 수 있는데, 예전에는 세 절이 **방금 받은
// 값에도** 「최대 3시간 전 기준이에요」라고 적었다 — 절반은 거짓말이었다.
describe('AreaDetailScreen — 값이 언제 기준인지', () => {
  const RECEIVED_AT = Date.parse('2026-08-18T09:00:00Z')

  async function renderWithAge(freshness: CityInfo['freshness'], nowOffsetMs = 0) {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(RECEIVED_AT + nowOffsetMs)
    useCityInfo.mockReturnValue(
      ok({ ...EMPTY_CITY_INFO, parking: [PARKING_LOT], freshness }),
    )
    renderDetail()
    await openTab('주변')
  }

  /** 주차장 절의 안내 문구. 여러 절이 같은 문구를 쓰므로 하나로 대표한다. */
  function parkingNote(): string {
    const section = screen
      .getByRole('heading', { name: '주차장' })
      .closest('section') as HTMLElement
    return within(section).getByText(/값이에요|기준이에요/).textContent ?? ''
  }

  it('방금 받았으면 방금이라고 적는다', async () => {
    await renderWithAge({ ageSeconds: 0, receivedAt: RECEIVED_AT })
    expect(parkingNote()).toBe('방금 받은 값이에요')
  })

  it('묵었으면 몇 분 전인지 적는다', async () => {
    await renderWithAge({ ageSeconds: 12 * 60, receivedAt: RECEIVED_AT })
    expect(parkingNote()).toBe('12분 전 값이에요')
  })

  it('받아 둔 채로 흐른 시간도 함께 센다', async () => {
    // `staleTime`이 30분이라 응답이 캐시에 그만큼 더 앉아 있을 수 있다.
    await renderWithAge(
      { ageSeconds: 12 * 60, receivedAt: RECEIVED_AT },
      30 * 60 * 1_000,
    )
    expect(parkingNote()).toBe('42분 전 값이에요')
  })

  it('한 시간이 넘으면 시간으로 적는다', async () => {
    await renderWithAge({ ageSeconds: 2 * 3_600 + 300, receivedAt: RECEIVED_AT })
    expect(parkingNote()).toBe('2시간 전 값이에요')
  })

  // **모를 때가 문제의 핵심이다.** 프록시가 `Age`를 CORS로 열어 주기 전이거나
  // CDN을 안 거친 응답이면 나이를 알 수 없는데, 그때 「방금」이라 적으면 최대
  // 3시간 묵은 값이 갓 받은 값으로 둔갑해 **고치기 전보다 나빠진다.**
  it('나이를 모르면 예전처럼 뭉뚱그려 말한다', async () => {
    await renderWithAge(null)
    expect(parkingNote()).toBe('잔여 면수는 최대 3시간 전 기준이에요')
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})

describe('AreaDetailScreen — 요약 탭의 나머지', () => {
  // 혼잡도 숫자를 보고 나서 가장 먼저 묻는 것이 「그래서 지금 어떤데」이고,
  // 영상이 그 질문에 유일하게 직접 답한다 — 도메인 탭으로 내리지 않은 이유다.
  it('실시간 영상이 요약 탭에 있다', () => {
    renderDetail()
    expect(screen.getByRole('heading', { name: '주변 CCTV' })).toBeInTheDocument()
  })

  // 「근처 쾌적한 장소」는 좌표와 캐시가 둘 다 있어야 열린다. 기본 픽스처는
  // 좌표가 없어 이 가지에 닿지 않으므로 여기서만 채운다.
  it('근처 쾌적한 장소는 지금 보는 곳을 빼고 두 곳까지 보여준다', async () => {
    const { AREA_NAMES } = await import('../../data/areas')
    standAt({ lat: 37.5796, lng: 126.977 })
    useAreaCongestion.mockReturnValue(
      ok<readonly AreaCongestion[]>(
        AREA_NAMES.map((name) => ({ name, congestion: '여유' as const })),
      ),
    )

    renderDetail('경복궁')

    const section = screen
      .getByRole('heading', { name: '근처 쾌적한 장소' })
      .closest('section') as HTMLElement
    const rows = within(section).getAllByRole('button')
    expect(rows).toHaveLength(2)
    // 지금 보고 있는 곳이 "다른 데 가보라"는 추천에 끼면 안 된다.
    expect(within(section).queryByRole('button', { name: /경복궁/ })).toBeNull()
  })

  // 제목으로 훑는 사용자를 위한 뼈대다. 상단 바가 h2를 갖고 그 아래가 전부
  // h3다 — 층을 건너뛰면 목차가 어긋난다.
  it('제목이 h2 아래로 층을 이룬다', () => {
    renderDetail()
    expect(
      screen.getAllByRole('heading').map((node) => `${node.tagName} ${node.textContent}`),
    ).toEqual(['H2 강남역', 'H3 지금은 약간 붐벼요', 'H3 주변 CCTV'])
  })
})

// **배선을 여기서 잡는다.** 2026-08-25에 날씨 절 둘을 탭에서 통째로 떼어 내도
// 스위트가 통과한 일이 있었다 — 잎 컴포넌트마다 테스트가 있어도 「붙였는가」는
// 아무도 안 본다. 승하차·정류소도 같은 모양이라 같은 그물을 친다.
describe('AreaDetailScreen — 교통 탭의 승하차와 정류소', () => {
  const BUSY = {
    boardingMin: 550,
    boardingMax: 600,
    alightingMin: 900,
    alightingMax: 950,
  }
  const EMPTY_WINDOW = {
    boardingMin: null,
    boardingMax: null,
    alightingMin: null,
    alightingMax: null,
  }

  function ridership(overrides = {}) {
    return {
      total: EMPTY_WINDOW,
      last30Minutes: EMPTY_WINDOW,
      last10Minutes: BUSY,
      last5Minutes: EMPTY_WINDOW,
      stopCount: 4,
      stopCountAt: '20260825',
      ...overrides,
    }
  }

  it('지하철 절이 승하차 요약을 이고 있다', async () => {
    useCityInfo.mockReturnValue(
      ok({ ...EMPTY_CITY_INFO, subwayRidership: ridership() }),
    )
    renderDetail()
    await openTab('교통')

    expect(screen.getByText('사람이 모이는 중이에요')).toBeInTheDocument()
    expect(screen.getByText(/승차 550~600명/)).toBeInTheDocument()
  })

  /**
   * **탭이 승강기를 실제로 내려보내는지.** 잇는 규칙은 도메인이 잠그지만, 패널이
   * `subwayFacilities`를 안 넘기면 그 규칙째로 화면에서 사라진다 — 도착 열차는
   * 그대로 뜨므로 눈으로는 아무 일이 없어 보인다. 시안 `_9`의 안전 탭이
   * `origin={null}`을 넘기던 것과 같은 종류의 자리다.
   */
  it('지하철 절이 역 승강기를 함께 보여준다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        subway: [
          {
            station: '광화문',
            line: '5호선',
            direction: '방화행',
            terminal: '방화',
            message: '2분 후',
          },
        ],
        subwayFacilities: [
          {
            station: '광화문',
            line: '5호선',
            facilities: [
              { kind: 'EV', section: 'B2-B4', position: '8번 출입구', status: '사용가능' },
              { kind: 'ES', section: 'B2-B3', position: '5번 출입구', status: '보수중' },
            ],
          },
        ],
      }),
    )
    renderDetail()
    await openTab('교통')

    expect(screen.getByRole('img', { name: '엘리베이터 있음' })).toBeInTheDocument()
    expect(screen.getByText('에스컬레이터 B2-B3')).toBeInTheDocument()
  })

  it('버스 절이 정류소와 승하차를 함께 보여준다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        busRidership: ridership({ stopCount: 41 }),
        busStops: [
          { name: '광화문역', arsId: '1009', id: 'B1', coords: { lat: 37.57, lng: 126.977 } },
        ],
        busResultMessage: '정상 호출되었습니다.',
      }),
    )
    renderDetail()
    await openTab('교통')

    expect(screen.getByText('광화문역')).toBeInTheDocument()
    expect(screen.getByText(/1009번/)).toBeInTheDocument()
    expect(screen.getByText('이 명소 안 41곳 기준')).toBeInTheDocument()
  })

  // 도착 정보가 없는 명소가 실제로 있다(공원류). 그때 승하차만으로도 탭이
  // 서야 한다 — `has`가 승하차를 안 세면 「교통 정보가 없어요」가 뜬다.
  it('열차 도착이 없어도 승하차만으로 탭이 선다', async () => {
    useCityInfo.mockReturnValue(
      ok({ ...EMPTY_CITY_INFO, subway: [], subwayRidership: ridership() }),
    )
    renderDetail()
    await openTab('교통')

    expect(
      screen.queryByText('이 명소에는 지금 제공되는 교통 정보가 없어요.'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('사람이 모이는 중이에요')).toBeInTheDocument()
  })

  // 「이 근처에 정류소가 없다」와 「버스 쪽 호출이 실패했다」는 다른 안내인데
  // 빈 목록만 보면 구분이 안 된다.
  it('정류소가 비었을 때만 실패 메시지를 적는다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        busRidership: ridership(),
        busStops: [],
        busResultMessage: '서비스 점검 중입니다.',
      }),
    )
    renderDetail()
    await openTab('교통')

    expect(screen.getByText('서비스 점검 중입니다.')).toBeInTheDocument()
  })

  it('성공 메시지는 화면에 안 나온다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        busRidership: ridership(),
        busStops: [],
        busResultMessage: '정상 호출되었습니다.',
      }),
    )
    renderDetail()
    await openTab('교통')

    expect(screen.queryByText('정상 호출되었습니다.')).not.toBeInTheDocument()
  })
})

// 시안(stitch_ui_ux/_2)의 탭 줄에 처음부터 있었는데 `LIVE_CMRCL_STTS`를 안
// 읽고 있어 자리가 비어 있던 탭이다. 배선을 여기서 잡는다.
describe('AreaDetailScreen — 상권 탭', () => {
  const COMMERCE = {
    level: '바쁜',
    paymentCount: 168,
    paymentMin: 390_000_000,
    paymentMax: 400_000_000,
    categories: [
      {
        major: '음식·음료',
        minor: '한식',
        level: '바쁜',
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
  }

  it('상권 탭이 줄에 있다', () => {
    renderDetail()
    expect(screen.getByRole('tab', { name: '상권' })).toBeInTheDocument()
  })

  it('상권 탭이 지표와 업종을 보여준다', async () => {
    useCityInfo.mockReturnValue(ok({ ...EMPTY_CITY_INFO, commerce: COMMERCE }))
    renderDetail()
    await openTab('상권')

    expect(screen.getByText('지금 이 동네 상권은 바쁜편이에요')).toBeInTheDocument()
    expect(screen.getByText('한식')).toBeInTheDocument()
  })

  // **명소에 따라 통째로 빈다.** 실호출에서 여의도한강공원은 이 섹션이 아예
  // 없었고, 121곳 중 공원류가 서른 곳 넘는다.
  it('상권이 없는 명소에서는 없다고 말한다', async () => {
    useCityInfo.mockReturnValue(ok({ ...EMPTY_CITY_INFO, commerce: null }))
    renderDetail()
    await openTab('상권')

    expect(screen.getByText('이 명소에는 상권 정보가 없어요.')).toBeInTheDocument()
  })
})

// 시안에 충전소 화면이 없어 「주변」 탭의 셋째 절로 넣었다. 배선을 여기서 잡는다 —
// 잎 컴포넌트마다 테스트가 있어도 「붙였는가」는 아무도 안 본다(2026-08-25에
// 날씨 절 둘이 그 상태였다).
describe('AreaDetailScreen — 전기차 충전 절', () => {
  const STATION = {
    name: 'NIA빌딩',
    id: 'HM110247',
    address: '서울특별시 중구 청계천로 14',
    coords: { lat: 37.5687892, lng: 126.9788175 },
    useTime: '24시간 이용가능',
    parkingPaid: true,
    limited: false,
    limitDetail: '',
    kind: '기타',
    chargers: [
      {
        id: '02',
        type: 'AC완속',
        status: '사용가능',
        outputKw: 7,
        method: '단독',
        statusAt: '2026-08-25 08:56',
        lastStartAt: '',
        lastEndAt: '',
        chargingSince: '',
      },
    ],
  }

  it('주변 탭이 충전소를 보여준다', async () => {
    useCityInfo.mockReturnValue(ok({ ...EMPTY_CITY_INFO, chargers: [STATION] }))
    renderDetail()
    await openTab('주변')

    expect(screen.getByText('NIA빌딩')).toBeInTheDocument()
    expect(screen.getByText('1대 가능')).toBeInTheDocument()
  })

  // **주차장·따릉이와 다르다.** 저 둘은 「없다」는 사실 자체가 답이지만
  // 충전소는 전기차를 모는 사람만 묻는다 — 없는 곳에 빈 절을 세우면 나머지
  // 사용자에게는 잡음이다.
  it('충전소가 없으면 절 자체가 안 생긴다', async () => {
    useCityInfo.mockReturnValue(
      ok({ ...EMPTY_CITY_INFO, chargers: [], parking: [PARKING_LOT] }),
    )
    renderDetail()
    await openTab('주변')

    expect(screen.getByRole('heading', { name: '주차장' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /전기차/ })).not.toBeInTheDocument()
  })

  // 충전소만 있고 주차장·따릉이가 없는 명소가 있을 수 있다. `has`가 충전소를
  // 안 세면 「주변 정보가 없어요」를 띄우면서 그 아래로 충전 절을 그린다.
  it('충전소만 있어도 탭이 선다', async () => {
    useCityInfo.mockReturnValue(
      ok({ ...EMPTY_CITY_INFO, chargers: [STATION], parking: [], bikes: [] }),
    )
    renderDetail()
    await openTab('주변')

    expect(screen.queryByText('주변 주차장·따릉이 정보가 없어요.')).not.toBeInTheDocument()
    expect(screen.getByText('NIA빌딩')).toBeInTheDocument()
  })
})
