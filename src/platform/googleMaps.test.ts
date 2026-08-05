import { afterEach, describe, expect, it, vi } from 'vitest'
import { googleMapsApiKey, googleMapsMapId, isMapAvailable } from './googleMaps'

// 저장소의 .env에는 실제 값이 들어 있고 Vitest도 그걸 읽는다. 모든 케이스에서
// 값을 명시하지 않으면 로컬 .env 내용에 따라 통과 여부가 달라진다.
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('googleMapsApiKey', () => {
  it('설정된 키를 그대로 돌려준다', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'demo-key-1234')

    expect(googleMapsApiKey()).toBe('demo-key-1234')
  })

  it('앞뒤 공백을 떼어낸다', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '  demo-key-1234  ')

    expect(googleMapsApiKey()).toBe('demo-key-1234')
  })

  it('공백만 들어 있으면 빈 문자열로 본다', () => {
    // .env에 `VITE_GOOGLE_MAPS_API_KEY= ` 처럼 실수로 공백이 남는 경우다.
    // 이걸 키로 취급하면 지도가 "키 미설정" 안내 대신 Google의 오류 화면을 띄운다.
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '   ')

    expect(googleMapsApiKey()).toBe('')
  })
})

describe('googleMapsMapId', () => {
  it('설정된 Map ID를 그대로 돌려준다', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_MAP_ID', 'my-own-map-id')

    expect(googleMapsMapId()).toBe('my-own-map-id')
  })

  it('비어 있으면 DEMO_MAP_ID로 떨어진다', () => {
    // AdvancedMarker는 Map ID가 없으면 아예 렌더되지 않는다. 개발자가 Map ID를
    // 발급받기 전에도 마커가 보여야 해서 Google의 테스트용 ID로 떨어뜨린다.
    vi.stubEnv('VITE_GOOGLE_MAPS_MAP_ID', '')

    expect(googleMapsMapId()).toBe('DEMO_MAP_ID')
  })
})

describe('isMapAvailable', () => {
  it('키가 있으면 true', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'demo-key-1234')

    expect(isMapAvailable()).toBe(true)
  })

  it('키가 비어 있으면 false', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')

    expect(isMapAvailable()).toBe(false)
  })
})
