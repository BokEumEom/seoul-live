import type { VercelRequest, VercelResponse } from '@vercel/node'
import { cacheTtlSeconds, fetchArea } from './_lib/seoul.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const area = typeof req.query.area === 'string' ? req.query.area : ''
  if (!area) {
    res.status(400).json({ error: 'area 파라미터가 필요합니다.' })
    return
  }

  try {
    const payload = await fetchArea(area)
    const ttl = cacheTtlSeconds()
    res.setHeader(
      'Cache-Control',
      `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`,
    )
    res.status(200).json(payload)
  } catch (error) {
    // 원본 예외를 응답에 담지 않는다 — 요청 URL(그리고 그 안의 인증키)이 메시지에
    // 실려 있을 수 있다. fetchArea가 이미 키를 치환해서 던지므로 여기서는 그대로
    // 로그로 남겨도 안전하다. 응답에는 절대 error를 넣지 않는다.
    console.error(`[citydata] area="${area}" 조회 실패:`, error)
    res.status(502).json({ error: '혼잡도 정보를 가져오지 못했습니다.' })
  }
}
