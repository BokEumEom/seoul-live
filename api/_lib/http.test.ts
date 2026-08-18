import { describe, expect, it, vi } from 'vitest'
import type { VercelResponse } from '@vercel/node'
import { setCacheHeaders, setCorsHeaders, setNoStoreHeader } from './http.js'

// cityinfo.test.ts와 같은 이유로 api/_lib/ 안에 둔다 — Vercel은 밑줄로 시작하는
// 디렉터리를 함수 라우팅에서 제외하므로 테스트가 엔드포인트로 오인되지 않는다.

function createResponse() {
  const headers = new Map<string, string>()
  const res = {
    setHeader: vi.fn((name: string, value: string) => {
      headers.set(name, value)
    }),
  }
  return { res: res as unknown as VercelResponse, headers }
}

describe('setCorsHeaders', () => {
  it('오리진과 메서드를 연다', () => {
    const { res, headers } = createResponse()
    setCorsHeaders(res)

    expect(headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS')
  })

  // **`Age`는 CORS 안전목록 헤더가 아니다.** 노출을 명시하지 않으면 브라우저가
  // 응답에서 그 헤더를 통째로 감춰, 클라이언트가 `response.headers.get('Age')`로
  // 읽어도 언제나 `null`이다. 토스 번들과 이 프록시는 오리진이 달라 이 경로를
  // 반드시 탄다.
  //
  // **이 줄이 없으면 화면이 조용히 더 나빠진다.** 「모르면 모른다고 말한다」는
  // 규칙 덕에 거짓말은 안 하지만, 도시정보 세 절이 영영 「최대 3시간 전」에
  // 머문다 — 고쳤다고 생각하면서 아무것도 안 바뀐 상태가 된다.
  it('Age 헤더를 클라이언트에 노출한다', () => {
    const { res, headers } = createResponse()
    setCorsHeaders(res)

    expect(headers.get('Access-Control-Expose-Headers')).toBe('Age')
  })
})

describe('setCacheHeaders', () => {
  it('TTL과 그 두 배의 stale-while-revalidate를 심는다', () => {
    const { res, headers } = createResponse()
    setCacheHeaders(res, 3_600)

    expect(headers.get('Cache-Control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=7200',
    )
  })
})

describe('setNoStoreHeader', () => {
  it('실패 응답이 캐시되지 않게 한다', () => {
    const { res, headers } = createResponse()
    setNoStoreHeader(res)

    expect(headers.get('Cache-Control')).toBe('no-store')
  })
})
