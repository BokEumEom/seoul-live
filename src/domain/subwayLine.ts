/**
 * 노선 배지 한 칸. 시안 `stitch_ui_ux/_4`의 「５ 광화문역」에서 앞의 동그라미다.
 */
export interface SubwayLineBadge {
  /** 배지 안의 글자. 숫자 호선은 「3」, 이름 노선은 「공항철도」 */
  readonly label: string
  /** 노선 식별색 */
  readonly color: string
  /** 그 위에 얹을 글자색 */
  readonly ink: string
}

interface LineEntry extends SubwayLineBadge {
  /** 서울이 보내는 값 그대로. `SUB_LINE`(열차) 또는 `SUB_STN_LINE`(역)에서 온다 */
  readonly line: string
}

/**
 * **흰 글자가 관례이지만 이 앱에서는 못 쓴다.**
 *
 * 서울 지하철 노선 배지는 어디서나 흰 글자다(지도·역 표지·다른 앱). 그런데 재
 * 보면 흰 글자가 4.5:1을 넘는 노선은 **1호선과 신분당선 둘뿐**이다 —
 * 2호선 3.13, 수인분당 2.09, 경의중앙 2.06으로 사실상 안 읽힌다. 이 저장소는
 * 「선명한 색이 보기 좋다」로 고른 배지 글자색 넷이 전부 4.5:1에 못 미쳤던
 * 일을 한 번 겪었고, 그때 정한 규칙이 **눈으로 고르지 말고 숫자를 맞춘다**이다.
 *
 * 그래서 노선마다 둘 중 대비가 나오는 쪽을 적어 둔다. 값은
 * `subwayLine.test.ts`가 **다시 계산해서** 잰다.
 */
const INK_ON_LIGHT = '#000000'
const INK_ON_DARK = '#ffffff'

/**
 * 노선 식별색. **우리 배색이 아니라 서울교통공사의 자산이다.**
 *
 * 그래서 `index.css`의 `@theme`에 넣지 않는다. 저 파일은 「이 앱이 고르는 색」의
 * 정본이고 다크 모드에서 갈아 끼우는 짝이 함께 있어야 하는데, 노선색은 **밤이라고
 * 바뀌지 않는다** — 길찾기 버튼의 `brand-naver`와 같은 성질이고 저쪽도 다크
 * 면제 목록에 들어 있다. 다만 저기는 둘이라 토큰으로 감당되고 여기는 열넷이라
 * 팔레트를 통째로 뒤덮는다. 데이터로 두고 화면이 `style`로 칠한다.
 *
 * **여기 없는 노선은 색이 없다**(`subwayLineBadge`가 `null`을 준다). 이 앱이
 * 값을 모를 때 지키는 규칙 그대로다 — 틀린 색은 없는 색보다 나쁘고, 노선색은
 * 특히 그렇다(초록으로 칠한 3호선은 2호선으로 읽힌다).
 *
 * 목록은 2026-08-25 실호출 34곳에서 **실제로 나온 값**이다. 짐작으로 늘리지
 * 않는다 — 서울이 「수인분당선」이 아니라 「수인분당」을 보내는 것처럼 이름이
 * 잘려 오는 자리가 있어서, 안 본 노선의 열쇠를 지어 적으면 영영 안 맞는 줄이
 * 표에 남는다. 신림선만 예외인데 역 쪽(`SUB_STN_LINE`)에서 봤다.
 *
 * **그 신림선 줄은 2026-08-27까지 한 번도 안 그려졌다.** 파서가 열차의
 * `SUB_LINE`을 먼저 읽었는데 샛강역 열차가 「4호선」으로 오기 때문이다 — 화면에는
 * 4호선 하늘색 배지가 떠 있었다. 지금은 역이 말한 것을 먼저 읽는다.
 */
export const SUBWAY_LINES: readonly LineEntry[] = [
  { line: '1호선', label: '1', color: '#0052a4', ink: INK_ON_DARK },
  { line: '2호선', label: '2', color: '#00a84d', ink: INK_ON_LIGHT },
  { line: '3호선', label: '3', color: '#ef7c1c', ink: INK_ON_LIGHT },
  { line: '4호선', label: '4', color: '#00a5de', ink: INK_ON_LIGHT },
  { line: '5호선', label: '5', color: '#996cac', ink: INK_ON_LIGHT },
  { line: '6호선', label: '6', color: '#cd7c2f', ink: INK_ON_LIGHT },
  { line: '7호선', label: '7', color: '#747f00', ink: INK_ON_LIGHT },
  { line: '8호선', label: '8', color: '#e6186c', ink: INK_ON_LIGHT },
  { line: '9호선', label: '9', color: '#bb8336', ink: INK_ON_LIGHT },
  { line: '신분당선', label: '신분당선', color: '#d4003b', ink: INK_ON_DARK },
  { line: '공항철도', label: '공항철도', color: '#0090d2', ink: INK_ON_LIGHT },
  { line: '수인분당', label: '수인분당', color: '#f5a200', ink: INK_ON_LIGHT },
  { line: '경의중앙', label: '경의중앙', color: '#77c4a3', ink: INK_ON_LIGHT },
  { line: '신림선', label: '신림선', color: '#6789ca', ink: INK_ON_LIGHT },
]

/**
 * 「3호선」 → 동그라미에 들어갈 「3」과 그 색. 모르는 노선이면 `null`이다.
 *
 * **`label`은 옮기지 않는다.** 숫자는 언어가 없고, 「공항철도」는 역 이름과
 * 같이 로마자 표기가 이 앱에 없는 고유명사다(`i18n/subway.ts`). 화면은 배지에
 * 접근성 이름으로 `subwayLineText()`를 얹어 소리 채널에서 「Line 3」이 되게 한다.
 */
export function subwayLineBadge(line: string): SubwayLineBadge | null {
  return SUBWAY_LINES.find((entry) => entry.line === line) ?? null
}
