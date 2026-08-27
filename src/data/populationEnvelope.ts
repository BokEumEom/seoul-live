/**
 * 인구 행 배열을 봉투에서 꺼낸다.
 *
 * **두 서비스가 같은 행을 서로 다른 봉투에 담아 준다.**
 *
 *   citydata_ppltn →  { 'SeoulRtd.citydata_ppltn': [row] }
 *   citydata       →  { CITYDATA: { LIVE_PPLTN_STTS: [row] } }
 *
 * 2026-08-27에 명소 3곳에서 같은 순간을 재어 `AREA_CONGEST_LVL`·
 * `AREA_PPLTN_MIN/MAX`·`PPLTN_TIME`·`REPLACE_YN`·`FCST_YN`과 예보 12칸이
 * **전부 일치**하는 것을 확인했다. 그래서 안쪽 스키마를 공유한다.
 *
 * **옛 봉투(`SeoulRtd.citydata_ppltn`) 갈래는 임시다.** 마이그레이션 도중
 * 커밋마다 스위트를 초록으로 두려고 남겨 둔 것이고, 마지막 태스크에서 지운다.
 *
 * **던지지 않는다.** 모양이 아니면 `undefined`다 — 판별과 에러 문구는
 * 호출자의 zod가 맡는다. `parseComposition`이 「절대 예외를 던지지 않는다」는
 * 약속을 지키려면 이 함수도 조용해야 한다.
 *
 * `src/data/schema.ts`가 아니라 별도 모듈인 이유: `schema.ts`가
 * `compositionSchema.ts`를 import하므로, 여기 두고 저쪽이 가져가면 순환이 된다.
 */
export function populationRows(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null) {
    return undefined
  }
  const record = payload as Record<string, unknown>

  const container = record.CITYDATA
  if (typeof container === 'object' && container !== null) {
    return (container as Record<string, unknown>).LIVE_PPLTN_STTS
  }

  return record['SeoulRtd.citydata_ppltn']
}
