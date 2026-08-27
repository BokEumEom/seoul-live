import {
  isPopulationDirection,
  type PopulationChange,
  type PopulationTrend,
} from '../domain/populationTrend'
import { asRow, text, type Row } from './rowReaders'

/**
 * SeoulRtd `/api/ppltn`의 관대한 리더.
 *
 * **`cityInfoSchema.ts`와 같은 쪽에 선다** — 봉투만 보고 나머지는 `null`로
 * 흘려보낸다. 이유도 같다: 이 값은 인구 탭의 **부가 정보**라 한 칸이 이상할 때
 * 나머지까지 날리면 안 되고, 애초에 **문서화된 API가 아니라** 필드가 예고 없이
 * 바뀔 수 있다. 혼잡도 본체(`schema.ts`)가 엄격한 것과 반대 방향이고, 그 이유는
 * 그쪽 값이 곧 화면의 존재 이유이기 때문이다.
 *
 * 응답에는 성별·연령·거주 구성도 함께 오지만 **읽지 않는다.** 같은 값을 공식
 * API(`citydata_ppltn` → `compositionSchema.ts`)가 이미 주고 있어서, 여기서 또
 * 읽으면 같은 화면의 한 숫자에 출처가 둘이 된다.
 */

/**
 * 「7.0%」·「12%」. **`Number()`를 맨몸으로 쓰지 않는다**(AGENTS.md) —
 * `Number('0x1f')`는 31, `Number('1e1')`은 10, `Number('')`은 0이라 「없는 값」이
 * 아니라 **그럴듯한 틀린 값**이 화면에 뜬다.
 *
 * **음수를 안 받는다.** 부호는 숫자가 아니라 `UP_DOWN` 필드가 진다(실호출 30칸이
 * 전부 양수였다). 음수를 읽으면 방향과 두 번 부호가 붙어 「감소 -5%」가 된다.
 */
const PERCENT_PATTERN = /^(\d+(?:\.\d+)?)%$/

function changeOf(row: Row, prefix: string): PopulationChange {
  const direction = text(row, `${prefix}_RATE_UP_DOWN`)
  const matched = text(row, `${prefix}_RATE`).match(PERCENT_PATTERN)

  return {
    direction: isPopulationDirection(direction) ? direction : null,
    percent: matched === null ? null : Number(matched[1]),
  }
}

const EMPTY: Row = {}

/**
 * **응답이 배열이다.** 한 명소를 물어도 `[{...}]`로 온다. 배열이 아니거나 비어
 * 있으면 빈 행으로 읽어 세 칸이 모두 `null`이 된다 — 던지지 않는 이유는 위
 * 「관대한 리더」 주석에 있다.
 */
export function parsePopulationTrend(payload: unknown): PopulationTrend {
  const first = Array.isArray(payload) ? asRow(payload[0]) : null
  const row = first ?? EMPTY

  return {
    lastHour: changeOf(row, 'ONEHOUR'),
    lastThreeHours: changeOf(row, 'THREEHOUR'),
    lastMonth: changeOf(row, 'ONEMONTH'),
  }
}
