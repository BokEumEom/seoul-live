import { CONGESTION_LEVELS, type AreaCongestion, type CongestionLevel } from '../domain/types'
import { asRow, text } from './rowReaders'

// 명소 전체 혼잡도 응답을 옮긴다. 상류는 SeoulRtd이고 문서화된 API가 아니다
// (`api/_lib/seoulRtd.ts`).
//
// **관대함의 방향이 CCTV와 다르다.** 저기는 행이 깨지면 빈 배열로 접었지만
// (부가 정보라 「지금은 없다」가 맞는 답이었다), 여기는 **행 하나가 명소 하나**다.
// 한 행이 이상하다고 121곳을 통째로 버리면 화면이 텅 빈다. 그래서 **깨진 행만
// 버리고 나머지는 살린다** — 그 명소만 「정보 없음」 배지가 된다.
//
// 다만 **응답 자체가 배열이 아니면 던진다.** 그건 한 명소의 문제가 아니라
// 상류가 통째로 바뀌었거나 막힌 것이고, 그때 빈 배열을 돌려주면 화면이 121곳을
// 전부 「정보 없음」으로 그리면서 아무 문제 없는 척한다(`api/hotspots.ts`가
// 502를 올리는 것과 같은 판단).

const LEVELS: ReadonlySet<string> = new Set(CONGESTION_LEVELS)

/**
 * 서울시가 주는 등급 문자열을 우리 타입으로 좁힌다.
 *
 * **매핑표가 없는 것이 요점이다.** `CONGESTION_LEVELS`가 `['여유', '보통',
 * '약간 붐빔', '붐빔']`이고 상류가 주는 값이 글자 그대로 같다 — 공식 OpenAPI의
 * `AREA_CONGEST_LVL`과도 같은 값이다(두 문이 한 창고로 이어져 있다).
 *
 * 그래도 검사는 한다. 모르는 값이 오면 **짐작해서 등급에 끼워 넣지 않고**
 * `null`을 준다 — 틀린 색을 칠하느니 「정보 없음」이 정직하다. 이건 도로소통
 * (`ROAD_TRAFFIC_IDX`)에서 이미 내린 판단과 같은 규칙이다.
 */
function congestionOrNull(raw: string): CongestionLevel | null {
  return LEVELS.has(raw) ? (raw as CongestionLevel) : null
}

export function parseHotspotsResponse(body: unknown): readonly AreaCongestion[] {
  const rows = (body as { rows?: unknown } | null)?.rows
  if (!Array.isArray(rows)) {
    throw new Error('혼잡도 응답에 rows 배열이 없다')
  }

  return rows.flatMap((entry: unknown): readonly AreaCongestion[] => {
    const row = asRow(entry)
    if (row === null) {
      return []
    }

    // 이름이 이 항목의 본체다 — 카탈로그와 맞출 열쇠라서, 없으면 어느 명소인지
    // 알 수 없고 화면에 놓을 자리도 없다.
    const name = text(row, 'area_nm')
    if (name === '') {
      return []
    }

    return [{ name, congestion: congestionOrNull(text(row, 'area_congest_lvl')) }]
  })
}
