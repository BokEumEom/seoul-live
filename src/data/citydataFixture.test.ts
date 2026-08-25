import { describe, expect, it } from 'vitest'
// JSON을 import로 읽는다. jsdom 환경에서는 `import.meta.url`이 file: 스킴이
// 아니라 http:라 `readFileSync(new URL(...))`가 죽는다.
import fixture from '../../docs/fixtures/citydata-광화문덕수궁.json'
import { parkingBaseFee } from '../domain/cityInfo'
import { parseCityInfoResponse } from './cityInfoSchema'

// **실호출 응답 한 벌을 그대로 파서에 통과시킨다.** 2026-08-25에 인증키로
// `/citydata/1/5/광화문·덕수궁`을 불러 받은 것이다.
//
// 이 파일이 있는 이유: 명세의 출력명 표만 보고 짐작했던 두 곳이 실제로 틀렸다.
// 도로소통과 지하철이 한 겹 더 들어가 있었는데, **손으로 지어낸 목업과 손으로
// 지어낸 테스트가 서로 같은 오해를 공유해서 둘 다 통과했다.** 실제 응답을
// 자료로 두고 대조하는 것만이 그 종류의 오해를 깬다.
//
// 갱신법: `/api/cityinfo?area=<명소>` 응답을 받아 같은 자리에 덮어쓴다.
const FIXTURE: unknown = fixture

const AREA = '광화문·덕수궁'

/**
 * 응답이 주는 최상위 서비스 전부. **개수가 아니라 이름을 적는다.**
 *
 * 이 목록이 있는 이유가 있다. 2026-08-13 픽스처는 「큰 섹션만 개수를 줄였다,
 * 구조는 손대지 않았다」고 적혀 있었지만 실제로는 **다섯 서비스가 통째로 빠져
 * 있었다** — `LIVE_SUB_PPLTN`·`BUS_STN_STTS`·`LIVE_BUS_PPLTN`·`CHARGER_STTS`·
 * `LIVE_CMRCL_STTS`. 빠졌다는 흔적이 아무 데도 없어서, 2026-08-25에 「이 API는
 * 버스·충전소·상권을 안 준다」고 **결론 낼 뻔했다.** 실호출로 다시 재서 그게
 * 틀렸음을 확인했다.
 *
 * 여기 이름을 박아 두면 다음 갱신에서 하나라도 사라질 때 죽는다.
 */
const SERVICES = [
  'AREA_NM',
  'AREA_CD',
  'LIVE_PPLTN_STTS',
  'ROAD_TRAFFIC_STTS',
  'PRK_STTS',
  'SUB_STTS',
  'LIVE_SUB_PPLTN',
  'BUS_STN_STTS',
  'LIVE_BUS_PPLTN',
  'ACDNT_CNTRL_STTS',
  'SBIKE_STTS',
  'WEATHER_STTS',
  'CHARGER_STTS',
  'EVENT_STTS',
  'LIVE_CMRCL_STTS',
  'LIVE_DST_MESSAGE',
  'LIVE_YNA_NEWS',
] as const

/**
 * 줄인 목록과 **원래 개수**. 줄인 사실 자체를 자료로 남긴다 — 「3곳뿐이네」로
 * 읽고 화면을 그러게 짜면 실제 33곳에서 무너진다.
 *
 * `FCST24HOURS`는 **안 줄였다.** 24칸이 계약이고 아래 테스트가 그 수를 센다.
 */
const TRIMMED: Readonly<Record<string, number>> = {
  PRK_STTS: 33,
  BUS_STN_STTS: 32,
  CHARGER_STTS: 44,
  SBIKE_STTS: 10,
  EVENT_STTS: 17,
  'ROAD_TRAFFIC_STTS.ROAD_TRAFFIC_STTS': 159,
}

describe('실호출 citydata 응답 (2026-08-25)', () => {
  const body = (FIXTURE as { readonly CITYDATA: Record<string, unknown> }).CITYDATA

  it('서비스가 하나도 빠지지 않았다', () => {
    expect(Object.keys(body)).toEqual([...SERVICES])
  })

  it('줄인 목록의 원래 개수를 자료로 남긴다', () => {
    // 이 단언은 픽스처가 아니라 **이 파일의 기록**을 지킨다. 다음 사람이
    // 목록을 다시 채우면서 여기를 안 지우면 걸린다.
    for (const key of Object.keys(TRIMMED)) {
      const actual = key.includes('.')
        ? (body.ROAD_TRAFFIC_STTS as { ROAD_TRAFFIC_STTS: readonly unknown[] })
            .ROAD_TRAFFIC_STTS
        : (body[key] as readonly unknown[])
      expect(actual.length).toBeLessThanOrEqual(TRIMMED[key])
    }
  })
})

describe('실호출 citydata 응답 (2026-08-25) — 파서', () => {
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

  // **여기가 「명세에 있는데 안 읽던 것」을 지키는 자리다.** 2026-08-25까지
  // 이 여덟은 응답에 있는데 파서가 그냥 흘려보냈다 — `WeatherPanel` 주석이
  // 「시안에 있지만 우리 파서가 아직 안 읽는다」였다.
  it('습도·바람·일출일몰·자외선을 읽는다', () => {
    expect(info.weather?.humidity).not.toBeNull()
    expect(info.weather?.windSpeed).not.toBeNull()
    // 16방위 약자로 온다. 화면이 `windDirectionLabel`로 한국어를 고른다.
    expect(info.weather?.windDirection).toMatch(/^[NSEW]{1,3}$/)
    expect(info.weather?.sunrise).toMatch(/^\d{2}:\d{2}$/)
    expect(info.weather?.sunset).toMatch(/^\d{2}:\d{2}$/)
    expect(info.weather?.uvIndex).not.toBeNull()
    expect(info.weather?.uvGrade).not.toBe('')
  })

  it('통합대기환경지수의 수치를 등급과 함께 읽는다', () => {
    // 등급(`AIR_IDX`)만 읽던 자리다. 수치가 있어야 「좋음」이 얼마나 좋은지가
    // 나온다 — 실호출은 `좋음 / 33.0`이었다.
    expect(info.weather?.airIndexValue).not.toBeNull()
  })

  it('기상특보를 날씨 행 안에서 읽는다', () => {
    // **재난문자와 다른 자리다.** 최상위 `LIVE_DST_MESSAGE`가 아니라
    // `WEATHER_STTS[0].NEWS_LIST`에 있다 — 이 픽스처를 뜬 날 실제로 서울 전역에
    // 폭염주의보가 발효 중이었다(2026-08-25).
    expect(info.weather?.warnings.length).toBeGreaterThan(0)
    expect(info.weather?.warnings[0].kind).not.toBe('')
    expect(info.weather?.warnings[0].level).not.toBe('')
    // 재난문자 쪽은 이 날 비어 있었다. 둘이 서로 다른 출처임을 여기서 못 박는다.
    expect(info.alerts).toEqual([])
  })

  it('주차장의 요금과 주소를 읽는다', () => {
    // 33곳 중 3곳으로 줄인 픽스처인데 셋 다 요금이 있다(2026-08-25 실호출).
    const withFee = info.parking.filter((lot) => parkingBaseFee(lot.fee) !== null)
    expect(withFee.length).toBeGreaterThan(0)
    // 실호출은 도로명주소가 33곳 중 1곳뿐이고 나머지는 지번으로 온다.
    expect(info.parking.every((lot) => lot.address !== '')).toBe(true)
    expect(info.parking.every((lot) => lot.code !== '')).toBe(true)
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
