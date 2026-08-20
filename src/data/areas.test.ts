import { describe, expect, it } from 'vitest'
import { AREA_CATEGORIES, CATEGORY_LABEL } from '../domain/types'
import { ALERT_SOURCE_AREA, AREA_CATALOG, findAreaByName } from './areas'
import { OFFICIAL_AREA_NAMES } from './official-areas'

describe('AREA_CATALOG', () => {
  it('공식 목록 121곳을 전부 담는다', () => {
    expect(AREA_CATALOG).toHaveLength(121)
  })

  it('명소 이름이 중복되지 않는다', () => {
    const names = AREA_CATALOG.map((area) => area.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('명소 코드가 중복되지 않는다', () => {
    const codes = AREA_CATALOG.map((area) => area.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  // 영어 화면에서 「인사동」이 그대로 남아 있었다. 목록·지도·상세가 전부 이
  // 이름을 쓰므로, 하나라도 비면 영어 사용자는 그 명소를 읽을 수 없다.
  //
  // **한국어 `name`은 API 호출 키이자 지도 앱 검색어라 그대로 둔다.** 여기
  // 더하는 것은 표시용 이름뿐이고, 값과 표시를 가르는 규칙은 AGENTS.md 「언어」에.
  it('121곳 전부 영어 이름이 있다', () => {
    const missing = AREA_CATALOG.filter((area) => area.nameEn.trim() === '')
    expect(missing.map((area) => area.name)).toEqual([])
  })

  it('영어 이름에 한글이 섞이지 않는다', () => {
    // 「Insa-dong(인사동)」처럼 절반만 옮긴 값을 막는다. 영어 화면에서 한글이
    // 보이면 사용자는 「덜 됐다」가 아니라 「지원하지 않는다」로 읽는다.
    const mixed = AREA_CATALOG.filter((area) => /[가-힣]/.test(area.nameEn))
    expect(mixed.map((area) => area.nameEn)).toEqual([])
  })

  it('영어 이름이 중복되지 않는다', () => {
    // 겹치면 목록에 같은 줄이 둘 뜬다 — 「잠실한강공원」과 「잠원한강공원」처럼
    // 로마자가 비슷한 짝이 실제로 있다.
    const names = AREA_CATALOG.map((area) => area.nameEn)
    expect(new Set(names).size).toBe(names.length)
  })

  // **오타가 나면 홈의 재난문자가 조용히 사라진다.** 프록시가 허용 목록에
  // 없는 이름을 400으로 막으므로 화면에는 그냥 「경보 없음」으로 보인다.
  it('재난문자를 받아 오는 명소가 카탈로그에 있다', () => {
    expect(findAreaByName(ALERT_SOURCE_AREA)).toBeDefined()
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
    for (const category of AREA_CATEGORIES) {
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
  // 2026-08-20에 확인했다 — 서울시가 주는 121개 이름과 이 카탈로그가 괄호
  // 주변 공백까지 121/121 일치한다. 그래서 `it.todo`를 지운다.
})

describe('공식 카테고리 마이그레이션', () => {
  it('카탈로그 121곳이 공식 분류로만 이루어진다', () => {
    const counts = AREA_CATALOG.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.category] = (acc[entry.category] ?? 0) + 1
      return acc
    }, {})

    // 매뉴얼 PDF p9~10의 분포와 같아야 한다. 30곳 시절에는 발달상권·공원에
    // 쏠려 있었는데(12/10/3/3/2), 121곳에서는 인구밀집지역이 절반 가까이다 —
    // 서울시가 고른 「주요장소」의 실제 성격이 그렇다.
    expect(counts).toEqual({
      인구밀집지역: 48,
      공원: 33,
      발달상권: 28,
      관광특구: 7,
      '고궁·문화유산': 5,
    })
  })

  it('「기타」가 사라진다', () => {
    expect(AREA_CATALOG.some((e) => (e.category as string) === '기타')).toBe(false)
  })

  it('이름에 관광특구가 든 명소는 관광특구로 분류된다', () => {
    const specials = AREA_CATALOG.filter((e) => e.name.includes('관광특구'))
    expect(specials).toHaveLength(7)
    for (const entry of specials) {
      expect(entry.category).toBe('관광특구')
    }
  })

  it('목적 태그가 이전 프리셋 범위를 그대로 옮긴다', () => {
    const kids = AREA_CATALOG.filter((e) => e.purposes?.includes('kids'))
    const date = AREA_CATALOG.filter((e) => e.purposes?.includes('date'))
    // 이전 정의: kids = 공원(10), date = 카페(3) ∪ 문화재(6) ∪ 공원(10) = 19
    expect(kids).toHaveLength(10)
    expect(date).toHaveLength(19)
  })

  it('모든 공식 분류에 화면 라벨이 있다', () => {
    for (const entry of AREA_CATALOG) {
      expect(CATEGORY_LABEL[entry.category]).toBeTruthy()
    }
  })
})

describe('findAreaByName', () => {
  it('이름으로 명소를 찾는다', () => {
    expect(findAreaByName('강남역')?.category).toBe('인구밀집지역')
  })

  it('없는 이름은 undefined를 준다', () => {
    expect(findAreaByName('부산역')).toBeUndefined()
  })
})
