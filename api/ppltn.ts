import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAllowedAreaName } from './_lib/allowed-areas.js'
import { setCacheHeaders, setCorsHeaders, setNoStoreHeader } from './_lib/http.js'
import { cacheTtlSeconds } from './_lib/seoul.js'
import { fetchPopulationRows } from './_lib/seoulRtd.js'

// 명소 인구의 시간 대비(1시간·3시간·한달 전)와 24시간 흐름 25칸. `cctv.ts`와
// 모양이 같다 — 같은 상류(SeoulRtd)이고 **인증키를 안 쓰므로 하루 1,000회
// 한도와 무관하다.**
//
// **두 엔드포인트를 한 봉투로 준다.** 화면이 언제나 함께 쓰므로 왕복도 캐시
// 항목도 하나여야 하고, 상류 세션도 한 번만 연다(`_lib/seoulRtd.ts`).
//
// **TTL이 5분이 아니라 상세 혼잡도와 같은 값이다.** 상류는 5분마다 갱신되지만
// (`hotspotsCacheTtlSeconds`의 근거), 이 값은 인구 탭에서 **인원수 바로 옆에
// 놓인다.** 시계를 따로 두면 「38,000명」은 한 시간 전 값이고 「1시간 전보다
// 7% 증가」는 방금 값이 되어, 한 화면의 두 숫자가 서로 다른 순간을 말한다.
// 같은 손잡이(`CACHE_TTL_SECONDS`)에 묶어 두면 둘이 같은 순간에서 온다.
//
// **실패를 502로 올리지 않는다.** 이 상류는 문서화된 API가 아니라 언제든
// 조용히 깨지는데(302 + HTML), 그때마다 인구 탭에 오류가 뜨면 **공식 API에서
// 멀쩡히 온 인원수·구성비까지 고장 난 것처럼 보인다.** 대비 세 칸은 부가
// 정보이고, 없으면 그 절만 빠지는 것이 정직하면서도 화면을 지키는 답이다 —
// CCTV와 같은 판단이고 근거도 같다.
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

  // 서울 쿼터가 안 걸린 경로라도 허용 목록은 필수다. 임의 문자열이 통과하면
  // **남의 서버(SeoulRtd)로 우리가 무제한 요청을 흘려보내는 통로**가 된다.
  if (!isAllowedAreaName(area)) {
    res.status(400).json({ error: '알 수 없는 명소입니다.' })
    return
  }

  try {
    const rows = await fetchPopulationRows(area)
    setCacheHeaders(res, cacheTtlSeconds())
    res.status(200).json(rows)
  } catch (error) {
    console.error(`[ppltn] area="${area}" 조회 실패:`, error)
    // 실패는 캐시하지 않는다 — 상류가 돌아와도 TTL이 끝날 때까지 빈 절이 된다.
    setNoStoreHeader(res)
    // 200 + 빈 봉투다. 관대한 리더가 대비 세 칸을 `null`로, 흐름을 빈 칸으로 읽는다.
    res.status(200).json({ ppltn: [], congest: [] })
  }
}
