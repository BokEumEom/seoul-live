import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadPattern, savePattern, storageKey } from './weekPattern'

// 실제 브리지에 기대지 않는다 — `favorites.test.ts`와 같은 이유다.
vi.mock('@apps-in-toss/web-framework', () => ({
  Storage: { getItem: vi.fn(), setItem: vi.fn() },
}))

const { Storage } = await import('@apps-in-toss/web-framework')
const getItem = vi.mocked(Storage.getItem)
const setItem = vi.mocked(Storage.setItem)

/** 브리지가 없는 환경(개발 서버·브라우저)을 흉내 낸다. */
function withoutBridge(): void {
  getItem.mockRejectedValue(new Error('브리지 없음'))
  setItem.mockRejectedValue(new Error('브리지 없음'))
}

const AREA = '광화문·덕수궁'
const CELL = { rankSum: 3, count: 2 }

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('storageKey', () => {
  // 한 덩어리로 묶으면 명소 하나를 볼 때마다 30곳치를 읽고 쓴다.
  it('명소마다 다른 키를 쓴다', () => {
    expect(storageKey(AREA)).not.toBe(storageKey('강남역'))
    expect(storageKey(AREA)).toContain(AREA)
  })
})

describe('loadPattern / savePattern', () => {
  const STORED = { pattern: { '1-4': CELL }, lastObservedAt: '2026-08-03 14:35' }
  const RAW = JSON.stringify({ cells: STORED.pattern, lastObservedAt: STORED.lastObservedAt })

  it('브리지에 쓰고 브리지에서 읽는다', async () => {
    await savePattern(AREA, STORED)
    expect(setItem).toHaveBeenCalledWith(storageKey(AREA), RAW)

    getItem.mockResolvedValue(RAW)
    expect(await loadPattern(AREA)).toEqual(STORED)
  })

  it('브리지가 없으면 localStorage로 떨어진다', async () => {
    withoutBridge()
    await savePattern(AREA, STORED)
    expect(localStorage.getItem(storageKey(AREA))).toBe(RAW)
    expect(await loadPattern(AREA)).toEqual(STORED)
  })

  it('쌓인 게 없으면 빈 패턴이다', async () => {
    getItem.mockResolvedValue(null)
    expect(await loadPattern(AREA)).toEqual({ pattern: {}, lastObservedAt: null })
  })

  // **마지막 관측 시각이 함께 남아야** 같은 시간대에 상세를 두 번 열어도 관측이
  // 두 번 쌓이지 않는다. 평균은 그대로지만 「몇 번 봤나」가 부푸는데, 그 숫자는
  // 화면이 신뢰도로 내놓는 값이다.
  it('마지막 관측 시각을 함께 실어 나른다', async () => {
    getItem.mockResolvedValue(RAW)
    expect((await loadPattern(AREA)).lastObservedAt).toBe('2026-08-03 14:35')
  })

  it('시각이 이상하면 기록한 적 없음으로 두되 패턴은 살린다', async () => {
    getItem.mockResolvedValue(JSON.stringify({ cells: { '1-4': CELL }, lastObservedAt: 7 }))
    const loaded = await loadPattern(AREA)
    expect(loaded.lastObservedAt).toBeNull()
    expect(loaded.pattern).toEqual({ '1-4': CELL })
  })

  // 읽기 실패로 상세를 막지 않는다. 다만 조용히 넘기지도 않는다.
  it('읽지 못하면 빈 패턴을 주고 기록을 남긴다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    getItem.mockResolvedValue('{ 망가진 JSON')
    expect(await loadPattern(AREA)).toEqual({ pattern: {}, lastObservedAt: null })
    expect(logged).toHaveBeenCalled()
  })

  // **칸 하나가 이상하다고 패턴을 통째로 버리지 않는다.** 지난 버전이 쓴 값이나
  // 사람이 만진 값이 섞일 수 있는데, 그때 쌓아둔 걸 다 잃으면 안 된다.
  it('이상한 칸만 버리고 나머지는 살린다', async () => {
    getItem.mockResolvedValue(
      JSON.stringify({
        cells: {
          '1-4': CELL,
          '2-0': { rankSum: -1, count: 2 },
          '2-1': { rankSum: 1, count: 0 },
          '2-2': { rankSum: 1.5, count: 2 },
          '2-3': '망가짐',
          '2-4': null,
        },
      }),
    )
    expect((await loadPattern(AREA)).pattern).toEqual({ '1-4': CELL })
  })

  // 어느 요일에도 안 그려지는 칸이라 눈에는 안 보이지만 「몇 번 봤나」는 는다.
  it('범위 밖 키는 버린다', async () => {
    getItem.mockResolvedValue(
      JSON.stringify({
        cells: { '1-4': CELL, '7-0': CELL, '1-9': CELL, '망가짐': CELL, '-1-0': CELL },
      }),
    )
    expect((await loadPattern(AREA)).pattern).toEqual({ '1-4': CELL })
  })

  it('저장된 값이 객체가 아니면 빈 패턴이다', async () => {
    getItem.mockResolvedValue('[1,2,3]')
    expect(await loadPattern(AREA)).toEqual({ pattern: {}, lastObservedAt: null })
  })

  // 브리지도 없고 localStorage도 거부하는 상황(용량 초과)에서 상세가 죽으면 안 된다.
  // `Storage`라는 이름이 토스 목업에 가려져 있으므로 localStorage 인스턴스를 직접 짚는다.
  it('저장 실패는 삼키되 기록을 남긴다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    setItem.mockRejectedValue(new Error('브리지 없음'))
    // 인스턴스가 아니라 프로토타입에 건다 — jsdom의 localStorage는 Proxy라
    // 인스턴스에 자기 속성을 얹는 방식(`spyOn(localStorage, ...)`)이 조용히 안 먹는다.
    vi.spyOn(Object.getPrototypeOf(window.localStorage) as globalThis.Storage, 'setItem')
      .mockImplementation(() => {
        throw new Error('용량 초과')
      })
    await expect(savePattern(AREA, STORED)).resolves.toBeUndefined()
    expect(logged).toHaveBeenCalled()
  })
})
