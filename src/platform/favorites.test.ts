import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadFavorites, saveFavorites, STORAGE_KEY } from './favorites'

// 실제 브리지에 기대지 않는다. jsdom에는 브리지가 없고, SDK가 던질지
// null을 줄지에 따라 결과가 달라지면 테스트가 SDK 구현에 묶인다.
// App.test.tsx가 같은 이유로 토스 SDK를 목업한다.
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

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  getItem.mockResolvedValue(null)
  setItem.mockResolvedValue(undefined)
})

describe('favorites — 브리지가 있을 때', () => {
  it('저장한 목록을 그대로 읽는다', async () => {
    await saveFavorites(['강남역', '경복궁'])
    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, '["강남역","경복궁"]')

    getItem.mockResolvedValue('["강남역","경복궁"]')
    expect(await loadFavorites()).toEqual(['강남역', '경복궁'])
  })

  it('브리지를 쓰면 localStorage에는 쓰지 않는다', async () => {
    await saveFavorites(['강남역'])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  // 브리지가 "저장된 것 없음"이라고 답한 것과 브리지가 없는 것은 다르다.
  // 둘을 뭉개면 앱 안에서 즐겨찾기를 비운 사용자가 브라우저에 남은 옛
  // 목록을 다시 보게 된다.
  it('브리지가 null을 주면 localStorage를 보지 않는다', async () => {
    localStorage.setItem(STORAGE_KEY, '["옛날목록"]')
    getItem.mockResolvedValue(null)
    expect(await loadFavorites()).toEqual([])
  })
})

describe('favorites — 브리지가 없을 때', () => {
  beforeEach(withoutBridge)

  it('localStorage로 떨어져 저장하고 읽는다', async () => {
    await saveFavorites(['강남역', '경복궁'])
    expect(localStorage.getItem(STORAGE_KEY)).toBe('["강남역","경복궁"]')
    expect(await loadFavorites()).toEqual(['강남역', '경복궁'])
  })

  it('저장된 게 없으면 빈 배열이다', async () => {
    expect(await loadFavorites()).toEqual([])
  })

  it('깨진 JSON이면 빈 배열로 떨어지고 로그를 남긴다', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem(STORAGE_KEY, '{{{')
    expect(await loadFavorites()).toEqual([])
    expect(spy).toHaveBeenCalled()
  })

  it('배열이 아닌 값이 저장돼 있으면 빈 배열이다', async () => {
    localStorage.setItem(STORAGE_KEY, '{"a":1}')
    expect(await loadFavorites()).toEqual([])
  })

  it('문자열이 아닌 원소는 걸러낸다', async () => {
    localStorage.setItem(STORAGE_KEY, '["강남역",42,null]')
    expect(await loadFavorites()).toEqual(['강남역'])
  })

  it('저장 실패는 예외를 올리지 않는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // globalThis.Storage는 DOM의 것이다 — 위에서 import한 토스 SDK의
    // Storage와 이름만 같다. localStorage 할당량 초과를 흉내 낸다.
    vi.spyOn(globalThis.Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    await expect(saveFavorites(['강남역'])).resolves.toBeUndefined()
  })
})
