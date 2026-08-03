import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAllowedAreaName } from './_lib/allowed-areas.js'
import { setCacheHeaders, setCorsHeaders, setNoStoreHeader } from './_lib/http.js'
import { cacheTtlSeconds, fetchArea } from './_lib/seoul.js'

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

  // 허용 목록에 없는 이름은 서울 API까지 가지 않고 여기서 막는다 — 그렇지 않으면
  // 임의 문자열이 전부 별개의 캐시 키가 되어 캐시가 무력화되고, 그 문자열 수만큼
  // 서울 API 호출량이 는다(하루 1,000회 한도).
  if (!isAllowedAreaName(area)) {
    res.status(400).json({ error: '알 수 없는 명소입니다.' })
    return
  }

  try {
    const payload = await fetchArea(area)
    setCacheHeaders(res, cacheTtlSeconds())
    res.status(200).json(payload)
  } catch (error) {
    // 원본 예외를 응답에 담지 않는다 — 요청 URL(그리고 그 안의 인증키)이 메시지에
    // 실려 있을 수 있다. fetchArea가 이미 키를 치환해서 던지므로 여기서는 그대로
    // 로그로 남겨도 안전하다. 응답에는 절대 error를 넣지 않는다.
    console.error(`[citydata] area="${area}" 조회 실패:`, error)
    // 실패를 캐시하면 서울 API가 복구돼도 TTL이 끝날 때까지 계속 실패로 보인다.
    setNoStoreHeader(res)
    res.status(502).json({ error: '혼잡도 정보를 가져오지 못했습니다.' })
  }
}
