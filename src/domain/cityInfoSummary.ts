import type { BikeStation, CityInfo, ParkingLot } from './cityInfo'

/**
 * 도시 정보 응답을 **한 값으로 접는** 함수들이 사는 자리.
 *
 * **예전에는 요약 칩 줄(`CityInfoChips`)이 이 파일의 주인이었다.** 상세가 한
 * 장으로 5,395px까지 자라던 시절, 칩이 값을 요약하면서 목차 노릇을 했다.
 * 2026-08-20에 상세가 전체 화면 + 탭이 되면서 그 일은 요약 탭의 카드 격자가
 * 맡는다(`SummaryGrid`) — 카드는 같은 값을 보여주면서 **다른 화면**으로
 * 데려가므로, 같은 화면 안에서 스크롤하던 칩보다 할 수 있는 일이 넓다.
 *
 * 그래서 칩 관련 타입과 `summarizeCityInfo`는 사라졌고, 여러 항목을 하나로
 * 접는 셈법만 남았다. 이 셈법은 그대로 카드가 쓴다.
 */
export type CityInfoSectionId = 'parking' | 'road' | 'subway' | 'bikes' | 'events' | 'cctv'

/**
 * 절의 DOM id. **여러 곳이 이 함수를 나눠 써야 한다** — 문자열을 각자 지으면
 * 한쪽만 고쳤을 때 조용히 어긋난다.
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
export function subwayLineCount(info: CityInfo): number {
  return new Set(info.subway.map((train) => `${train.station} ${train.line}`)).size
}
