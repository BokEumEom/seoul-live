import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UseQueryResult } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CityInfo } from '../../domain/cityInfo'
import type { AreaSnapshot } from '../../domain/types'
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
  composition: null,
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
  localStorage.clear()
  vi.clearAllMocks()
  useAreaSnapshot.mockReturnValue(ok(SNAPSHOT))
  useAreaSnapshots.mockReturnValue(
    ok<readonly (AreaSnapshot | null)[]>([]) as UseQueryResult<
      readonly (AreaSnapshot | null)[]
    >,
  )
  useCityInfo.mockReturnValue(ok(EMPTY_CITY_INFO))
  useLocation.mockReturnValue({
    coords: null,
    status: 'unavailable',
    retry: vi.fn(),
  } as unknown as ReturnType<typeof locationContext.useLocation>)
})

function renderDetail(areaName = '강남역') {
  return render(
    <AreaDetail areaName={areaName} onBack={() => {}} onSelectArea={() => {}} />,
  )
}

describe('AreaDetail', () => {
  it('명소 이름과 혼잡도를 보여준다', () => {
    renderDetail()
    expect(screen.getByRole('heading', { name: '강남역' })).toBeInTheDocument()
    expect(screen.getByText(/지금은 약간 붐빔/)).toBeInTheDocument()
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
    expect(screen.getByText(/지금은 약간 붐빔/)).toBeInTheDocument()
    expect(screen.getByText('도시 정보를 가져오지 못했어요.')).toBeInTheDocument()
  })

  it('혼잡도가 실패해도 도시 정보는 펼칠 수 있다', async () => {
    useAreaSnapshot.mockReturnValue(failed<AreaSnapshot>())
    renderDetail()
    expect(screen.getByText('혼잡도 정보를 가져오지 못했어요.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /이곳의 도시 정보/ }))
    expect(useCityInfo).toHaveBeenCalledWith('강남역')
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

  it('즐겨찾기를 토글한다', async () => {
    renderDetail()
    await userEvent.click(screen.getByRole('button', { name: '즐겨찾기에 추가' }))
    expect(
      await screen.findByRole('button', { name: '즐겨찾기에서 빼기' }),
    ).toBeInTheDocument()
  })
})
