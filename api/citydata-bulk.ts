import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAllowedAreaName } from './_lib/allowed-areas.js'
import { setCacheHeaders, setCorsHeaders, setNoStoreHeader } from './_lib/http.js'
import { cacheTtlSeconds, fetchArea } from './_lib/seoul.js'

const MAX_AREAS = 40

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const raw = typeof req.query.areas === 'string' ? req.query.areas : ''
  const requested = raw.split(',').map((v) => v.trim()).filter(Boolean)

  if (requested.length === 0) {
    res.status(400).json({ error: 'areas 파라미터가 필요합니다.' })
    return
  }
  // 원시 입력 기준으로 먼저 잘라낸다 — 허용 목록 필터를 통과하기도 전에 거대한
  // 쿼리스트링을 split/filter하는 CPU 낭비를 막는다.
  if (requested.length > MAX_AREAS) {
    res.status(400).json({ error: `한 번에 최대 ${MAX_AREAS}곳까지 조회할 수 있습니다.` })
    return
  }

  // 허용 목록에 없는 이름은 서울 API까지 가지 않고 여기서 버린다 — 그렇지 않으면
  // 임의 문자열이 전부 별개의 캐시 키가 되고, 그 문자열 수만큼 서울 API 호출량이
  // 는다. `curl '.../citydata-bulk?areas=z1,z2,...,z40'` 같은 호출 25번이면
  // 하루 1,000회 한도가 끝난다.
  const areas = requested.filter(isAllowedAreaName)

  if (areas.length === 0) {
    res.status(400).json({ error: '요청한 명소를 찾을 수 없습니다.' })
    return
  }

  // 개별 명소 실패가 전체 요청을 무너뜨리지 않도록 allSettled를 쓴다.
  // 계약: results[i]는 areas[i]에 대응한다 — 순서를 보존해야 클라이언트
  // (src/data/client.ts의 fetchAreaSnapshots)가 인덱스로 짝을 맞출 수 있다.
  const settled = await Promise.allSettled(areas.map(fetchArea))
  let successCount = 0
  const results = settled.map((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      successCount += 1
      return outcome.value
    }
    // 원본 예외를 응답에 담지 않는다 — fetchArea가 이미 키를 치환해서 던지므로
    // 로그로 남기는 것 자체는 안전하지만, 클라이언트에는 null만 보낸다.
    console.error(`[citydata-bulk] area="${areas[index]}" 조회 실패:`, outcome.reason)
    return null
  })

  if (successCount === 0) {
    // 전부 실패 — 서울 API 전체 장애이거나 SEOUL_API_KEY 미설정일 가능성이 크다.
    // 이 상태를 정상 TTL로 캐시하면 최대 몇 시간 동안 모든 사용자가 "정보 없음"을
    // 보게 되고, 그사이 서울 API가 복구돼도 캐시가 만료되기 전까지는 반영되지
    // 않는다. 반면 한 명소만 실패했을 때(다른 29곳은 성공)는 정상 TTL을 유지한다 —
    // 그 한 곳 때문에 나머지 결과까지 버릴 이유는 없다.
    setNoStoreHeader(res)
    res.status(502).json({ error: '혼잡도 정보를 가져오지 못했습니다.' })
    return
  }

  setCacheHeaders(res, cacheTtlSeconds())
  res.status(200).json({ results })
}
