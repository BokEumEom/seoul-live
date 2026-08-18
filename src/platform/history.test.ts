import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { currentSearch, onPopstate, pushSearch, replaceSearch } from './history'

beforeEach(() => {
  // 매 테스트를 깨끗한 주소에서 시작한다. jsdom의 히스토리는 파일 하나 안에서
  // 이어지므로 안 되돌리면 앞 테스트가 남긴 쿼리를 물려받는다.
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('currentSearch', () => {
  it('물음표를 포함해 그대로 준다', () => {
    window.history.replaceState(null, '', '/?area=%EA%B0%95%EB%82%A8%EC%97%AD')
    expect(currentSearch()).toBe('?area=%EA%B0%95%EB%82%A8%EC%97%AD')
  })

  it('쿼리가 없으면 빈 문자열이다', () => {
    expect(currentSearch()).toBe('')
  })
})

describe('pushSearch', () => {
  it('주소를 바꾸고 히스토리에 칸을 하나 쌓는다', () => {
    const before = window.history.length
    pushSearch('?view=today')

    expect(currentSearch()).toBe('?view=today')
    expect(window.history.length).toBe(before + 1)
  })

  it('빈 문자열이면 쿼리를 지운다', () => {
    window.history.replaceState(null, '', '/?view=today')
    pushSearch('')

    expect(currentSearch()).toBe('')
    // 경로는 남는다 — 쿼리만 걷어내는 것이지 다른 곳으로 가는 게 아니다.
    expect(window.location.pathname).toBe('/')
  })

  it('지금과 같은 주소면 칸을 쌓지 않는다', () => {
    // 지도에서 **같은 마커를 두 번** 누르면 `openArea`가 두 번 불린다. 그때마다
    // 칸이 쌓이면 뒤로 가기를 눌러도 화면이 안 바뀌는 칸을 여러 번 거슬러야 한다.
    pushSearch('?view=today')
    const after = window.history.length

    pushSearch('?view=today')

    expect(window.history.length).toBe(after)
    expect(currentSearch()).toBe('?view=today')
  })
})

describe('replaceSearch', () => {
  it('주소를 바꾸되 칸을 쌓지 않는다', () => {
    pushSearch('?view=today')
    const after = window.history.length

    replaceSearch('')

    expect(currentSearch()).toBe('')
    expect(window.history.length).toBe(after)
  })
})

describe('onPopstate', () => {
  it('뒤로 가기에 반응한다', async () => {
    const seen: string[] = []
    const stop = onPopstate(() => {
      seen.push(currentSearch())
    })

    pushSearch('?view=today')
    window.history.back()

    // jsdom도 브라우저도 popstate를 다음 태스크로 미룬다.
    await vi.waitFor(() => {
      expect(seen).toEqual([''])
    })

    stop()
  })

  it('해제하면 더 이상 안 부른다', async () => {
    const listener = vi.fn()
    const stop = onPopstate(listener)
    stop()

    pushSearch('?view=today')
    window.history.back()

    // 「안 일어난다」는 기다려서 확인해야 한다. 즉시 단언하면 이벤트가 아직
    // 안 왔을 뿐인데 통과해, 해제가 고장 나도 초록으로 남는다.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(listener).not.toHaveBeenCalled()
  })
})
