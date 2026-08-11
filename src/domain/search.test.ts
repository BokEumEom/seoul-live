import { describe, expect, it } from 'vitest'
import { searchAreas } from './search'
import type { NearbyArea } from './types'

function area(name: string): NearbyArea {
  return {
    entry: { code: name, name, lat: 0, lng: 0, category: '발달상권' },
    snapshot: null,
    distanceMeters: null,
  }
}

const AREAS = [area('성수카페거리'), area('연남동'), area('DDP(동대문디자인플라자)')]

describe('searchAreas', () => {
  // toEqual이 아니라 toBe다. ''.includes('')가 언제나 참이라 조기 반환이
  // 없어도 filter는 전체를 돌려주고, 깊은 비교로는 그 차이를 잡지 못한다.
  // 조기 반환의 값어치는 "같은 배열"을 준다는 것 자체다 — 매번 새 배열을
  // 만들면 하위 useMemo가 검색어와 무관하게 다시 계산된다.
  it('빈 문자열이면 받은 배열을 그대로 돌려준다', () => {
    expect(searchAreas(AREAS, '')).toBe(AREAS)
  })

  it('공백만 있어도 받은 배열을 그대로 돌려준다', () => {
    expect(searchAreas(AREAS, '   ')).toBe(AREAS)
  })

  it('부분일치로 거른다', () => {
    expect(searchAreas(AREAS, '성수').map((a) => a.entry.name)).toEqual(['성수카페거리'])
  })

  it('대소문자를 구분하지 않는다', () => {
    expect(searchAreas(AREAS, 'ddp')).toHaveLength(1)
  })

  it('입력의 앞뒤 공백을 무시한다', () => {
    expect(searchAreas(AREAS, '  연남  ')).toHaveLength(1)
  })

  it('맞는 게 없으면 빈 배열이다', () => {
    expect(searchAreas(AREAS, '없는곳')).toEqual([])
  })

  // "입력 배열 불변"은 쓰지 않는다 — filter로는 어떤 구현도 입력을 건드릴 수
  // 없어 무엇을 해도 통과한다. 이 저장소가 같은 이름의 테스트를 변이 테스트로
  // 이미 한 번 걷어냈다. 대신 결과 순서를 고정한다: 알파벳순으로 정렬하는
  // 구현이었다면 DDP가 앞으로 와 실패한다.
  it('일치하는 항목의 원래 순서를 지킨다', () => {
    expect(searchAreas(AREAS, '동').map((a) => a.entry.name)).toEqual([
      '연남동',
      'DDP(동대문디자인플라자)',
    ])
  })
})
