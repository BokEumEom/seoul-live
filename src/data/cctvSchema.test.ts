import { describe, expect, it } from 'vitest'
import { parseCctvResponse } from './cctvSchema'

const PROXY = 'https://data.seoul.go.kr/SeoulRtd/cctv/proxy?src=x'

function row(overrides: Record<string, unknown> = {}) {
  return {
    src: PROXY,
    STRMID: 'L010020',
    XCOORD: '126.972',
    YCOORD: '37.576',
    CCTVNAME: '경복궁역',
    ...overrides,
  }
}

describe('parseCctvResponse', () => {
  it('행을 카메라로 옮긴다', () => {
    expect(parseCctvResponse([row()])).toEqual([
      { name: '경복궁역', coords: { lat: 37.576, lng: 126.972 }, streamUrl: PROXY },
    ])
  })

  // **축이 뒤집히기 쉬운 자리다.** XCOORD가 경도, YCOORD가 위도로 온다 —
  // 따릉이(`SBIKE_X`)와 같은 함정이다. 뒤집으면 위도가 126이 되어 지도가
  // 서울이 아니라 지구 밖으로 간다.
  it('XCOORD를 경도로, YCOORD를 위도로 읽는다', () => {
    const [camera] = parseCctvResponse([row({ XCOORD: '127.0278', YCOORD: '37.4982' })])

    expect(camera.coords).toEqual({ lat: 37.4982, lng: 127.0278 })
    // 축이 뒤집혔다면 위도가 127이 됐을 것이다.
    expect(camera.coords?.lat).toBeLessThan(90)
  })

  // 실응답에 위치만 있고 스트림이 없는 카메라가 섞여 온다(반포한강공원).
  // 「실시간 영상」이라 적어 놓고 못 트는 줄을 세우면 약속을 어기는 것이다.
  it('스트림이 없는 행은 버린다', () => {
    expect(parseCctvResponse([row({ src: '' })])).toEqual([])
    expect(parseCctvResponse([row({ src: '   ' })])).toEqual([])
    expect(parseCctvResponse([row({ src: undefined })])).toEqual([])
  })

  // 프록시가 걸러 주지만 클라이언트도 스스로 지킨다 — 이 값은 <video src>에
  // 그대로 들어간다.
  it('HTTPS가 아닌 스트림은 버린다', () => {
    expect(parseCctvResponse([row({ src: 'http://210.179.218.51:1935/x.m3u8' })])).toEqual([])
    expect(parseCctvResponse([row({ src: 'javascript:alert(1)' })])).toEqual([])
  })

  // 이름이 이 항목의 본체다. 이름 없는 카메라는 목록에서 무엇인지 알 수 없고
  // 지도에 찍어도 어느 점인지 모른다.
  it('이름이 없는 행은 버린다', () => {
    expect(parseCctvResponse([row({ CCTVNAME: '' })])).toEqual([])
    expect(parseCctvResponse([row({ CCTVNAME: undefined })])).toEqual([])
  })

  // 좌표는 없어도 볼 수 있다 — 영상이 본체이고 지도는 덤이다. 좌표 없다고
  // 버리면 볼 수 있는 카메라가 사라진다.
  it('좌표가 없어도 카메라는 남긴다', () => {
    const [camera] = parseCctvResponse([row({ XCOORD: '', YCOORD: '' })])

    expect(camera.name).toBe('경복궁역')
    expect(camera.coords).toBeNull()
  })

  // 같은 스트림이 한 명소에 두 번 실려 오면 같은 영상이 두 줄이 된다.
  it('같은 스트림은 한 번만 센다', () => {
    const rows = [row(), row({ CCTVNAME: '경복궁역 2' })]

    expect(parseCctvResponse(rows)).toHaveLength(1)
  })

  // 상류가 문서화된 API가 아니라 무엇이 올지 단정할 수 없다. 도시정보와 같은
  // 방향으로 관대하게 — 던지지 않고 빈 배열로 떨어진다.
  it('배열이 아니거나 모양이 다르면 빈 배열이다', () => {
    expect(parseCctvResponse(null)).toEqual([])
    expect(parseCctvResponse({ error: 'nope' })).toEqual([])
    expect(parseCctvResponse([1, 'x', null])).toEqual([])
  })

  it('여러 대를 순서대로 돌려준다', () => {
    const rows = [
      row({ CCTVNAME: '광화문', src: `${PROXY}1` }),
      row({ CCTVNAME: '세종대로', src: `${PROXY}2` }),
    ]

    expect(parseCctvResponse(rows).map((camera) => camera.name)).toEqual([
      '광화문',
      '세종대로',
    ])
  })
})
