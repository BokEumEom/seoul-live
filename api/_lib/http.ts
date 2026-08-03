import type { VercelResponse } from '@vercel/node'

// 토스가 서빙하는 번들과 이 프록시(Vercel)는 오리진이 다르다. CORS 헤더가 없으면
// 전부 실패한다.
export function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
}

// 정상 응답에만 쓴다. citydata.ts와 citydata-bulk.ts가 각자 캐시 헤더를 따로
// 만들다가 실패 응답에도 이 TTL이 붙는 결함이 났었다 — 공용 함수 하나로 합쳐서
// 같은 실수가 두 곳에서 따로 나는 걸 막는다.
export function setCacheHeaders(res: VercelResponse, ttlSeconds: number): void {
  res.setHeader(
    'Cache-Control',
    `public, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}`,
  )
}

// 실패 응답에 쓴다. 이 헤더를 빠뜨리면 실패 상태가 그대로 굳어 CDN에 캐시되고,
// 캐시가 만료되기 전까지는 서울 API가 복구돼도 사용자에게 반영되지 않는다.
export function setNoStoreHeader(res: VercelResponse): void {
  res.setHeader('Cache-Control', 'no-store')
}
