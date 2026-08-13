import type { Coords } from './types'

// 지도 앱 딥링크 URL 조립. 네트워크도 SDK도 쓰지 않는 순수 계산이라 도메인에 둔다.
// 실제로 여는 것은 platform/links.ts의 openExternalUrl이 맡는다.
//
// 카탈로그에 `광장(전통)시장`, `광화문·덕수궁`처럼 URL에서 의미를 갖는 문자가
// 든 이름이 있어서 인코딩이 필수다.

export function kakaoMapSearchUrl(name: string): string {
  return `https://map.kakao.com/link/search/${encodeURIComponent(name)}`
}

export function naverMapSearchUrl(name: string): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(name)}`
}

/**
 * 티맵 길안내. 카카오·네이버와 달리 **좌표**로 목적지를 넘긴다.
 *
 * 이름 검색 스킴이 티맵에는 없다 — 공식 문서에 URL scheme 안내 자체가 없고,
 * 커뮤니티에서 검증된 `tmap://route?goalname=&goalx=&goaly=`가 iOS·안드로이드
 * 양쪽에서 동작한다는 보고를 따랐다. 카탈로그가 이미 좌표를 갖고 있어 좌표를
 * 넘기는 편이 이름 검색보다 정확하기도 하다.
 *
 * **`goalx`가 경도, `goaly`가 위도다.** 뒤집으면 앱이 아무 불평 없이 바다
 * 한가운데로 안내한다.
 *
 * **이것만 https가 아니다.** 카카오·네이버는 웹 URL이라 브라우저에서도 열리지만
 * 이 커스텀 스킴은 토스 앱의 `Device.openURL`을 거쳐야 뜬다 — 개발 서버에서
 * 눌러도 아무 일이 없는 것이 정상이다(STATE.md의 미해결).
 */
export function tmapRouteUrl(name: string, coords: Coords): string {
  return `tmap://route?goalname=${encodeURIComponent(name)}&goalx=${coords.lng}&goaly=${coords.lat}`
}
