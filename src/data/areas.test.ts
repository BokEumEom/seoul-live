import { describe, expect, it } from 'vitest'
import type { AreaCategory } from '../domain/types'
import { AREA_CATALOG, findAreaByName } from './areas'

const ALL_CATEGORIES: readonly AreaCategory[] = ['공원', '쇼핑몰', '카페', '문화재', '기타']

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

  it('모든 카테고리가 최소 한 곳 이상 등장한다', () => {
    // `area.category`가 비어있지 않은 걸 확인하는 건 AreaCategory 타입이 이미 보장한다.
    // 실제로 값어치 있는 건 필터 탭이 빈 화면이 되지 않는지 — 5개 카테고리 전부가
    // 카탈로그에 최소 하나씩 있는지다.
    const categories = new Set(AREA_CATALOG.map((area) => area.category))
    for (const category of ALL_CATEGORIES) {
      expect(categories.has(category)).toBe(true)
    }
  })

  // 인증키 발급 후 반드시 실행할 것: areas.ts의 name(=AREA_NM)이 실제 서울 열린데이터광장
  // 응답과 일치하는지 30곳 전부 대조한다. 지금은 검증할 방법이 없어 todo로 남겨
  // 테스트를 돌릴 때마다 눈에 띄게 한다.
  it.todo('30개 이름을 실제 API 응답과 대조한다')
})

describe('findAreaByName', () => {
  it('이름으로 명소를 찾는다', () => {
    expect(findAreaByName('강남역')?.category).toBe('기타')
  })

  it('없는 이름은 undefined를 준다', () => {
    expect(findAreaByName('부산역')).toBeUndefined()
  })
})
