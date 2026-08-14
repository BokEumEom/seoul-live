import type { BikeStation, CityInfo, ParkingLot } from './cityInfo'

/**
 * 상세 맨 위의 요약 칩 하나.
 *
 * `sectionId`가 있는 이유는 화면 길이다. 도시 정보가 통째로 펼쳐지면서 상세가
 * 매우 길어졌는데, 칩이 요약만 하고 끝나면 사용자는 그 값을 확인하러 손으로
 * 한참 스크롤해야 한다. 칩이 곧 목차가 되게 한다 — 샘플(서울 인파레이더)의
 * 칩은 정보만 담고 누를 수 없지만, 그쪽은 4,000px짜리 한 장을 그냥 스크롤하게
 * 둔다. 우리는 시트 안이라 더 좁다.
 */
export interface CityInfoChip {
  /** 화면에 그대로 적히는 글자. 「주차 45%」·「따릉이 131대」 */
  readonly label: string
  /** 눌렀을 때 갈 절. `InfoSection`이 이 값을 id로 단다. */
  readonly sectionId: CityInfoSectionId
}

export type CityInfoSectionId = 'parking' | 'road' | 'subway' | 'bikes' | 'events'

/**
 * 칩이 뛰어갈 절의 DOM id. **칩과 절이 이 함수를 나눠 써야 한다** — 양쪽에서
 * 문자열을 따로 지으면 한쪽만 고쳤을 때 칩이 조용히 아무 데도 안 간다.
 *
 * 컴포넌트 파일이 아니라 여기 있는 이유는 `toneClass.ts`와 같다: 컴포넌트를
 * export하는 파일이 함수까지 함께 export하면 빠른 새로고침이 깨진다.
 */
export function cityInfoSectionDomId(sectionId: CityInfoSectionId): string {
  return `cityinfo-${sectionId}`
}

/**
 * 「아는 것 중에서」 몇 %가 비어 있나.
 *
 * **면수를 모르는 주차장은 분모에서도 뺀다.** 분자에서만 빼면 전체 300면 중
 * 45면으로 세어 15%가 되는데, 정작 값을 아는 주차장에는 45%가 비어 있다.
 * 셀 수 있는 것이 하나도 없으면 `null`이다 — 0%로 접으면 「자리가 하나도
 * 없다」는 정반대 뜻이 된다.
 */
export function parkingVacancyRate(lots: readonly ParkingLot[]): number | null {
  const countable = lots.filter(
    (lot) => lot.capacity !== null && lot.capacity > 0 && lot.available !== null,
  )
  if (countable.length === 0) {
    return null
  }

  const capacity = countable.reduce((sum, lot) => sum + (lot.capacity ?? 0), 0)
  const available = countable.reduce((sum, lot) => sum + (lot.available ?? 0), 0)
  // 남은 면수가 전체보다 크게 오는 응답이 있어도 「112% 비어 있음」은 말이 안 된다.
  return Math.min(100, Math.round((available / capacity) * 100))
}

/** 지금 빌릴 수 있는 자전거 수. 대수를 모르는 대여소는 0이 아니라 건너뛴다. */
export function totalBikes(stations: readonly BikeStation[]): number | null {
  const countable = stations.filter((spot) => spot.bikes !== null)
  if (countable.length === 0) {
    return null
  }
  return countable.reduce((sum, spot) => sum + (spot.bikes ?? 0), 0)
}

/** 도착 정보가 오는 역·호선 수. 열차 수를 세면 무엇을 세는지 알 수 없어진다. */
function subwayLineCount(info: CityInfo): number {
  return new Set(info.subway.map((train) => `${train.station} ${train.line}`)).size
}

/**
 * 값이 **있는 것만** 칩으로 만든다. 「주차 -」처럼 빈 칩을 세우면 한 줄이
 * 모르는 것들로 채워진다.
 *
 * **순서는 고정이고, 아래 절의 순서와 같다.** 두 가지 이유가 겹친다. 하나는
 * 값이 있는 것만 세우다 보면 명소마다 칩 순서가 달라져 같은 자리에 다른 뜻이
 * 오기 때문이고, 다른 하나는 이 칩이 목차 노릇을 하기 때문이다 — 칩 순서와
 * 절 순서가 어긋나면 왼쪽 칩이 아래쪽 절로 뛰어 방향 감각이 깨진다.
 *
 * **그래서 샘플과 순서가 다르다.** 샘플(서울 인파레이더)은 주차를 맨 앞에
 * 두지만 그쪽 칩은 누를 수 없어 순서가 목차일 필요가 없다.
 */
export function summarizeCityInfo(info: CityInfo): readonly CityInfoChip[] {
  const vacancy = parkingVacancyRate(info.parking)
  const bikes = totalBikes(info.bikes)
  const lines = subwayLineCount(info)

  const candidates: readonly (CityInfoChip | null)[] = [
    // 도로소통은 「정체」·「서행」처럼 그 자체가 한 낱말이라 접두어를 붙이지
    // 않는다. 「도로 정체」로 늘리면 좁은 줄에서 칩 하나가 두 배가 된다.
    info.roadTraffic === null || info.roadTraffic.index === ''
      ? null
      : { label: info.roadTraffic.index, sectionId: 'road' },
    lines === 0 ? null : { label: `지하철 ${String(lines)}`, sectionId: 'subway' },
    vacancy === null ? null : { label: `주차 ${String(vacancy)}%`, sectionId: 'parking' },
    bikes === null ? null : { label: `따릉이 ${String(bikes)}대`, sectionId: 'bikes' },
    info.events.length === 0
      ? null
      : { label: `행사 ${String(info.events.length)}`, sectionId: 'events' },
  ]

  return candidates.filter((chip): chip is CityInfoChip => chip !== null)
}
