import { describe, expect, it } from 'vitest'
import { populationRows } from './populationEnvelope'

describe('populationRows', () => {
  it('citydata 봉투에서 꺼낸다', () => {
    const rows = [{ AREA_NM: '강남역' }]
    expect(populationRows({ CITYDATA: { LIVE_PPLTN_STTS: rows } })).toBe(rows)
  })

  it('옛 citydata_ppltn 봉투는 더 이상 안 읽는다', () => {
    // 2026-08-27에 그 프록시를 걷어냈다. 되살리려는 커밋을 여기서 막는다.
    expect(populationRows({ 'SeoulRtd.citydata_ppltn': [{ AREA_NM: '강남역' }] })).toBeUndefined()
  })

  it('봉투가 아니면 undefined다', () => {
    // **던지지 않는다.** 판별은 호출자의 zod가 한다 — 여기서 던지면
    // parseComposition의 "절대 예외를 던지지 않는다"는 약속이 깨진다.
    expect(populationRows(null)).toBeUndefined()
    expect(populationRows('문자열')).toBeUndefined()
    expect(populationRows({})).toBeUndefined()
    expect(populationRows({ CITYDATA: null })).toBeUndefined()
    expect(populationRows({ CITYDATA: {} })).toBeUndefined()
  })

  it('배열이 아니어도 거르지 않는다 — 판별은 호출자 zod의 몫이다', () => {
    expect(populationRows({ CITYDATA: { LIVE_PPLTN_STTS: '문자열' } })).toBe('문자열')
  })
})
