import { describe, expect, it } from 'vitest'

/** `index.css`의 원문. `vitest.config.ts`의 `define`이 넣는다 — 근거는 거기 주석. */
declare const __INDEX_CSS__: string
const CSS = __INDEX_CSS__

/** `stitch_ui/seoul_flow/DESIGN.md`의 원문. 같은 경로로 들어온다. */
declare const __DESIGN_MD__: string
const DESIGN = __DESIGN_MD__

/** `src/`의 컴포넌트 원문(테스트 제외). 같은 경로로 들어온다 — 여기서
    `node:fs`를 부르면 브라우저용 tsconfig가 죽는다(vitest.config.ts 주석). */
declare const __SRC_SOURCES__: string
const SOURCES = __SRC_SOURCES__

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

// AGENTS.md의 「디자인 토큰의 출처는 `stitch_ui/seoul_flow/DESIGN.md` 하나다.
// `index.css`에서 값을 직접 고치지 말고 그 파일을 고친 뒤 옮긴다」를 기계로
// 지킨다.
//
// **손으로는 지켜지지 않았다.** 2026-08-12 감사에서 정본과 실제가 열 곳에서
// 갈려 있었다 — 캔버스 색이 본문(`#F8FAFC`)과 프론트매터(`#faf8ff`)에서 서로
// 다르고, 카드 스트로크가 코드와 달랐고, 혼잡도 4단계·`on-*-container`·히트맵
// 램프·브랜드 색 18개는 정본에 아예 없었다. 규칙이 문장으로만 있으면 이렇게 된다.
//
// 양방향으로 본다. 한쪽만 보면 반대 방향 드리프트가 그대로 산다 — 코드에만
// 토큰을 더하면 정본이 낡고, 정본에만 더하면 화면에 없는 값을 문서가 약속한다.
describe('DESIGN.md와 index.css의 색이 일치한다', () => {
  function colorsOfCss(): Map<string, string> {
    return new Map(
      [...CSS.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map(
        (found) => [found[1], found[2].toLowerCase()],
      ),
    )
  }

  function colorsOfDesign(): Map<string, string> {
    // 프론트매터(첫 `---`와 둘째 `---` 사이)의 `colors:` 블록만 본다. 본문에도
    // 색 코드가 나오므로 범위를 좁히지 않으면 설명문의 숫자까지 긁힌다.
    const front = DESIGN.split('---')[1] ?? ''
    return new Map(
      [...front.matchAll(/^ {2}([a-z0-9-]+): '(#[0-9a-fA-F]{6})'/gm)].map(
        (found) => [found[1], found[2].toLowerCase()],
      ),
    )
  }

  it('정본의 색이 전부 코드에 같은 값으로 있다', () => {
    const css = colorsOfCss()
    const missing = [...colorsOfDesign()]
      .filter(([name, value]) => css.get(name) !== value)
      .map(([name, value]) => `${name}: 정본 ${value} vs 코드 ${css.get(name)}`)

    expect(missing).toEqual([])
  })

  it('코드의 색이 전부 정본에 올라 있다', () => {
    const design = colorsOfDesign()
    const unrecorded = [...colorsOfCss()]
      .filter(([name]) => !design.has(name))
      .map(([name, value]) => `${name}: ${value}`)

    expect(unrecorded).toEqual([])
  })

  // 위 둘이 빈 배열끼리 비교하며 조용히 통과하는 것을 막는다. 정규식이 깨져
  // 양쪽 다 0개가 되면 「일치한다」가 언제나 참이 된다.
  it('양쪽에서 실제로 색을 읽어낸다', () => {
    expect(colorsOfCss().size).toBeGreaterThan(40)
    expect(colorsOfDesign().size).toBe(colorsOfCss().size)
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

  // **`on-*-container` 넷은 두 곳에서 쓰인다.** 배지 글자(위)이면서 지도 마커
  // 알약의 **배경**이다(`CongestionMarker`). 값이 같아도 되는 이유는 두 요구가
  // 어긋나지 않아서다 — 둘 다 「그 색상의 어두운 끝」을 원한다.
  //
  // 그래도 겸용은 조용한 결합이라 여기서 드러낸다. 배지 대비를 맞추려고 이
  // 색을 밝히면 알약의 흰 글자가 무너지는데, 그 사실이 코드 어디에도 안
  // 보이기 때문이다. 지금 7.09~8.31이다.
  it.each(PAIRS)('%s 마커 알약의 흰 글자가 4.5:1을 넘는다', (_level, fill) => {
    expect(contrast('#ffffff', token(fill))).toBeGreaterThanOrEqual(4.5)
  })
})

// 길찾기 버튼 둘은 상세 화면의 1차 CTA다(`ActionButtons`). 배경이 남의 브랜드
// 색이라 우리가 못 고치므로 **글자 쪽으로 맞춘다.**
//
// 네이버 녹색에 흰 글자를 얹으면 2.25:1로 무너진다(카카오는 원래 어두운 글자라
// 문제가 없었다). 브랜드 규정 안에서 쓸 수 있는 조합을 재 보니 어두운 글자가
// 답이었다 — 흰 배경에 녹색 글자로 뒤집는 길도 2.25:1로 똑같이 실패한다.
// 그 녹색 자체가 흰색과 2.25:1이라 어느 쪽으로 놓아도 같다.
//
// 브랜드 색을 컴포넌트의 raw hex가 아니라 토큰으로 둔 이유가 이것이다 —
// 여기서 재려면 한 파일에 모여 있어야 한다.
describe('길찾기 버튼 색 대비', () => {
  it.each([
    ['카카오맵', 'brand-kakao'],
    ['네이버', 'brand-naver'],
  ])('%s 버튼 글자가 4.5:1을 넘는다', (_name, brand) => {
    expect(contrast(token('on-surface'), token(brand))).toBeGreaterThanOrEqual(4.5)
  })
})

// 요일×시간 히트맵은 **글자 없이 색만으로** 네 단계를 말한다(`WeeklyPatternCard`).
// 칸마다 `sr-only`로 값을 함께 내보내지만 그건 소리 채널이고, 눈으로 읽는
// 사람에게는 색이 유일한 통로다. 아래 범례 막대도 같은 표를 쓴다.
//
// 예전 램프는 `-container` 둘 + 진한 색 둘이라 네 단계가 사실상 둘로 읽혔다.
// 이웃 대비가 여유→보통 **1.02**, 약간붐빔→붐빔 1.36이었다 — 앞의 둘은
// 명도가 같고 색상(민트/연노랑)으로만 갈렸다.
describe('히트맵 램프', () => {
  const RAMP = ['heat-calm', 'heat-normal', 'heat-busy', 'heat-crowded'] as const

  // **이쪽이 객관적인 성질이다.** 붐빌수록 어두워야 한다 — 순서를 뒤섞거나
  // 한 칸만 밝게 바꾸면 죽는다.
  it('붐빌수록 어두워진다', () => {
    const levels = RAMP.map((name) => luminance(token(name)))

    expect(levels).toEqual([...levels].toSorted((a, b) => b - a))
  })

  // **이쪽 문턱은 고른 값이다.** 순차 스케일의 이웃 간격에 대한 표준 기준은
  // 없다. 1.5는 작은 칸(20px)에서 명도 차가 눈에 띄기 시작하는 선으로 잡았고,
  // 지금 램프는 1.66~1.89다. 예전 램프의 최소값 1.02가 이 문턱에 걸린다.
  it('이웃한 두 단계가 눈으로 갈린다', () => {
    const neighbours = RAMP.slice(1).map((name, at) =>
      contrast(token(RAMP[at]), token(name)),
    )

    expect(Math.min(...neighbours)).toBeGreaterThanOrEqual(1.5)
  })
})

// ── 다크 모드 ──────────────────────────────────────────────────────────────
//
// 라이트에서 재던 것들을 밤에도 그대로 재야 한다. 다크 팔레트를 눈으로만 고르면
// 「어두우니까 대충 밝은 글자」로 끝나고, 실제로 무너지는 자리는 배지처럼 옅은
// 배경에 작은 글자가 얹히는 곳인데 그건 재 보기 전에는 안 보인다.

/** `--color-dark-<name>`. 라이트 토큰과 이름공간을 나눠 둔 이유는 index.css 주석에. */
function darkToken(name: string): string {
  return token(`dark-${name}`)
}

/** 다크 블록이 실제로 갈아 끼우는 이름 → 갈아 끼울 값의 이름. */
function darkOverrides(): Map<string, string> {
  const block = CSS.match(
    /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/,
  )
  if (block === null) {
    throw new Error('다크 모드 블록을 index.css에서 찾지 못했다')
  }
  return new Map(
    [...block[1].matchAll(/--color-([a-z0-9-]+):\s*var\(--color-dark-([a-z0-9-]+)\)/g)].map(
      (found) => [found[1], found[2]],
    ),
  )
}

describe('다크 모드 대비', () => {
  it.each([
    ['여유', 'on-calm-container', 'calm-container'],
    ['보통', 'on-normal-container', 'normal-container'],
    ['약간 붐빔', 'on-busy-container', 'busy-container'],
    ['붐빔', 'on-crowded-container', 'crowded-container'],
  ] as const)('%s 배지가 4.5:1을 넘는다', (_level, fg, bg) => {
    expect(contrast(darkToken(fg), darkToken(bg))).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['본문', 'on-surface', 'surface'],
    ['본문(카드 위)', 'on-surface', 'surface-container-lowest'],
    ['보조 글자', 'on-surface-variant', 'surface-container-lowest'],
    // 12px 글자에 쓰이므로 large text 완화가 없다 — 라이트와 같은 이유다.
    ['작은 글자', 'outline', 'surface-container-lowest'],
    ['강조', 'primary', 'surface-container-lowest'],
    ['버튼 글자', 'on-primary', 'primary'],
    ['보조 상자 위 강조', 'primary', 'secondary-container'],
  ] as const)('%s가 4.5:1을 넘는다', (_what, fg, bg) => {
    expect(contrast(darkToken(fg), darkToken(bg))).toBeGreaterThanOrEqual(4.5)
  })
})

// 라이트에서는 붐빌수록 **어두워**진다. 다크에서 같은 방향으로 가면 「붐빔」이
// 배경(#16120c)에 잠겨 사라진다 — 그래서 방향이 뒤집힌다. 방향만 뒤집고 간격
// 기준은 그대로 둔다(1.5는 20px 칸에서 명도 차가 눈에 띄기 시작하는 선).
describe('다크 히트맵 램프', () => {
  const RAMP = ['heat-calm', 'heat-normal', 'heat-busy', 'heat-crowded'] as const

  it('붐빌수록 밝아진다', () => {
    const levels = RAMP.map((name) => luminance(darkToken(name)))

    expect(levels).toEqual([...levels].toSorted((a, b) => a - b))
  })

  it('이웃한 두 단계가 눈으로 갈린다', () => {
    const neighbours = RAMP.slice(1).map((name, at) =>
      contrast(darkToken(RAMP[at]), darkToken(name)),
    )

    expect(Math.min(...neighbours)).toBeGreaterThanOrEqual(1.5)
  })

  // 가장 옅은 칸도 카드 배경에서 보여야 한다. 라이트의 `heat-calm`(#d1fae5)은
  // 흰 카드와 1.13이라 거의 안 보이는데, 그건 「여유」가 눈에 안 띄어도 되는
  // 값이라 넘어간 것이다. 다크에서는 배경이 거의 검정이라 그 여유가 없다.
  it('가장 옅은 칸도 카드에서 보인다', () => {
    expect(
      contrast(darkToken('heat-calm'), darkToken('surface-container-lowest')),
    ).toBeGreaterThanOrEqual(1.5)
  })
})

// **이 테스트가 다크 모드의 완결성을 잠근다.** 화면 어딘가에서 쓰는 색인데
// 다크 블록에 없으면, 밤에 그 자리만 라이트 값이 남아 배경과 뭉개진다 —
// 새 색을 쓰기 시작할 때 가장 조용히 빠지는 자리라 사람이 기억할 일이 아니다.
describe('다크 모드 완결성', () => {
  /** 브랜드 배경과 그 위의 글자. 남의 자산이라 밤이라고 바꿀 수 없다. */
  const EXEMPT: ReadonlySet<string> = new Set(['brand-kakao', 'brand-naver', 'brand-ink'])

  const UTILITIES = [
    'bg',
    'text',
    'border',
    'ring',
    'fill',
    'stroke',
    'outline',
    'divide',
    'from',
    'via',
    'to',
    'shadow',
    'accent',
    'caret',
    'decoration',
  ] as const

  /** `src/`에서 실제로 쓰이는 색 토큰 이름. 테스트 파일은 세지 않는다. */
  function usedColorTokens(): readonly string[] {
    const sources = SOURCES
    const defined = [...CSS.matchAll(/--color-([a-z0-9-]+):\s*#/g)]
      .map((found) => found[1])
      .filter((name) => !name.startsWith('dark-'))

    return defined.filter((name) =>
      // 뒤에 다른 글자가 붙지 않는 것만 센다 — 안 그러면 `bg-surface`가
      // `bg-surface-container`에도 걸려 쓰지 않는 토큰이 쓰인 것으로 잡힌다.
      new RegExp(`\\b(?:${UTILITIES.join('|')})-${name}(?![a-z0-9-])`).test(sources),
    )
  }

  it('화면에서 쓰는 색은 전부 다크 값을 갖는다', () => {
    const overridden = darkOverrides()
    const missing = usedColorTokens().filter(
      (name) => !EXEMPT.has(name) && !overridden.has(name),
    )

    expect(missing).toEqual([])
  })

  it('다크에서 갈아 끼우는 값은 전부 실제로 정의돼 있다', () => {
    const undefinedTargets = [...darkOverrides().values()].filter((target) => {
      try {
        darkToken(target)
        return false
      } catch {
        return true
      }
    })

    expect(undefinedTargets).toEqual([])
  })

  // 위 둘이 빈 배열끼리 비교하며 조용히 통과하는 것을 막는다. 소스를 못 읽거나
  // 정규식이 깨지면 「전부 갖췄다」가 언제나 참이 된다.
  it('양쪽에서 실제로 이름을 읽어낸다', () => {
    expect(usedColorTokens().length).toBeGreaterThan(20)
    expect(darkOverrides().size).toBeGreaterThan(20)
  })

  // 브랜드 버튼 글자는 밤에도 안 바뀌어야 한다. 바뀌면 카카오 노랑 위에 크림
  // 글자가 얹혀 1.2:1로 사라진다 — 배경을 못 바꾸니 글자도 못 바꾼다.
  it('브랜드 글자색은 다크에서 갈아 끼우지 않는다', () => {
    expect(darkOverrides().has('brand-ink')).toBe(false)
    expect(contrast(token('brand-ink'), token('brand-kakao'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token('brand-ink'), token('brand-naver'))).toBeGreaterThanOrEqual(4.5)
  })
})
