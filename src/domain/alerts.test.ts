import { describe, expect, it } from 'vitest'
import { dedupeAlerts } from './alerts'
import type { CityAlert } from './cityInfo'

function alert(message: string, step = '주의보'): CityAlert {
  return { category: '호우', step, message, createdAt: '2026-08-18 14:00' }
}

describe('dedupeAlerts', () => {
  it('빈 목록은 빈 목록이다', () => {
    expect(dedupeAlerts([])).toEqual([])
  })

  // 같은 경보가 여러 명소에 실려 온다. 지우지 않으면 폭염 경보 하나가 30줄이 된다.
  it('같은 문구를 한 번만 남긴다', () => {
    const result = dedupeAlerts([alert('폭염'), alert('폭염'), alert('호우')])

    expect(result.map((a) => a.message)).toEqual(['폭염', '호우'])
  })

  // **문구가 열쇠다.** 같은 문구가 명소마다 다른 `category`·`step`을 달고 올 수
  // 있는데, 화면이 보여주는 것은 문구다 — 다른 필드로 가르면 같은 문장이 두 줄
  // 뜬다.
  it('다른 필드가 달라도 문구가 같으면 하나다', () => {
    const result = dedupeAlerts([alert('폭염', '주의보'), alert('폭염', '경보')])

    expect(result).toHaveLength(1)
  })

  // **정렬하지 않는다.** `createdAt`의 형식이 명세에 없어(다른 자유 문자열과
  // 같다) 시각순으로 세울 근거가 없다. 짐작해 정렬하면 처음 보는 형식에서
  // 순서가 조용히 뒤집힌다 — 배너는 첫 줄만 보여주므로 그게 곧 틀린 경보다.
  it('받은 순서를 지킨다', () => {
    const result = dedupeAlerts([alert('나중'), alert('먼저'), alert('나중')])

    expect(result.map((a) => a.message)).toEqual(['나중', '먼저'])
  })
})
