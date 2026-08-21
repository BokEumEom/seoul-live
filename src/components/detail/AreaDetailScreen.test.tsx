import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UseQueryResult } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CityInfo } from '../../domain/cityInfo'
import { DETAIL_TABS } from '../../domain/detailTabs'
import type { AreaCongestion, AreaSnapshot } from '../../domain/types'
import { reset } from '../../hooks/favoritesStore'
import { findAreaByName } from '../../data/areas'
import { AreaDetailScreen } from './AreaDetailScreen'

vi.mock('../../data/queries', () => ({
  useAreaSnapshot: vi.fn(),
  useAreaCongestion: vi.fn(),
  useCityInfo: vi.fn(),
  // CCTV는 이 파일이 볼 것이 아니다(CctvSection.test.tsx의 몫). 다만 목록을
  // 안 주면 조회 중으로 남아 절이 안 그려지므로, 여기서는 「없는 명소」로 둔다 —
  // 121곳 중 상당수가 실제로 그 상태다.
  useCctv: vi.fn(() => ({ data: [], isPending: false, isError: false })),
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
  composition: {
    maleRate: 48,
    femaleRate: 52,
    nonResidentRate: 71,
    ageRates: [3, 8, 31, 22, 14, 11, 6, 4],
  },
  replaced: null,
}

const EMPTY_CITY_INFO: CityInfo = {
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
}

const PARKING_LOT = {
  name: '주차장',
  coords: null,
  capacity: 100,
  available: 45,
  liveAvailable: true,
  paid: null,
} as const

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
        events: [{ name: '행사', period: '', place: '', free: null, url: '' }],
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
          { name: '가', coords: null, bikes: 6, racks: 21 },
          { name: '나', coords: null, bikes: 12, racks: 20 },
        ],
      }),
    )
    renderDetail()
    expect(within(summaryCard(/따릉이/)).getByText('18대')).toBeInTheDocument()
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
    expect(screen.getByRole('heading', { name: '지금 누가 있나' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '시간대별 인파' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '요일×시간 패턴' })).toBeInTheDocument()
  })

  it('인구 구성이 시간대별 인파보다 위에 있다', async () => {
    renderDetail()
    await openTab('인구')
    const who = screen.getByRole('heading', { name: '지금 누가 있나' })
    expect(before(who, screen.getByRole('heading', { name: '시간대별 인파' }))).toBe(
      true,
    )
  })

  // 순서만 보면 인구 구성을 현재 상태 카드 밖으로 빼 독립 섹션으로 만드는
  // 되돌림이 초록불로 통과한다. 그러면 테두리·패딩이 이중이 된다.
  //
  // `closest('section')`끼리 비교하면 안 된다 — PopulationCard 자신이 <section>이라
  // 올바른 구현에서도 둘이 갈린다. 카드가 그것을 품고 있는지를 본다.
  it('인구 구성이 현재 상태 카드 안에 있다', async () => {
    renderDetail()
    await openTab('인구')
    const who = screen.getByRole('heading', { name: '지금 누가 있나' })
    const card = screen
      .getByRole('heading', { name: '지금 얼마나 붐비나' })
      .closest('section')
    expect(card?.contains(who)).toBe(true)
  })

  it('인구 구성이 없으면 그 절만 빠진다', async () => {
    useAreaSnapshot.mockReturnValue(ok({ ...SNAPSHOT, composition: null }))
    renderDetail()
    await openTab('인구')
    expect(screen.queryByRole('heading', { name: '지금 누가 있나' })).toBeNull()
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

  // 도로소통과 사고통제는 같은 질문의 답이다 — 「지금 차로 갈 만한가」.
  it('사고통제만 있어도 절이 뜬다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        accidents: [
          {
            info: '강남대로 1개 차로 통제',
            type: '교통사고',
            detailType: '',
            occurredAt: '2026-08-07 08:40',
            expectedClearAt: '2026-08-07 10:00',
          },
        ],
      }),
    )
    renderDetail()
    await openTab('교통')
    expect(screen.getByRole('heading', { name: '도로소통' })).toBeInTheDocument()
    expect(screen.getByText('강남대로 1개 차로 통제')).toBeInTheDocument()
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
          {
            name: '광화문역 5번출구',
            coords: { lat: 37.5698, lng: 126.9775 },
            bikes: 6,
            racks: 21,
          },
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
          {
            name: '가까운 대여소',
            coords: { lat: GANGNAM.lat + 0.00198, lng: GANGNAM.lng },
            bikes: 6,
            racks: 21,
          },
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
        weather: {
          temperature: 27,
          maxTemperature: 30,
          minTemperature: 23,
          hourly: [],
          precipitationMessage: '비 소식은 없어요.',
          pm10: 42,
          pm10Grade: '보통',
          pm25: 18,
          pm25Grade: '좋음',
          airGrade: '좋음',
          airMessage: '',
          updatedAt: '',
        },
      }),
    )
    renderDetail()
    await openTab('날씨')
    expect(screen.getByText('27.0°')).toBeInTheDocument()
    expect(screen.getByText('비 소식은 없어요.')).toBeInTheDocument()
  })

  it('행사 탭이 문화행사를 보여준다', async () => {
    useCityInfo.mockReturnValue(
      ok({
        ...EMPTY_CITY_INFO,
        events: [
          { name: '서울 야외도서관', period: '8.20~8.24', place: '광화문광장', free: true, url: '' },
        ],
      }),
    )
    renderDetail()
    await openTab('행사')
    expect(screen.getByText('서울 야외도서관')).toBeInTheDocument()
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
          {
            info: '강남대로 1개 차로 통제',
            type: '교통사고',
            detailType: '',
            occurredAt: '2026-08-07 08:40',
            expectedClearAt: '2026-08-07 10:00',
          },
        ],
      }),
    )
    renderDetail()
    await openTab('안전')
    expect(screen.getByRole('alert')).toHaveTextContent('침수 위험')
    expect(screen.getByRole('heading', { name: '사고·통제' })).toBeInTheDocument()
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
