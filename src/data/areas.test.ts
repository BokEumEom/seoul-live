import { describe, expect, it } from 'vitest'
import type { AreaCategory } from '../domain/types'
import { AREA_CATALOG, findAreaByName } from './areas'
import { OFFICIAL_AREA_NAMES } from './official-areas'

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

  it('모든 명소 이름이 공식 121곳 목록에 있다', () => {
    // name이 곧 API 호출 키(AREA_NM)다. 목록에 없는 이름은 그 명소만 조용히 실패한다.
    const official = new Set(OFFICIAL_AREA_NAMES)
    const unknown = AREA_CATALOG.map((area) => area.name).filter(
      (name) => !official.has(name),
    )
    expect(unknown).toEqual([])
  })

  // 위 테스트는 "공식 목록에 있는 이름인가"까지만 보장한다. 공백까지 정확한지는 별개다.
  // 매뉴얼 PDF에서 목록을 뽑았는데 텍스트 추출이 공백을 임의로 넣는다
  // ("광장( 전통) 시장", "홍대입구역(2 호선)"). 괄호 주변 공백을 지워 정규화했지만
  // 실제 API가 받는 형태와 같은지는 호출해봐야 안다.
  it.todo('인증키 발급 후 30곳을 실제 호출해 공백까지 일치하는지 확인한다')
})

describe('findAreaByName', () => {
  it('이름으로 명소를 찾는다', () => {
    expect(findAreaByName('강남역')?.category).toBe('기타')
  })

  it('없는 이름은 undefined를 준다', () => {
    expect(findAreaByName('부산역')).toBeUndefined()
  })
})
