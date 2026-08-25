import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cellLevel, observationTotal } from '../domain/pattern'
import type { AreaSnapshot } from '../domain/types'
import { useWeekPattern } from './useWeekPattern'

vi.mock('../platform/weekPattern', () => ({
  loadPattern: vi.fn(),
  savePattern: vi.fn(),
}))

const store = await import('../platform/weekPattern')
const loadPattern = vi.mocked(store.loadPattern)
const savePattern = vi.mocked(store.savePattern)

/** 2026-08-03은 월요일 → day 1, 14시 → bucket 4 */
const OBSERVED_AT = '2026-08-03 14:35'

function snapshot(overrides: Partial<AreaSnapshot> = {}): AreaSnapshot {
  return {
    code: 'POI009',
    name: '광화문·덕수궁',
    congestion: '보통',
    message: '',
    populationMin: 1,
    populationMax: 2,
    observedAt: OBSERVED_AT,
    observedAtLabel: '14:35',
    forecasts: [],
    forecastProvided: null,
    composition: null,
    replaced: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  loadPattern.mockResolvedValue({ pattern: {}, lastObservedAt: null })
  savePattern.mockResolvedValue(undefined)
})

describe('useWeekPattern', () => {
  it('새 관측이면 한 칸 쌓고 저장한다', async () => {
    const { result } = renderHook(() => useWeekPattern('광화문·덕수궁', snapshot()))
    await waitFor(() => {
      expect(cellLevel(result.current, 1, 4)).toBe('보통')
    })
    expect(savePattern).toHaveBeenCalledWith('광화문·덕수궁', {
      pattern: { '1-4': { rankSum: 1, count: 1 } },
      lastObservedAt: OBSERVED_AT,
    })
  })

  // **같은 `PPLTN_TIME`이면 같은 관측이다.** 상세를 두 번 열었다고 두 번 세면
  // 평균은 그대로여도 「몇 번 봤나」가 부푼다 — 화면이 신뢰도로 내놓는 값이다.
  it('이미 기록한 관측이면 다시 세지 않는다', async () => {
    loadPattern.mockResolvedValue({
      pattern: { '1-4': { rankSum: 1, count: 1 } },
      lastObservedAt: OBSERVED_AT,
    })
    const { result } = renderHook(() => useWeekPattern('광화문·덕수궁', snapshot()))
    await waitFor(() => {
      expect(observationTotal(result.current)).toBe(1)
    })
    expect(savePattern).not.toHaveBeenCalled()
  })

  it('시각이 달라지면 다시 센다', async () => {
    loadPattern.mockResolvedValue({
      pattern: { '1-4': { rankSum: 1, count: 1 } },
      lastObservedAt: '2026-08-03 13:35',
    })
    const { result } = renderHook(() => useWeekPattern('광화문·덕수궁', snapshot()))
    await waitFor(() => {
      expect(observationTotal(result.current)).toBe(2)
    })
  })

  // 못 읽은 시각으로 칸을 채우면 엉뚱한 요일에 관측이 쌓인다.
  it('시각을 못 읽으면 쌓지 않는다', async () => {
    const { result } = renderHook(() =>
      useWeekPattern('광화문·덕수궁', snapshot({ observedAt: '어제 오후' })),
    )
    await waitFor(() => {
      expect(result.current).toEqual({})
    })
    expect(savePattern).not.toHaveBeenCalled()
  })

  it('혼잡도가 아직 없으면 읽기만 한다', async () => {
    loadPattern.mockResolvedValue({
      pattern: { '1-4': { rankSum: 1, count: 1 } },
      lastObservedAt: null,
    })
    const { result } = renderHook(() => useWeekPattern('광화문·덕수궁', undefined))
    await waitFor(() => {
      expect(observationTotal(result.current)).toBe(1)
    })
    expect(savePattern).not.toHaveBeenCalled()
  })

  // **앞 명소의 패턴이 비치면 안 된다.** 읽기가 비동기라 명소를 바꾼 직후에는
  // 아직 새 값이 없는데, 그때 옛 값을 그대로 두면 다른 곳의 패턴을 이 명소의
  // 것으로 읽게 된다.
  it('명소가 바뀌면 새로 읽기 전까지 빈 패턴이다', async () => {
    loadPattern.mockResolvedValue({
      pattern: { '1-4': { rankSum: 1, count: 1 } },
      lastObservedAt: OBSERVED_AT,
    })
    const { result, rerender } = renderHook(({ area }) => useWeekPattern(area, snapshot()), {
      initialProps: { area: '광화문·덕수궁' },
    })
    await waitFor(() => {
      expect(observationTotal(result.current)).toBe(1)
    })

    loadPattern.mockResolvedValue({ pattern: {}, lastObservedAt: null })
    rerender({ area: '강남역' })
    expect(result.current).toEqual({})
  })

  it('명소가 없으면 빈 패턴이고 저장소를 건드리지 않는다', () => {
    const { result } = renderHook(() => useWeekPattern(undefined, snapshot()))
    expect(result.current).toEqual({})
    expect(loadPattern).not.toHaveBeenCalled()
  })
})
