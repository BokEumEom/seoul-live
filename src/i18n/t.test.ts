import { afterEach, describe, expect, it } from 'vitest'
import { applyLanguage, currentLanguage, t } from './t'

afterEach(() => {
  applyLanguage('ko')
})

describe('t', () => {
  it('한국어일 때는 원문을 그대로 돌려준다', () => {
    // **이 성질이 옮기는 동안 화면을 지켜준다.** 감싸기만 하면 한국어 화면은
    // 한 글자도 안 바뀌므로 기존 테스트 990여 개가 그대로 통과한다.
    expect(t('붐빔')).toBe('붐빔')
    expect(t('아무 데도 없는 문구')).toBe('아무 데도 없는 문구')
  })

  it('영어일 때는 사전을 쓴다', () => {
    applyLanguage('en')
    expect(t('붐빔')).toBe('Crowded')
  })

  it('사전에 없으면 한국어를 그대로 돌려준다', () => {
    // 빈 칸이나 키 이름을 보여주는 것보다 낫다 — 뜻은 안 통해도 자리와 길이는
    // 유지되어 화면이 안 깨진다.
    applyLanguage('en')
    expect(t('사전에 없는 새 문구')).toBe('사전에 없는 새 문구')
  })

  it('값이 낀 자리를 채운다', () => {
    expect(t('주차 {비율}%', { 비율: 45 })).toBe('주차 45%')
  })

  it('영어에서 어순이 달라져도 자리만 옮기면 된다', () => {
    // 자리를 파 두는 값이 여기 있다. 통째로 키를 삼으면 어순을 못 바꾼다.
    applyLanguage('en')
    expect(t('주차 {비율}%', { 비율: 45 })).toBe('45% parking free')
  })

  it('채우지 못한 자리는 그대로 남긴다', () => {
    // 빈 문자열로 지우면 「분」만 남은 문장이 되어 뜻이 뒤집히고, 무엇이
    // 빠졌는지도 알 수 없다.
    expect(t('걸어서 {분}분', {})).toBe('걸어서 {분}분')
  })

  it('같은 자리가 여러 번 나와도 다 채운다', () => {
    expect(t('{곳}에서 {곳}까지', { 곳: '명동' })).toBe('명동에서 명동까지')
  })

  it('언어를 바꾸면 그다음 호출부터 반영된다', () => {
    expect(currentLanguage()).toBe('ko')
    applyLanguage('en')
    expect(currentLanguage()).toBe('en')
  })
})
