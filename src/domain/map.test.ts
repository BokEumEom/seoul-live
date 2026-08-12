import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ZOOM,
  LABEL_MIN_ZOOM,
  SEOUL_CENTER,
  shouldShowMarkerLabel,
  toMapMarkers,
} from './map'
import type { AreaCatalogEntry, AreaSnapshot, NearbyArea } from './types'

function entry(name: string, code: string): AreaCatalogEntry {
  return { code, name, lat: 37.5, lng: 127, category: '인구밀집지역' }
}

function snapshot(name: string): AreaSnapshot {
  return {
    code: 'POI000',
    name,
    congestion: '붐빔',
    message: '사람이 많아 붐빕니다.',
    populationMin: 42_000,
    populationMax: 44_000,
    observedAt: '2026-08-05 14:00',
    observedAtLabel: '14:00',
    forecasts: [],
    composition: null,
    replaced: null,
  }
}

function area(name: string, code: string, withSnapshot: boolean): NearbyArea {
  return {
    entry: entry(name, code),
    snapshot: withSnapshot ? snapshot(name) : null,
    distanceMeters: null,
  }
}

describe('기본 뷰 상수', () => {
  it('서울 전역이 들어오는 줌에서 시작한다', () => {
    // 11보다 크면 서울 외곽 명소가 초기 화면에서 잘린다.
    expect(DEFAULT_ZOOM).toBe(11)
  })

  it('초기 중심이 서울 안이다', () => {
    expect(SEOUL_CENTER.lat).toBeGreaterThan(37.4)
    expect(SEOUL_CENTER.lat).toBeLessThan(37.7)
    expect(SEOUL_CENTER.lng).toBeGreaterThan(126.8)
    expect(SEOUL_CENTER.lng).toBeLessThan(127.2)
  })

  it('라벨 표시 줌이 기본 줌보다 크다', () => {
    // 같거나 작으면 초기 화면에서 라벨이 전부 켜져 도심 명소끼리 겹친다.
    expect(LABEL_MIN_ZOOM).toBeGreaterThan(DEFAULT_ZOOM)
  })
})

describe('shouldShowMarkerLabel', () => {
  it('기본 줌에서는 라벨을 감춘다', () => {
    expect(shouldShowMarkerLabel(DEFAULT_ZOOM)).toBe(false)
  })

  it('경계값 바로 아래에서는 감춘다', () => {
    expect(shouldShowMarkerLabel(LABEL_MIN_ZOOM - 1)).toBe(false)
  })

  it('경계값에서는 보여준다', () => {
    expect(shouldShowMarkerLabel(LABEL_MIN_ZOOM)).toBe(true)
  })

  it('충분히 확대하면 보여준다', () => {
    expect(shouldShowMarkerLabel(16)).toBe(true)
  })
})

describe('toMapMarkers', () => {
  it('스냅샷이 있으면 혼잡도를 싣는다', () => {
    const markers = toMapMarkers([area('강남역', 'POI014', true)])

    expect(markers).toEqual([
      {
        entry: entry('강남역', 'POI014'),
        level: '붐빔',
        // 지도에 넘길 좌표를 여기서 한 번 만든다 — 호출부에서 만들면 매 렌더
        // 신원이 바뀌어 vis.gl이 마커마다 position을 다시 대입한다.
        position: { lat: 37.5, lng: 127 },
      },
    ])
  })

  it('스냅샷이 없는 명소도 마커를 만든다', () => {
    // 지도에서만 사라지면 사용자는 그 명소가 없다고 오인한다. 「내 주변」은
    // 같은 명소를 "정보 없음" 배지로 보여주고 있다.
    const markers = toMapMarkers([area('경복궁', 'POI007', false)])

    expect(markers).toHaveLength(1)
    expect(markers[0].level).toBeNull()
    expect(markers[0].entry.name).toBe('경복궁')
  })

  it('스냅샷 유무가 섞여도 전부 유지한다', () => {
    const markers = toMapMarkers([
      area('강남역', 'POI014', true),
      area('경복궁', 'POI007', false),
      area('남산공원', 'POI088', true),
    ])

    expect(markers.map((m) => m.entry.name)).toEqual([
      '강남역',
      '경복궁',
      '남산공원',
    ])
    expect(markers.map((m) => m.level)).toEqual(['붐빔', null, '붐빔'])
  })

  it('빈 목록은 빈 결과다', () => {
    expect(toMapMarkers([])).toEqual([])
  })
})
