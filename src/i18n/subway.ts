import { t } from './t'

// 지하철 도착 절의 글자를 영어로 옮긴다.
//
// **왜 여기만 별도 파일인가.** 이 절의 값은 서울 API가 주는 자유 문자열이라
// 사전에 통째로 넣을 수 없다 — 「9분 후 (동대입구)」는 값이 바뀔 때마다 새
// 키가 된다. 그렇다고 통째로 두면 절 머리만 영어이고 안쪽이 전부 한국어라
// **번역하지 않은 화면처럼 읽힌다**(사용자가 실제로 그렇게 지적했다).
//
// **파싱하되 짐작하지 않는다.** 도메인은 이 필드를 파싱하지 않기로 했는데
// (`domain/cityInfo.ts`의 `SubwayArrival.message`), 그건 「분」을 숫자로 뽑아
// **정렬하거나 색을 붙이는** 것을 막는 규칙이다. 여기서 하는 일은 다르다 —
// 아는 모양이 **통째로** 맞을 때만 옮기고, 아니면 원문을 그대로 돌려준다.
// 그래서 실패해도 「틀린 영어」가 아니라 「한국어」다.
//
// **역 이름은 한국어로 남는다.** 서울 지하철 역명의 로마자 표기는 이 앱에
// 없는 데이터다. 지어내면 틀린 것을 확인할 방법이 없으므로(테스트가 못 잡는다)
// 주차장·대여소·행사 이름과 같이 그대로 둔다.

/** 「3호선」. 숫자가 아닌 노선(경의중앙선·신분당선)은 로마자 표기가 없어 그대로 둔다. */
const NUMBERED_LINE = /^(\d+)호선$/

/** 「대화행」 → 「To 대화」. 역 이름은 안 건드린다. */
const BOUND_FOR = /^(.+)행$/

/**
 * **「행」으로 끝나지만 행선지가 아닌 것들.**
 *
 * `상행`·`하행`은 「위쪽으로 가는 방향」이지 「상역으로 간다」가 아니다.
 * 이걸 거르지 않으면 `BOUND_FOR`가 잡아 **「To 상」이라는 없는 말**을 만든다 —
 * 처음 짤 때 실제로 그렇게 만들었고, 테스트에 그 결과를 기대값으로 적기까지 했다.
 *
 * 옮기지 않고 **한국어로 흘려보낸다.** `Upbound`/`Downbound`가 맞는 말일
 * 가능성이 높지만 실응답에서 이 값을 본 적이 없고, 틀려도 확인할 방법이 없다.
 * 지어낸 영어보다 한국어가 낫다는 이 파일의 규칙 그대로다.
 */
const NOT_A_DESTINATION: ReadonlySet<string> = new Set(['상행', '하행'])

/** 「9분 후 (동대입구)」·「9분 후」. 괄호는 원문 그대로 뒤에 붙인다. */
const MINUTES = /^(\d+)분 후(?: (\(.+\)))?$/

/** 「4분 30초 후 (무악재)」 */
const MINUTES_SECONDS = /^(\d+)분 (\d+)초 후(?: (\(.+\)))?$/

/** 「[24]번째 전역 (수원)」 */
const STATIONS_AWAY = /^\[(\d+)\]번째 전역(?: (\(.+\)))?$/

/** 괄호가 없을 때 자리를 빈 문자열로 채우면 「in 9 min 」처럼 꼬리 공백이 남는다. */
function withPlace(body: string, place: string | undefined): string {
  return place === undefined ? body : `${body} ${place}`
}

export function subwayLineText(line: string): string {
  const matched = line.match(NUMBERED_LINE)
  return matched === null ? line : t('{번호}호선', { 번호: matched[1] })
}

export function subwayDirectionText(direction: string): string {
  if (NOT_A_DESTINATION.has(direction)) {
    return direction
  }
  const matched = direction.match(BOUND_FOR)
  return matched === null ? direction : t('{역}행', { 역: matched[1] })
}

export function subwayArrivalText(message: string): string {
  if (message === '전역 출발') {
    return t('전역 출발')
  }
  if (message === '전역 도착') {
    return t('전역 도착')
  }

  const seconds = message.match(MINUTES_SECONDS)
  if (seconds !== null) {
    return withPlace(
      t('{분}분 {초}초 후', { 분: seconds[1], 초: seconds[2] }),
      seconds[3],
    )
  }

  const minutes = message.match(MINUTES)
  if (minutes !== null) {
    return withPlace(t('{분}분 후', { 분: minutes[1] }), minutes[2])
  }

  const away = message.match(STATIONS_AWAY)
  if (away !== null) {
    return withPlace(t('[{순번}]번째 전역', { 순번: away[1] }), away[2])
  }

  // 처음 보는 문구. **손대지 않는다.**
  return message
}
