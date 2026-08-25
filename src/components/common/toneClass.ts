import type { CongestionTone } from '../../domain/congestion'

// Tailwind v4는 클래스명을 정적으로 추출한다. `bg-${tone}-container` 같은 동적 조합은
// 빌드에서 사라지므로 전체 클래스명을 리터럴로 적어야 한다.
//
// 혼잡도 배지(CongestionBadge)와 도시정보의 대기·주차 배지(ToneBadge)가 이 표를
// 공유한다. 표를 두 벌 두면 같은 화면에 미묘하게 다른 초록이 두 종류 생긴다.
// 컴포넌트 파일이 아니라 여기 두는 이유는 react-refresh 규칙이다 — 컴포넌트를
// export하는 파일이 상수까지 함께 export하면 빠른 새로고침이 깨진다.
// 글자색이 `text-calm`이 아니라 `text-on-calm-container`인 이유는 index.css의
// 그 토큰 주석에 한 벌 있다 — 요약하면 선명한 `--color-calm`을 옅은
// `-container` 위에 얹으면 12px 글자가 4.5:1에 못 미친다. 지도 핀·마커 알약은
// 여전히 선명한 쪽을 쓴다.
export const TONE_CLASS: Readonly<Record<CongestionTone, string>> = {
  calm: 'bg-calm-container text-on-calm-container',
  normal: 'bg-normal-container text-on-normal-container',
  busy: 'bg-busy-container text-on-busy-container',
  crowded: 'bg-crowded-container text-on-crowded-container',
}

/** 값을 모를 때. 어느 톤도 아니라는 뜻이라 색을 쓰지 않는다. */
export const NEUTRAL_TONE_CLASS = 'bg-surface-container text-on-surface-variant'

/**
 * **표면 위에 바로 얹는 글자**의 톤. 상세 히어로의 인원수와 요약 카드의 값이
 * 쓴다 — 배지처럼 옅은 상자를 깔지 않고 흰 카드에 글자만 놓는 자리다.
 *
 * `text-calm` 같은 선명한 쪽이 아니라 `-container`의 짝을 쓰는 이유는
 * `TONE_CLASS`와 같다: 선명한 값은 지도 타일 위에서 튀라고 고른 것이라 흰
 * 표면에서는 대비가 모자란다. 지금 이 넷은 흰 카드에서 7.2~9.4:1이다.
 */
export const TONE_TEXT_CLASS: Readonly<Record<CongestionTone, string>> = {
  calm: 'text-on-calm-container',
  normal: 'text-on-normal-container',
  busy: 'text-on-busy-container',
  crowded: 'text-on-crowded-container',
}

/**
 * 톤을 모르면 본문 색이다. `undefined`를 돌려주므로 부르는 쪽이 제 기본값을 쓴다.
 *
 * `SummaryGrid` 안에 사유화돼 있던 것을 2026-08-25에 여기로 올렸다 —
 * `WeatherStats`가 같은 것을 필요로 했고, **이 파일의 존재 이유가 「표를 두 벌
 * 두지 않는다」**이기 때문이다. 표만 공유하고 표를 읽는 방법을 각자 두면 같은
 * 자리가 한쪽에서는 색이 없고 한쪽에서는 검정으로 갈린다.
 */
export function toneTextClass(tone: CongestionTone | null): string | undefined {
  return tone === null ? undefined : TONE_TEXT_CLASS[tone]
}

/**
 * 「지금」을 뜻하는 작은 점. 글자가 아니라 **도형**이라 선명한 쪽을 쓴다 —
 * 12px 원은 대비 4.5:1이 아니라 3:1(WCAG 1.4.11) 기준이고, 옆에 같은 뜻을
 * 적은 문장이 있어 색이 정보를 혼자 나르지도 않는다.
 */
export const TONE_DOT_CLASS: Readonly<Record<CongestionTone, string>> = {
  calm: 'bg-calm',
  normal: 'bg-normal',
  busy: 'bg-busy',
  crowded: 'bg-crowded',
}

/**
 * 같은 점을 **primary로 채워진 칩 위**에 찍을 때. 고른 혼잡도 칩이 유일한
 * 사용처다.
 *
 * 위 선명한 톤(`--color-calm` 등)을 그대로 쓸 수 없다. 그쪽은 밝은 지도
 * 타일에서 튀라고 고른 값이라 `--color-primary`(#005bbf) 위에서는 어두운
 * 색끼리 겹친다 — `bg-calm`(#006d37)은 1.2:1로 사실상 안 보인다.
 *
 * `-container` 쪽은 넷 다 아주 밝아(L≈0.8) 파랑 위에서 5.5:1 언저리다.
 * 넷이 서로 비슷해 보이는 것은 문제가 되지 않는다 — **한 번에 하나만
 * 고를 수 있어** 이웃과 견줄 일이 없고, 등급 이름은 바로 옆에 글자로 있다.
 */
export const TONE_DOT_ON_PRIMARY_CLASS: Readonly<Record<CongestionTone, string>> = {
  calm: 'bg-calm-container',
  normal: 'bg-normal-container',
  busy: 'bg-busy-container',
  crowded: 'bg-crowded-container',
}

/**
 * 히트맵 칸처럼 **글자 없이 색만으로** 값을 말하는 자리.
 *
 * 전용 토큰(`--color-heat-*`)을 쓴다. 예전에는 `-container` 둘 + 진한 색 둘을
 * 섞어 「위 둘은 옅게, 아래 둘은 진하게」로 램프를 흉내 냈는데, 재 보니 네
 * 단계가 사실상 둘로 읽혔다 — 이웃 대비가 여유→보통 **1.02**로 명도가 오히려
 * 뒤집혀 있었다. 배지·핀과 요구가 반대라 토큰을 갈랐다(근거는 index.css).
 *
 * **색만으로 값을 전하지 마라.** 이 표를 쓰는 자리는 같은 값을 소리로도
 * 내보내야 한다(`WeeklyPatternCard`의 `sr-only` 참고).
 */
export const TONE_FILL_CLASS: Readonly<Record<CongestionTone, string>> = {
  calm: 'bg-heat-calm',
  normal: 'bg-heat-normal',
  busy: 'bg-heat-busy',
  crowded: 'bg-heat-crowded',
}

/**
 * 관측이 없는 칸.
 *
 * **채우지 않는다.** 어떤 회색을 골라도 「여유」(L 0.876)와 명도가 겹쳐
 * 다섯째 단계처럼 읽힌다 — 예전 값 `bg-surface-container-high`로 재면 여유와
 * 1.14였다. 값의 부재는 값이 아니므로 램프에 자리를 주지 않고, 채움 대신
 * 테두리라는 **다른 채널**로 말한다.
 *
 * Tailwind 프리플라이트가 `box-sizing: border-box`를 깔아 두어 1px 테두리가
 * 붙어도 칸 높이(`h-5`)는 그대로다.
 */
export const EMPTY_CELL_CLASS = 'border border-outline-variant'
