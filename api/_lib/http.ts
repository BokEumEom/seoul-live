import type { VercelResponse } from '@vercel/node'

// 토스가 서빙하는 번들과 이 프록시(Vercel)는 오리진이 다르다. CORS 헤더가 없으면
// 전부 실패한다.
export function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  // **`Age`는 CORS 안전목록 헤더가 아니다.** 노출을 명시하지 않으면 브라우저가
  // 응답에서 통째로 감춰 클라이언트는 언제나 `null`을 읽는다. 오리진이 다른
  // 위 사정 때문에 이 경로를 반드시 탄다.
  //
  // 화면이 「12분 전 값이에요」라고 적을 수 있는 근거가 이 한 줄이다. 없으면
  // 클라이언트가 경과를 모르게 되고, 도시정보 세 절이 「최대 3시간 전」이라는
  // 뭉뚱그린 문구에 머문다(`domain/freshness.ts` 참고 — 모를 때 지어내지 않는다).
  res.setHeader('Access-Control-Expose-Headers', 'Age')
}

// 정상 응답에만 쓴다. cityinfo.ts와 citydata-bulk.ts가 각자 캐시 헤더를 따로
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
