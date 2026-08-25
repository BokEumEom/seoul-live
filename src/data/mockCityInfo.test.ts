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
    expect(infoFor('경복궁').areaCode).toBe('POI008')
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

  // **목업이 한 갈래를 아예 안 내면 그 갈래는 개발 중에 한 번도 안 보인다.**
  // 실호출 227곳 중 61곳이 거치대보다 자전거가 많았는데, `% (racks + 1)`로
  // 두던 예전 목업에서는 그런 대여소가 나올 수 없었다.
  it('거치대가 찬 대여소와 여유 있는 대여소가 둘 다 나온다', () => {
    const rates = AREA_NAMES.flatMap((name) =>
      infoFor(name).bikes.flatMap((spot) => (spot.dockRate === null ? [] : [spot.dockRate])),
    )
    expect(rates.some((rate) => rate >= 100)).toBe(true)
    expect(rates.some((rate) => rate < 100)).toBe(true)
  })

  // 거치율이 대수와 어긋나면 화면이 「7대 가능 / 반납 자리 없음」처럼 모순된
  // 두 값을 그린다 — 실호출에서는 안 일어나는 모양이다.
  it('거치율이 대수와 앞뒤가 맞는다', () => {
    for (const name of AREA_NAMES) {
      for (const spot of infoFor(name).bikes) {
        if (spot.dockRate === null || spot.bikes === null || spot.racks === null) {
          continue
        }
        const expected = Math.round((spot.bikes / spot.racks) * 100)
        expect(Math.abs(spot.dockRate - expected)).toBeLessThanOrEqual(1)
      }
    }
  })

  // 끝난 행사의 파일이 내려간 경우다. 그림이 늘 있으면 `EventThumbnail`의
  // 빈 자리 처리를 개발 중에 못 본다.
  it('그림이 있는 행사와 없는 행사가 둘 다 나온다', () => {
    const thumbnails = AREA_NAMES.flatMap((name) =>
      infoFor(name).events.map((event) => event.thumbnail),
    )
    expect(thumbnails.some((url) => url !== '')).toBe(true)
    expect(thumbnails.some((url) => url === '')).toBe(true)
  })

  // **명세에 없는 필드다**(`ACDNT_ENG_INFO`). 목업이 이걸 안 내면 영어 화면의
  // 통제 내용이 개발 중에는 한국어로 보이고 실데이터에서만 영어가 된다.
  it('사고통제에 영어 원문과 좌표와 갱신시각이 있다', () => {
    const withAccidents = AREA_NAMES.map(infoFor).filter(
      (info) => info.accidents.length > 0,
    )
    expect(withAccidents.length).toBeGreaterThan(0)
    for (const info of withAccidents) {
      expect(info.accidentsUpdatedAt).not.toBe('')
      for (const accident of info.accidents) {
        expect(accident.infoEn).not.toBe('')
        expect(accident.coords).not.toBeNull()
      }
    }
  })

  // 실호출 840칸 중 75칸에만 값이 있었다. 목업이 한쪽만 내면 화면의 분기
  // 하나가 죽은 채로 남는다.
  it('강수량이 있는 예보 칸과 없는 칸이 둘 다 나온다', () => {
    const amounts = AREA_NAMES.flatMap((name) =>
      (infoFor(name).weather?.hourly ?? []).map((hour) => hour.precipitation),
    )
    expect(amounts.some((amount) => amount !== null && amount > 0)).toBe(true)
    expect(amounts.some((amount) => amount === null)).toBe(true)
  })

  // **명세에 없는 한 겹 안이다** — 바깥 `ROAD_TRAFFIC_STTS` 안에 같은 이름의
  // 배열이 또 있다. 목업이 평평하게 두면 파서가 그 겹을 안 타도 통과한다.
  it('도로 구간이 요약과 함께 나온다', () => {
    const info = infoFor('광화문·덕수궁')

    expect(info.roadTraffic).not.toBeNull()
    expect(info.roadSegments.length).toBeGreaterThan(0)
  })

  // `VISIBLE_LIMIT`가 5다. 목업이 그보다 적게 내면 「외 N곳」 줄을 개발 중에
  // 한 번도 못 본다 — 실호출은 3~281개다.
  it('구간을 다섯 개보다 많이 낸다', () => {
    for (const name of AREA_NAMES) {
      expect(infoFor(name).roadSegments.length).toBeGreaterThan(5)
    }
  })

  // **밑줄 앞이 경도, 점 사이는 파이프다.** 예전 목업은 이 둘이 반대였는데
  // (`'126.977,37.570_126.978,37.571'`) 아무도 `XYLIST`를 안 읽어서 몰랐다.
  it('보간점을 선이 될 만큼 읽어낸다', () => {
    for (const segment of infoFor('광화문·덕수궁').roadSegments) {
      expect(segment.path.length).toBeGreaterThanOrEqual(2)
      expect(segment.startCoords).not.toBeNull()
      expect(segment.endCoords).not.toBeNull()
    }
  })

  // **지표와 속도를 따로 굴린다.** 실호출에서 둘의 범위가 크게 겹쳤고 화면이
  // 그 사실 위에 서 있다 — 속도로 지표를 지어내는 목업을 두면 화면 규칙이
  // 목업에서만 성립한다.
  it('세 지표가 모두 나오고 속도와 묶여 있지 않다', () => {
    const segments = AREA_NAMES.flatMap((name) => infoFor(name).roadSegments)
    const indexes = new Set(segments.map((segment) => segment.index))

    expect([...indexes].sort()).toEqual(['서행', '원활', '정체'])
    // 같은 지표 안에서 속도가 한 값으로 굳어 있지 않다.
    const jammed = segments.filter((segment) => segment.index === '정체')
    expect(new Set(jammed.map((segment) => segment.speed)).size).toBeGreaterThan(1)
  })
})
