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
  //
  // 중복 제거 + 정렬도 함께 한다. 정렬 덕분에 클라이언트가 어떤 순서로 보내든
  // (예: `areas=B,A`와 `areas=A,B`) 실제 서울 API 호출 순서와 응답 JSON의 키
  // 순서가 항상 같아진다 — 같은 명소 집합이면 항상 같은 바이트의 응답이 나온다는
  // 뜻이다. 응답을 이름 키 객체로 만들기 때문에 순서 자체가 클라이언트 파싱에
  // 영향을 주지는 않지만(아래 참고), 이렇게 정규화해두면 동작이 예측 가능해지고
  // 디버깅·테스트 스냅샷이 안정된다.
  const areas = Array.from(new Set(requested.filter(isAllowedAreaName))).toSorted()

  if (areas.length === 0) {
    res.status(400).json({ error: '요청한 명소를 찾을 수 없습니다.' })
    return
  }

  // 개별 명소 실패가 전체 요청을 무너뜨리지 않도록 allSettled를 쓴다.
  // 응답은 위치(인덱스)가 아니라 이름을 키로 쓴다 — `{ results: { "강남역": ..., "경복궁":
  // null } }`. 위치 기반 배열이었다면 클라이언트가 자신이 보낸 순서와 서버가 응답한
  // 순서가 정확히 같다고 가정해야 했다(실제로 그랬다). 이름 키는 그 가정 자체를
  // 없앤다 — 클라이언트는 필요한 이름으로 바로 조회하면 되고, 서버가 중복을
  // 제거하거나 순서를 바꿔도(위에서 이미 그렇게 한다) 깨지지 않는다.
  const settled = await Promise.allSettled(areas.map(fetchArea))
  let successCount = 0
  const results: Record<string, unknown> = {}
  settled.forEach((outcome, index) => {
    const name = areas[index]
    if (outcome.status === 'fulfilled') {
      successCount += 1
      results[name] = outcome.value
      return
    }
    // 원본 예외를 응답에 담지 않는다 — fetchArea가 이미 키를 치환해서 던지므로
    // 로그로 남기는 것 자체는 안전하지만, 클라이언트에는 null만 보낸다.
    console.error(`[citydata-bulk] area="${name}" 조회 실패:`, outcome.reason)
    results[name] = null
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
