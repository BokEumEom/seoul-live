import { describe, expect, it } from 'vitest'

/** `index.css`의 원문. `vitest.config.ts`의 `define`이 넣는다 — 근거는 거기 주석. */
declare const __INDEX_CSS__: string
const CSS = __INDEX_CSS__

// `@theme` 블록에서 색 토큰을 읽는다. **값을 여기에 리터럴로 옮겨 적지 않는다** —
// 그러면 색을 고칠 때 테스트도 같이 고치게 되어 아무것도 못 죽인다. 파일에서
// 읽어 계산하므로 누가 대비를 되돌리면 여기서 죽는다(되돌려 확인했다).
function token(name: string): string {
  const found = CSS.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (found === null) {
    throw new Error(`--color-${name} 토큰을 index.css에서 찾지 못했다`)
  }
  return found[1]
}

/** WCAG 2.x 상대 휘도. sRGB 감마를 편 뒤 가중합한다. */
function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map((value) =>
      value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    )
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].toSorted((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

// 계산이 맞는지부터 잠근다. 아래 단언들이 전부 이 함수 위에 서 있어서, 여기가
// 조용히 틀리면 대비를 재는 척하는 테스트가 된다 — 흑백 21:1과 동일색 1:1은
// 명세가 고정한 두 끝값이다.
describe('contrast()', () => {
  it('명세가 고정한 두 끝값을 낸다', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 2)
    expect(contrast('#4a7f2c', '#4a7f2c')).toBeCloseTo(1, 5)
  })

  it('순서를 바꿔도 같은 값이다', () => {
    expect(contrast('#004ac6', '#ffffff')).toBeCloseTo(
      contrast('#ffffff', '#004ac6'),
      5,
    )
  })
})

// 혼잡도 배지(`CongestionBadge`)와 대기·주차 배지(`ToneBadge`)가 쓰는 짝이다.
// `toneClass.ts`의 `TONE_CLASS`가 이 조합을 만든다 — 그 표를 고치면 여기 짝도
// 함께 고쳐야 하고, 그게 이 테스트가 지키려는 것이다.
//
// 4.5:1인 이유: 글자가 `text-label-sm`(12px/600)이라 WCAG의 "large text"
// (18.66px 이상 굵은 글씨) 완화에 해당하지 않는다. DESIGN.md도 "minimum
// contrast ratio of 4.5:1 for all body text against card backgrounds"를 못박는다.
//
// 이 단언을 처음 붙였을 때 네 짝이 모두 미달이었다 — 여유 3.32, 보통 2.86,
// 약간 붐빔 3.11, 붐빔 3.95. 보통은 비텍스트 기준 3:1조차 못 넘겼다.
describe('혼잡도 배지 색 대비', () => {
  const PAIRS = [
    ['여유', 'on-calm-container', 'calm-container'],
    ['보통', 'on-normal-container', 'normal-container'],
    ['약간 붐빔', 'on-busy-container', 'busy-container'],
    ['붐빔', 'on-crowded-container', 'crowded-container'],
  ] as const

  it.each(PAIRS)('%s 배지가 4.5:1을 넘는다', (_level, fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5)
  })
})
