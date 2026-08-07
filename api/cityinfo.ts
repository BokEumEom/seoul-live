import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAllowedAreaName } from './_lib/allowed-areas.js'
import { setCacheHeaders, setCorsHeaders, setNoStoreHeader } from './_lib/http.js'
import { cityInfoCacheTtlSeconds, fetchArea } from './_lib/seoul.js'

// 「더보기」(도시정보) 화면용. citydata.ts와 구조가 같고 서비스 이름만 다르다 —
// `citydata`는 주차장·따릉이·날씨·문화행사·재난문자를 한 응답에 담아준다.
// 엔드포인트를 나눈 이유는 캐시다. 응답 크기가 인구만 받는 쪽의 몇 배라, 같은
// 경로에 얹으면 인구만 필요한 목록 화면까지 큰 응답을 CDN에서 받게 된다.
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

  // 허용 목록 검사는 citydata.ts와 같은 이유로 필수다 — 임의 문자열이 그대로
  // 통과하면 문자열 수만큼 캐시 키와 서울 API 호출이 늘어난다(하루 1,000회 한도).
  if (!isAllowedAreaName(area)) {
    res.status(400).json({ error: '알 수 없는 명소입니다.' })
    return
  }

  try {
    const payload = await fetchArea(area, 'citydata')
    // 혼잡도와 다른 TTL을 쓴다 — 근거는 cityInfoCacheTtlSeconds의 주석(쿼터 배분).
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
