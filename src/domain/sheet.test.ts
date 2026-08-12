import { describe, expect, it } from 'vitest'
import {
  clampSheetRatio,
  nearestDetent,
  SHEET_RATIO,
  type Detent,
} from './sheet'

describe('SHEET_RATIO', () => {
  it('세 단계가 오름차순이다', () => {
    expect(SHEET_RATIO.peek).toBeLessThan(SHEET_RATIO.half)
    expect(SHEET_RATIO.half).toBeLessThan(SHEET_RATIO.full)
  })

  it('어느 쪽도 완전히 접히거나 덮지 않는다', () => {
    // peek이 0이면 시트를 되돌릴 손잡이가 사라지고, full이 1이면 지도가 없어진다.
    expect(SHEET_RATIO.peek).toBeGreaterThan(0)
    expect(SHEET_RATIO.full).toBeLessThan(1)
  })
})

describe('clampSheetRatio', () => {
  it('peek 아래는 peek으로 올린다', () => {
    expect(clampSheetRatio(0)).toBe(SHEET_RATIO.peek)
    expect(clampSheetRatio(-1)).toBe(SHEET_RATIO.peek)
  })

  it('full 위는 full로 내린다', () => {
    expect(clampSheetRatio(1)).toBe(SHEET_RATIO.full)
    expect(clampSheetRatio(2)).toBe(SHEET_RATIO.full)
  })

  it('범위 안은 그대로 둔다', () => {
    expect(clampSheetRatio(0.5)).toBe(0.5)
  })

  it('NaN은 half로 떨어뜨린다', () => {
    expect(clampSheetRatio(Number.NaN)).toBe(SHEET_RATIO.half)
  })
})

describe('nearestDetent', () => {
  it('가장 가까운 단계를 고른다', () => {
    expect(nearestDetent(0.17)).toBe('peek')
    expect(nearestDetent(0.44)).toBe('half')
    expect(nearestDetent(0.9)).toBe('full')
  })

  it('중간값은 더 가까운 쪽으로 간다', () => {
    // peek 0.16과 half 0.56의 중간은 0.36.
    //
    // **소재를 상수에서 다시 뽑는다.** 예전에는 0.33/0.29를 박아 뒀는데
    // half가 0.46→0.56으로 오르자 0.33이 peek 쪽으로 넘어가 이 테스트가 죽었다.
    // 죽은 것이 맞다 — 다만 새 숫자를 다시 박으면 다음에 또 같은 일이 난다.
    const mid = (SHEET_RATIO.peek + SHEET_RATIO.half) / 2
    expect(nearestDetent(mid + 0.02)).toBe('half')
    expect(nearestDetent(mid - 0.02)).toBe('peek')
  })

  it('범위 밖도 단계 하나로 떨어진다', () => {
    expect(nearestDetent(5)).toBe('full')
    expect(nearestDetent(-5)).toBe('peek')
  })

  // clampSheetRatio 호출이 실제로 하는 일은 이것 하나다. 범위 밖 값은 거리
  // 비교가 어차피 처리하므로, NaN만 갈린다 — clamp가 없으면 비교가 전부
  // false라 첫 단계(peek)에 눌러앉는다.
  it('NaN은 peek이 아니라 half가 된다', () => {
    expect(nearestDetent(Number.NaN)).toBe('half')
  })

  it('언제나 세 단계 중 하나를 준다', () => {
    const all: readonly Detent[] = ['peek', 'half', 'full']
    for (let raw = -0.5; raw <= 1.5; raw += 0.01) {
      expect(all).toContain(nearestDetent(raw))
    }
  })
})
