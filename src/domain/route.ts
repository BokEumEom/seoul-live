/**
 * 주소에 실리는 화면 상태.
 *
 * **셋뿐이다.** 시트가 고르는 것이 목록·명소 상세·오늘의 서울 셋이라
 * (`HomeScreen`의 `sheetContent`) 그대로 옮겼다.
 *
 * **필터·정렬·검색어는 안 싣는다.** 칩을 한 번 누를 때마다 주소가 바뀌면
 * 히스토리에 칸이 하나씩 쌓여, 상세를 보다 뒤로 가려는 사용자가 칩 조작
 * 열몇 번을 거꾸로 되밟게 된다. 공유·새로고침이 지켜야 하는 것은 「어느
 * 화면을 보고 있었나」이지 「어떤 칩을 눌러 두었나」가 아니다.
 */
export type Route =
  | { readonly kind: 'list' }
  | { readonly kind: 'area'; readonly name: string }
  | { readonly kind: 'today' }

export const LIST_ROUTE: Route = { kind: 'list' }

const AREA_PARAM = 'area'
const VIEW_PARAM = 'view'
const TODAY_VALUE = 'today'

/**
 * 주소에 붙일 쿼리 문자열. 목록은 빈 문자열이라 기본 화면의 주소가 깨끗하다.
 *
 * **경로가 아니라 쿼리인 이유:** `vercel.json`에 SPA rewrite가 없어서
 * `/area/강남역`은 새로고침하면 404다. 공유 링크는 언제나 남의 첫 방문이라
 * 그 경로로는 성립하지 않는다. 토스 쪽은 번들을 우리가 서빙하지도 않는다.
 */
export function routeToSearch(route: Route): string {
  switch (route.kind) {
    case 'list':
      return ''
    case 'area':
      return `?${new URLSearchParams({ [AREA_PARAM]: route.name }).toString()}`
    case 'today':
      return `?${new URLSearchParams({ [VIEW_PARAM]: TODAY_VALUE }).toString()}`
  }
}

/**
 * 주소를 화면 상태로 읽는다. 모르는 값은 전부 목록으로 떨어진다.
 *
 * **`knownAreaNames`를 받는 이유는 둘이다.** 하나는 `src/domain/`이
 * `src/data/`를 import하지 않는다는 이 저장소의 규약이고, 다른 하나가 더
 * 중요하다 — **주소는 남이 준다.** 공유 링크는 누구나 고쳐 보낼 수 있어서,
 * 거르지 않으면 카탈로그에 없는 이름의 상세가 열리고 그 이름으로 조회까지
 * 나간다. 프록시의 허용 목록은 두 번째 방벽이지 첫 번째가 아니다.
 */
export function routeFromSearch(
  search: string,
  knownAreaNames: readonly string[],
): Route {
  // **맨 앞 물음표는 `URLSearchParams`가 뗀다.** 직접 `slice(1)`로 떼는 줄을
  // 한 번 넣었다가 지웠다 — 돌연변이로 확인해 보니 그 줄을 없애도 테스트가
  // 전부 통과했다. 표준이 이미 하는 일이라 **어떤 테스트로도 못 죽이는
  // 분기**였다(이 저장소가 `?.`를 두고 금지하는 것과 같은 것이다).
  // 위 테스트는 그래도 남는다 — 잠그는 것은 우리 코드가 아니라 「두 형태가
  // 같게 읽힌다」는 계약이고, 호출부가 실제로 두 벌을 섞어 넣는다.
  const params = new URLSearchParams(search)

  const area = params.get(AREA_PARAM)
  // 명소가 view보다 앞선다 — `sheetContent`의 순서와 같다. 다르면 주소는
  // 오늘의 서울인데 화면은 상세인 상태가 만들어진다.
  if (area !== null && knownAreaNames.includes(area)) {
    return { kind: 'area', name: area }
  }

  if (params.get(VIEW_PARAM) === TODAY_VALUE) {
    return { kind: 'today' }
  }

  return LIST_ROUTE
}
