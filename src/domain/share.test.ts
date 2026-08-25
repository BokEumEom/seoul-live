import { describe, expect, it } from 'vitest'
import { hasShare, shareWidths } from './share'

describe('shareWidths', () => {
  it('합이 100이면 값 그대로다', () => {
    expect(shareWidths([25, 25, 50])).toEqual([25, 25, 50])
  })

  // **이것이 이 함수의 존재 이유다.** 실제 합으로만 정규화하면 절반만 읽힌
  // 구성에서 남은 칸들이 100%를 나눠 가져 「이 둘이 전부」라고 그린다 — 바로
  // 아래 글자는 25%·15%라고 적으니 두 줄이 모순되고 막대 쪽이 거짓이다.
  it('합이 100 미만이면 못 읽은 칸의 여백을 남긴다', () => {
    expect(shareWidths([25, 15])).toEqual([25, 15])
  })

  it('합이 100을 넘으면 실제 합으로 되돌아간다', () => {
    expect(shareWidths([100, 100])).toEqual([50, 50])
  })

  it('빈 배열도 견딘다', () => {
    expect(shareWidths([])).toEqual([])
  })
})

describe('hasShare', () => {
  // 합이 0이면 균등 칸을 그리는 대신 통째로 뺀다 — 균등 막대는 「모든 칸이
  // 고르게 있다」는 없는 사실을 그린다.
  it('전부 0이면 그릴 것이 없다', () => {
    expect(hasShare([0, 0, 0])).toBe(false)
    expect(hasShare([])).toBe(false)
  })

  it('하나라도 0보다 크면 그린다', () => {
    expect(hasShare([0, 0, 1])).toBe(true)
  })
})
