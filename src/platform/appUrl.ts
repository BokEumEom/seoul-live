import { routeToSearch, type Route } from '../domain/route'

/**
 * 공유 링크의 뿌리 주소.
 *
 * **`window.location`을 그냥 쓰지 않는 이유는 토스다.** 토스 미니앱의 번들은
 * 우리가 서빙하지 않아서, 그 안에서의 `location.origin`이 남에게 열리는
 * 주소인지 **확인한 적이 없다.** 확인 못 한 것을 공유 버튼에 실으면 받은
 * 사람이 아무 데도 못 가는데 보낸 쪽은 그 사실을 모른다.
 *
 * 그래서 배포 도메인을 `VITE_PUBLIC_APP_URL`로 한 번 박아 둔다. 비밀이 아니라
 * 공개 주소이므로 `VITE_` 접두사가 맞다 — 클라이언트 번들에 들어가야 한다.
 *
 * 설정이 없으면 지금 열려 있는 주소로 떨어진다. Vercel 웹에서는 그게 정답이고
 * 개발 서버에서도 그대로 동작한다.
 */
export function appBaseUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL?.trim() ?? ''

  if (configured !== '') {
    // 상대 주소나 오타(`seoul-live.vercel.app`)를 그대로 실으면 링크가 조용히
    // 깨진다. 막을 수 있는 자리는 여기뿐이라 여기서 막는다.
    if (/^https?:\/\//.test(configured)) return configured
    console.error(
      'VITE_PUBLIC_APP_URL이 http(s) 절대 주소가 아니라 무시합니다:',
      configured,
    )
  }

  // 검색어·해시는 뺀다. 뿌리 주소에 지금 보고 있는 명소가 딸려 오면
  // `routeToSearch`가 붙이는 쿼리와 겹친다.
  return `${window.location.origin}${window.location.pathname}`
}

/** 그 화면을 남에게 보낼 수 있는 주소. */
export function shareUrl(route: Route): string {
  return `${appBaseUrl()}${routeToSearch(route)}`
}
