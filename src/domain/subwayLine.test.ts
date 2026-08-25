import { describe, expect, it } from 'vitest'
import { SUBWAY_LINES, subwayLineBadge } from './subwayLine'

/** WCAG 2.x 상대 휘도. `tokens.test.ts`와 같은 식이고, 여기 따로 적는 이유는
    저쪽이 `index.css`를 재는 도구라서다 — 이 표의 색은 index.css에 없다. */
function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

/**
 * 2026-08-25 실호출 34곳에서 실제로 나온 값 전부.
 *
 * **여기 적힌 것이 곧 계약이다.** 서울이 「수인분당선」이 아니라 **「수인분당」**을
 * 보낸다 — 표의 열쇠를 「선」이 붙은 이름으로 적으면 그 노선만 조용히 색을 잃는다.
 */
const SEEN_IN_LIVE_RESPONSES = [
  '1호선',
  '2호선',
  '3호선',
  '4호선',
  '5호선',
  '6호선',
  '7호선',
  '8호선',
  '9호선',
  '공항철도',
  '신분당선',
  '수인분당',
  '경의중앙',
] as const

describe('subwayLineBadge', () => {
  it('숫자 호선은 숫자만 적는다', () => {
    // 원 안에 들어갈 글자다. 「3호선」은 24px 원에 안 들어간다.
    expect(subwayLineBadge('3호선')?.label).toBe('3')
  })

  it('이름 노선은 이름을 그대로 적는다', () => {
    // **「선」을 붙이지 않는다.** 서울이 「수인분당」으로 보내는데 우리가 뒤에
    // 글자를 더하면 없는 이름을 만드는 것이다.
    expect(subwayLineBadge('수인분당')?.label).toBe('수인분당')
    expect(subwayLineBadge('신분당선')?.label).toBe('신분당선')
  })

  it('실호출에서 본 노선을 하나도 빠뜨리지 않는다', () => {
    const missing = SEEN_IN_LIVE_RESPONSES.filter((line) => subwayLineBadge(line) === null)

    expect(missing).toEqual([])
  })

  // **모르는 노선에 색을 지어내지 않는다.** 이 앱이 `?? null`로 지키는 규칙과
  // 같다 — 틀린 색은 없는 색보다 나쁘다. 새 노선(예: 위례선)이 열리면 여기로
  // 떨어져 화면이 옛 글자 표기로 돌아간다.
  it('모르는 노선은 배지를 만들지 않는다', () => {
    expect(subwayLineBadge('위례선')).toBeNull()
    expect(subwayLineBadge('')).toBeNull()
  })

  // 「3」이 3호선의 색으로 칠해지는지. 표를 잘못 옮기면 여기가 죽는다.
  it('호선마다 제 색을 준다', () => {
    expect(subwayLineBadge('1호선')?.color).toBe('#0052a4')
    expect(subwayLineBadge('3호선')?.color).toBe('#ef7c1c')
  })

  // **색이 겹치면 두 노선이 한 노선으로 보인다.** 옮겨 적다 한 줄을 복사해
  // 두고 값을 안 고치는 실수가 이 표에서 가장 잦다.
  it('두 노선이 같은 색을 쓰지 않는다', () => {
    const colors = SUBWAY_LINES.map((entry) => entry.color)

    expect(new Set(colors).size).toBe(colors.length)
  })

  /**
   * **흰 글자가 관례지만 대비가 안 나온다.** 재 보면 흰 글자는 1호선과
   * 신분당선에서만 4.5:1을 넘고, 2호선(3.13)·수인분당(2.09)·경의중앙(2.06)은
   * 사실상 안 읽힌다. 그래서 노선마다 검정·흰색 중 대비가 나오는 쪽을 적어 둔다.
   *
   * 여기서 대비를 **다시 계산해서** 재는 것이 요점이다 — 구현이 고른 잉크를
   * 그대로 기대값으로 적으면 어떤 값을 넣어도 통과한다.
   */
  it('모든 노선의 글자가 4.5:1을 넘는다', () => {
    const failing = SUBWAY_LINES.filter((entry) => contrast(entry.color, entry.ink) < 4.5)

    expect(failing).toEqual([])
  })
})
