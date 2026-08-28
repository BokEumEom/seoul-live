import { describe, expect, it } from 'vitest'
import { parseHotspotsResponse } from './hotspotsSchema'

// **이 파서 하나에 121곳이 걸려 있다.** 목록·지도·「오늘의 서울」·「내 주변」이
// 전부 `useAreaCongestion` → `fetchAreaCongestion` → 여기로 온다. 상류가
// 문서화된 API가 아니라(`api/_lib/seoulRtd.ts`) 조용히 모양이 바뀔 수 있는데,
// 화면 쪽 테스트는 전부 `useAreaCongestion`을 `vi.mock`으로 갈아 끼우고 준비된
// 값을 먹인다 — 즉 **이 파일이 없으면 이 함수의 분기는 아무도 안 본다.**
// (`useCachedCityAlerts`가 정확히 그 모양으로 조용히 죽은 적이 있다.)

/** 실응답의 필드 이름 그대로다 — 소문자 스네이크다(공식 API의 대문자와 다르다). */
function row(name: string, level: string): Record<string, unknown> {
  return { area_nm: name, area_congest_lvl: level }
}

describe('parseHotspotsResponse — 봉투', () => {
  it('rows 배열을 명소 목록으로 옮긴다', () => {
    const parsed = parseHotspotsResponse({
      rows: [row('강남역', '붐빔'), row('홍대 관광특구', '여유')],
    })

    expect(parsed).toEqual([
      { name: '강남역', congestion: '붐빔' },
      { name: '홍대 관광특구', congestion: '여유' },
    ])
  })

  // **빈 배열로 접으면 안 된다.** 그건 한 명소의 문제가 아니라 상류가 통째로
  // 바뀌었거나 막힌 것이고, 그때 빈 배열을 주면 화면이 121곳을 전부 「정보
  // 없음」으로 그리면서 **아무 문제 없는 척한다.** 던져야 화면이 오류를 말한다.
  it('rows가 배열이 아니면 던진다', () => {
    expect(() => parseHotspotsResponse({ rows: { 강남역: '붐빔' } })).toThrow(
      'rows 배열이 없다',
    )
  })

  it('rows가 아예 없으면 던진다', () => {
    expect(() => parseHotspotsResponse({})).toThrow('rows 배열이 없다')
  })

  // 상류가 302 + HTML을 주고 그게 어쩌다 JSON으로 읽히는 경우, 그리고 프록시가
  // 오류 객체를 200으로 흘리는 경우가 여기로 온다.
  it('봉투가 객체가 아니어도 던진다 — null·배열·문자열', () => {
    expect(() => parseHotspotsResponse(null)).toThrow('rows 배열이 없다')
    expect(() => parseHotspotsResponse([])).toThrow('rows 배열이 없다')
    expect(() => parseHotspotsResponse('<html>')).toThrow('rows 배열이 없다')
  })

  it('rows가 비어 있으면 빈 목록이다 — 그건 정상 응답이다', () => {
    expect(parseHotspotsResponse({ rows: [] })).toEqual([])
  })
})

// **관대함의 방향이 CCTV와 반대다.** 저기는 행이 깨지면 통째로 접었지만
// (부가 정보라 「지금은 없다」가 맞았다), 여기는 행 하나가 명소 하나다 —
// 한 행 때문에 121곳을 버리면 화면이 텅 빈다.
describe('parseHotspotsResponse — 깨진 행만 버린다', () => {
  it('행이 객체가 아니면 그 행만 버리고 나머지는 살린다', () => {
    const parsed = parseHotspotsResponse({
      rows: [row('강남역', '붐빔'), null, 'nope', 42, [], row('경복궁', '보통')],
    })

    expect(parsed).toEqual([
      { name: '강남역', congestion: '붐빔' },
      { name: '경복궁', congestion: '보통' },
    ])
  })

  // 이름이 이 항목의 본체다 — 카탈로그와 맞출 열쇠라서, 없으면 어느 명소인지
  // 알 수 없고 화면에 놓을 자리도 없다.
  it('이름이 비면 그 행을 버린다 — 공백만 있는 것도 빈 것이다', () => {
    const parsed = parseHotspotsResponse({
      rows: [
        { area_congest_lvl: '붐빔' },
        { area_nm: '   ', area_congest_lvl: '붐빔' },
        row('강남역', '붐빔'),
      ],
    })

    expect(parsed).toEqual([{ name: '강남역', congestion: '붐빔' }])
  })

  it('이름 앞뒤 공백은 다듬는다 — 카탈로그 이름과 그대로 맞아야 한다', () => {
    expect(parseHotspotsResponse({ rows: [row('  강남역 ', '붐빔')] })).toEqual([
      { name: '강남역', congestion: '붐빔' },
    ])
  })
})

// **모르는 등급은 짐작하지 않는다.** 틀린 색을 칠하느니 「정보 없음」이 정직하다.
// 다만 행 자체는 살린다 — 이름은 멀쩡하므로 목록에서 사라지면 안 된다.
describe('parseHotspotsResponse — 등급', () => {
  it('네 등급을 글자 그대로 받는다 — 매핑표가 없는 것이 요점이다', () => {
    const parsed = parseHotspotsResponse({
      rows: [
        row('가', '여유'),
        row('나', '보통'),
        row('다', '약간 붐빔'),
        row('라', '붐빔'),
      ],
    })

    expect(parsed.map((entry) => entry.congestion)).toEqual([
      '여유',
      '보통',
      '약간 붐빔',
      '붐빔',
    ])
  })

  it('모르는 등급은 null이고 행은 남는다', () => {
    const parsed = parseHotspotsResponse({
      rows: [row('강남역', '매우 붐빔'), row('경복궁', '')],
    })

    expect(parsed).toEqual([
      { name: '강남역', congestion: null },
      { name: '경복궁', congestion: null },
    ])
  })

  it('등급 필드가 아예 없어도 행은 남는다', () => {
    expect(parseHotspotsResponse({ rows: [{ area_nm: '강남역' }] })).toEqual([
      { name: '강남역', congestion: null },
    ])
  })
})
