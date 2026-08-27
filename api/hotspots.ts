import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCacheHeaders, setCorsHeaders, setNoStoreHeader } from './_lib/http.js'
import { hotspotsCacheTtlSeconds } from './_lib/seoul.js'
import { fetchHotspotRows } from './_lib/seoulRtd.js'

// 명소 **전부**의 지금 혼잡도. 목록과 지도가 이걸 쓴다.
//
// **예전의 `citydata-bulk`를 대신한다.** 그쪽은 `AREA_NM`이 필수인 공식
// OpenAPI라 명소당 1회씩 들어서, 121곳이면 갱신 한 번에 121회이고 하루
// 2,904회가 된다(한도는 1,000). 그 프록시(api/citydata-bulk.ts)는 목록이
// 여기로 완전히 옮겨온 뒤 2026-08-27에 지웠다(Task 7). 이쪽은 상류가 서울시
// 실시간 도시데이터 웹(SeoulRtd)이고 **인증키를 안 쓴다** — 한 번의 호출로
// 121곳이 오고 쿼터를 1원도 안 쓴다.
//
// **파라미터가 없다.** 명소를 고르지 않으므로 허용 목록 검사도 필요 없고,
// 그래서 CDN 캐시 키가 URL 하나로 수렴한다 — 사용자가 몇이든 상류로 나가는
// 요청은 TTL당 한 번이다. 다른 엔드포인트가 이름을 걸러야 했던 이유(임의
// 문자열이 캐시를 쪼개고 호출량을 늘린다)가 여기서는 애초에 생기지 않는다.
//
// **실패를 200으로 접지 않는다 — `cctv.ts`와 반대다.** CCTV는 부가 정보라
// 「지금은 없다」가 정직한 답이었지만 혼잡도는 이 앱의 본체다. 빈 배열을 주면
// 화면은 121곳을 전부 「정보 없음」으로 그리면서 **아무 문제 없는 척**한다.
// 502를 올려야 클라이언트가 그 사실을 알고 물러설 길을 고를 수 있다.
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  try {
    const rows = await fetchHotspotRows()
    setCacheHeaders(res, hotspotsCacheTtlSeconds())
    res.status(200).json({ rows })
  } catch (error) {
    console.error('[hotspots] 조회 실패:', error)
    // 실패는 캐시하지 않는다 — 상류가 돌아와도 TTL이 끝날 때까지 같은 오류가
    // 모든 사용자에게 나간다.
    setNoStoreHeader(res)
    res.status(502).json({ error: '혼잡도 정보를 가져오지 못했습니다.' })
  }
}
