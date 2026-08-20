import { describe, expect, it } from 'vitest'

/** `index.css`의 원문. `vitest.config.ts`의 `define`이 넣는다 — 근거는 거기 주석. */
declare const __INDEX_CSS__: string
const CSS = __INDEX_CSS__

/**
 * 디자인 토큰 정본(`docs/DESIGN.md`)의 원문. 같은 경로로 들어온다.
 *
 * **없으면 빈 문자열이다.** 옛 정본이 있던 `stitch_ui/`가 2026-08-20에
 * 지워졌고(새 디자인을 넣기로 했다), 그때 이 값이 파일을 직통으로 읽고 있어서
 * **테스트 스위트가 시작조차 못 했다.** 지금은 `vitest.config.ts`가 없으면 빈
 * 문자열을 준다 — 아래 대조가 그 상태를 알아보고 시끄럽게 비켜선다.
 */
declare const __DESIGN_MD__: string
const DESIGN = __DESIGN_MD__

/** 정본이 지금 저장소에 있나. */
const HAS_DESIGN_SOURCE = DESIGN.trim() !== ''

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
  // **정본이 없으면 대조할 것이 없다.** 그렇다고 describe를 통째로 지우면
  // 「검사가 있었다」는 사실까지 사라진다 — 이 저장소는 그 규칙이 문장으로만
  // 있던 동안 실제로 열 곳이 갈렸던 곳이다(2026-08-12 감사).
  //
  // 그래서 **매 실행마다 한 줄로 상태를 적는다.** 테스트 이름이 곧 알림이다.
  // 새 디자인이 `docs/DESIGN.md`로 들어오는 순간 아래 대조가 되살아난다.
  if (!HAS_DESIGN_SOURCE) {
    it('정본(docs/DESIGN.md)이 아직 없어 색 대조를 건너뛴다', () => {
      expect(DESIGN).toBe('')
      // 정본이 없어도 **코드 쪽은 여전히 읽혀야 한다.** 이게 0이면 정본이
      // 없는 게 아니라 정규식이나 주입이 깨진 것이다.
      expect(colorsOfCss().size).toBeGreaterThan(40)
    })
    return
  }

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

