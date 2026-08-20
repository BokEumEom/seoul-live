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

// **이 자리에 있던 불변식은 2026-08-20에 깨졌고, 깨지는 것이 맞았다.**
//
// 예전 규칙은 「카탈로그가 `MAX_AREAS`(40)를 넘지 않는다」였다. 목록 화면이
// 카탈로그 전체를 `citydata-bulk`에 한 번에 실어 보냈으므로, 넘으면 정상 요청이
// 400으로 막혔기 때문이다. 121곳으로 늘리면서 **목록이 그 엔드포인트를 아예 안
// 쓴다** — 인증키 없이 한 번에 전부 주는 `/api/hotspots`로 갔다.
//
// 그래서 지금 지켜야 할 것은 크기가 아니라 **누가 무엇을 부르는가**다.
// `citydata-bulk`는 이제 「몇 곳을 골라 부르는」 자리에만 쓰이고, 그 자리는
// 40곳을 넘길 이유가 없다. 카탈로그 크기와는 무관해졌다.
describe('허용 목록과 카탈로그', () => {
  it('카탈로그가 121곳으로 늘어도 허용 목록이 함께 따라온다', () => {
    // 손으로 옮겨 적은 목록이었다면 여기서 갈렸을 자리다.
    expect(AREA_NAMES.length).toBe(121)
    expect(isAllowedAreaName('서울역')).toBe(true)
    expect(isAllowedAreaName('올림픽공원')).toBe(true)
  })
})
