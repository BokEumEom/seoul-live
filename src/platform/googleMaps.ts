// Google Maps SDK 경계. 앱인토스 브리지(links.ts)와 성질이 같다 — jsdom에도
// 없고, 키가 설정되지 않은 환경에도 없다. VITE_GOOGLE_MAPS_* 를 읽는 코드가
// 흩어지면 "키가 없으면 무슨 일이 나는가"를 화면마다 따로 처리하게 된다.
//
// 이 키가 클라이언트 번들에 들어가는 것은 의도된 동작이다. SEOUL_API_KEY와
// 달리 프록시 뒤로 숨길 수 없다 — 지도 타일과 스크립트를 브라우저가 직접
// 받아야 하기 때문이다. 보호는 Google Cloud 콘솔의 리퍼러·API 제한으로 한다.
// 근거는 docs/superpowers/specs/2026-08-04-map-tab-design.md §2.3.

// AdvancedMarker는 Map ID를 요구한다. 없으면 마커가 아예 렌더되지 않는다.
// Google이 개발·테스트용으로 제공하는 ID이고, 출시 전에는 자체 ID로 바꾼다.
const DEMO_MAP_ID = 'DEMO_MAP_ID'

function readEnv(value: string | undefined): string {
  return value?.trim() ?? ''
}

export function googleMapsApiKey(): string {
  return readEnv(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
}

export function googleMapsMapId(): string {
  const mapId = readEnv(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID)
  return mapId === '' ? DEMO_MAP_ID : mapId
}

/** 지도를 그릴 수 있는가. false면 화면은 안내로 대체한다. */
export function isMapAvailable(): boolean {
  return googleMapsApiKey() !== ''
}
