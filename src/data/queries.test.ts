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

  // 아래 코드는 「서울시 실시간 도시데이터」 명세(서울시+실시간+도시데이터.xls)의
  // 에러 코드 표에서 그대로 가져왔다. 같은 SeoulApiError라도 원인이 우리 요청이냐
  // 상대 서버냐에 따라 재시도 가치가 정반대다.
  it('요청 자체가 잘못된 SeoulApiError는 재시도하지 않는다', () => {
    const permanent = [
      ['INFO-100', '인증키가 유효하지 않습니다.'],
      ['INFO-200', '해당하는 데이터가 없습니다.'],
      ['ERROR-300', '필수 값이 누락되어 있습니다.'],
      ['ERROR-301', '파일타입 값이 누락 혹은 유효하지 않습니다.'],
      ['ERROR-310', '해당하는 서비스를 찾을 수 없습니다.'],
      ['ERROR-331', '요청시작위치 값을 확인하십시오.'],
      ['ERROR-336', '데이터요청은 한번에 최대 1000건을 넘을 수 없습니다.'],
      ['ERROR-601', 'SQL 문장 오류 입니다.'],
    ] as const

    for (const [code, message] of permanent) {
      expect(shouldRetry(0, new SeoulApiError(code, message)), code).toBe(false)
    }
  })

  it('상대 서버가 흔들린 SeoulApiError는 재시도한다', () => {
    // ERROR-500(서버 오류)·ERROR-600(DB 연결 오류)은 같은 요청이 잠시 뒤 성공할 수
    // 있다. 전부 non-retryable로 묶으면 서울 API가 1초 삐끗한 것만으로 사용자에게
    // "정보 없음"을 띄운다.
    expect(shouldRetry(0, new SeoulApiError('ERROR-500', '서버 오류입니다.'))).toBe(true)
    expect(shouldRetry(0, new SeoulApiError('ERROR-600', '데이터베이스 연결 오류입니다.'))).toBe(
      true,
    )
  })

  it('상대 서버 오류도 무한히 재시도하지는 않는다', () => {
    expect(shouldRetry(1, new SeoulApiError('ERROR-500', '서버 오류입니다.'))).toBe(true)
    expect(shouldRetry(2, new SeoulApiError('ERROR-500', '서버 오류입니다.'))).toBe(false)
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
