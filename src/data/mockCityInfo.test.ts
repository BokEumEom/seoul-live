import { describe, expect, it } from 'vitest'
import { groupSubwayArrivals } from '../domain/cityInfo'
import { AREA_CATALOG, AREA_NAMES } from './areas'
import { parseCityInfoResponse } from './cityInfoSchema'
import { buildMockCityInfo } from './mockCityInfo'

const NOW = new Date(2026, 7, 7, 10, 30)

function infoFor(name: string) {
  return parseCityInfoResponse(buildMockCityInfo(name, NOW), name)
}

describe('buildMockCityInfo', () => {
  it('실데이터와 같은 파서를 통과한다', () => {
    const info = infoFor('광화문·덕수궁')
    expect(info.areaName).toBe('광화문·덕수궁')
    expect(info.weather).not.toBeNull()
  })

  it('카탈로그의 장소 코드를 그대로 준다', () => {
    // 실제 응답은 등록된 코드를 돌려준다. 목업이 다른 값을 주면 코드 대조나
    // React key로 쓸 때 목업에서만 동작이 갈린다.
    expect(infoFor('경복궁').areaCode).toBe('POI007')
  })

  it('같은 입력이면 같은 결과다', () => {
    expect(buildMockCityInfo('강남역', NOW)).toEqual(buildMockCityInfo('강남역', NOW))
  })

  it('명소마다 날씨가 같지 않다', () => {
    const temps = new Set(AREA_NAMES.map((name) => infoFor(name).weather?.temperature))
    expect(temps.size).toBeGreaterThan(1)
  })

  // 아래 세 테스트는 mock.ts에서 이미 한 번 데인 문제를 막는다 — 목업이 모든
  // 명소에 값을 채워주면 "정보 없음" 빈 상태를 목업만으로는 볼 수 없다.
  it('주차장이 있는 명소와 없는 명소가 둘 다 있다', () => {
    const counts = AREA_NAMES.map((name) => infoFor(name).parking.length)
    expect(counts.some((count) => count > 0)).toBe(true)
    expect(counts.some((count) => count === 0)).toBe(true)
  })

  it('따릉이 대여소가 있는 명소와 없는 명소가 둘 다 있다', () => {
    const counts = AREA_NAMES.map((name) => infoFor(name).bikes.length)
    expect(counts.some((count) => count > 0)).toBe(true)
    expect(counts.some((count) => count === 0)).toBe(true)
  })

  it('문화행사가 있는 명소와 없는 명소가 둘 다 있다', () => {
    const counts = AREA_NAMES.map((name) => infoFor(name).events.length)
    expect(counts.some((count) => count > 0)).toBe(true)
    expect(counts.some((count) => count === 0)).toBe(true)
  })

  it('재난문자가 뜨는 명소와 안 뜨는 명소가 둘 다 있다', () => {
    const counts = AREA_NAMES.map((name) => infoFor(name).alerts.length)
    expect(counts.some((count) => count > 0)).toBe(true)
    expect(counts.some((count) => count === 0)).toBe(true)
  })

  it('만차인 주차장과 여유 있는 주차장이 둘 다 나온다', () => {
    const lots = AREA_CATALOG.flatMap((entry) => infoFor(entry.name).parking)
    expect(lots.some((lot) => lot.available === 0)).toBe(true)
    expect(lots.some((lot) => (lot.available ?? 0) > 0)).toBe(true)
  })

  it('대기 등급이 한 가지로 고정되지 않는다', () => {
    const grades = new Set(AREA_NAMES.map((name) => infoFor(name).weather?.airGrade))
    expect(grades.size).toBeGreaterThan(1)
  })

  it('날씨 관측 시각은 넘겨준 시각을 따른다', () => {
    expect(infoFor('강남역').weather?.updatedAt).toBe('2026-08-07 10:30')
  })

  it('시간대별 예보 24칸을 준다', () => {
    // 파서까지 통과한 값으로 센다. 목업 객체를 직접 들여다보면 FCST24HOURS의
    // 키 이름이 틀려도 통과한다.
    expect(infoFor('광화문·덕수궁').weather?.hourly).toHaveLength(24)
  })

  it('예보 시각이 넘겨준 시각부터 한 시간씩 나아간다', () => {
    const hourly = infoFor('광화문·덕수궁').weather?.hourly ?? []
    // NOW가 10시 30분이라 첫 칸은 10시, 그다음이 11시다.
    expect(hourly[0].time).toBe('202608071000')
    expect(hourly[1].time).toBe('202608071100')
  })

  it('예보 기온이 한 값으로 고정되지 않는다', () => {
    // 상수 곡선이면 「밤에 시원해지나」를 목업으로 확인할 수 없다.
    const temps = new Set(
      (infoFor('광화문·덕수궁').weather?.hourly ?? []).map((entry) => entry.temperature),
    )
    expect(temps.size).toBeGreaterThan(1)
  })

  it('강수확률이 0~100 안에 있다', () => {
    for (const entry of infoFor('강남역').weather?.hourly ?? []) {
      expect(entry.rainChance).toBeGreaterThanOrEqual(0)
      expect(entry.rainChance).toBeLessThanOrEqual(100)
    }
  })

  it('지하철 도착이 있는 명소와 없는 명소가 둘 다 있다', () => {
    // 지하철역이 없는 명소(한강공원 등)의 빈 상태를 목업으로도 볼 수 있어야 한다.
    const counts = AREA_NAMES.map((name) => infoFor(name).subway.length)
    expect(counts.some((count) => count > 0)).toBe(true)
    expect(counts.some((count) => count === 0)).toBe(true)
  })

  it('한 역에 열차가 여러 대 온다', () => {
    // 한 대씩만 오면 역·호선 묶음도 「외 N대」도 목업으로 확인할 수 없다.
    const grouped = AREA_NAMES.map((name) =>
      groupSubwayArrivals(infoFor(name).subway),
    ).flat()
    expect(grouped.some((group) => group.arrivals.length > 1)).toBe(true)
  })

  it('분 단위와 문구형 도착 메세지가 둘 다 나온다', () => {
    // 한쪽만 나오면 다른 쪽 표시를 목업으로 못 본다.
    const messages = AREA_NAMES.flatMap((name) =>
      infoFor(name).subway.map((entry) => entry.message),
    )
    // 실측 형태는 「9분 후 (동대입구)」와 「전역 출발」 둘이다 — 분 단위 쪽도
    // 괄호로 끝나므로 어미가 아니라 안에 든 말로 센다.
    expect(messages.some((message) => message.includes('분 후'))).toBe(true)
    expect(messages.some((message) => message.startsWith('전역'))).toBe(true)
  })
})
