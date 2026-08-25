import { afterEach, describe, expect, it } from 'vitest'
import { apiText } from './apiText'
import { applyLanguage } from './t'

afterEach(() => {
  applyLanguage('ko')
})

describe('apiText', () => {
  it('한국어 화면에서는 한국어 원문을 쓴다', () => {
    expect(apiText('세종대로 2개 차로 통제', 'Two lanes closed')).toBe(
      '세종대로 2개 차로 통제',
    )
  })

  it('영어 화면에서는 서울이 준 영어를 쓴다', () => {
    applyLanguage('en')
    expect(apiText('세종대로 2개 차로 통제', 'Two lanes closed')).toBe('Two lanes closed')
  })

  // **영어가 안 오는 경우가 실재한다** — 사고통제 표본이 두 건뿐이라 「항상
  // 온다」고 단정할 수 없다. 그때 빈 칸을 그리면 통제 내용이 통째로 사라진다.
  // `t()`가 사전에 없는 키를 그대로 돌려주는 것과 같은 판단이다.
  it('영어가 비어 있으면 한국어로 떨어진다', () => {
    applyLanguage('en')
    expect(apiText('세종대로 2개 차로 통제', '')).toBe('세종대로 2개 차로 통제')
  })
})
