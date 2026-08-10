import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UseQueryResult } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CityAlert } from '../domain/cityInfo'
import type { AreaSnapshot } from '../domain/types'
import { TodayScreen } from './TodayScreen'

vi.mock('../data/queries', () => ({ useAreaSnapshots: vi.fn() }))
vi.mock('../hooks/useCachedCityAlerts', () => ({ useCachedCityAlerts: vi.fn() }))
vi.mock('../app/locationContext', () => ({ useLocation: vi.fn() }))

const queries = await import('../data/queries')
const cached = await import('../hooks/useCachedCityAlerts')
const locationContext = await import('../app/locationContext')
const useAreaSnapshots = vi.mocked(queries.useAreaSnapshots)
const useCachedCityAlerts = vi.mocked(cached.useCachedCityAlerts)
const useLocation = vi.mocked(locationContext.useLocation)

function snapshotFor(
  name: string,
  congestion: AreaSnapshot['congestion'],
): AreaSnapshot {
  return {
    code: name,
    name,
    congestion,
    message: '',
    populationMin: 0,
    populationMax: 0,
    observedAt: '2026-08-07 11:00',
    observedAtLabel: '11:00',
    forecasts: [],
    composition: null,
  }
}

function mockSnapshots(data: readonly (AreaSnapshot | null)[]): void {
  useAreaSnapshots.mockReturnValue({
    data,
    isPending: false,
    isError: false,
  } as unknown as UseQueryResult<readonly (AreaSnapshot | null)[]>)
}

/** 명소마다 혼잡도를 다르게 준다 — 전부 같으면 TOP 순서 테스트가 무의미하다. */
async function mixedSnapshots(): Promise<readonly AreaSnapshot[]> {
  const { AREA_CATALOG } = await import('../data/areas')
  const levels = ['여유', '보통', '약간 붐빔', '붐빔'] as const
  return AREA_CATALOG.map((entry, index) =>
    snapshotFor(entry.name, levels[index % levels.length]),
  )
}

beforeEach(async () => {
  vi.clearAllMocks()
  useLocation.mockReturnValue({ coords: null, status: 'unavailable', retry: vi.fn() })
  useCachedCityAlerts.mockReturnValue([])
  mockSnapshots(await mixedSnapshots())
})

describe('TodayScreen', () => {
  it('붐비는 곳과 여유로운 곳을 모두 보여준다', () => {
    render(<TodayScreen onSelectArea={() => {}} />)
    expect(
      screen.getByRole('heading', { name: '지금 가장 붐비는 곳' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '지금 여유로운 곳' })).toBeInTheDocument()
  })

  it('붐비는 곳 목록은 붐빔부터, 여유로운 곳 목록은 여유부터 나온다', () => {
    // 제목만 보면 두 목록을 서로 바꿔 넣어도 통과한다. 첫 줄의 배지를 고정한다.
    render(<TodayScreen onSelectArea={() => {}} />)
    const busiest = screen.getByRole('heading', { name: '지금 가장 붐비는 곳' })
      .parentElement as HTMLElement
    const calmest = screen.getByRole('heading', { name: '지금 여유로운 곳' })
      .parentElement as HTMLElement

    const busiestFirst = within(busiest).getAllByRole('listitem')[0]
    const calmestFirst = within(calmest).getAllByRole('listitem')[0]
    // getByText는 완전 일치라 '약간 붐빔'은 '붐빔'에 걸리지 않는다.
    expect(within(busiestFirst).getByText('붐빔')).toBeInTheDocument()
    expect(within(calmestFirst).getByText('여유')).toBeInTheDocument()
  })

  it('혼잡도 분포를 한 줄로 요약한다', () => {
    render(<TodayScreen onSelectArea={() => {}} />)
    // 30곳을 네 단계로 돌려 배분하면 붐빔은 7곳이다(인덱스 3,7,...,27).
    expect(screen.getByText(/30곳 중 붐빔 7곳/)).toBeInTheDocument()
  })

  it('항목을 누르면 명소를 올려보낸다', async () => {
    const onSelectArea = vi.fn()
    render(<TodayScreen onSelectArea={onSelectArea} />)
    const busiest = screen.getByRole('heading', { name: '지금 가장 붐비는 곳' })
    const firstItem = busiest.parentElement?.querySelectorAll('button')[0]
    await userEvent.click(firstItem as HTMLElement)
    expect(onSelectArea).toHaveBeenCalled()
  })

  it('캐시에 재난문자가 없으면 배너를 그리지 않는다', () => {
    useCachedCityAlerts.mockReturnValue([])
    render(<TodayScreen onSelectArea={() => {}} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('같은 재난문자가 여러 명소에 실려도 한 번만 그린다', () => {
    const alert = {
      category: '기상',
      step: '주의보',
      message: '호우 주의보',
      createdAt: '2026-08-07 11:00',
    } satisfies CityAlert
    useCachedCityAlerts.mockReturnValue([alert, alert, alert])
    render(<TodayScreen onSelectArea={() => {}} />)
    expect(screen.getAllByText('호우 주의보')).toHaveLength(1)
  })

  it('스냅샷이 하나도 없으면 그 사실을 말한다', async () => {
    const { AREA_CATALOG } = await import('../data/areas')
    mockSnapshots(AREA_CATALOG.map(() => null))
    render(<TodayScreen onSelectArea={() => {}} />)
    expect(screen.getByText('혼잡도 정보를 아직 받지 못했어요.')).toBeInTheDocument()
    // 순위를 매길 근거가 없으면 목록 자체를 그리지 않는다.
    expect(screen.queryByRole('heading', { name: '지금 가장 붐비는 곳' })).toBeNull()
  })

  it('혼잡도 조회가 실패하면 에러를 보여준다', () => {
    useAreaSnapshots.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<readonly (AreaSnapshot | null)[]>)
    render(<TodayScreen onSelectArea={() => {}} />)
    expect(screen.getByText('혼잡도 정보를 가져오지 못했어요.')).toBeInTheDocument()
  })

  it('카테고리별 평균을 화면 라벨로 보여준다', () => {
    render(<TodayScreen onSelectArea={() => {}} />)
    const heading = screen.getByRole('heading', { name: '카테고리별 평균' })
    // RankList 항목에도 같은 라벨이 붙으므로 이 섹션 안으로 좁힌다.
    const section = heading.parentElement as HTMLElement
    expect(within(section).getByText('역·번화가')).toBeInTheDocument()
  })
})
