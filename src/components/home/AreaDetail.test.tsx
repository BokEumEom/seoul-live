import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UseQueryResult } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CityInfo } from '../../domain/cityInfo'
import type { AreaSnapshot } from '../../domain/types'
import { reset } from '../../hooks/favoritesStore'
import { AreaDetail } from './AreaDetail'

vi.mock('../../data/queries', () => ({
  useAreaSnapshot: vi.fn(),
  useAreaSnapshots: vi.fn(),
  useCityInfo: vi.fn(),
}))
vi.mock('../../app/locationContext', () => ({ useLocation: vi.fn() }))
// 요일×시간 패턴의 저장소는 여기서 볼 것이 아니다. 목업하지 않으면 비동기
// 읽기가 테스트가 끝난 뒤 상태를 바꿔 act() 경고가 뜨고, 상세 테스트가
// 토스 Storage 브리지 구현에 묶인다. 쌓기 자체는 useWeekPattern이 잠근다.
vi.mock('../../platform/weekPattern', () => ({
  loadPattern: vi.fn().mockResolvedValue({ pattern: {}, lastObservedAt: null }),
  savePattern: vi.fn().mockResolvedValue(undefined),
}))

const queries = await import('../../data/queries')
const locationContext = await import('../../app/locationContext')
const useAreaSnapshot = vi.mocked(queries.useAreaSnapshot)
const useAreaSnapshots = vi.mocked(queries.useAreaSnapshots)
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
  weather: null,
  roadTraffic: null,
  accidents: [],
  parking: [],
  bikes: [],
  events: [],
  alerts: [],
}

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
  useAreaSnapshots.mockReturnValue(
    ok<readonly (AreaSnapshot | null)[]>([]) as UseQueryResult<
      readonly (AreaSnapshot | null)[]
    >,
  )
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

function renderDetail(areaName = '강남역') {
  return render(
    <AreaDetail areaName={areaName} onBack={() => {}} onSelectArea={() => {}} />,
  )
}

