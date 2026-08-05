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
