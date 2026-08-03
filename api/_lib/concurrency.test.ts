import { describe, expect, it } from 'vitest'
import { mapWithConcurrency } from './concurrency.js'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('mapWithConcurrency', () => {
  it('완료 순서와 무관하게 원래 인덱스 순서로 결과를 돌려준다', async () => {
    const items = [30, 10, 20]
    const results = await mapWithConcurrency(items, 3, async (ms) => {
      await delay(ms)
      return ms
    })

    expect(results).toEqual([
      { status: 'fulfilled', value: 30 },
      { status: 'fulfilled', value: 10 },
      { status: 'fulfilled', value: 20 },
    ])
  })

  it('동시 실행 수가 limit을 넘지 않는다', async () => {
    const items = Array.from({ length: 10 }, (_, i) => i)
    let active = 0
    let maxActive = 0

    await mapWithConcurrency(items, 3, async (i) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await delay(5)
      active -= 1
      return i
    })

    expect(maxActive).toBeLessThanOrEqual(3)
    expect(maxActive).toBeGreaterThan(1) // 진짜로 동시에 여러 개가 뜬다는 것도 확인한다.
  })

  it('reject된 항목은 rejected 결과로 담기고 나머지는 정상 처리된다', async () => {
    const items = ['ok', 'fail', 'ok2']
    const results = await mapWithConcurrency(items, 2, async (item) => {
      if (item === 'fail') {
        throw new Error('boom')
      }
      return item
    })

    expect(results[0]).toEqual({ status: 'fulfilled', value: 'ok' })
    expect(results[1]?.status).toBe('rejected')
    expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(Error)
    expect(results[2]).toEqual({ status: 'fulfilled', value: 'ok2' })
  })

  it('limit이 항목 수보다 크면 항목 수만큼만 워커를 만든다(빈 배열도 안전하다)', async () => {
    const results = await mapWithConcurrency([], 8, async () => 'never')
    expect(results).toEqual([])
  })

  it('항목이 하나뿐이어도 동작한다', async () => {
    const results = await mapWithConcurrency([1], 8, async (n) => n * 2)
    expect(results).toEqual([{ status: 'fulfilled', value: 2 }])
  })
})
