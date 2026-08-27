import {
  EMPTY_POPULATION_FLOW,
  type PopulationFlow,
  type PopulationFlowSlot,
} from '../domain/populationFlow'
import { CONGESTION_LEVELS, type CongestionLevel } from '../domain/types'
import { asRow, text, type Row } from './rowReaders'

/**
 * SeoulRtd `/api/ppltn_congest`의 관대한 리더 — 24시간 인파 흐름 25칸.
 *
 * **응답이 세로 배열이 아니라 파이프로 이은 문자열 다발이다.** 한 행 안에
 * `time_cd`·`people_value`·`before_people_value`·`congestion_label_list`가 각각
 * 「a|b|c」로 오고, **같은 자리끼리 짝**이다. 그래서 이 파일이 하는 일의 절반은
 * 그 다발을 칸으로 되돌리는 것이다.
 *
 * 관대한 이유는 `ppltnSchema.ts`와 같다 — 문서화된 API가 아니라 필드가 예고
 * 없이 바뀔 수 있고, 이 값은 인구 탭의 부가 정보다.
 */

/** 「현재」 칸의 표식. 이 글자만 시각이 아니다. */
const NOW_MARKER = '현재'

/** 「11시」·「8/28 0시」 — 날짜가 붙는 칸이 하루에 하나 있다. */
const HOUR_PATTERN = /(\d{1,2})시$/

/**
 * **`Number()`를 맨몸으로 쓰지 않는다**(AGENTS.md). 인원은 막대 높이가 되므로
 * `Number('0x1f')`=31 같은 값이 **그럴듯한 그래프**를 그린다. 음수도 안 받는다 —
 * 사람 수는 음수가 될 수 없고, 받으면 막대가 축 아래로 내려간다.
 */
const COUNT_PATTERN = /^\d+$/

function splitBundle(row: Row, key: string): readonly string[] {
  const raw = text(row, key)
  return raw === '' ? [] : raw.split('|')
}

function countAt(bundle: readonly string[], index: number): number | null {
  const raw = (bundle[index] ?? '').trim()
  return COUNT_PATTERN.test(raw) ? Number(raw) : null
}

function isCongestionLevel(value: string): value is CongestionLevel {
  return (CONGESTION_LEVELS as readonly string[]).includes(value)
}

/**
 * 시각을 잇는다. 「현재」 칸에는 글자가 없으므로 **앞칸+1**로 만든다 — 25칸이
 * 빈틈없는 한 시간 간격이라 성립한다. 앞칸이 없으면 뒷칸−1로 떨어진다.
 *
 * 24가 아니라 0으로 감는다. 「23시」 다음은 「0시」이지 「24시」가 아니다.
 */
function hoursOf(times: readonly string[]): readonly (number | null)[] {
  const parsed = times.map((label) => {
    const matched = label.trim().match(HOUR_PATTERN)
    return matched === null ? null : Number(matched[1])
  })

  return parsed.map((hour, index) => {
    if (hour !== null) {
      return hour
    }
    const before = parsed[index - 1]
    if (before !== undefined && before !== null) {
      return (before + 1) % 24
    }
    const after = parsed[index + 1]
    if (after !== undefined && after !== null) {
      return (after + 23) % 24
    }
    return null
  })
}

export function parsePopulationFlow(payload: unknown): PopulationFlow {
  const row = Array.isArray(payload) ? asRow(payload[0]) : null
  if (row === null) {
    return EMPTY_POPULATION_FLOW
  }

  const times = splitBundle(row, 'time_cd')
  const people = splitBundle(row, 'people_value')
  const usual = splitBundle(row, 'before_people_value')
  const levels = splitBundle(row, 'congestion_label_list')

  // **짧은 쪽에 맞춘다.** 필드마다 개수가 다르게 오면 짝이 어긋난 칸이 생기는데,
  // 그때 만들어지는 것은 「빈 칸」이 아니라 **다른 시각의 값이 붙은 칸**이다.
  // 평소 값은 통째로 안 올 수 있어(서울의 프런트엔드도 null 검사를 둔다) 이
  // 계산에서 뺀다 — 그것 때문에 흐름이 통째로 사라지면 안 된다.
  const length = Math.min(times.length, people.length, levels.length)
  const hours = hoursOf(times)

  const slots: PopulationFlowSlot[] = []
  for (let index = 0; index < length; index += 1) {
    const level = (levels[index] ?? '').trim()
    slots.push({
      hour: hours[index] ?? null,
      people: countAt(people, index),
      usual: countAt(usual, index),
      congestion: isCongestionLevel(level) ? level : null,
    })
  }

  const nowIndex = times.findIndex((label) => label.trim() === NOW_MARKER)

  return {
    slots,
    // 표식이 잘려 나간 칸을 가리키지 않게 길이 안쪽인지 함께 본다.
    nowIndex: nowIndex >= 0 && nowIndex < length ? nowIndex : null,
  }
}