// 길찾기 버튼 셋은 이제 **같은 중립 상자**다. 브랜드 색은 아이콘 한 글리프에만
// 들어간다(`MapLinkButtons`) — 그래서 여기서 재는 것이 바뀌었다.
//
// **예전에는 「브랜드 배경 위의 글자」를 쟀다.** 카카오 노랑·네이버 초록을
// 배경에 칠했기 때문이다. 네이버 초록에 흰 글자는 2.25:1로 무너지고 흰 배경에
// 초록 글자로 뒤집어도 같은 2.25:1이라(그 초록 자체가 흰색과 2.25:1이다) 어두운
// 글자가 유일한 답이었고, 그걸 `--color-brand-ink`로 박아 뒀다. 배경이 우리
// 토큰으로 돌아오면서 그 제약이 사라졌다 — 글자는 `text-on-surface`이므로
// 아래 표면 대비 검사가 이미 덮고, `brand-ink`는 지웠다.
//
// **대신 반대쪽 함정이 생겼다: 배경으로 멀쩡하던 색이 전경에서 무너진다.**
// 카카오 노랑(`#fee500`)을 흰 표면 위 아이콘으로 놓으면 1.28:1이라 통째로
// 사라진다. 배경일 때는 「어두운 글자를 얹으면 된다」로 풀리던 문제가, 전경이
// 되는 순간 색 자체를 바꾸는 것 말고 길이 없어진 것이다.
//
// **그래서 4.5:1이 아니라 3:1을 잰다.** 라벨이 「카카오맵」이라 적혀 있어 색은
// 정보를 나르지 않는다 — WCAG 1.4.1이 금지하는 「색만으로 전하기」가 아니고,
// 1.4.11(비텍스트 3:1)도 색이 **의미를 지닐 때** 걸리는 조항이다. 여기 3:1은
// 규정이 아니라 우리가 고른 바다: **훑을 때 단서로 쓰이려면 일단 보여야 한다.**
describe('길찾기 버튼 아이콘 색', () => {
  // 상자는 셋 다 `surface-container-lowest`다(`MapLinkButtons`의 `ACTION_BASE`).
  // 표면 토큰을 바꾸면 이 검사가 함께 움직인다 — 그게 이 검사의 값어치다.
  const LIGHT = 'surface-container-lowest'

  // **이 토큰이 존재하는 이유가 이 검사다.** 진짜 카카오 노랑을 되돌려 놓으면
  // 밝은 쪽이 1.28:1로 죽는다(되돌려 확인했다).
  it.each([
    ['밝은 표면', () => contrast(token('brand-kakao-ink'), token(LIGHT))],
    ['어두운 표면', () => contrast(token('brand-kakao-ink'), darkToken(LIGHT))],
  ] as const)('카카오 아이콘이 %s에서 3:1을 넘는다', (_where, measure) => {
    expect(measure()).toBeGreaterThanOrEqual(3)
  })

  // **네이버는 밝은 표면에서 3:1을 못 넘는다. 알고 두는 것이다** — 2.25:1은
  // 「초록이구나」가 읽히는 값이고, 1.28:1의 노랑과 다르다. 실제 브랜드 값을
  // 그대로 두는 쪽을 골랐으므로 여기서는 **지금보다 나빠지지 않는 것**만 잠근다.
  // 이 값이 흔들린다면 그건 네이버가 아니라 표면 토큰이 바뀐 것이다.
  it('네이버 아이콘이 지금보다 나빠지지 않는다', () => {
    expect(contrast(token('brand-naver'), token(LIGHT))).toBeGreaterThanOrEqual(2.2)
    expect(contrast(token('brand-naver'), darkToken(LIGHT))).toBeGreaterThanOrEqual(3)
  })

  // 위 둘이 「같은 색 하나를 두 번 재는」 것으로 통과하는 것을 막는다. 아이콘
  // 색은 보이기만 하면 되는 게 아니라 **어느 앱인지를 가리켜야** 한다.
  // (색상이 실제로 갈리는지는 대비로 못 잰다 — 여기서 잠그는 것은 값이 서로
  // 다르다는 사실뿐이고, 「노랑」·「초록」인지는 사람이 봐야 한다.)
  it('두 색이 같은 값이 아니다', () => {
    expect(token('brand-kakao-ink')).not.toBe(token('brand-naver'))
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
  const block = CSS.match(/:root\[data-theme='dark'\]\s*\{([^}]*)\}/)
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
  /**
   * 길찾기 아이콘의 브랜드 색. 그 색이 곧 「카카오」·「네이버」라는 단서라
   * 밤이라고 갈아 끼우면 단서 노릇을 못 한다. 그래도 되는 이유는 둘 다 어두운
   * 표면에서 더 잘 보이기 때문이고, 그 값은 위 「길찾기 버튼 아이콘 색」이 잰다.
   */
  const EXEMPT: ReadonlySet<string> = new Set(['brand-kakao-ink', 'brand-naver'])

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

  // **위 EXEMPT가 진짜로 필요한 상태인지 여기서 다시 확인한다.** 면제 목록은
  // 한 번 적어 두면 늙는다 — 누가 다크 값을 나중에 넣으면 면제가 거짓말이 되고,
  // 그때는 아이콘 색이 밤에 갈리면서 「그 색이 곧 브랜드」라는 전제가 깨진다.
  it.each(['brand-kakao-ink', 'brand-naver'])(
    '%s는 다크에서 갈아 끼우지 않는다',
    (name) => {
      expect(darkOverrides().has(name)).toBe(false)
    },
  )
})
