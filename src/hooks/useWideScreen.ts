import { useSyncExternalStore } from 'react'

/**
 * 시트가 왼쪽 패널로 바뀌는 경계.
 *
 * **768px인 것은 고른 값이다.** 그보다 좁으면 400px 패널을 뺀 지도가 368px밖에
 * 안 남아 「지도가 주인공」이 무너진다. 태블릿 세로(768×1024)가 정확히 이
 * 경계에 걸리는데, 그 크기에서는 패널 400 + 지도 368이라 아슬아슬하다 —
 * 실측으로 확인할 자리다.
 */
export const WIDE_SCREEN_QUERY = '(min-width: 768px)'

/**
 * 왼쪽 패널의 폭. 지도 중심 보정이 이 값을 픽셀로 쓰므로 CSS와 **한 곳에서**
 * 나와야 한다 — 두 벌로 두면 한쪽만 고쳐지는 날 지도가 어긋난다.
 */
export const PANEL_WIDTH_PX = 400

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE_SCREEN_QUERY)
  query.addEventListener('change', onChange)
  return () => {
    query.removeEventListener('change', onChange)
  }
}

function readIsWide(): boolean {
  return window.matchMedia(WIDE_SCREEN_QUERY).matches
}

/**
 * 지금 넓은 화면인가.
 *
 * `useSyncExternalStore`를 쓰는 이유는 `useOnlineStatus`와 같다 — 이펙트 안에서
 * `setState`를 부르면 첫 페인트 뒤 한 번 더 그려지고, lint(`react-hooks`)가
 * 그 패턴을 막는다.
 *
 * 서버 스냅샷은 `false`(좁은 화면)다. 이 앱의 주 무대가 토스 미니앱이라
 * 모바일이 기본이고, 넓은 화면은 **더해진 것**이다.
 */
export function useWideScreen(): boolean {
  return useSyncExternalStore(subscribe, readIsWide, () => false)
}
