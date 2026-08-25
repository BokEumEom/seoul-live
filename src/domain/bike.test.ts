import { describe, expect, it } from 'vitest'
import { makeBikeStation } from '../test/cityInfo'
import { isDockFull } from './bike'

describe('isDockFull', () => {
  // **거치율 100%는 「자전거 수 = 거치대 수」다.** 실호출 227곳 중 61곳이
  // 100을 넘었고 최댓값이 450이었다 — 못 꽂은 자전거를 옆에 세워 둔다.
  it('거치율이 100을 넘으면 반납할 자리가 없다', () => {
    expect(isDockFull(makeBikeStation({ dockRate: 130 }))).toBe(true)
    expect(isDockFull(makeBikeStation({ dockRate: 450 }))).toBe(true)
  })

  // 경계에서 잠근다. `>`로 짜면 자전거 수와 거치대 수가 같은 곳이 「자리 있음」이
  // 되는데, 그 곳에는 꽂을 자리가 없다.
  it('딱 100도 찬 것이다', () => {
    expect(isDockFull(makeBikeStation({ dockRate: 100 }))).toBe(true)
    expect(isDockFull(makeBikeStation({ dockRate: 99 }))).toBe(false)
  })

  it('여유가 있으면 false다', () => {
    expect(isDockFull(makeBikeStation({ dockRate: 0 }))).toBe(false)
    expect(isDockFull(makeBikeStation({ dockRate: 47 }))).toBe(false)
  })

  // 0을 「자리가 넘친다」로도 「못 읽었다」로도 읽지 않는다. 못 읽은 것은 null이고,
  // 화면은 null일 때 아무 말도 안 한다 — 없는 사실을 단정하지 않는 규칙이다.
  it('모르면 null이다', () => {
    expect(isDockFull(makeBikeStation())).toBeNull()
  })
})
