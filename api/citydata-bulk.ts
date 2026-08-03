import type { VercelRequest, VercelResponse } from '@vercel/node'
import { cacheTtlSeconds, fetchArea } from './_lib/seoul.js'

const MAX_AREAS = 40

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

  const raw = typeof req.query.areas === 'string' ? req.query.areas : ''
  const areas = raw.split(',').map((v) => v.trim()).filter(Boolean)

  if (areas.length === 0) {
    res.status(400).json({ error: 'areas 파라미터가 필요합니다.' })
    return
  }
  if (areas.length > MAX_AREAS) {
    res.status(400).json({ error: `한 번에 최대 ${MAX_AREAS}곳까지 조회할 수 있습니다.` })
    return
  }

  // 개별 명소 실패가 전체 요청을 무너뜨리지 않도록 allSettled를 쓴다.
  // 계약: results[i]는 areas[i]에 대응한다 — 순서를 보존해야 클라이언트
  // (src/data/client.ts의 fetchAreaSnapshots)가 인덱스로 짝을 맞출 수 있다.
  const settled = await Promise.allSettled(areas.map(fetchArea))
  const results = settled.map((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      return outcome.value
    }
    // 원본 예외를 응답에 담지 않는다 — fetchArea가 이미 키를 치환해서 던지므로
    // 로그로 남기는 것 자체는 안전하지만, 클라이언트에는 null만 보낸다.
    console.error(`[citydata-bulk] area="${areas[index]}" 조회 실패:`, outcome.reason)
    return null
  })

  const ttl = cacheTtlSeconds()
  res.setHeader(
    'Cache-Control',
    `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`,
  )
  res.status(200).json({ results })
}
