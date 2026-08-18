/**
 * 브라우저 히스토리를 감싸는 얇은 층.
 *
 * **주소가 유일한 진실이다.** `history.state`에 아무것도 안 싣는다 — 두 벌을
 * 들면 언젠가 어긋나고, 어긋난 쪽이 이기는 순간을 테스트로 못 잡는다.
 * `popstate`가 오면 그때의 `location.search`를 다시 읽으면 그만이다.
 *
 * `src/platform/`에 두는 이유는 이 저장소의 규약대로다 — 브라우저 전역을
 * 만지는 코드를 화면에 흩지 않는다. 덕분에 `useRoute`가 이 모듈만 목업하면
 * 히스토리 없이도 테스트된다.
 */

/** `?`를 포함한 지금 쿼리. 쿼리가 없으면 빈 문자열이다. */
export function currentSearch(): string {
  return window.location.search
}

// 경로는 건드리지 않는다. 이 앱은 화면이 하나뿐이고 바뀌는 것은 쿼리뿐이다 —
// 경로까지 쓰면 `vercel.json`에 rewrite가 없어 새로고침이 404가 난다.
function urlFor(search: string): string {
  return `${window.location.pathname}${search}`
}

/**
 * 새 칸을 쌓으며 주소를 바꾼다. 뒤로 가기로 되돌아올 수 있는 이동에 쓴다.
 *
 * **같은 주소면 아무것도 안 한다.** 지도에서 같은 마커를 두 번 누르면
 * `openArea`가 두 번 불리는데, 그때마다 칸이 쌓이면 뒤로 가기를 눌러도 화면이
 * 안 바뀌는 칸을 여러 번 거슬러야 한다.
 */
export function pushSearch(search: string): void {
  if (search === currentSearch()) return
  window.history.pushState(null, '', urlFor(search))
}

/** 지금 칸을 덮으며 주소를 바꾼다. 뒤로 갈 자리를 남기지 않는 이동에 쓴다. */
export function replaceSearch(search: string): void {
  window.history.replaceState(null, '', urlFor(search))
}

/** 뒤로/앞으로 가기를 구독한다. 반환값을 부르면 해제된다. */
export function onPopstate(listener: () => void): () => void {
  window.addEventListener('popstate', listener)
  return () => {
    window.removeEventListener('popstate', listener)
  }
}
