import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAllowedAreaName } from './_lib/allowed-areas.js'
import { setCacheHeaders, setCorsHeaders, setNoStoreHeader } from './_lib/http.js'
import { cctvCacheTtlSeconds } from './_lib/seoul.js'
import { fetchCctvRows } from './_lib/seoulRtd.js'

// 명소 주변 교통 CCTV. cityinfo.ts와 모양이 같지만 **상류가 다르다** —
// 서울 OpenAPI가 아니라 서울시 실시간 도시데이터 웹(SeoulRtd)의 내부
// 엔드포인트다. 인증키를 안 쓰므로 **하루 1,000회 한도와 무관하다**
// (`api/_lib/seoulRtd.ts` 참고).
//
// **실패를 502로 올리지 않고 빈 목록으로 접는다.** 이 상류는 문서화된 API가
// 아니라 언제든 바뀌거나 막힐 수 있는데, 그때마다 상세 화면에 빨간 오류가
// 뜨면 **멀쩡한 나머지 정보까지 고장 난 것처럼 보인다.** CCTV는 부가 정보라
// 「지금은 없다」가 정직하면서도 화면을 지키는 답이다. 30곳 중 10곳은 애초에
// 빈 배열이 정상이라 사용자에게는 같은 상태로 보인다.
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const area = typeof req.query.area === 'string' ? req.query.area : ''
  if (!area) {
    res.status(400).json({ error: 'area 파라미터가 필요합니다.' })
    return
  }

  // 허용 목록 검사는 다른 엔드포인트와 같은 이유로 필수다. 여기는 서울 API
  // 쿼터가 걸려 있지 않지만, 임의 문자열이 통과하면 **남의 서버(SeoulRtd)로
  // 우리가 무제한 요청을 흘려보내는 통로**가 된다.
  if (!isAllowedAreaName(area)) {
    res.status(400).json({ error: '알 수 없는 명소입니다.' })
    return
  }

  try {
    const rows = await fetchCctvRows(area)
    setCacheHeaders(res, cctvCacheTtlSeconds())
    res.status(200).json(rows)
  } catch (error) {
    console.error(`[cctv] area="${area}" 조회 실패:`, error)
    // 실패는 캐시하지 않는다 — 상류가 돌아와도 TTL이 끝날 때까지 빈 화면이 된다.
    setNoStoreHeader(res)
    // 200 + 빈 배열이다. 위 주석의 판단 — 부가 정보라 화면을 깨지 않는다.
    res.status(200).json([])
  }
}
