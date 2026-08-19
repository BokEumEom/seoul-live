import type { Coords } from '../domain/types'

// 서울 쪽 응답의 한 행을 관대하게 읽는 공용 리더. `cityInfoSchema.ts`가 쓰던
// 것을 꺼내 `cctvSchema.ts`와 나눠 쓴다 — **좌표 축 가드를 두 벌로 두지 않기
// 위해서다.** 축이 뒤집히는 실수는 이 저장소에서 이미 한 번 나온 자리라
// (따릉이 `SBIKE_X`=경도), 검사가 한 곳에만 있어야 한다.

export type Row = Readonly<Record<string, unknown>>

/** 배열도 null도 아닌 순수 객체만 통과시킨다. */
export function asRow(value: unknown): Row | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  return value as Row
}

export function text(row: Row, key: string): string {
  const value = row[key]
  if (typeof value === 'string') {
    return value.trim()
  }
  // 숫자로 오는 필드를 문자열 자리에서 읽는 경우가 있다(예: 코드값).
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

// 소수와 음수를 허용한다(기온). schema.ts의 인구 정규식과 달리 `-`와 `.`을 받는
// 대신, `Number('')`이 0인 문제는 똑같이 막는다 — 빈 값이 "기온 0도"로 보이면
// 안 된다. `'-'`, `'점검중'`, `'1e5'`는 전부 null이다.
const NUMERIC_PATTERN = /^-?\d+(?:\.\d+)?$/

export function numberOrNull(row: Row, key: string): number | null {
  const value = row[key]
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const raw = text(row, key)
  return NUMERIC_PATTERN.test(raw) ? Number(raw) : null
}

/**
 * 지도에 찍을 수 있는 좌표만 돌려준다.
 *
 * **위경도 축을 헷갈리기 쉬운 자리다.** 따릉이는 `SBIKE_X`가 경도,
 * `SBIKE_Y`가 위도로 온다(실응답 확인: X 126.977 / Y 37.569). CCTV도 같은
 * 규칙이다(`XCOORD` 126.972 / `YCOORD` 37.576). 주차장만 `LAT`/`LNG`로 이름
 * 그대로다. 그래서 호출부가 어느 키가 무엇인지 정하고 이 함수는 받은 순서대로만
 * 쓴다.
 *
 * 범위를 보는 이유는 축이 뒤집힌 값을 조용히 통과시키지 않기 위해서다 —
 * 뒤집히면 위도 126이 되는데 그건 지구에 없는 값이라 여기서 걸린다.
 * 빈 문자열·누락은 실응답에도 있는 정상 상태라 `null`이 답이다.
 */
export function coordsOrNull(row: Row, latKey: string, lngKey: string): Coords | null {
  const lat = numberOrNull(row, latKey)
  const lng = numberOrNull(row, lngKey)
  if (lat === null || lng === null) {
    return null
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null
  }
  // 0,0은 서아프리카 앞바다다. 좌표를 못 채운 행이 이 값으로 오는 경우가 있어
  // 「모른다」로 접는다 — 지도가 대서양으로 날아가는 편보다 낫다.
  if (lat === 0 && lng === 0) {
    return null
  }
  return { lat, lng }
}
