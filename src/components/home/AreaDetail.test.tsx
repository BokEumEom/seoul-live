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
}

const EMPTY_CITY_INFO: CityInfo = {
  areaName: '강남역',
  areaCode: 'POI014',
  weather: null,
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
    // 같은 사실을 세 번 말하지 않는다. 히어로에 배지를 얹으면서 카드 안의
    // `emphasis` 배지("지금은 약간 붐빔")를 뺐다 — 바로 아래 제목이 이미 같은
    // 말을 다른 어조로 하고, 그 36px이 인구 구성의 폴드 예산으로 간다.
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

  it('저장 버튼이 즐겨찾기를 토글한다', async () => {
    renderDetail()
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByRole('button', { name: '저장됨' })).toBeInTheDocument()
  })

  // 라벨이 상태를 말하므로 aria-pressed를 겹쳐 쓰지 않는다. 둘 다 쓰면
  // 스크린리더가 "저장됨, 선택됨"처럼 같은 상태를 두 번 읽는다. 헤더의 별은
  // 아이콘뿐이라 aria-pressed가 유일한 상태 단서였지만, 글자를 얻으면서
  // 그 역할이 라벨로 넘어갔다.
  it('저장 상태를 라벨로만 말한다', async () => {
    renderDetail()
    const save = screen.getByRole('button', { name: '저장' })
    expect(save).not.toHaveAttribute('aria-pressed')
    await userEvent.click(save)
    expect(await screen.findByRole('button', { name: '저장됨' })).not.toHaveAttribute(
      'aria-pressed',
    )
  })

  // Google Maps의 Directions·Save·Share 자리다. 저장을 공유 아래 한 줄로
  // 더 쌓으면 액션 행이 세 줄(약 168px)이 되어 그만큼 아래가 폴드 밖으로 밀린다.
  it('저장이 공유와 같은 줄에 선다', () => {
    renderDetail()
    const save = screen.getByRole('button', { name: '저장' })
    const share = screen.getByRole('button', { name: '친구에게 공유하기' })
    expect(save.parentElement).toBe(share.parentElement)
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

  // 폴드 결정을 잠근다. 390px 폭 실측에서 예측 섹션은 262px이라, 인구 구성을
  // 그 아래 두면 720~740px급 안드로이드(가용 약 640px)에서 제목만 보이고 막대는
  // 폴드 아래로 나간다. 이 카드가 「인파레이더 대신 쓸 이유」라 위로 올렸다.
  it('인구 구성이 시간대별 예상보다 위에 있다', () => {
    renderDetail()
    const who = screen.getByRole('heading', { name: '지금 누가 있나' })
    const forecast = screen.getByRole('heading', { name: '시간대별 예상' })
    expect(
      who.compareDocumentPosition(forecast) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
