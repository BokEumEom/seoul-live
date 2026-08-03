import { describe, expect, it } from 'vitest'
import { AREA_CATALOG, findAreaByName } from './areas'

describe('AREA_CATALOG', () => {
  it('1차 목표인 30곳을 담는다', () => {
    expect(AREA_CATALOG).toHaveLength(30)
  })

  it('명소 이름이 중복되지 않는다', () => {
    const names = AREA_CATALOG.map((area) => area.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('명소 코드가 중복되지 않는다', () => {
    const codes = AREA_CATALOG.map((area) => area.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('모든 좌표가 서울 범위 안에 있다', () => {
    for (const area of AREA_CATALOG) {
      expect(area.lat).toBeGreaterThan(37.4)
      expect(area.lat).toBeLessThan(37.75)
      expect(area.lng).toBeGreaterThan(126.75)
      expect(area.lng).toBeLessThan(127.25)
    }
  })

  it('모든 명소에 카테고리가 있다', () => {
    for (const area of AREA_CATALOG) {
      expect(area.category).toBeTruthy()
    }
  })
})

describe('findAreaByName', () => {
  it('이름으로 명소를 찾는다', () => {
    expect(findAreaByName('강남역')?.category).toBe('기타')
  })

  it('없는 이름은 undefined를 준다', () => {
    expect(findAreaByName('부산역')).toBeUndefined()
  })
})
