import { describe, expect, it } from 'vitest'
import { LIST_ROUTE, type Route, routeFromSearch, routeToSearch } from './route'

// 카탈로그 전체를 끌어오지 않는다. 이 파일이 검사하는 것은 「모르는 이름을
// 거른다」이지 「지금 30곳이 무엇이냐」가 아니다 — 카탈로그를 쓰면 명소가
// 늘어날 때마다 이 테스트가 이유 없이 흔들린다.
const KNOWN: readonly string[] = ['강남역', '광화문·덕수궁']

describe('routeToSearch', () => {
  it('목록은 쿼리를 남기지 않는다', () => {
    // 기본 화면이 `?view=list`를 달고 다니면 공유·북마크한 주소가 전부
    // 지저분해진다. 아무것도 없는 것이 목록이다.
    expect(routeToSearch(LIST_ROUTE)).toBe('')
  })

  it('명소는 이름을 인코딩해 싣는다', () => {
    expect(routeToSearch({ kind: 'area', name: '강남역' })).toBe(
      '?area=%EA%B0%95%EB%82%A8%EC%97%AD',
    )
  })

  it('오늘의 서울은 view로 싣는다', () => {
    expect(routeToSearch({ kind: 'today' })).toBe('?view=today')
  })
})

describe('routeFromSearch', () => {
  it('빈 쿼리는 목록이다', () => {
    expect(routeFromSearch('', KNOWN)).toEqual(LIST_ROUTE)
  })

  it('물음표가 있든 없든 같게 읽는다', () => {
    // `window.location.search`는 물음표를 포함해서 주고, 우리가 만든 문자열도
    // 그렇다. 두 벌을 다르게 다루면 호출부마다 자르는 코드가 붙는다.
    const withMark = routeFromSearch('?area=%EA%B0%95%EB%82%A8%EC%97%AD', KNOWN)
    const without = routeFromSearch('area=%EA%B0%95%EB%82%A8%EC%97%AD', KNOWN)
    expect(withMark).toEqual({ kind: 'area', name: '강남역' })
    expect(without).toEqual(withMark)
  })

  it('카탈로그에 없는 이름은 목록으로 떨어뜨린다', () => {
    // **주소는 남이 준다.** 공유 링크는 누구나 고쳐 보낼 수 있고, 거른 이름이
    // 그대로 통과하면 이 앱에 없는 명소의 상세가 열려 조회까지 나간다.
    // 프록시에도 허용 목록이 있지만 그건 두 번째 방벽이지 첫 번째가 아니다.
    expect(routeFromSearch('?area=평양역', KNOWN)).toEqual(LIST_ROUTE)
  })

  it('빈 area 값은 목록이다', () => {
    expect(routeFromSearch('?area=', KNOWN)).toEqual(LIST_ROUTE)
  })

  it('모르는 view 값은 목록이다', () => {
    expect(routeFromSearch('?view=settings', KNOWN)).toEqual(LIST_ROUTE)
  })

  it('명소와 view가 함께 오면 명소가 이긴다', () => {
    // 시트가 셋 중 하나를 고르는 순서(`HomeScreen`의 `sheetContent`)와 같아야
    // 한다. 다르면 주소는 오늘의 서울인데 화면은 상세인 상태가 만들어진다.
    expect(routeFromSearch('?view=today&area=%EA%B0%95%EB%82%A8%EC%97%AD', KNOWN)).toEqual({
      kind: 'area',
      name: '강남역',
    })
  })

  it('다른 쿼리가 섞여 있어도 무시하고 읽는다', () => {
    // 유입 추적 파라미터(`utm_source` 등)가 붙어 오는 것은 흔하다.
    expect(routeFromSearch('?utm_source=kakao&view=today', KNOWN)).toEqual({
      kind: 'today',
    })
  })
})

describe('왕복', () => {
  // 인코딩을 손으로 적은 위 단언은 형식을 고정하지만 「되돌아오는가」는 안
  // 말해준다. 가운뎃점(U+00B7)이 든 이름이 실제 카탈로그에 있어 특히 중요하다.
  const routes: readonly Route[] = [
    LIST_ROUTE,
    { kind: 'today' },
    { kind: 'area', name: '강남역' },
    { kind: 'area', name: '광화문·덕수궁' },
  ]

  it.each(routes)('$kind $name', (route) => {
    expect(routeFromSearch(routeToSearch(route), KNOWN)).toEqual(route)
  })
})
