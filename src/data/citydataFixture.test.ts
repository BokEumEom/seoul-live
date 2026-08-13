import { describe, expect, it } from 'vitest'
// JSON을 import로 읽는다. jsdom 환경에서는 `import.meta.url`이 file: 스킴이
// 아니라 http:라 `readFileSync(new URL(...))`가 죽는다.
import fixture from '../../docs/fixtures/citydata-광화문덕수궁.json'
import { parseCityInfoResponse } from './cityInfoSchema'

// **실호출 응답 한 벌을 그대로 파서에 통과시킨다.** 2026-08-13에 인증키로
// `/citydata/1/5/광화문·덕수궁`을 불러 받은 것이고, 큰 섹션만 개수를 줄였다
// (구조는 손대지 않았다).
//
// 이 파일이 있는 이유: 명세의 출력명 표만 보고 짐작했던 두 곳이 실제로 틀렸다.
// 도로소통과 지하철이 한 겹 더 들어가 있었는데, **손으로 지어낸 목업과 손으로
// 지어낸 테스트가 서로 같은 오해를 공유해서 둘 다 통과했다.** 실제 응답을
// 자료로 두고 대조하는 것만이 그 종류의 오해를 깬다.
//
// 갱신법: `/api/cityinfo?area=<명소>` 응답을 받아 같은 자리에 덮어쓴다.
const FIXTURE: unknown = fixture

const AREA = '광화문·덕수궁'

describe('실호출 citydata 응답 (2026-08-13)', () => {
  const info = parseCityInfoResponse(FIXTURE, AREA)

  it('장소명과 코드를 읽는다', () => {
    expect(info.areaName).toBe(AREA)
    expect(info.areaCode).toBe('POI009')
  })

  it('도로소통을 읽는다', () => {
    // AVG_ROAD_DATA 안에 있다. 바깥에서 읽으면 여기가 null이 된다.
    expect(info.roadTraffic).not.toBeNull()
    expect(info.roadTraffic?.index).not.toBe('')
    expect(info.roadTraffic?.speed).not.toBeNull()
  })

  it('지하철 도착을 읽는다', () => {
    // SUB_DETAIL 안에 있다. 바깥에서 읽으면 역 이름만 있고 열차가 비어 있었다.
    expect(info.subway.length).toBeGreaterThan(0)
    expect(info.subway.every((entry) => entry.station !== '')).toBe(true)
    expect(info.subway.every((entry) => entry.line.endsWith('호선'))).toBe(true)
    expect(info.subway.some((entry) => entry.message !== '')).toBe(true)
  })

  it('시간대별 예보 24칸을 읽는다', () => {
    expect(info.weather?.hourly).toHaveLength(24)
    // FCST_DT가 붙여 쓴 12자리로 온다 — forecastHourLabel이 읽는 형식이다.
    expect(info.weather?.hourly[0].time).toMatch(/^\d{12}$/)
    expect(info.weather?.hourly[0].temperature).not.toBeNull()
  })

  it('날씨와 대기질을 읽는다', () => {
    expect(info.weather?.temperature).not.toBeNull()
    expect(info.weather?.airGrade).not.toBe('')
  })

  it('주차장·따릉이·행사를 읽는다', () => {
    expect(info.parking.length).toBeGreaterThan(0)
    expect(info.bikes.length).toBeGreaterThan(0)
    // 명세는 CULTURALEVENTINFO라고 적었지만 실제 키는 EVENT_STTS다.
    expect(info.events.length).toBeGreaterThan(0)
  })

  it('어느 섹션이든 내용이 있다', () => {
    // hasAnyCityInfo가 false면 화면이 「정보 없음」만 띄운다.
    expect(info.parking.length + info.bikes.length + info.subway.length).toBeGreaterThan(0)
  })
})
