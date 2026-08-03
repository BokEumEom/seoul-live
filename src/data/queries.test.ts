import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { shouldRetry } from './queries'
import { AreaNameMismatchError, SeoulApiError } from './schema'
import { ProxyResponseError } from './client'

// I5 — shouldRetry는 재시도 정책이라는, 겉으로는 자명해 보이지만 실은 미묘한
// 규칙(어떤 에러는 절대 재시도해도 안 풀린다)을 담은 순수 함수다. React 렌더
// 없이도 완전히 검증할 수 있다.
describe('shouldRetry', () => {
  it('AreaNameMismatchError는 재시도하지 않는다', () => {
    expect(shouldRetry(0, new AreaNameMismatchError('강남역', ['광화문·덕수궁']))).toBe(false)
  })

  it('SeoulApiError는 재시도하지 않는다', () => {
    expect(shouldRetry(0, new SeoulApiError('INFO-200', '해당하는 데이터가 없습니다.'))).toBe(
      false,
    )
  })

  it('ZodError는 재시도하지 않는다', () => {
    const error = new z.ZodError([])
    expect(shouldRetry(0, error)).toBe(false)
  })

  it('ProxyResponseError의 4xx는 재시도하지 않는다', () => {
    expect(shouldRetry(0, new ProxyResponseError('요청 오류', 400))).toBe(false)
    expect(shouldRetry(0, new ProxyResponseError('찾을 수 없음', 404))).toBe(false)
    expect(shouldRetry(0, new ProxyResponseError('과다 요청', 499))).toBe(false)
  })

  it('ProxyResponseError의 5xx는 실패 횟수가 2 미만이면 재시도한다', () => {
    expect(shouldRetry(0, new ProxyResponseError('상류 실패', 502))).toBe(true)
    expect(shouldRetry(1, new ProxyResponseError('상류 실패', 502))).toBe(true)
    expect(shouldRetry(2, new ProxyResponseError('상류 실패', 502))).toBe(false)
  })

  it('일반 네트워크/타임아웃 에러는 실패 횟수가 2 미만이면 재시도한다', () => {
    expect(shouldRetry(0, new Error('네트워크 문제'))).toBe(true)
    expect(shouldRetry(1, new Error('네트워크 문제'))).toBe(true)
    expect(shouldRetry(2, new Error('네트워크 문제'))).toBe(false)
  })
})
