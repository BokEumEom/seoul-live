import { afterEach, describe, expect, it } from 'vitest'
import { formatPopulationTick } from './format'
import { applyLanguage } from './t'

afterEach(() => {
  applyLanguage('ko')
})

describe('formatPopulationTick', () => {
  it('만 단위부터는 만으로 줄인다', () => {
    // 60,000을 그대로 적으면 좁은 축에서 자리를 다 먹는다.
    expect(formatPopulationTick(60000)).toBe('6만')
    expect(formatPopulationTick(45000)).toBe('4.5만')
  })

  it('만 미만은 그대로 적는다', () => {
    // 0.32만은 아무도 안 읽는다.
    expect(formatPopulationTick(3200)).toBe('3,200')
    expect(formatPopulationTick(800)).toBe('800')
  })

  it('0은 0이다', () => {
    expect(formatPopulationTick(0)).toBe('0')
  })
})

describe('formatPopulationTick — 영어', () => {
  // **사전으로는 못 푼다.** 한국어는 만 단위(4.5만), 영어는 천 단위(45k)라
  // 자릿수 자체가 다르다 — 문자열 치환이 아니라 나눗셈이 달라진다.
  it('천 단위로 줄인다', () => {
    applyLanguage('en')
    expect(formatPopulationTick(60000)).toBe('60k')
    expect(formatPopulationTick(45000)).toBe('45k')
  })

  it('천 미만은 그대로 적는다', () => {
    applyLanguage('en')
    expect(formatPopulationTick(800)).toBe('800')
    expect(formatPopulationTick(0)).toBe('0')
  })
})
