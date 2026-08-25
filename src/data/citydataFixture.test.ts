import { describe, expect, it } from 'vitest'
// JSON을 import로 읽는다. jsdom 환경에서는 `import.meta.url`이 file: 스킴이
// 아니라 http:라 `readFileSync(new URL(...))`가 죽는다.
import fixture from '../../docs/fixtures/citydata-광화문덕수궁.json'
import { isBusCallFailure, parkingBaseFee } from '../domain/cityInfo'
import {
  chargerTypeParts,
  CHARGER_STATUSES,
  CHARGER_TYPE_PARTS,
} from '../domain/charger'
import { COMMERCE_LEVELS } from '../domain/commerce'
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

  // **지하철과 버스의 승하차가 같은 모양이다.** 접두어(`SUB_`/`BUS_`)만 다르고
  // 나머지 키 18개가 한 글자도 안 다르다 — 파서가 접두어만 받아 둘을 같은
  // 코드로 읽는 근거다. 한쪽만 읽히면 그 전제가 깨진 것이다.
  it('지하철·버스 승하차를 같은 모양으로 읽는다', () => {
    for (const ridership of [info.subwayRidership, info.busRidership]) {
      expect(ridership).not.toBeNull()
      expect(ridership?.total.boardingMin).not.toBeNull()
      expect(ridership?.last10Minutes.alightingMax).not.toBeNull()
      expect(ridership?.stopCount).not.toBeNull()
    }
  })

  // **네 시간창이 서로 다른 키에서 온다.** 「있나 없나」만 보면 10분 자리에
  // 30분 값을 읽어도 통과한다(2026-08-25 변이 실험에서 실제로 살아남았다).
  //
  // 짧은 창은 긴 창에 통째로 들어 있으므로 **인원이 더 많을 수 없다.** 이건
  // 이 명소의 값이 아니라 시간창의 정의라, 데이터가 바뀌어도 참이다.
  it('짧은 시간창이 긴 시간창보다 크지 않다', () => {
    for (const ridership of [info.subwayRidership, info.busRidership]) {
      const spans = [
        ridership?.last5Minutes,
        ridership?.last10Minutes,
        ridership?.last30Minutes,
        ridership?.total,
      ]
      for (const [shorter, longer] of spans.slice(0, -1).map((s, i) => [s, spans[i + 1]])) {
        expect(shorter?.boardingMin ?? 0).toBeLessThanOrEqual(longer?.boardingMin ?? 0)
        expect(shorter?.alightingMin ?? 0).toBeLessThanOrEqual(longer?.alightingMin ?? 0)
      }
      // 위가 전부 같은 값이어도 통과하는 것을 막는다 — 실호출의 5분과 누적은
      // 자릿수가 다르다(300 대 10,400).
      expect(ridership?.last5Minutes.boardingMin ?? 0).toBeLessThan(
        ridership?.total.boardingMin ?? 0,
      )
    }
  })

  it('버스정류소를 읽는다', () => {
    expect(info.busStops.length).toBeGreaterThan(0)
    // 정류소 번호는 실호출에서 네 자리로 온다(`1009`).
    expect(info.busStops.every((stop) => stop.arsId !== '')).toBe(true)
    expect(info.busStops.every((stop) => stop.id !== '')).toBe(true)
    // X가 경도·Y가 위도다. 뒤집히면 `coordsOrNull`의 범위 가드가 null로 떨군다.
    expect(info.busStops.some((stop) => stop.coords !== null)).toBe(true)
  })

  it('버스 호출 메시지를 읽고 성공으로 판정한다', () => {
    expect(info.busResultMessage).not.toBe('')
    expect(isBusCallFailure(info.busResultMessage)).toBe(false)
  })

  // **`CMRCL_RSB`가 명세에 없다.** 명세 222~229행은 업종 필드를 한 겹 펼쳐
  // 적어 놓고 그것들을 담는 배열 이름을 안 적었다 — 순번만 보고 평평하게
  // 읽으면 업종이 통째로 빈다(도로소통·지하철에서 이미 한 번 밟은 함정이다).
  it('상권을 읽고 업종은 한 겹 안에서 꺼낸다', () => {
    expect(info.commerce).not.toBeNull()
    expect(info.commerce?.level).not.toBe('')
    expect(info.commerce?.paymentCount).not.toBeNull()
    expect(info.commerce?.categories.length).toBeGreaterThan(0)
    expect(info.commerce?.categories[0].minor).not.toBe('')
    expect(info.commerce?.categories[0].storeCount).not.toBeNull()
  })

  it('상권 지표가 아는 네 단계 안이다', () => {
    // 새 값이 오면 여기서 죽는다 — 그때 `commerceLevelTone`과 사전에 함께 더한다.
    expect(COMMERCE_LEVELS).toContain(info.commerce?.level)
    for (const category of info.commerce?.categories ?? []) {
      expect(COMMERCE_LEVELS).toContain(category.level)
    }
  })

  it('성별과 개인·법인 비율을 읽는다', () => {
    // **막대가 아니라 파서를 잰다.** 화면 쪽 테스트는 목업으로 값을 넣으므로
    // 파서가 이 넷을 안 읽어도 통과한다 — 2026-08-25 변이 실험에서 실제로
    // 「개인/법인 안 읽기」가 살아남았다.
    expect(info.commerce?.maleRate).not.toBeNull()
    expect(info.commerce?.femaleRate).not.toBeNull()
    expect(info.commerce?.personalRate).not.toBeNull()
    expect(info.commerce?.corporationRate).not.toBeNull()
    // 개인과 법인은 합이 100이다(실호출: 79.4 + 20.6). 한쪽을 다른 쪽 자리에서
    // 읽으면 여기서 걸린다.
    expect(
      (info.commerce?.personalRate ?? 0) + (info.commerce?.corporationRate ?? 0),
    ).toBeCloseTo(100, 1)
  })

  it('소비 연령이 여섯 칸이다', () => {
    // 인구 구성은 여덟 칸이다. 파서·라벨·색 셋이 어긋나면 색 없는 막대나
    // 이름 없는 칸이 조용히 생긴다.
    expect(info.commerce?.ageRates).toHaveLength(6)
    expect(info.commerce?.ageRates.some((rate) => rate > 0)).toBe(true)
  })

  // **`CHARGER_DETAILS`가 명세에 없다.** 명세 151~159행은 충전기 필드를
  // 충전소와 같은 층에 펼쳐 적었지만 실제로는 배열로 한 겹 더 들어가 있다 —
  // 상권의 `CMRCL_RSB`와 같은 함정이고, 평평하게 읽으면 충전기가 통째로 빈다.
  it('충전소를 읽고 충전기는 한 겹 안에서 꺼낸다', () => {
    expect(info.chargers.length).toBeGreaterThan(0)
    expect(info.chargers.every((station) => station.id !== '')).toBe(true)
    expect(info.chargers.every((station) => station.address !== '')).toBe(true)
    expect(info.chargers.some((station) => station.chargers.length > 0)).toBe(true)
    const charger = info.chargers.flatMap((station) => station.chargers)[0]
    expect(charger.type).not.toBe('')
    expect(charger.status).not.toBe('')
    expect(charger.outputKw).not.toBeNull()
  })

  // **좌표 축과 제한 여부는 화면 테스트가 못 잡는다** — 저쪽은 목업으로 값을
  // 넣으므로 파서가 뒤집어 읽거나 안 읽어도 통과한다(2026-08-25 변이 실험에서
  // 둘 다 살아남았다).
  it('충전소 좌표를 서울 안쪽으로 읽는다', () => {
    const located = info.chargers.filter((station) => station.coords !== null)
    expect(located.length).toBeGreaterThan(0)
    for (const station of located) {
      // X가 경도·Y가 위도다. 뒤집으면 위도 126이 되는데 지구에 없는 값이라
      // `coordsOrNull`이 null로 떨군다 — 그래서 「좌표가 있는 곳이 있다」가
      // 곧 축이 맞다는 증거다. 범위도 함께 못 박는다.
      expect(station.coords?.lat).toBeGreaterThan(37)
      expect(station.coords?.lat).toBeLessThan(38)
      expect(station.coords?.lng).toBeGreaterThan(126)
      expect(station.coords?.lng).toBeLessThan(128)
    }
  })

  it('이용 제한 여부를 읽는다', () => {
    // 실호출 1,725대 중 464대가 제한 있음이었다. 목록의 차례가 이 값에
    // 걸려 있어서, 안 읽히면 못 들어가는 충전소가 맨 위로 온다.
    expect(info.chargers.every((station) => station.limited !== null)).toBe(true)
    expect(info.chargers.every((station) => station.useTime !== '')).toBe(true)
    expect(info.chargers.every((station) => station.kind !== '')).toBe(true)
  })

  it('충전기 상태와 방식이 아는 값 안이다', () => {
    // 새 값이 오면 여기서 죽는다 — 그때 도메인 목록과 사전에 함께 더한다.
    for (const station of info.chargers) {
      for (const charger of station.chargers) {
        expect(CHARGER_STATUSES).toContain(charger.status)
        for (const part of chargerTypeParts(charger.type)) {
          expect(CHARGER_TYPE_PARTS).toContain(part)
        }
      }
    }
  })

  it('어느 섹션이든 내용이 있다', () => {
    // hasAnyCityInfo가 false면 화면이 「정보 없음」만 띄운다.
    expect(info.parking.length + info.bikes.length + info.subway.length).toBeGreaterThan(0)
  })
})
