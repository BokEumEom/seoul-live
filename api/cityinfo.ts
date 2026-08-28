import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAllowedAreaName } from './_lib/allowed-areas.js'
import { setCacheHeaders, setCorsHeaders, setNoStoreHeader } from './_lib/http.js'
import { cityInfoCacheTtlSeconds, fetchArea } from './_lib/seoul.js'

// 상세 화면용. `citydata`는 인구·주차장·따릉이·날씨·문화행사·재난문자를 한
// 응답에 담아준다 — 상세는 이 응답 하나로 혼잡도까지 함께 읽는다(근거는
// populationEnvelope.ts). **이 파일이 공식 서울 OpenAPI(citydata)를 부르는
// 유일한 프록시다.** 예전에는 목록 화면(api/citydata-bulk.ts)도 같은 API를
// 인구만 주는 좁은 서비스(citydata_ppltn)로 따로 불렀는데, 그 프록시는
// 2026-08-27에 지웠다(Task 7) — 목록은 인증키가 필요 없는 /api/hotspots로
// 완전히 갈아탔다(api/hotspots.ts 참고). 그래서 지금은 응답 크기를 나눠 볼
// 상대가 없다.
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

  // 허용 목록 검사는 다른 엔드포인트와 같은 이유로 필수다 — 임의 문자열이 그대로
  // 통과하면 문자열 수만큼 캐시 키와 서울 API 호출이 늘어난다(하루 1,000회 한도).
  if (!isAllowedAreaName(area)) {
    res.status(400).json({ error: '알 수 없는 명소입니다.' })
    return
  }

  try {
    const payload = await fetchArea(area)
    // 혼잡도와 같은 값이다. 손잡이로 따로 조일 수는 있다 — 근거는 cityInfoCacheTtlSeconds의 주석.
    setCacheHeaders(res, cityInfoCacheTtlSeconds())
    res.status(200).json(payload)
  } catch (error) {
    // 원본 예외를 응답에 담지 않는다 — 요청 URL(그리고 그 안의 인증키)이 메시지에
    // 실려 있을 수 있다.
    console.error(`[cityinfo] area="${area}" 조회 실패:`, error)
    // 실패를 캐시하면 서울 API가 복구돼도 TTL이 끝날 때까지 실패로 보인다.
    setNoStoreHeader(res)
    res.status(502).json({ error: '도시 정보를 가져오지 못했습니다.' })
  }
}
