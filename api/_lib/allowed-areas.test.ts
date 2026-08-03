import { describe, expect, it } from 'vitest'
import { AREA_NAMES } from '../../src/data/areas.js'
import { ALLOWED_AREA_NAMES, isAllowedAreaName } from './allowed-areas.js'

// C1 회귀 방지 — 허용 목록은 src/data/areas.ts를 직접 import하므로 구조적으로
// 어긋날 수 없지만, 나중에 누군가 "간단히" 이름을 손으로 나열하는 방식으로 바꾸면
// 그 순간부터 갈라질 수 있다. 이 테스트가 그 리팩터를 즉시 잡아낸다.
describe('허용 명소 목록은 카탈로그와 일치한다', () => {
  it('ALLOWED_AREA_NAMES가 AREA_NAMES와 정확히 같은 집합이다', () => {
    expect(new Set(ALLOWED_AREA_NAMES)).toEqual(new Set(AREA_NAMES))
    expect(ALLOWED_AREA_NAMES.size).toBe(AREA_NAMES.length)
  })

  it('카탈로그의 모든 이름을 허용한다', () => {
    for (const name of AREA_NAMES) {
      expect(isAllowedAreaName(name)).toBe(true)
    }
  })

  it('카탈로그에 없는 이름은 거부한다', () => {
    expect(isAllowedAreaName('없는명소')).toBe(false)
    expect(isAllowedAreaName('')).toBe(false)
    expect(isAllowedAreaName('강남역 ')).toBe(false) // 공백 등 변형도 그대로 거부
  })
})

// M5 — 카탈로그가 MAX_AREAS(citydata-bulk.ts)보다 커지면 정상 요청조차 400으로
// 막힐 수 있다. 상수를 직접 import하기보다, 현재 값(40)을 여기 고정해 두고 카탈로그가
// 이 한계에 가까워지면(이미 넘었으면 다른 곳에서도 실패하겠지만) 신호를 준다.
describe('카탈로그 크기와 MAX_AREAS의 관계', () => {
  const MAX_AREAS = 40 // api/citydata-bulk.ts와 값을 맞춰서 유지한다.

  it('카탈로그 크기가 MAX_AREAS를 넘지 않는다', () => {
    expect(AREA_NAMES.length).toBeLessThanOrEqual(MAX_AREAS)
  })
})
