// 확장자 `.js`는 오타가 아니다. 이 파일은 `api/_lib/allowed-areas.ts` → `src/data/areas.ts`를
// 거쳐 tsconfig.node.json(`moduleResolution: nodenext`) 프로그램에도 들어간다. 거기서는
// 상대 경로에 확장자가 없으면 TS2835로 막힌다. `areas.ts`의 `../domain/types.js`와 같은 이유다.
import type { PopulationComposition } from './composition.js'

export interface Coords {
  readonly lat: number
  readonly lng: number
}

export const CONGESTION_LEVELS = ['여유', '보통', '약간 붐빔', '붐빔'] as const

export type CongestionLevel = (typeof CONGESTION_LEVELS)[number]

// 서울시 공식 분류. 출처는 저장소의 `실시간 도시데이터 매뉴얼.pdf` p9~10
// 「주요장소 목록」이다. 121곳 확장 시 매뉴얼에서 그대로 가져올 수 있다.
//
// 30곳 구간에서는 분포가 쏠린다(발달상권 12 / 공원 10 / 관광특구 3 /
// 고궁·문화유산 3 / 인구밀집지역 2). 121곳에서는 48/33/28/7/5로 균형이
// 잡히므로 이 쏠림은 임시 비용이다. 설계 문서 §2.5 참고 — 되돌리지 마라.
export const AREA_CATEGORIES = [
  '관광특구',
  '고궁·문화유산',
  '인구밀집지역',
  '발달상권',
  '공원',
] as const

export type AreaCategory = (typeof AREA_CATEGORIES)[number]

// 「인구밀집지역」·「발달상권」은 행정 용어라 화면에 그대로 쓰지 않는다.
// 데이터는 공식 값을 갖고 표시만 바꾼다.
export const CATEGORY_LABEL: Readonly<Record<AreaCategory, string>> = {
  관광특구: '관광특구',
  '고궁·문화유산': '고궁·유적',
  인구밀집지역: '역·번화가',
  발달상권: '상권·거리',
  공원: '공원',
}

// 프리셋용 목적 태그. 카테고리와 축이 다르다 — 카테고리는 "어떤 성격의
// 구역인가"이고 이건 "거기서 뭘 하려는가"다. 광장(전통)시장과 청담동
// 명품거리가 같은 발달상권인데 데이트 적합성은 정반대다.
//
// 'hot'은 없다. 「지금 핫플」은 혼잡도만 보므로 태그가 필요 없다.
export type Purpose = 'kids' | 'date'

export interface AreaCatalogEntry extends Coords {
  readonly code: string
  readonly name: string
  /**
   * 영어 화면에 적는 이름. **`name`을 대신하지 않는다.**
   *
   * `name`은 서울 API 호출 키이자 카카오맵·네이버 검색어라 한국어여야 하고,
   * 이 값은 오직 표시용이다. 둘을 헷갈리면 「Insa-dong」으로 API를 부르게 된다.
   *
   * **선택 항목이 아니다.** `purposes`처럼 없어도 되는 값으로 두면 121곳으로
   * 늘릴 때 빠뜨린 곳이 영어 화면에서만 조용히 한국어로 남는다 — 필수로 두어
   * 컴파일러가 세게 한다. 사전(`i18n/en.ts`)이 아니라 카탈로그에 두는 이유는
   * 이름·좌표·코드와 같은 자리에 있어야 한 곳만 보면 되기 때문이다.
   */
  readonly nameEn: string
  readonly category: AreaCategory
  /** 없으면 나들이·데이트 프리셋에 걸리지 않는다. 121곳 확장 시 태그가
   *  없는 명소가 조용히 오분류되지 않고 그냥 빠지게 하려는 것이다. */
  readonly purposes?: readonly Purpose[]
}

export interface Forecast {
  /** 서울 API 원본 형식. `"2026-08-03 16:00"` — ISO 아님, 타임존 없음 */
  readonly time: string
  /** `time`에서 뽑은 0~23. 화면이 원본 형식을 파싱하지 않게 하려는 것 */
  readonly hour: number
  readonly congestion: CongestionLevel
  readonly populationMin: number
  readonly populationMax: number
}

export interface AreaSnapshot {
  readonly code: string
  readonly name: string
  readonly congestion: CongestionLevel
  readonly message: string
  readonly populationMin: number
  readonly populationMax: number
  /** 서울 API 원본 형식. `"2026-08-03 14:35"` — ISO 아님, 타임존 없음 */
  readonly observedAt: string
  /** `observedAt`에서 뽑은 "HH:MM". 화면이 원본 형식을 파싱하지 않게 하려는 것 */
  readonly observedAtLabel: string
  readonly forecasts: readonly Forecast[]
  /** 없을 수 있다. 이 값이 없어도 혼잡도 화면은 그대로 선다. */
  readonly composition: PopulationComposition | null
  /**
   * REPLACE_YN — 이 수치가 실측이 아니라 대체 데이터인가.
   *
   * **세 상태다.** `true`는 대체값, `false`는 실측, **`null`은 모름**이다.
   * 모름을 실측으로 접지 마라 — `false`는 「서울 API가 실측이라고 했다」는
   * 주장이고 `null`은 「말해 주지 않았다」이다. 둘을 묶으면 나중에 「실측
   * 확인됨」을 표시하려는 순간, 필드가 안 오는 날에도 실측이라고 단언하게
   * 된다. `ParkingLot.paid`가 `boolean | null`인 것과 같은 규칙이다.
   */
  readonly replaced: boolean | null
}

/**
 * 목록·지도·「오늘의 서울」이 명소 하나에 대해 **실제로 필요로 하는 전부.**
 *
 * **`AreaSnapshot`보다 훨씬 작고, 그게 요점이다.** 저 큰 타입은 명소당 1회
 * 호출이 드는 공식 OpenAPI에서만 나오는데, 121곳이면 갱신 한 번에 121회다
 * (하루 한도 1,000에 24번 갱신이면 2,904회). 반면 이 두 필드는 인증키 없는
 * 한 번의 호출로 121곳이 전부 온다(`api/hotspots.ts`).
 *
 * 그 교환이 성립하는 이유는 **목록이 원래 등급만 읽고 있었기 때문**이다 —
 * 목록 행·지도 마커·혼잡도 분포·프리셋 개수가 전부 `congestion` 하나만 본다.
 * 인구수·예보·구성비는 상세에서만 쓰이고, 상세는 사용자가 연 한 곳뿐이라
 * 공식 API를 그대로 써도 호출량이 는 만큼 감당된다.
 *
 * **`AreaSnapshot`이 이 모양을 구조적으로 만족한다.** 그래서 상세가 받아 둔
 * 큰 스냅샷을 이 자리에 그대로 넘길 수 있고, 두 경로가 한 타입 아래서 만난다.
 *
 * `congestion`이 `null`일 수 있는 것은 상류가 모르는 등급 문자열을 준 경우다 —
 * 짐작해서 끼워 넣지 않는다(`hotspotsSchema.ts`).
 */
export interface AreaCongestion {
  readonly name: string
  readonly congestion: CongestionLevel | null
}

export interface NearbyArea {
  readonly entry: AreaCatalogEntry
  readonly snapshot: AreaCongestion | null
  readonly distanceMeters: number | null
}
