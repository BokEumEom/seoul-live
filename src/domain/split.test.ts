import { describe, expect, it } from 'vitest'
import {
  clampRatio,
  DEFAULT_MAP_RATIO,
  MAX_MAP_RATIO,
  MIN_MAP_RATIO,
  snapRatio,
} from './split'

describe('clampRatio', () => {
  it('최소 아래는 최소로 올린다', () => {
    expect(clampRatio(0)).toBe(MIN_MAP_RATIO)
    expect(clampRatio(-1)).toBe(MIN_MAP_RATIO)
  })

  it('최대 위는 최대로 내린다', () => {
    expect(clampRatio(1)).toBe(MAX_MAP_RATIO)
  })

  it('범위 안은 그대로 둔다', () => {
    expect(clampRatio(0.5)).toBe(0.5)
  })

  it('경계값은 그대로 둔다', () => {
    expect(clampRatio(MIN_MAP_RATIO)).toBe(MIN_MAP_RATIO)
    expect(clampRatio(MAX_MAP_RATIO)).toBe(MAX_MAP_RATIO)
  })

  it('NaN은 기본값으로 떨어뜨린다', () => {
    expect(clampRatio(Number.NaN)).toBe(DEFAULT_MAP_RATIO)
  })
})

describe('snapRatio', () => {
  it('가장 가까운 스냅점에 붙는다', () => {
    expect(snapRatio(0.17)).toBe(MIN_MAP_RATIO)
    expect(snapRatio(0.33)).toBe(DEFAULT_MAP_RATIO)
    expect(snapRatio(0.72)).toBe(MAX_MAP_RATIO)
  })

  it('중간값은 더 가까운 쪽에 붙는다', () => {
    // 0.15와 0.35의 중간은 0.25. 0.26은 0.35 쪽이 가깝다.
    expect(snapRatio(0.26)).toBe(DEFAULT_MAP_RATIO)
    expect(snapRatio(0.24)).toBe(MIN_MAP_RATIO)
  })

  it('범위 밖 입력도 스냅점으로 떨어진다', () => {
    expect(snapRatio(2)).toBe(MAX_MAP_RATIO)
    expect(snapRatio(-1)).toBe(MIN_MAP_RATIO)
  })

  // snapRatio 안의 clampRatio 호출이 실제로 하는 일은 이것 하나다. 범위 밖
  // 값은 reduce가 어차피 가장 가까운 스냅점을 고르므로 clamp가 없어도 같다.
  // NaN만 다르다 — clamp가 없으면 비교가 전부 false라 첫 스냅점(최소)에
  // 눌러앉는다. 손잡이 위치를 못 읽었을 때 지도가 최소로 접히는 대신
  // 기본값으로 돌아가야 한다.
  it('NaN은 최소가 아니라 기본값으로 떨어진다', () => {
    expect(snapRatio(Number.NaN)).toBe(DEFAULT_MAP_RATIO)
  })

  it('언제나 스냅점 중 하나를 준다', () => {
    // 손잡이를 놓은 자리가 어디든 세 값 중 하나로 떨어져야 한다. 아니면
    // 다음 드래그의 출발점이 스냅 격자에서 벗어난다.
    const points: readonly number[] = [MIN_MAP_RATIO, DEFAULT_MAP_RATIO, MAX_MAP_RATIO]
    for (let raw = -0.5; raw <= 1.5; raw += 0.01) {
      expect(points).toContain(snapRatio(raw))
    }
  })
})

describe('경계 상수', () => {
  it('기본값이 최소와 최대 사이에 있다', () => {
    expect(MIN_MAP_RATIO).toBeLessThan(DEFAULT_MAP_RATIO)
    expect(DEFAULT_MAP_RATIO).toBeLessThan(MAX_MAP_RATIO)
  })

  it('어느 쪽도 완전히 접히지 않는다', () => {
    // 한쪽이 사라지면 되돌릴 손잡이도 같이 사라진다.
    expect(MIN_MAP_RATIO).toBeGreaterThan(0)
    expect(MAX_MAP_RATIO).toBeLessThan(1)
  })
})