describe('AreaDetail', () => {
  it('명소 이름과 혼잡도를 보여준다', () => {
    renderDetail()
    expect(screen.getByRole('heading', { name: '강남역' })).toBeInTheDocument()
    // 히어로 배지는 API 원문 4단계, 카드 제목은 교통정보 어조의 요약이다.
    expect(screen.getByText('약간 붐빔')).toBeInTheDocument()
    expect(screen.getByText('다소 혼잡')).toBeInTheDocument()
    // 같은 사실을 두 번까지만 말한다. 크기로 한 번 더 말하던 배지를 뺀 근거는
    // CongestionBadge.tsx의 SIZE 주석에 한 벌 있다.
    expect(screen.getAllByText(/약간 붐빔/)).toHaveLength(1)
  })

  // 강남역은 (37.498, 127.0276)이다. 위도로 0.009° 북쪽이면 이 코드가 쓰는
  // 지구 반지름(6,371km)에서 1,000.75m가 나온다 — formatDistance가 10m 단위로
  // 반올림해 "1.0km", walkingMinutes(시속 4km)가 round(15.01)=15분이다.
  it('히어로가 카테고리·거리·도보 시간을 한 줄로 보여준다', () => {
    standAt({ lat: 37.507, lng: 127.0276 })
    renderDetail()
    expect(screen.getByText('역·번화가 · 1.0km · 도보 15분')).toBeInTheDocument()
  })

  // 거리 0은 falsy다. `distanceMeters &&`로 쓰면 명소 위에 서 있을 때 거리와
  // 도보 시간이 통째로 사라진다(AreaListItem이 같은 함정을 주석으로 남겼다).
  // walkingMinutes의 하한 1분도 여기서 함께 잠긴다.
  it('명소 위에 서 있어도 거리와 도보 시간을 지우지 않는다', () => {
    standAt({ lat: 37.498, lng: 127.0276 })
    renderDetail()
    expect(screen.getByText('역·번화가 · 0m · 도보 1분')).toBeInTheDocument()
  })

  // 위도 0.045° 북쪽이면 5,003.8m다 — 도보로 75분. 한 시간을 넘으면 도보
  // 구간만 빠지고 거리는 남는다. 「도보 160분」(홍대입구역 10.7km)은 이 앱을
  // 쓸 이유를 만드는 첫 세 줄의 신뢰를 깎는다.
  it('걸어갈 거리가 아니면 도보 시간을 적지 않는다', () => {
    standAt({ lat: 37.543, lng: 127.0276 })
    renderDetail()
    expect(screen.getByText('역·번화가 · 5.0km')).toBeInTheDocument()
  })

  // 좌표가 없으면 거리 구간만 빠지고 카테고리는 남는다. AreaListItem과 같은
  // 처리다 — 거기는 "거리 · 카테고리", 여기는 "카테고리 · 거리"라 순서만 다르다.
  it('좌표가 없으면 카테고리만 남는다', () => {
    renderDetail()
    expect(screen.getByText('역·번화가')).toBeInTheDocument()
  })

  it('카탈로그에 없는 명소는 조회하지 않는다', () => {
    renderDetail('부산역')
    expect(useAreaSnapshot).toHaveBeenCalledWith(undefined)
    expect(screen.getByText('명소를 찾을 수 없어요.')).toBeInTheDocument()
  })

  it('도시 정보는 접힌 채로 시작하고 조회하지 않는다', () => {
    renderDetail()
    expect(screen.getByRole('button', { name: /이곳의 도시 정보/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    // 접힌 동안은 undefined를 넘겨 useCityInfo의 enabled를 끈다.
    expect(useCityInfo).toHaveBeenCalledWith(undefined)
    expect(useCityInfo).not.toHaveBeenCalledWith('강남역')
  })

  it('펼치면 그때 조회한다', async () => {
    renderDetail()
    await userEvent.click(screen.getByRole('button', { name: /이곳의 도시 정보/ }))
    expect(useCityInfo).toHaveBeenCalledWith('강남역')
    expect(screen.getByRole('button', { name: /이곳의 도시 정보/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('다시 접으면 조회를 끈다', async () => {
    renderDetail()
    const toggleButton = screen.getByRole('button', { name: /이곳의 도시 정보/ })
    await userEvent.click(toggleButton)
    useCityInfo.mockClear()
    await userEvent.click(toggleButton)
    expect(useCityInfo).toHaveBeenCalledWith(undefined)
    expect(useCityInfo).not.toHaveBeenCalledWith('강남역')
  })

  // 파서와 카드가 각각 통과해도 **패널이 둘을 안 부르면** 화면에는 아무것도 안
  // 뜬다. 배선을 따로 잠근다 — 새 섹션을 더할 때 가장 조용히 빠지는 자리다.
  it('펼치면 도로소통 섹션이 뜬다', async () => {
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
    await userEvent.click(screen.getByRole('button', { name: /이곳의 도시 정보/ }))
    expect(screen.getByRole('heading', { name: '도로소통' })).toBeInTheDocument()
    expect(screen.getByText('강남대로가 서행하고 있어요.')).toBeInTheDocument()
  })

  it('사고통제만 있어도 섹션이 뜬다', async () => {
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
    await userEvent.click(screen.getByRole('button', { name: /이곳의 도시 정보/ }))
    expect(screen.getByRole('heading', { name: '도로소통' })).toBeInTheDocument()
    expect(screen.getByText('강남대로 1개 차로 통제')).toBeInTheDocument()
  })

  // 도로 정보가 하나도 없으면 제목만 있는 빈 섹션이 남으면 안 된다. 주차장·
  // 따릉이처럼 「없어요」를 쓰지 않는 이유는, 도로소통은 안 오는 게 흔한
  // 필드라 명소마다 「도로 정보가 없어요」가 상시로 뜨게 되기 때문이다.
  it('도로 정보가 없으면 섹션을 만들지 않는다', async () => {
    renderDetail()
    await userEvent.click(screen.getByRole('button', { name: /이곳의 도시 정보/ }))
    expect(screen.queryByRole('heading', { name: '도로소통' })).not.toBeInTheDocument()
  })

  it('도시 정보가 실패해도 혼잡도는 그대로 남는다', async () => {
    useCityInfo.mockReturnValue(failed<CityInfo>())
    renderDetail()
    await userEvent.click(screen.getByRole('button', { name: /이곳의 도시 정보/ }))
    expect(screen.getByText('다소 혼잡')).toBeInTheDocument()
    expect(screen.getByText('도시 정보를 가져오지 못했어요.')).toBeInTheDocument()
  })

  it('혼잡도가 실패해도 도시 정보는 펼칠 수 있다', async () => {
    useAreaSnapshot.mockReturnValue(failed<AreaSnapshot>())
    renderDetail()
    expect(screen.getByText('혼잡도 정보를 가져오지 못했어요.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /이곳의 도시 정보/ }))
    expect(useCityInfo).toHaveBeenCalledWith('강남역')
  })

  // 액션 행은 명소 카탈로그만 있으면 성립한다. 혼잡도 응답 안에 두면 API가
  // 흔들린 날 저장·길찾기·공유가 통째로 사라진다 — 헤더의 별은 그 상황에서도
  // 눌렸으므로, 별을 액션 행으로 옮기면서 잃기 쉬운 자리다.
  it('혼잡도가 실패해도 저장과 길찾기는 남는다', () => {
    useAreaSnapshot.mockReturnValue(failed<AreaSnapshot>())
    renderDetail()
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '카카오맵 길찾기' })).toBeInTheDocument()
  })

  it('뒤로 버튼이 콜백을 부른다', async () => {
    const onBack = vi.fn()
    render(
      <AreaDetail areaName="강남역" onBack={onBack} onSelectArea={() => {}} />,
    )
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  // 루트가 flex flex-col(기본 align-items:stretch)이라 w-fit이 없으면 화면 폭
  // 전체가 뒤로가기 타깃이 된다 — 상세 어디를 눌러도 목록으로 튕긴다.
  //
  // 한계를 알고 쓴다: jsdom에는 레이아웃이 없어 실제 폭을 잴 수 없고 클래스
  // 이름만 본다. 그래서 (1) 같은 결과를 내는 `self-start`로 바꾸면 거짓 실패하고,
  // (2) 부모를 block으로 바꿔 w-fit이 필요 없어져도 거짓 통과한다. 이 테스트가
  // 지키는 건 "폭이 글자만큼이다"가 아니라 "그 결정을 지웠는가"다.
  it('목록으로 버튼이 글자 폭만 차지한다', () => {
    render(<AreaDetail areaName="강남역" onBack={() => {}} onSelectArea={() => {}} />)
    expect(screen.getByRole('button', { name: '목록으로' })).toHaveClass('w-fit')
  })

  // 「근처 쾌적한 장소」는 좌표와 캐시가 둘 다 있어야 열린다. 기본 픽스처는
  // 좌표가 없어 이 가지에 닿지 않으므로 여기서만 채운다.
  it('근처 쾌적한 장소는 지금 보는 곳을 빼고 두 곳까지 보여준다', async () => {
    const { AREA_NAMES } = await import('../../data/areas')
    useLocation.mockReturnValue({
      // 경복궁 좌표. 2km 안에 서촌·북촌한옥마을 등이 들어온다.
      coords: { lat: 37.5796, lng: 126.977 },
      status: 'granted',
      retry: vi.fn(),
    } as unknown as ReturnType<typeof locationContext.useLocation>)
    useAreaSnapshots.mockReturnValue(
      ok<readonly (AreaSnapshot | null)[]>(
        AREA_NAMES.map((name) => ({
          ...SNAPSHOT,
          code: name,
          name,
          congestion: '여유' as const,
        })),
      ) as UseQueryResult<readonly (AreaSnapshot | null)[]>,
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

  // 라벨이 상태를 말하므로 aria-pressed를 겹쳐 쓰지 않는다. 둘 다 쓰면
  // 스크린리더가 "저장됨, 선택됨"처럼 같은 상태를 두 번 읽는다. 헤더의 별은
  // 아이콘뿐이라 aria-pressed가 유일한 상태 단서였지만, 글자를 얻으면서
  // 그 역할이 라벨로 넘어갔다. 토글 자체도 이 테스트가 함께 잠근다.
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

  // 「근처 쾌적한 장소」로 갈아타도 액션 행은 언마운트되지 않는다. key가 없으면
  // 리전에 앞 명소 문구가 남아, 경복궁을 보는데 「강남역 저장됨」이라 적혀 있다.
  it('명소를 갈아타면 저장 알림을 비운다', async () => {
    const { rerender } = renderDetail()
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(screen.getByRole('status')).toHaveTextContent('강남역 저장됨')

    rerender(
      <AreaDetail areaName="경복궁" onBack={() => {}} onSelectArea={() => {}} />,
    )
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  // 로딩 중에는 배지를 그리지 않는다. null을 넘기면 CongestionBadge가
  // 「정보 없음」을 띄우는데, 아직 안 왔을 뿐인 것을 없다고 단정하는 말이다.
  it('혼잡도가 오기 전에는 배지를 그리지 않는다', () => {
    useAreaSnapshot.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    } as UseQueryResult<AreaSnapshot>)
    renderDetail()
    expect(screen.queryByText('정보 없음')).toBeNull()
  })

  // Google Maps의 Directions·Save·Share 자리다. 저장을 공유 아래 한 줄로 더
  // 쌓으면 액션 행이 세 줄이 되어 그만큼 아래가 폴드 밖으로 밀린다(계획서 Step 3).
  it('저장이 공유와 같은 줄에 같은 기하로 선다', () => {
    renderDetail()
    const save = screen.getByRole('button', { name: '저장' })
    const share = screen.getByRole('button', { name: '공유하기' })
    expect(save.parentElement).toBe(share.parentElement)
    // 한 줄에 나란히 서는 버튼의 높이·반경·간격이 갈리면 줄이 어긋난다.
    for (const geometry of ['min-h-12', 'flex-1', 'gap-1.5', 'rounded-action']) {
      expect(save).toHaveClass(geometry)
      expect(share).toHaveClass(geometry)
    }
  })

  // 제목으로 훑는 사용자를 위한 뼈대다. 현재 상태 카드에는 보이는 제목이
  // 없어서(「다소 혼잡」은 display-lg 문단이다) 제목만 따라가면 혼잡도·추정
  // 인구·여유 예상이 어느 제목에도 안 속한 채 남았다. sr-only 제목으로 메우고
  // 그 안의 인구 구성은 한 단 낮춘다.
  it('제목이 h2 아래로 층을 이룬다', () => {
    renderDetail()
    expect(
      screen.getAllByRole('heading').map((node) => `${node.tagName} ${node.textContent}`),
    ).toEqual([
      'H2 강남역',
      'H3 지금 얼마나 붐비나',
      'H4 지금 누가 있나',
      'H3 시간대별 예상',
      'H3 요일×시간 패턴',
    ])
  })

  it('예측 섹션 제목이 시간대별 예상이다', () => {
    renderDetail()
    expect(screen.getByRole('heading', { name: '시간대별 예상' })).toBeInTheDocument()
  })

  it('인구 구성이 있으면 보여준다', () => {
    renderDetail()
    expect(screen.getByRole('heading', { name: '지금 누가 있나' })).toBeInTheDocument()
    expect(screen.getByText('외지인이 많아요')).toBeInTheDocument()
    // ForecastChart도 role="img"라 이름 없이 찾으면 둘이 겹친다.
    expect(screen.getByRole('img', { name: /연령대 비율/ })).toBeInTheDocument()
  })

  it('인구 구성이 없으면 그 섹션만 빠지고 혼잡도는 남는다', () => {
    useAreaSnapshot.mockReturnValue(ok({ ...SNAPSHOT, composition: null }))
    renderDetail()
    expect(screen.queryByRole('heading', { name: '지금 누가 있나' })).toBeNull()
    expect(screen.getByText('다소 혼잡')).toBeInTheDocument()
  })

  // 아래 셋은 폴드 예산 결정을 잠근다. 근거와 실측표는 계획서 Task 8
  // (「Task 7 리뷰에서 이월된 것 둘」과 Step 3·6의 정정 블록)에 한 벌만 있다 —
  // 숫자를 여기 옮겨 적으면 한쪽만 고쳐져 거짓말이 된다.
  it('액션 행이 현재 상태 카드보다 위에 있다', () => {
    renderDetail()
    const save = screen.getByRole('button', { name: '저장' })
    const population = screen.getByText(/추정 인구/)
    expect(before(save, population)).toBe(true)
    // 히어로 다음이지 헤더 앞이 아니다.
    expect(before(screen.getByRole('heading', { name: '강남역' }), save)).toBe(true)
  })

  it('인구 구성이 시간대별 예상보다 위에 있다', () => {
    renderDetail()
    const who = screen.getByRole('heading', { name: '지금 누가 있나' })
    expect(before(who, screen.getByRole('heading', { name: '시간대별 예상' }))).toBe(
      true,
    )
  })

  // 순서만 보면 인구 구성을 현재 상태 카드 밖으로 빼 독립 섹션으로 만드는
  // 되돌림이 초록불로 통과한다. 그러면 테두리·패딩이 이중이 되고 세로 예산이
  // 늘어 위 배치를 정당화한 계산이 무효가 된다.
  //
  // `closest('section')`끼리 비교하면 안 된다 — PopulationCard 자신이 <section>이라
  // 올바른 구현에서도 둘이 갈린다. 카드가 그것을 품고 있는지를 본다.
  it('인구 구성이 현재 상태 카드 안에 있다', () => {
    renderDetail()
    const who = screen.getByRole('heading', { name: '지금 누가 있나' })
    const card = screen.getByText(/추정 인구/).closest('section')
    expect(card?.contains(who)).toBe(true)
  })
})
