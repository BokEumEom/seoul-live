import type { Coords } from './types'

// 도로 구간별 소통(`ROAD_TRAFFIC_STTS` 안의 같은 이름 배열). 명세 106~117행.
//
// **명세에 없는 껍데기가 하나 더 있다.** 명세는 구간 필드를 요약(`ROAD_MSG`·
// `ROAD_TRAFFIC_IDX`…)과 같은 층에 펼쳐 적었지만, 실제 응답은
// `{ AVG_ROAD_DATA: {요약}, ROAD_TRAFFIC_STTS: [구간…] }`이다. 상권의
// `CMRCL_RSB`, 충전소의 `CHARGER_DETAILS`에 이은 네 번째다.
//
// **구간 수가 명소마다 크게 다르다** — 2026-08-25 실호출 35곳에서 3곳부터
// 281곳까지였다(여의도 281, 창동 152).

/** 도로 한 구간. `LINK_ID` 하나가 이 모양이 된다. */
export interface RoadSegment {
  /**
   * LINK_ID — 도로구간 ID. **목록의 키다.**
   *
   * 실호출 35곳 어디에서도 한 명소 안에서 겹치지 않았다(1,893건). 명소를
   * 건너뛰면 겹치는데(1,537 고유), 그건 같은 구간이 두 명소 근처인 것이라
   * 겹치는 것이 맞다.
   */
  readonly linkId: string
  /** ROAD_NM — 도로명. 실호출 1,893건 전부에 있었다 */
  readonly roadName: string
  /** START_ND_NM — 시작 노드 이름 */
  readonly startName: string
  /** END_ND_NM — 종료 노드 이름 */
  readonly endName: string
  /** DIST — 구간 길이(m). 실호출 범위는 11~653m였다 */
  readonly meters: number | null
  /** SPD — 구간 평균 속도(km/h). **숫자로 온다**(`DIST`는 문자열인데) */
  readonly speed: number | null
  /**
   * IDX — 구간 소통 지표. 실호출 1,893건에서 셋뿐이었다 —
   * `정체`(796) · `서행`(693) · `원활`(404). 요약의 `ROAD_TRAFFIC_IDX`와
   * 같은 어휘라 `roadIndexTone`을 그대로 쓴다.
   */
  readonly index: string
  /**
   * XYLIST — 구간을 그리는 보간점들. 실호출에서 2~26개였다(과반이 2개).
   *
   * **끝에서 시작으로 간다.** 1,893건 전부에서 `XYLIST`의 첫 점이
   * `END_ND_XY`와, 마지막 점이 `START_ND_XY`와 정확히 같았다 — 이름의
   * 순서와 반대다. 선을 긋는 데에는 방향이 상관없지만, 화살표를 붙이거나
   * 머리에 이름을 얹는 날 이 사실이 필요하다.
   *
   * 못 읽으면 `startCoords`·`endCoords`로 만든 두 점짜리 직선으로 떨어진다.
   */
  readonly path: readonly Coords[]
  /** START_ND_XY의 좌표. `127.030_37.493`꼴로 오고 **앞이 경도다** */
  readonly startCoords: Coords | null
  /** END_ND_XY의 좌표 */
  readonly endCoords: Coords | null
}

/**
 * 화면에 올릴 차례. **지표가 먼저고 속도가 그다음이다.**
 *
 * 속도만으로 줄 세우면 틀린다. 2026-08-25 실호출 1,893건에서 세 지표의 속도
 * 범위가 크게 겹쳤다 — `정체`는 2~28km/h, `원활`은 25~67km/h다. **25~28km/h인
 * 구간이 어떤 도로에서는 정체이고 어떤 도로에서는 원활이다.** 이면도로의
 * 25km/h와 올림픽대로의 25km/h가 같은 뜻일 리 없고, 그 판단은 서울이 이미
 * `IDX`에 담아 준다. 우리가 속도로 다시 매기면 그 판단을 덮어쓰는 것이다.
 *
 * 같은 이유로 **속도에서 지표를 지어내지도 않는다.** 임계값이 도로 종류마다
 * 다르므로 위 범위로는 규칙을 세울 수 없다.
 */
const SEVERITY_BY_INDEX: Readonly<Record<string, number>> = {
  정체: 0,
  서행: 1,
  원활: 2,
}

/** 모르는 지표는 아는 셋보다 뒤다 — 「처음 보는 값」을 「제일 급한 값」으로
 *  올려 두면 정체 구간이 그것에 밀려 화면에서 사라진다. */
const UNKNOWN_SEVERITY = 3

/** 속도를 모르는 구간은 같은 지표 안에서 뒤로 간다. 못 읽은 값을 0으로
 *  떨어뜨리면 「0km/h」가 가장 급한 구간으로 올라온다. */
const UNKNOWN_SPEED = Number.POSITIVE_INFINITY

export function sortRoadSegments(
  segments: readonly RoadSegment[],
  limit?: number,
): readonly RoadSegment[] {
  const sorted = [...segments].sort((left, right) => {
    const bySeverity =
      (SEVERITY_BY_INDEX[left.index.trim()] ?? UNKNOWN_SEVERITY) -
      (SEVERITY_BY_INDEX[right.index.trim()] ?? UNKNOWN_SEVERITY)
    if (bySeverity !== 0) {
      return bySeverity
    }
    return (left.speed ?? UNKNOWN_SPEED) - (right.speed ?? UNKNOWN_SPEED)
  })
  return limit === undefined ? sorted : sorted.slice(0, limit)
}

/**
 * 지도가 비출 자리. **구간의 가운데다.**
 *
 * 첫 점이 아니라 가운데인 이유는 긴 구간(실호출 최대 653m) 때문이다 — 끝을
 * 비추면 나머지가 화면 밖으로 나간다.
 *
 * `startCoords`·`endCoords` 중 하나만 있으면 그것을 쓴다. 둘 다 없으면
 * `null`이고, 그때 화면은 「지도에서 보기」 버튼을 아예 안 그린다.
 */
export function roadSegmentCenter(segment: RoadSegment): Coords | null {
  const { startCoords, endCoords } = segment
  if (startCoords === null || endCoords === null) {
    return startCoords ?? endCoords
  }
  return {
    lat: (startCoords.lat + endCoords.lat) / 2,
    lng: (startCoords.lng + endCoords.lng) / 2,
  }
}

/**
 * 지도에 그을 선. **보간점을 못 읽으면 두 끝을 잇는 직선으로 떨어진다.**
 *
 * 굽은 길이 직선이 되지만 「어디쯤인지」는 그대로 전한다 — 선을 통째로 안
 * 그리는 것보다 낫다. 점이 하나뿐이면 선이 아니라 `null`이다.
 */
export function roadSegmentPath(segment: RoadSegment): readonly Coords[] | null {
  if (segment.path.length >= 2) {
    return segment.path
  }
  const ends = [segment.startCoords, segment.endCoords].filter(
    (point): point is Coords => point !== null,
  )
  return ends.length >= 2 ? ends : null
}

/** 사전과 검사가 같은 목록을 보게 한다. 요약(`ROAD_TRAFFIC_IDX`)과 같은 어휘다. */
export const ROAD_SEGMENT_INDEXES: readonly string[] = ['정체', '서행', '원활']
