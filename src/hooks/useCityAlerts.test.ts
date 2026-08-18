import { renderHook } from '@testing-library/react'
import type { UseQueryResult } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CityAlert, CityInfo } from '../domain/cityInfo'

vi.mock('../data/queries', () => ({ useCityInfo: vi.fn() }))
vi.mock('./useCachedCityAlerts', () => ({ useCachedCityAlerts: vi.fn() }))

const queries = await import('../data/queries')
const cached = await import('./useCachedCityAlerts')
const { useCityAlerts } = await import('./useCityAlerts')
const { ALERT_SOURCE_AREA } = await import('../data/areas')
const useCityInfo = vi.mocked(queries.useCityInfo)
const useCachedCityAlerts = vi.mocked(cached.useCachedCityAlerts)

function alert(message: string): CityAlert {
  return { category: '호우', step: '경보', message, createdAt: '' }
}

function info(alerts: readonly CityAlert[]): UseQueryResult<CityInfo> {
  return { data: { alerts } as CityInfo } as UseQueryResult<CityInfo>
}

beforeEach(() => {
  useCityInfo.mockReturnValue(info([]))
  useCachedCityAlerts.mockReturnValue([])
})

describe('useCityAlerts', () => {
  // **이게 이 훅의 존재 이유다.** 예전에는 캐시에 있는 것만 읽어서, 앱을 열고
  // 아무 명소도 안 눌렀으면 경보가 걸려 있어도 홈에 아무것도 안 떴다.
  it('상세를 한 번도 안 열어도 재난문자를 받아 온다', () => {
    useCityInfo.mockReturnValue(info([alert('폭염경보')]))

    const { result } = renderHook(() => useCityAlerts())

    expect(result.current.map((a) => a.message)).toEqual(['폭염경보'])
  })

  // **호출량이 걸린 단언이다.** 30곳을 부르면 하루 240회가 더해져 한도를
  // 넘는다. 「몇 번 불렸나」가 아니라 「몇 곳을 부르나」를 센다 — 리렌더마다
  // 훅이 다시 불리는 것은 정상이고, 곳이 늘어나는 것만 결함이다.
  it('정해진 한 곳만 조회한다', () => {
    renderHook(() => useCityAlerts())

    const asked = new Set(useCityInfo.mock.calls.map(([name]) => name))
    expect([...asked]).toEqual([ALERT_SOURCE_AREA])
  })

  // 사용자가 상세에서 이미 받아둔 것도 함께 모은다 — 그건 공짜다.
  it('캐시에 있는 다른 명소의 경보도 함께 모은다', () => {
    useCityInfo.mockReturnValue(info([alert('폭염경보')]))
    useCachedCityAlerts.mockReturnValue([alert('호우주의보')])

    const { result } = renderHook(() => useCityAlerts())

    expect(result.current.map((a) => a.message)).toEqual([
      '폭염경보',
      '호우주의보',
    ])
  })

  // 조회한 곳이 캐시에도 들어오므로 같은 문구가 두 벌 온다. 지우지 않으면
  // 배너가 같은 문장을 두 줄 그린다.
  it('같은 문구가 양쪽에 있어도 한 번만 남긴다', () => {
    useCityInfo.mockReturnValue(info([alert('폭염경보')]))
    useCachedCityAlerts.mockReturnValue([alert('폭염경보')])

    const { result } = renderHook(() => useCityAlerts())

    expect(result.current).toHaveLength(1)
  })

  it('조회가 아직 안 끝났으면 캐시에 있는 것만 준다', () => {
    useCityInfo.mockReturnValue({ data: undefined } as UseQueryResult<CityInfo>)
    useCachedCityAlerts.mockReturnValue([alert('호우주의보')])

    const { result } = renderHook(() => useCityAlerts())

    expect(result.current.map((a) => a.message)).toEqual(['호우주의보'])
  })

  // 조회가 실패해도 홈이 죽지 않는다. 경보는 부가 정보라 없으면 배너가 빠질 뿐이다.
  it('조회가 실패해도 빈 목록을 준다', () => {
    useCityInfo.mockReturnValue({
      data: undefined,
      isError: true,
    } as UseQueryResult<CityInfo>)

    const { result } = renderHook(() => useCityAlerts())

    expect(result.current).toEqual([])
  })
})
